import React, { useState, useMemo } from "react";
import {
  FlatList,
  View,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Card,
  Chip,
  IconButton,
  Text,
  ProgressBar,
  Checkbox,
  Menu,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useDashboardTasks,
  updateTodo,
  deleteTodo,
} from "../../hooks/useTodos";
import TodoFormModal from "../../components/todos/TodoFormModal";
import TaskGroup from "../../components/todos/TaskGroup";
import { buildTaskTree } from "../../utils/taskHierarchy";
import { format } from "date-fns";

const DashboardScreen = () => {
  const { tasks, loading, error, refetch } = useDashboardTasks();
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});

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
    // Let deleteTodo handle the Alert with options for children
    const result = await deleteTodo(todo.id, true);
    if (result.error) {
      // Only show error if it's not a cancellation
      if (result.error !== "Deletion cancelled") {
        Alert.alert("Error", result.error);
      }
    } else {
      refetch();
    }
  };

  const handleToggleComplete = async (todo) => {
    const isCompleted = todo.state === "completed";

    if (isCompleted) {
      // Show confirmation before unmarking as complete
      Alert.alert(
        "Unmark as Complete",
        `Mark "${todo.task_name || todo.title}" as not started?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Confirm",
            onPress: async () => {
              const result = await updateTodo(todo.id, {
                state: "not_started",
              });
              if (result.error) {
                Alert.alert("Error", result.error);
              } else {
                refetch();
              }
            },
          },
        ]
      );
    } else {
      // Show confirmation before marking as complete
      Alert.alert(
        "Mark as Complete",
        `Mark "${todo.task_name || todo.title}" as completed?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Confirm",
            onPress: async () => {
              const result = await updateTodo(todo.id, {
                state: "completed",
              });
              if (result.error) {
                Alert.alert("Error", result.error);
              } else {
                refetch();
              }
            },
          },
        ]
      );
    }
  };

  const handleModalDismiss = () => {
    setModalVisible(false);
    setSelectedTodo(null);
  };

  const handleModalSuccess = () => {
    refetch();
    handleModalDismiss();
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

  const formatDate = (dateString) => {
    if (!dateString) return "No due date";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  // Build task tree from flat tasks array
  // Use a stable reference to prevent unnecessary recalculations
  // Only depend on tasks, not loading (loading changes shouldn't rebuild tree)
  const taskGroups = useMemo(() => {
    console.log(
      "Building task groups. Tasks count:",
      tasks?.length || 0,
      "Loading:",
      loading
    );

    // Don't build tree while loading - wait for actual data
    if (loading) {
      console.log("Still loading, returning empty array");
      return [];
    }

    if (!tasks || tasks.length === 0) {
      console.log("No tasks available for tree building");
      return [];
    }

    try {
      console.log("Sample task data:", tasks[0]);
      console.log(
        "Task IDs and parent_ids:",
        tasks.slice(0, 5).map((t) => ({
          id: t.id,
          parent_id: t.parent_id,
          parent_todo_id: t.parent_todo_id,
          name: t.task_name || t.title,
        }))
      );

      const tree = buildTaskTree(tasks);
      // Ensure we return a valid array (never undefined)
      const result = Array.isArray(tree) ? tree : [];

      // Debug log to verify data is present
      console.log(`Task tree result: ${result.length} root tasks`);
      if (result.length === 0 && tasks.length > 0) {
        console.warn("⚠️ Task tree is empty but tasks exist:", tasks.length);
        console.warn(
          "Sample tasks:",
          tasks.slice(0, 3).map((t) => ({
            id: t.id,
            parent_id: t.parent_id,
            parent_todo_id: t.parent_todo_id,
          }))
        );
      }

      return result;
    } catch (error) {
      console.error("Error building task tree:", error, error.stack);
      return [];
    }
  }, [tasks, loading]);

  const getSummaryStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.state === "completed").length;
    const inProgress = tasks.filter(
      (t) => t.state === "in_progress" || t.state === "not_started"
    ).length;

    return { total, completed, inProgress };
  };

  const handleMenuToggle = (taskId, visible) => {
    setMenuVisible((prev) => ({ ...prev, [taskId]: visible }));
  };

  const ListHeaderComponent = () => {
    const stats = getSummaryStats();
    return (
      <View style={styles.headerContainer}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, styles.statCompleted]}>
              {stats.completed}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, styles.statInProgress]}>
              {stats.inProgress}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
        </View>
      </View>
    );
  };

  const TodoCard = ({ item }) => {
    const isCompleted = item.state === "completed";
    const hasChildren =
      item.children_count > 0 || item.completed_children_count > 0;
    const progress = hasChildren
      ? (item.completed_children_count || 0) / (item.children_count || 1)
      : 0;

    return (
      <Card
        style={[styles.card, isCompleted && styles.cardCompleted]}
        mode="elevated"
        elevation={2}
      >
        <Card.Title
          title={item.task_name || item.title}
          subtitle={`${item.task_type || "task"} • ${formatDate(
            item.due_date
          )}`}
          left={(props) => (
            <Checkbox
              {...props}
              status={isCompleted ? "checked" : "unchecked"}
              onPress={() => handleToggleComplete(item)}
            />
          )}
          right={(props) => (
            <Menu
              visible={menuVisible[item.id] || false}
              onDismiss={() =>
                setMenuVisible({ ...menuVisible, [item.id]: false })
              }
              anchor={
                <IconButton
                  {...props}
                  icon="dots-vertical"
                  onPress={() =>
                    setMenuVisible({ ...menuVisible, [item.id]: true })
                  }
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setMenuVisible({ ...menuVisible, [item.id]: false });
                  handleEdit(item);
                }}
                title="Edit"
                leadingIcon="pencil"
              />
              <Menu.Item
                onPress={() => {
                  setMenuVisible({ ...menuVisible, [item.id]: false });
                  handleDelete(item);
                }}
                title="Delete"
                leadingIcon="delete"
                titleStyle={{ color: "#B00020" }}
              />
            </Menu>
          )}
        />
        <Card.Content>
          {item.priority && (
            <Chip
              style={[
                styles.priorityChip,
                { backgroundColor: getPriorityColor(item.priority) + "20" },
              ]}
              textStyle={{
                color: getPriorityColor(item.priority),
                fontWeight: "600",
              }}
              icon="flag"
            >
              {item.priority}
            </Chip>
          )}
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          {hasChildren && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>
                  {item.completed_children_count || 0} /{" "}
                  {item.children_count || 0} completed
                </Text>
                <Text style={styles.progressPercent}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <ProgressBar
                progress={progress}
                color="#6200ee"
                style={styles.progressBar}
              />
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
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

      <FlatList
        data={taskGroups}
        keyExtractor={(item, index) => {
          // Use a stable key that combines ID and index for better stability
          const id = item?.id ? item.id.toString() : `root-${index}`;
          return id;
        }}
        renderItem={({ item }) => {
          // Defensive check before rendering
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
        extraData={taskGroups.length} // Force re-render when groups change
        contentContainerStyle={
          taskGroups.length === 0 && !loading
            ? styles.emptyContainer
            : styles.listContainer
        }
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to create your first task
              </Text>
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

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={() => {
          setSelectedTodo(null);
          setModalVisible(true);
        }}
      >
        <LinearGradient
          colors={["#8C4BFF", "#5A2DFF", "#3B1CB0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fabGradient}
        >
          <View style={styles.fabContent}>
            <Text style={styles.fabPlus}>＋</Text>
            <Text style={styles.fabLabel}>New Task</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

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
    color: "#666",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#ffebee",
    borderBottomWidth: 1,
    borderBottomColor: "#ef5350",
  },
  errorText: {
    color: "#B00020",
  },
  headerContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#000",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6200ee",
  },
  statCompleted: {
    color: "#4caf50",
  },
  statInProgress: {
    color: "#ff9800",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  card: {
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardCompleted: {
    opacity: 0.7,
  },
  priorityChip: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#666",
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6200ee",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e0e0e0",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "transparent",
    borderRadius: 28,
    paddingHorizontal: 18,
    height: 56,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 0.5,
    elevation: 20,
  },
  fabGradient: {
    borderRadius: 28,
    height: 56,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fabPlus: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginRight: 10,
    marginTop: -1,
  },
  fabLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default DashboardScreen;
