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
import {
  useLifeGoals,
  createLifeGoal,
  updateLifeGoal,
  deleteLifeGoal,
} from "../../hooks/useLifeGoals";

const LifeGoalsScreen = () => {
  const { lifeGoals, loading, error, refetch } = useLifeGoals();
  const isFocused = useIsFocused();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a goal name");
      return;
    }

    setFormLoading(true);

    try {
      let result;
      if (editingGoal) {
        result = await updateLifeGoal(editingGoal.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
      } else {
        result = await createLifeGoal(name.trim(), description.trim());
      }

      if (result.error) {
        Alert.alert("Error", result.error);
      } else {
        handleCloseModal();
        refetch();
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setFormLoading(false);
    }
  };

  // Auto-refresh when screen gains focus (e.g., after assigning a task to a goal)
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused]);

  const handleDelete = async (goal) => {
    // Let deleteLifeGoal handle the Alert with options for children
    const result = await deleteLifeGoal(goal.id, true);
    if (result.error) {
      // Only show error if it's not a cancellation
      if (result.error !== "Deletion cancelled") {
        Alert.alert("Error", result.error);
      }
    } else {
      refetch();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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

    // Get gradient colors based on completion percentage
    const getCardGradient = () => {
      if (completionPercentage === 0) return ["#9E9E9E", "#BDBDBD"];
      if (completionPercentage < 34) return ["#F44336", "#EF5350"];
      if (completionPercentage < 67) return ["#FF9800", "#FFB74D"];
      if (completionPercentage < 100) return ["#2196F3", "#64B5F6"];
      return ["#4CAF50", "#81C784"];
    };

    return (
      <Card style={styles.card} mode="elevated" elevation={3}>
        <LinearGradient
          colors={getCardGradient()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description && (
                <Text style={styles.cardDescription}>{item.description}</Text>
              )}
            </View>
            <View style={styles.cardActions}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => handleOpenModal(item)}
                disabled={formLoading}
                iconColor="#ffffff"
                style={styles.iconButton}
              />
              <IconButton
                icon="delete"
                size={20}
                onPress={() => handleDelete(item)}
                disabled={formLoading}
                iconColor="#ffffff"
                style={styles.iconButton}
              />
            </View>
          </View>
        </LinearGradient>
        <Card.Content style={styles.cardContentArea}>
          {renderProgressSection(item)}
        </Card.Content>
      </Card>
    );
  };

  if (loading && lifeGoals.length === 0) {
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
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No life goals yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to create your first life goal
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={() => handleOpenModal()}
        disabled={formLoading}
      >
        <LinearGradient
          colors={["#8C4BFF", "#5A2DFF", "#3B1CB0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fabGradient}
        >
          <View style={styles.fabContent}>
            <Text style={styles.fabPlus}>＋</Text>
            <Text style={styles.fabLabel}>Create Goal</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

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
            disabled={formLoading}
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
            disabled={formLoading}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleCloseModal} disabled={formLoading}>
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            mode="contained"
            loading={formLoading}
            disabled={formLoading || !name.trim()}
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
  cardContent: {
    flex: 1,
    marginRight: 8,
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
  fab: {
    position: "absolute",
    right: 0,
    bottom: 90,
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
    fontFamily: "Quicksand-Bold",
    marginRight: 10,
    marginTop: -1,
  },
  fabLabel: {
    color: "#ffffff",
    fontSize: 16,
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
    marginBottom: 8,
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
    marginTop: 4,
  },
  noTasksText: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
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
});

export default LifeGoalsScreen;
