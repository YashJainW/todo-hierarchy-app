import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, IconButton, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDashboardTasks } from "../../hooks/queries/useTodosQueries";
import { useUpdateTodoMutation } from "../../hooks/mutations/useTodoMutations";
import { useDeleteTodoMutation } from "../../hooks/mutations/useTodoMutations";
import TaskGroup from "../../components/todos/TaskGroup";
import { buildTaskTree } from "../../utils/taskHierarchy";
import { startOfDay, isBefore, format } from "date-fns";
import { logger } from "../../utils/logger";

const TaskHistoryScreen = () => {
  const navigation = useNavigation();
  const { data: tasks = [], isLoading, error, refetch } = useDashboardTasks();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const [menuVisible, setMenuVisible] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [visibleDaysCount, setVisibleDaysCount] = useState(5); // Initial days to show (5 days)
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Get today's date (at start of day for comparison)
  const today = useMemo(() => startOfDay(new Date()), []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Get all ancestor IDs of a task (parents, grandparents, etc.)
  const getAncestorIds = (task, allTasks) => {
    const ancestorIds = new Set();
    let currentTask = task;

    while (currentTask) {
      const parentId = currentTask.parent_id || currentTask.parent_todo_id;
      if (!parentId) break;

      const parent = allTasks.find(
        (t) => t.id === parentId || t.id?.toString() === parentId?.toString()
      );
      if (!parent) break;

      ancestorIds.add(parent.id?.toString() || parent.id);
      currentTask = parent;
    }

    return ancestorIds;
  };

  // Group completed tasks by completion day
  const historyByDay = useMemo(() => {
    logger.debug("Building task history by day", {
      taskCount: tasks?.length || 0,
      isLoading,
    });

    if (isLoading) {
      logger.debug("Still loading, returning empty array for history");
      return [];
    }

    if (!tasks || tasks.length === 0) {
      logger.debug("No tasks available for history building");
      return [];
    }

    try {
      // Filter: completed tasks with due_date older than today
      const completedTasks = tasks.filter((task) => {
        if (task.state !== "completed") return false;
        if (!task.due_date) return false;

        const dueDate = startOfDay(new Date(task.due_date));
        return isBefore(dueDate, today);
      });

      if (completedTasks.length === 0) {
        logger.debug("No completed tasks with due date before today");
        return [];
      }

      logger.debug("Found completed tasks", { count: completedTasks.length });

      // Group by due_date (not completion date)
      const tasksByDay = {};

      completedTasks.forEach((task) => {
        // Group by due_date
        if (!task.due_date) {
          logger.debug("Skipping task without due_date", {
            taskId: task.id,
            taskName: task.task_name,
          });
          return;
        }

        const dueDate = startOfDay(new Date(task.due_date));
        const dayKey = dueDate.toISOString();

        if (!tasksByDay[dayKey]) {
          tasksByDay[dayKey] = {
            date: dueDate,
            tasks: [],
          };
        }

        tasksByDay[dayKey].tasks.push(task);
      });

      // Convert to array and sort by date (newest first - latest due dates first)
      const historyDays = Object.values(tasksByDay).sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      logger.debug("Grouped tasks by due_date day", {
        totalDays: historyDays.length,
        totalTasksGrouped: Object.values(tasksByDay).reduce(
          (sum, day) => sum + day.tasks.length,
          0
        ),
        tasksWithoutDueDate:
          completedTasks.length -
          Object.values(tasksByDay).reduce(
            (sum, day) => sum + day.tasks.length,
            0
          ),
      });

      // For each day, build task trees
      const result = historyDays.map((dayData) => {
        // Include all ancestors of completed tasks for this day
        const ancestorIds = new Set();
        dayData.tasks.forEach((task) => {
          const ancestors = getAncestorIds(task, tasks);
          ancestors.forEach((id) => ancestorIds.add(id));
        });

        // Filter tasks to include: all completed tasks for this day and their ancestors
        const allTaskIds = new Set([
          ...dayData.tasks.map((t) => t.id?.toString() || t.id),
          ...Array.from(ancestorIds),
        ]);

        const filteredTasks = tasks.filter((task) => {
          const taskId = task.id?.toString() || task.id;
          return allTaskIds.has(taskId);
        });

        // Build task tree for this day
        const tree = buildTaskTree(filteredTasks);
        const taskGroups = Array.isArray(tree) ? tree : [];

        return {
          date: dayData.date,
          taskGroups,
        };
      });

      logger.debug("Task history by day result", {
        dayCount: result.length,
        totalTaskGroups: result.reduce(
          (sum, day) => sum + day.taskGroups.length,
          0
        ),
      });

      return result;
    } catch (error) {
      logger.error("Error building task history by day", {
        message: error.message,
        stack: error.stack,
      });
      return [];
    }
  }, [tasks, isLoading, today]);

  const formatDayHeader = (date) => {
    return format(date, "MMM dd, yyyy");
  };

  // Get visible days based on pagination
  const visibleDays = useMemo(() => {
    return historyByDay.slice(0, visibleDaysCount);
  }, [historyByDay, visibleDaysCount]);

  const hasMoreDays = historyByDay.length > visibleDaysCount;

  const handleShowOlderTasks = () => {
    setVisibleDaysCount((prev) => prev + 5); // Show 5 more older days
  };

  const handleToggleComplete = (todo) => {
    // Allow unchecking completed tasks in history
    // Tasks in history are completed, so unchecking them marks them as not_started
    if (todo.state === "completed") {
      updateTodoMutation.mutate({
        id: todo.id,
        updates: { state: "not_started" },
      });
    }
  };

  const handleEdit = () => {
    // No edit in history
  };

  const handleDelete = (todo) => {
    deleteTodoMutation.mutate({ id: todo.id, showAlert: true });
  };

  const handleMenuToggle = (taskId, visible) => {
    setMenuVisible((prev) => ({ ...prev, [taskId]: visible }));
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "#f44336";
      case "medium":
        return "#ff9800";
      case "low":
        return "#4caf50";
      default:
        return "#757575";
    }
  };

  const renderDaySection = ({ item }) => {
    if (!item || !item.taskGroups || item.taskGroups.length === 0) {
      return null;
    }

    return (
      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>{formatDayHeader(item.date)}</Text>
        </View>
        {item.taskGroups.map((rootTask) => (
          <TaskGroup
            key={rootTask.id}
            rootTask={rootTask}
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
            menuVisible={menuVisible}
            onMenuToggle={handleMenuToggle}
            getPriorityColor={getPriorityColor}
            expandAllByDefault={true}
            showEditOption={false}
            showDeleteOption={true}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <LinearGradient
        colors={["#3B1CB0", "#5A2DFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#FFFFFF"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>Task History</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      {/* Clear Completed Button under header */}
      <View style={styles.clearBar}>
        <TouchableOpacity
          onPress={() => {
            // Placeholder – functionality will be implemented in a future feature
            logger.debug("Clear All Completed Tasks pressed");
            setConfirmClearVisible(true);
          }}
          activeOpacity={0.7}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>Clear All Completed Tasks</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      {confirmClearVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete completed task groups?</Text>
            <Text style={styles.modalSubtitle}>
              This will delete all task groups where every task is completed.
              Groups containing any incomplete task will be kept.
            </Text>
            {isClearing && (
              <View style={styles.modalLoadingRow}>
                <ActivityIndicator size="small" color="#6200ee" />
                <Text style={styles.modalLoadingText}>Deleting...</Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setConfirmClearVisible(false)}
                style={[styles.modalButton, styles.modalCancelButton]}
                activeOpacity={0.8}
                disabled={isClearing}
              >
                <Text style={[styles.modalButtonText, styles.modalCancelText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setIsClearing(true);
                    // Verify completeness against FULL dataset with normalized string IDs
                    const toId = (val) =>
                      val !== null && val !== undefined ? String(val) : null;
                    const idToTask = new Map();
                    const idToChildren = new Map();
                    const idToParent = new Map();
                    (tasks || []).forEach((t) => {
                      const idStr = toId(t?.id);
                      if (!idStr) return;
                      idToTask.set(idStr, t);
                      idToChildren.set(idStr, []);
                    });
                    (tasks || []).forEach((t) => {
                      const idStr = toId(t?.id);
                      const parentStr =
                        toId(t?.parent_id) || toId(t?.parent_todo_id);
                      if (!idStr || !parentStr) return;
                      if (!idToChildren.has(parentStr))
                        idToChildren.set(parentStr, []);
                      idToChildren.get(parentStr).push(idStr);
                      idToParent.set(idStr, parentStr);
                    });

                    const areAllLeafDescendantsCompleted = (rootIdRaw) => {
                      const rootId = toId(rootIdRaw);
                      if (!rootId || !idToTask.has(rootId)) return false;
                      const stack = [rootId];
                      while (stack.length > 0) {
                        const currentId = stack.pop();
                        const children = idToChildren.get(currentId) || [];
                        if (children.length === 0) {
                          const leafTask = idToTask.get(currentId);
                          if (!leafTask || leafTask.state !== "completed")
                            return false;
                        } else {
                          for (const childId of children) stack.push(childId);
                        }
                      }
                      return true;
                    };

                    // Collect ALL completed overdue tasks as candidates (not just roots from history)
                    // This ensures intermediate parents (monthly/weekly) are also considered
                    const candidateTaskIds = new Set();
                    (tasks || []).forEach((t) => {
                      if (t.state !== "completed" || !t.due_date) return;
                      const due = startOfDay(new Date(t.due_date));
                      if (isBefore(due, today)) {
                        const idStr = toId(t?.id);
                        if (idStr) candidateTaskIds.add(idStr);
                      }
                    });

                    // Mark all candidates whose leaf descendants are completed
                    const completedCandidateIds = new Set(
                      Array.from(candidateTaskIds).filter((rootId) =>
                        areAllLeafDescendantsCompleted(rootId)
                      )
                    );

                    // Keep only TOP-MOST completed nodes (no ancestor in the set)
                    const hasAncestorInSet = (idStr, set) => {
                      let current = idToParent.get(idStr);
                      while (current) {
                        if (set.has(current)) return true;
                        current = idToParent.get(current);
                      }
                      return false;
                    };
                    const fullyCompletedRootIds = Array.from(
                      completedCandidateIds
                    ).filter(
                      (idStr) => !hasAncestorInSet(idStr, completedCandidateIds)
                    );

                    logger.debug(
                      "Fully completed roots (verified against full tree with normalized ids)",
                      { count: fullyCompletedRootIds.length }
                    );

                    // Collect all descendants of fully completed roots to delete them all
                    const getAllDescendantIds = (rootIdStr) => {
                      const descendantIds = new Set([rootIdStr]);
                      const stack = [rootIdStr];
                      while (stack.length > 0) {
                        const currentId = stack.pop();
                        const children = idToChildren.get(currentId) || [];
                        children.forEach((childId) => {
                          descendantIds.add(childId);
                          stack.push(childId);
                        });
                      }
                      return Array.from(descendantIds);
                    };

                    // Get all task IDs to delete (roots + all their descendants)
                    const allTaskIdsToDelete = new Set();
                    fullyCompletedRootIds.forEach((rootIdStr) => {
                      const descendantIds = getAllDescendantIds(rootIdStr);
                      descendantIds.forEach((id) => allTaskIdsToDelete.add(id));
                    });

                    logger.debug("Tasks to delete (roots + descendants)", {
                      rootCount: fullyCompletedRootIds.length,
                      totalTaskCount: allTaskIdsToDelete.size,
                    });

                    const deletionPromises = Array.from(allTaskIdsToDelete).map(
                      (idStr) => {
                        const originalId = idToTask.get(idStr)?.id ?? idStr;
                        return deleteTodoMutation
                          .mutateAsync({ id: originalId, showAlert: false })
                          .catch((e) => {
                            logger.error("Failed to delete task", {
                              id: idStr,
                              message: e?.message,
                            });
                          });
                      }
                    );
                    await Promise.allSettled(deletionPromises);
                  } finally {
                    setIsClearing(false);
                    setConfirmClearVisible(false);
                  }
                }}
                style={[styles.modalButton, styles.modalDeleteButton]}
                activeOpacity={0.8}
                disabled={isClearing}
              >
                {isClearing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : historyByDay.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="history"
              size={64}
              color="#C5BFF3"
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>No Task History</Text>
            <Text style={styles.emptySubtext}>
              Completed tasks with due dates before today will appear here
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={visibleDays}
          renderItem={renderDaySection}
          keyExtractor={(item, index) =>
            `day-${item.date.toISOString()}-${index}`
          }
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6200ee"
            />
          }
          ListFooterComponent={
            hasMoreDays ? (
              <View style={styles.showMoreContainer}>
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={handleShowOlderTasks}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.showMoreIcon}
                  />
                  <Text style={styles.showMoreText}>Show older tasks</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Quicksand-Bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  clearBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F5F5F5",
  },
  clearButton: {
    backgroundColor: "#3B1CB0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Quicksand-SemiBold",
    textAlign: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    elevation: 10000,
    pointerEvents: "auto",
  },
  modalContainer: {
    width: "88%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
    color: "#000",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#666",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#6200ee",
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelButton: {
    backgroundColor: "#EEEEEE",
  },
  modalDeleteButton: {
    backgroundColor: "#B00020",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Quicksand-SemiBold",
  },
  modalCancelText: {
    color: "#333333",
  },
  content: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  contentContainer: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    color: "#666",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#ffebee",
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    fontFamily: "Quicksand-Regular",
    color: "#B00020",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: "Quicksand-SemiBold",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  daySection: {
    marginBottom: 24,
  },
  dayHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  dayHeaderText: {
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
    color: "#3B1CB0",
  },
  showMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B1CB0",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  showMoreIcon: {
    marginRight: 8,
  },
  showMoreText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Quicksand-SemiBold",
  },
});

export default TaskHistoryScreen;
