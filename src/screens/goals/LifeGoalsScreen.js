import React, { useState } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import {
  FAB,
  Card,
  Title,
  Paragraph,
  IconButton,
  Dialog,
  TextInput,
  Button,
  ActivityIndicator,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useLifeGoals,
  createLifeGoal,
  updateLifeGoal,
  deleteLifeGoal,
} from "../../hooks/useLifeGoals";

const LifeGoalsScreen = () => {
  const { lifeGoals, loading, error, refetch } = useLifeGoals();
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

  const handleDelete = (goal) => {
    Alert.alert(
      "Delete Life Goal",
      `Are you sure you want to delete "${goal.name}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deleteLifeGoal(goal.id);
            if (result.error) {
              Alert.alert("Error", result.error);
            } else {
              refetch();
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderGoalItem = ({ item }) => (
    <Card style={styles.card} mode="outlined">
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardContent}>
            <Title style={styles.cardTitle}>{item.name}</Title>
            {item.description && (
              <Paragraph style={styles.cardDescription}>
                {item.description}
              </Paragraph>
            )}
          </View>
          <View style={styles.cardActions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleOpenModal(item)}
              disabled={formLoading}
            />
            <IconButton
              icon="delete"
              size={20}
              onPress={() => handleDelete(item)}
              disabled={formLoading}
              iconColor="#B00020"
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

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
        renderItem={renderGoalItem}
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

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => handleOpenModal()}
        disabled={formLoading}
      />

      <Dialog visible={modalVisible} onDismiss={handleCloseModal}>
        <Dialog.Title>{editingGoal ? "Edit Goal" : "Create Goal"}</Dialog.Title>
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#6200ee",
  },
  input: {
    marginBottom: 12,
  },
});

export default LifeGoalsScreen;
