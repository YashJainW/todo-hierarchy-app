import React, { useState } from "react";
import {
  FlatList,
  View,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import {
  FAB,
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

  const getSummaryStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.state === "completed").length;
    const inProgress = tasks.filter(
      (t) => t.state === "in_progress" || t.state === "not_started"
    ).length;

    return { total, completed, inProgress };
  };

  const ListHeaderComponent = () => {
    const stats = getSummaryStats();
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Tasks</Text>
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
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <TodoCard item={item} />}
        contentContainerStyle={
          tasks.length === 0 ? styles.emptyContainer : styles.listContainer
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

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setSelectedTodo(null);
          setModalVisible(true);
        }}
        label="New Task"
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
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#6200ee",
  },
});

export default DashboardScreen;
