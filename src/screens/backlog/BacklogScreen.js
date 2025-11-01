import React, { useState, useMemo } from "react";
import {
  FlatList,
  View,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDashboardTasks } from "../../hooks/queries/useTodosQueries";
import {
  useUpdateTodoMutation,
  useDeleteTodoMutation,
} from "../../hooks/mutations/useTodoMutations";
import TodoFormModal from "../../components/todos/TodoFormModal";
import TaskGroup from "../../components/todos/TaskGroup";
import { buildTaskTree } from "../../utils/taskHierarchy";
import { startOfDay, isBefore } from "date-fns";

const BacklogScreen = () => {
  const { data: tasks = [], isLoading, error, refetch } = useDashboardTasks();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});

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

  // Build backlog task tree (tasks with due_date before today)
  const backlogTaskGroups = useMemo(() => {
    console.log(
      "Building backlog task groups. Tasks count:",
      tasks?.length || 0,
      "Loading:",
      isLoading
    );

    // Don't build tree while loading - wait for actual data
    if (isLoading) {
      console.log("Still loading, returning empty array for backlog");
      return [];
    }

    if (!tasks || tasks.length === 0) {
      console.log("No tasks available for backlog building");
      return [];
    }

    try {
      // Filter tasks that have due_date before today
      const backlogTasks = tasks.filter((task) => {
        if (!task.due_date) {
          return false; // Tasks without due_date don't go to backlog
        }

        const dueDate = startOfDay(new Date(task.due_date));
        return isBefore(dueDate, today);
      });

      if (backlogTasks.length === 0) {
        console.log("No backlog tasks found");
        return [];
      }

      console.log(`Found ${backlogTasks.length} backlog tasks`);

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

      console.log(
        `Filtered to ${filteredBacklogTasks.length} backlog tasks (including ancestors)`
      );

      const tree = buildTaskTree(filteredBacklogTasks);
      // Ensure we return a valid array (never undefined)
      const result = Array.isArray(tree) ? tree : [];

      console.log(`Backlog task tree result: ${result.length} root tasks`);

      return result;
    } catch (error) {
      console.error("Error building backlog task tree:", error, error.stack);
      return [];
    }
  }, [tasks, isLoading, today]);

  const handleMenuToggle = (taskId, visible) => {
    setMenuVisible((prev) => ({ ...prev, [taskId]: visible }));
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

      <FlatList
        data={backlogTaskGroups}
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
        extraData={backlogTaskGroups.length}
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
});

export default BacklogScreen;

