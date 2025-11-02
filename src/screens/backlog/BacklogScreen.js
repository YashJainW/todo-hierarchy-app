import React, { useState, useMemo } from "react";
import {
  FlatList,
  View,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDashboardTasks } from "../../hooks/queries/useTodosQueries";
import {
  useUpdateTodoMutation,
  useDeleteTodoMutation,
} from "../../hooks/mutations/useTodoMutations";
import TodoFormModal from "../../components/todos/TodoFormModal";
import TaskGroup from "../../components/todos/TaskGroup";
import { buildTaskTree } from "../../utils/taskHierarchy";
import { startOfDay, isBefore } from "date-fns";
import { logger } from "../../utils/logger";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const BacklogScreen = () => {
  const navigation = useNavigation();
  const { data: tasks = [], isLoading, error, refetch } = useDashboardTasks();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});
  const [visibleTaskGroupsCount, setVisibleTaskGroupsCount] = useState(5); // Initial task groups to show (5 groups)

  // Get today's date (at start of day for comparison)
  const today = useMemo(() => startOfDay(new Date()), []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleEdit = (todo) => {
    setSelectedTodo(todo);
    setModalVisible(true);
  };

  const handleDelete = async (todo) => {
    deleteTodoMutation.mutate({ id: todo.id, showAlert: true });
  };

  const handleToggleComplete = (todo) => {
    const isCompleted = todo.state === "completed";
    const nextState = isCompleted ? "not_started" : "completed";
    updateTodoMutation.mutate({ id: todo.id, updates: { state: nextState } });
  };

  const handleModalDismiss = () => {
    setModalVisible(false);
    setSelectedTodo(null);
  };

  const handleModalSuccess = () => {
    handleModalDismiss();
  };

  const handleHistoryPress = () => {
    navigation.navigate("TaskHistory");
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

  // Get the earliest due_date from a task and all its descendants
  const getEarliestDueDate = (task) => {
    if (!task) return null;

    let earliestDate = task.due_date
      ? startOfDay(new Date(task.due_date))
      : null;

    // Recursively check children
    const checkChildren = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (child.due_date) {
            const childDate = startOfDay(new Date(child.due_date));
            if (!earliestDate || childDate.getTime() < earliestDate.getTime()) {
              earliestDate = childDate;
            }
          }
          checkChildren(child);
        });
      }
    };

    checkChildren(task);
    return earliestDate;
  };

  // Sort tasks recursively by due_date (oldest first) at all levels
  const sortTasksByDueDate = (taskList) => {
    return taskList
      .sort((a, b) => {
        // Get the earliest due_date for each task (including descendants)
        const dateA = getEarliestDueDate(a);
        const dateB = getEarliestDueDate(b);

        // Tasks without due_date go to the end
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        // Normalize dates to start of day for consistent comparison
        const normalizedA = startOfDay(dateA);
        const normalizedB = startOfDay(dateB);

        // Older dates first (ascending order)
        return normalizedA.getTime() - normalizedB.getTime();
      })
      .map((task) => {
        // Recursively sort children
        if (task.children && task.children.length > 0) {
          task.children = sortTasksByDueDate(task.children);
        }
        return task;
      });
  };

  // Build backlog task tree (tasks with due_date before today)
  const backlogTaskGroups = useMemo(() => {
    logger.debug("Building backlog task groups", {
      taskCount: tasks?.length || 0,
      isLoading,
    });

    // Don't build tree while loading - wait for actual data
    if (isLoading) {
      logger.debug("Still loading, returning empty array for backlog");
      return [];
    }

    if (!tasks || tasks.length === 0) {
      logger.debug("No tasks available for backlog building");
      return [];
    }

    try {
      // Filter tasks that have due_date before today AND are not completed
      // Completed tasks are shown in History modal, so exclude them from backlog
      const backlogTasks = tasks.filter((task) => {
        if (!task.due_date) {
          return false; // Tasks without due_date don't go to backlog
        }

        // Exclude completed tasks (they're shown in History modal)
        if (task.state === "completed") {
          return false;
        }

        const dueDate = startOfDay(new Date(task.due_date));
        return isBefore(dueDate, today);
      });

      if (backlogTasks.length === 0) {
        logger.debug("No backlog tasks found");
        return [];
      }

      logger.debug("Found backlog tasks", { count: backlogTasks.length });

      // Sort backlog tasks by due_date (ascending - oldest/most overdue first)
      backlogTasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1; // Tasks without due_date go to the end
        if (!b.due_date) return -1;

        // Normalize dates to start of day for consistent comparison
        const dateA = startOfDay(new Date(a.due_date));
        const dateB = startOfDay(new Date(b.due_date));

        // Older dates first (ascending order)
        return dateA.getTime() - dateB.getTime();
      });

      // For backlog, include all tasks with due_date before today
      // Also include ancestors of backlog leaf todos to maintain hierarchy
      const backlogLeafTodos = backlogTasks.filter(
        (task) => !task.children_count || task.children_count === 0
      );
      const backlogLeafTodoIds = new Set(
        backlogLeafTodos.map((t) => t.id?.toString() || t.id)
      );

      // Include all ancestors of backlog leaf todos
      const ancestorIds = new Set();
      backlogLeafTodos.forEach((leafTodo) => {
        const ancestors = getAncestorIds(leafTodo, tasks);
        ancestors.forEach((id) => ancestorIds.add(id));
      });

      // Filter tasks to include:
      // - All tasks with due_date before today (from backlogTasks)
      // - All ancestors of backlog leaf todos (to maintain hierarchy)
      const allBacklogTaskIds = new Set([
        ...backlogTasks.map((t) => t.id?.toString() || t.id),
        ...Array.from(ancestorIds),
      ]);

      const filteredBacklogTasks = tasks.filter((task) => {
        const taskId = task.id?.toString() || task.id;
        return allBacklogTaskIds.has(taskId);
      });

      logger.debug("Filtered backlog tasks", {
        count: filteredBacklogTasks.length,
        includingAncestors: true,
      });

      const tree = buildTaskTree(filteredBacklogTasks);
      // Ensure we return a valid array (never undefined)
      let result = Array.isArray(tree) ? tree : [];

      // Sort all tasks (root and nested children) by due_date (oldest first)
      result = sortTasksByDueDate(result);

      logger.debug("Backlog task tree result", {
        rootTaskCount: result.length,
      });

      return result;
    } catch (error) {
      logger.error("Error building backlog task tree", {
        message: error.message,
        stack: error.stack,
      });
      return [];
    }
  }, [tasks, isLoading, today]);

  const handleMenuToggle = (taskId, visible) => {
    setMenuVisible((prev) => ({ ...prev, [taskId]: visible }));
  };

  // Get visible task groups based on pagination
  const visibleTaskGroups = useMemo(() => {
    return backlogTaskGroups.slice(0, visibleTaskGroupsCount);
  }, [backlogTaskGroups, visibleTaskGroupsCount]);

  const hasMoreTaskGroups = backlogTaskGroups.length > visibleTaskGroupsCount;

  const handleShowOlderTasks = () => {
    setVisibleTaskGroupsCount((prev) => prev + 5); // Show 5 more older task groups
  };

  // Show loader on initial load (when isLoading is true)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading backlog...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* History Button */}
      <View style={styles.historyButtonContainer}>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleHistoryPress}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="history"
            size={20}
            color="#FFFFFF"
            style={styles.historyButtonIcon}
          />
          <Text style={styles.historyButtonText}>History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleTaskGroups}
        keyExtractor={(item, index) => {
          const id = item?.id ? item.id.toString() : `backlog-${index}`;
          return id;
        }}
        renderItem={({ item }) => {
          if (!item || !item.id) {
            return null;
          }
          return (
            <TaskGroup
              key={item.id}
              rootTask={item}
              onToggleComplete={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
              menuVisible={menuVisible}
              onMenuToggle={handleMenuToggle}
              getPriorityColor={getPriorityColor}
            />
          );
        }}
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        extraData={visibleTaskGroups.length}
        contentContainerStyle={
          backlogTaskGroups.length === 0 && !isLoading
            ? [styles.listContainer, styles.emptyContainer]
            : styles.listContainer
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyMessageContainer}>
              <Text style={styles.emptyText}>No backlog tasks</Text>
              <Text style={styles.emptySubtext}>
                Tasks with due dates before today will appear here
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMoreTaskGroups ? (
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6200ee"
          />
        }
      />

      <TodoFormModal
        visible={modalVisible}
        onDismiss={handleModalDismiss}
        existingTodo={selectedTodo}
        onSuccess={handleModalSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    borderBottomWidth: 1,
    borderBottomColor: "#ef5350",
  },
  errorText: {
    fontFamily: "Quicksand-Regular",
    color: "#B00020",
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    minHeight: 200,
  },
  emptyMessageContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    textAlign: "center",
  },
  historyButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  historyButton: {
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
  historyButtonIcon: {
    marginRight: 8,
  },
  historyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Quicksand-SemiBold",
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

export default BacklogScreen;
