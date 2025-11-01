import React, { useState, useEffect } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {
  Card,
  IconButton,
  Dialog,
  TextInput,
  Button,
  ActivityIndicator,
  ProgressBar,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useLifeGoals } from "../../hooks/queries/useLifeGoalsQueries";
import {
  useCreateLifeGoalMutation,
  useUpdateLifeGoalMutation,
  useDeleteLifeGoalMutation,
} from "../../hooks/mutations/useLifeGoalMutations";
import { useGoalTasks } from "../../hooks/queries/useTodosQueries";
import supabase from "../../lib/supabase";
import { format } from "date-fns";

const LifeGoalsScreen = () => {
  const navigation = useNavigation();
  const { data: lifeGoals = [], isLoading, error, refetch } = useLifeGoals();
  const createGoalMutation = useCreateLifeGoalMutation();
  const updateGoalMutation = useUpdateLifeGoalMutation();
  const deleteGoalMutation = useDeleteLifeGoalMutation();
  const isFocused = useIsFocused();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState(null);

  // Fetch tasks for the expanded goal using React Query
  const { data: expandedGoalTasks = [], isLoading: isLoadingExpandedTasks } =
    useGoalTasks(expandedGoalId);

  const handleOpenModal = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setName(goal.name || "");
      setDescription(goal.description || "");
    } else {
      setEditingGoal(null);
      setName("");
      setDescription("");
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingGoal(null);
    setName("");
    setDescription("");
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleOpenModal()}
          style={styles.headerButton}
          disabled={
            createGoalMutation.isPending || updateGoalMutation.isPending
          }
        >
          <LinearGradient
            colors={["#8C4BFF", "#5A2DFF", "#3B1CB0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerButtonGradient}
          >
            <View style={styles.headerButtonContent}>
              <Text style={styles.headerButtonPlus}>＋</Text>
              <Text style={styles.headerButtonLabel}>Create Goal</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ),
    });
  }, [navigation, createGoalMutation.isPending, updateGoalMutation.isPending]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a goal name");
      return;
    }

    if (editingGoal) {
      updateGoalMutation.mutate(
        {
          id: editingGoal.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
          },
        },
        {
          onSuccess: () => {
            handleCloseModal();
          },
        }
      );
    } else {
      createGoalMutation.mutate(
        {
          name: name.trim(),
          description: description.trim(),
        },
        {
          onSuccess: () => {
            handleCloseModal();
          },
        }
      );
    }
  };

  // Auto-refresh when screen gains focus (e.g., after assigning a task to a goal)
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused]);

  const handleDelete = (goal) => {
    // Use mutation hook - it handles errors and refetching automatically
    deleteGoalMutation.mutate({ id: goal.id, showAlert: true });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCardPress = (goal) => {
    if (expandedGoalId === goal.id) {
      // Collapse
      setExpandedGoalId(null);
    } else {
      // Expand - React Query will fetch tasks automatically
      setExpandedGoalId(goal.id);
    }
  };

  const renderProgressSection = (item) => {
    const completionPercentage = item.completion_percentage || 0;
    const totalTasks = item.total_tasks || 0;
    const completedTasks = item.completed_tasks || 0;

    const getProgressColor = () => {
      if (completionPercentage === 0) return "#9E9E9E";
      if (completionPercentage < 34) return "#F44336";
      if (completionPercentage < 67) return "#FF9800";
      if (completionPercentage < 100) return "#2196F3";
      return "#4CAF50";
    };

    if (totalTasks > 0) {
      return (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {completedTasks} of {totalTasks} tasks completed
            </Text>
            <Chip
              mode="flat"
              textStyle={styles.percentageChip}
              style={[
                styles.percentageChipContainer,
                { backgroundColor: getProgressColor() + "20" },
              ]}
            >
              {completionPercentage.toFixed(0)}%
            </Chip>
          </View>
          <ProgressBar
            progress={completionPercentage / 100}
            color={getProgressColor()}
            style={styles.progressBar}
          />
        </View>
      );
    }
    return <Text style={styles.noTasksText}>No tasks yet</Text>;
  };

  const renderGoalItemFull = ({ item }) => {
    const completionPercentage = item.completion_percentage || 0;
    const isExpanded = expandedGoalId === item.id;

    // Use the tasks from the top-level hook if this goal is expanded
    const tasks = isExpanded ? expandedGoalTasks : [];
    const isLoadingTasks = isExpanded ? isLoadingExpandedTasks : false;

    // Get gradient colors based on completion percentage
    const getCardGradient = () => {
      if (completionPercentage === 0) return ["#9E9E9E", "#BDBDBD"];
      if (completionPercentage < 34) return ["#F44336", "#EF5350"];
      if (completionPercentage < 67) return ["#FF9800", "#FFB74D"];
      if (completionPercentage < 100) return ["#2196F3", "#64B5F6"];
      return ["#4CAF50", "#81C784"];
    };

    const formatDate = (dateString) => {
      if (!dateString) return null;
      try {
        return format(new Date(dateString), "MMM dd, yyyy");
      } catch {
        return null;
      }
    };

    return (
      <Card style={styles.card} mode="elevated" elevation={3}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleCardPress(item)}
        >
          <LinearGradient
            colors={getCardGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardContentWrapper}>
                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <IconButton
                      icon={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      iconColor="#ffffff"
                      style={styles.expandButton}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        handleCardPress(item);
                      }}
                    />
                  </View>
                  {item.description && (
                    <Text style={styles.cardDescription}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.cardActions}>
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleOpenModal(item);
                  }}
                  disabled={
                    createGoalMutation.isPending || updateGoalMutation.isPending
                  }
                  iconColor="#ffffff"
                  style={styles.iconButton}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleDelete(item);
                  }}
                  disabled={
                    createGoalMutation.isPending || updateGoalMutation.isPending
                  }
                  iconColor="#ffffff"
                  style={styles.iconButton}
                />
              </View>
            </View>
          </LinearGradient>
          <Card.Content style={styles.cardContentArea}>
            {renderProgressSection(item)}
          </Card.Content>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedSection}>
            {isLoadingTasks ? (
              <View style={styles.tasksLoadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.tasksLoadingText}>Loading tasks...</Text>
              </View>
            ) : tasks.length > 0 ? (
              <View style={styles.tasksList}>
                {tasks.map((task) => (
                  <View key={task.id} style={styles.taskItem}>
                    <View style={styles.taskItemRow}>
                      <Text
                        style={[
                          styles.taskItemName,
                          task.state === "completed" &&
                            styles.taskItemCompleted,
                        ]}
                        numberOfLines={1}
                      >
                        {task.task_name || "Untitled Task"}
                      </Text>
                      {task.state && (
                        <Chip
                          mode="flat"
                          textStyle={styles.taskStateChip}
                          style={[
                            styles.taskStateChipContainer,
                            {
                              backgroundColor:
                                task.state === "completed"
                                  ? "#4CAF50"
                                  : task.state === "in_progress"
                                  ? "#FF9800"
                                  : "#9E9E9E",
                            },
                          ]}
                          compact
                        >
                          {task.state === "completed"
                            ? "Done"
                            : task.state === "in_progress"
                            ? "In Progress"
                            : "Not Started"}
                        </Chip>
                      )}
                      {task.due_date && (
                        <Text style={styles.taskItemDate}>
                          {formatDate(task.due_date)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.tasksEmptyContainer}>
                <Text style={styles.tasksEmptyText}>
                  No tasks assigned to this goal
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  if (isLoading && lifeGoals.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading goals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button onPress={refetch} mode="outlined" style={styles.retryButton}>
            Retry
          </Button>
        </View>
      )}

      <FlatList
        data={lifeGoals}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGoalItemFull}
        contentContainerStyle={
          lifeGoals.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No life goals yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the "Create Goal" button in the header to get started
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <Dialog visible={modalVisible} onDismiss={handleCloseModal}>
        <Dialog.Title style={styles.dialogTitleContainer}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dialogTitleGradient}
          >
            <Text style={styles.dialogTitle}>
              {editingGoal ? "Edit Goal" : "Create Goal"}
            </Text>
          </LinearGradient>
        </Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="Goal Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            disabled={
              createGoalMutation.isPending || updateGoalMutation.isPending
            }
            autoFocus
          />
          <TextInput
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            disabled={
              createGoalMutation.isPending || updateGoalMutation.isPending
            }
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            onPress={handleCloseModal}
            disabled={
              createGoalMutation.isPending || updateGoalMutation.isPending
            }
          >
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            mode="contained"
            loading={
              createGoalMutation.isPending || updateGoalMutation.isPending
            }
            disabled={
              createGoalMutation.isPending ||
              updateGoalMutation.isPending ||
              !name.trim()
            }
          >
            {editingGoal ? "Update" : "Create"}
          </Button>
        </Dialog.Actions>
      </Dialog>
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
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: "flex-start",
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
    overflow: "hidden",
    borderRadius: 12,
  },
  cardGradient: {
    padding: 16,
    paddingBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardContentWrapper: {
    flex: 1,
    marginRight: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardContentArea: {
    paddingTop: 16,
    backgroundColor: "#fff",
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Quicksand-SemiBold",
    marginBottom: 4,
    color: "#ffffff",
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#ffffff",
    opacity: 0.9,
    marginTop: 4,
  },
  iconButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
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
  input: {
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 32,
  },
  progressText: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#666",
  },
  percentageChip: {
    fontSize: 12,
    fontFamily: "Quicksand-SemiBold",
    paddingVertical: 2,
  },
  percentageChipContainer: {
    minHeight: 24,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    paddingHorizontal: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 0,
    marginBottom: 12,
  },
  noTasksText: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
    marginBottom: 12,
  },
  dialogTitleContainer: {
    backgroundColor: "transparent",
    margin: 0,
    padding: 0,
  },
  dialogTitleGradient: {
    padding: 16,
    paddingVertical: 18,
  },
  dialogTitle: {
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    color: "#ffffff",
    textAlign: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  expandButton: {
    margin: 0,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  tasksLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  tasksLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#666",
  },
  tasksList: {
    gap: 4,
  },
  taskItem: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  taskItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  taskItemName: {
    fontSize: 14,
    fontFamily: "Quicksand-SemiBold",
    color: "#333",
    flex: 1,
    marginRight: 4,
  },
  taskItemCompleted: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  taskStateChip: {
    fontSize: 7,
    fontFamily: "Quicksand-SemiBold",
    color: "#ffffff",
    lineHeight: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  taskStateChipContainer: {
    height: 20,
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  taskItemDate: {
    fontSize: 11,
    fontFamily: "Quicksand-Regular",
    color: "#666",
    marginLeft: 4,
  },
  tasksEmptyContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  tasksEmptyText: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    fontStyle: "italic",
  },
});

export default LifeGoalsScreen;
