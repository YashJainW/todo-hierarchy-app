import React, { useState, useMemo, useEffect } from "react";
import {
  FlatList,
  View,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {
  Card,
  Chip,
  IconButton,
  ProgressBar,
  Checkbox,
  Menu,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useDashboardTasks } from "../../hooks/queries/useTodosQueries";
import {
  useUpdateTodoMutation,
  useDeleteTodoMutation,
} from "../../hooks/mutations/useTodoMutations";
import TodoFormModal from "../../components/todos/TodoFormModal";
import TaskGroup from "../../components/todos/TaskGroup";
import { buildTaskTree } from "../../utils/taskHierarchy";
import {
  format,
  isSameDay,
  startOfDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isBefore,
  isAfter,
} from "date-fns";

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { data: tasks = [], isLoading, error, refetch } = useDashboardTasks();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});

  // Date selection state
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get today's date (at start of day for comparison)
  const today = useMemo(() => startOfDay(new Date()), []);

  // Check if selected date is today
  const isToday = useMemo(
    () => isSameDay(selectedDate, today),
    [selectedDate, today]
  );

  // Check if selected date is a future date
  const isFutureDate = useMemo(
    () => selectedDate > today,
    [selectedDate, today]
  );

  const openNewTaskModal = () => {
    setSelectedTodo(null);
    setModalVisible(true);
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openNewTaskModal}
          style={styles.headerButton}
        >
          <LinearGradient
            colors={["#8C4BFF", "#5A2DFF", "#3B1CB0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerButtonGradient}
          >
            <View style={styles.headerButtonContent}>
              <Text style={styles.headerButtonPlus}>＋</Text>
              <Text style={styles.headerButtonLabel}>New Task</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
    // Use mutation hook - it handles errors and refetching automatically
    deleteTodoMutation.mutate({ id: todo.id, showAlert: true });
  };

  const handleToggleComplete = (todo) => {
    const isCompleted = todo.state === "completed";
    const nextState = isCompleted ? "not_started" : "completed";

    // Use mutation with optimistic updates - UI updates instantly!
    updateTodoMutation.mutate({ id: todo.id, updates: { state: nextState } });
  };

  const handleModalDismiss = () => {
    setModalVisible(false);
    setSelectedTodo(null);
  };

  const handleModalSuccess = () => {
    // React Query will automatically refetch after mutations
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

  // Format date for display
  const formatSelectedDate = (date) => {
    if (isSameDay(date, today)) {
      return "Today";
    }
    return format(date, "MMM dd, yyyy");
  };

  // Check if a leaf todo should be visible based on selected date
  const shouldShowLeafTodo = (todo) => {
    // Only filter leaf todos (todos without children)
    const isLeafTodo = !todo.children_count || todo.children_count === 0;
    if (!isLeafTodo) {
      return false; // Non-leaf todos are filtered here, will be included if they have matching children
    }

    // Must have a due_date and task_type
    if (!todo.due_date || !todo.task_type) {
      return false;
    }

    const dueDate = startOfDay(new Date(todo.due_date));
    const taskType = todo.task_type.toLowerCase();

    switch (taskType) {
      case "daily":
        // Daily: show if due date is same as selected date
        return isSameDay(dueDate, selectedDate);

      case "weekly":
        // Weekly: show if selected date is before or equal to due date AND in same week
        return (
          (isBefore(selectedDate, dueDate) ||
            isSameDay(selectedDate, dueDate)) &&
          isSameWeek(selectedDate, dueDate)
        );

      case "monthly":
        // Monthly: show if selected date is before or equal to due date AND in same month
        return (
          (isBefore(selectedDate, dueDate) ||
            isSameDay(selectedDate, dueDate)) &&
          isSameMonth(selectedDate, dueDate)
        );

      case "yearly":
        // Yearly: show if selected date is before or equal to due date AND in same year
        return (
          (isBefore(selectedDate, dueDate) ||
            isSameDay(selectedDate, dueDate)) &&
          isSameYear(selectedDate, dueDate)
        );

      default:
        return false;
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

  // Build task tree from flat tasks array with date filtering
  // Use a stable reference to prevent unnecessary recalculations
  const taskGroups = useMemo(() => {
    console.log(
      "Building task groups. Tasks count:",
      tasks?.length || 0,
      "Loading:",
      isLoading,
      "Selected date:",
      selectedDate
    );

    // Don't build tree while loading - wait for actual data
    if (isLoading) {
      console.log("Still loading, returning empty array");
      return [];
    }

    if (!tasks || tasks.length === 0) {
      console.log("No tasks available for tree building");
      return [];
    }

    try {
      // Step 1: Identify leaf todos that match the selected date
      const matchingLeafTodos = tasks.filter((task) =>
        shouldShowLeafTodo(task)
      );
      const matchingLeafTodoIds = new Set(
        matchingLeafTodos.map((t) => t.id?.toString() || t.id)
      );

      console.log(
        `Found ${matchingLeafTodos.length} matching leaf todos for date:`,
        formatSelectedDate(selectedDate)
      );

      // Step 2: Include all ancestors of matching leaf todos
      const ancestorIds = new Set();
      matchingLeafTodos.forEach((leafTodo) => {
        const ancestors = getAncestorIds(leafTodo, tasks);
        ancestors.forEach((id) => ancestorIds.add(id));
      });

      // Step 3: Filter tasks to include:
      // - All matching leaf todos
      // - All ancestors of matching leaf todos
      const filteredTasks = tasks.filter((task) => {
        const taskId = task.id?.toString() || task.id;
        return matchingLeafTodoIds.has(taskId) || ancestorIds.has(taskId);
      });

      console.log(
        `Filtered to ${filteredTasks.length} tasks (including ancestors)`
      );

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

      const tree = buildTaskTree(filteredTasks);
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
  }, [tasks, isLoading, selectedDate]);

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

  // Date navigation handlers
  const handleDateNavigation = (direction) => {
    const newDate = new Date(selectedDate);
    if (direction === "forward") {
      // Forward movement is always allowed
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(startOfDay(newDate));
    } else if (direction === "backward") {
      // Backward movement is only allowed on future dates (not on today)
      if (isFutureDate) {
        newDate.setDate(newDate.getDate() - 1);
        // Ensure we don't go past today
        const adjustedDate = startOfDay(newDate);
        if (adjustedDate >= today) {
          setSelectedDate(adjustedDate);
        } else {
          setSelectedDate(today);
        }
      }
    }
  };

  // Date picker handlers
  const handleDatePickerOpen = () => {
    setShowDatePicker(true);
  };

  const handleDatePickerChange = (event, pickedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type !== "dismissed" && pickedDate) {
      const adjustedDate = startOfDay(pickedDate);
      // Only allow dates from today onwards
      if (adjustedDate >= today) {
        setSelectedDate(adjustedDate);
      }
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    } else if (Platform.OS === "ios" && event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  const ListHeaderComponent = () => {
    const stats = getSummaryStats();
    return (
      <View>
        <LinearGradient
          colors={["#3B1CB0", "#5A2DFF", "#7C4DFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statNumberLight]}>
                {stats.total}
              </Text>
              <Text style={styles.statLabelLight}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statNumberLight]}>
                {stats.completed}
              </Text>
              <Text style={styles.statLabelLight}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statNumberLight]}>
                {stats.inProgress}
              </Text>
              <Text style={styles.statLabelLight}>In Progress</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Date Selection Section */}
        <LinearGradient
          colors={["#FFFFFF", "#F8F5FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.dateSelectionGradient}
        >
          <View style={styles.dateSelectionContent}>
            <TouchableOpacity
              onPress={() => handleDateNavigation("backward")}
              disabled={!isFutureDate}
              style={[
                styles.dateNavButton,
                !isFutureDate && styles.dateNavButtonDisabled,
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={isFutureDate ? "#5A2DFF" : "#C5BFF3"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDatePickerOpen}
              style={styles.dateDisplayButton}
              activeOpacity={0.8}
            >
              <Text style={styles.dateDisplayText}>
                {formatSelectedDate(selectedDate)}
              </Text>
              <MaterialCommunityIcons
                name="calendar"
                size={20}
                color="#5A2DFF"
                style={styles.calendarIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDateNavigation("forward")}
              style={styles.dateNavButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#5A2DFF"
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
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

  // Show loader on initial load (when isLoading is true)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
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
          taskGroups.length === 0 && !isLoading
            ? [styles.listContainer, styles.emptyContainer]
            : styles.listContainer
        }
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyMessageContainer}>
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

      <TodoFormModal
        visible={modalVisible}
        onDismiss={handleModalDismiss}
        existingTodo={selectedTodo}
        onSuccess={handleModalSuccess}
      />

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDatePickerChange}
          minimumDate={today}
        />
      )}
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
  headerContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerGradient: {
    padding: 12,
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
  },
  dateSelectionGradient: {
    padding: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#EDE7F6",
    shadowColor: "#5A2DFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  dateSelectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 0,
  },
  dateNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#EDE7F6",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
    minHeight: 40,
  },
  dateNavButtonDisabled: {
    backgroundColor: "#F5F5F5",
  },
  dateDisplayButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE7F6",
  },
  dateDisplayText: {
    fontSize: 16,
    fontFamily: "Quicksand-SemiBold",
    color: "#3B1CB0",
    marginRight: 8,
  },
  calendarIcon: {
    marginLeft: 4,
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
    paddingVertical: 4,
    borderRadius: 14,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
    color: "#6200ee",
  },
  statNumberLight: {
    color: "#ffffff",
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
  statLabelLight: {
    fontSize: 11,
    fontFamily: "Quicksand-Regular",
    color: "#EDE7F6",
    marginTop: 2,
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
  headerButton: {
    marginRight: 16,
    backgroundColor: "transparent",
    borderRadius: 20,
    overflow: "hidden",
  },
  headerButtonGradient: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPlus: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
    marginRight: 6,
  },
  headerButtonLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    letterSpacing: 0.3,
  },
});

export default DashboardScreen;
