import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  Platform,
  Text as RNText,
  Modal,
  TouchableOpacity,
  FlatList,
} from "react-native";
import {
  Portal,
  Dialog,
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  Chip,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { validateHierarchyRules } from "../../hooks/useTodos";
import { usePossibleParents } from "../../hooks/queries/useTodosQueries";
import {
  useCreateTodoMutation,
  useUpdateTodoMutation,
} from "../../hooks/mutations/useTodoMutations";
import supabase from "../../lib/supabase";
import ParentConfirmationDialog from "./ParentConfirmationDialog";

const NO_PARENT_VALUE = "__none__";

const TodoFormModal = ({
  visible,
  onDismiss,
  existingTodo = null,
  onSuccess,
}) => {
  // Form fields state
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("daily");
  const [state, setState] = useState("not_started");
  const [dueDate, setDueDate] = useState(null);
  const [achievementNote, setAchievementNote] = useState("");

  // Parent selection state
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [selectedParentType, setSelectedParentType] = useState(null);
  // Controlled picker value (e.g., "todo:<uuid>" or "life_goal:<uuid>")
  const [selectedParentValue, setSelectedParentValue] =
    useState(NO_PARENT_VALUE);
  // Guard to prevent re-sync effect from overwriting user's selection during edit
  const [userChangedParent, setUserChangedParent] = useState(false);
  const [previousParentId, setPreviousParentId] = useState(null);
  const [previousParentType, setPreviousParentType] = useState(null);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [errors, setErrors] = useState(null);

  // React Query hooks
  const createTodoMutation = useCreateTodoMutation();
  const updateTodoMutation = useUpdateTodoMutation();
  const { data: possibleParents = [], isLoading: fetchingParents } =
    usePossibleParents(taskType, existingTodo?.id);

  // Confirmation state
  const [showParentChangeConfirm, setShowParentChangeConfirm] = useState(false);
  const [pendingParentChange, setPendingParentChange] = useState(null);

  // Initialize form when existingTodo is provided
  useEffect(() => {
    if (existingTodo && visible) {
      setTaskName(existingTodo.task_name || existingTodo.title || "");
      setDescription(existingTodo.description || "");
      setPriority(existingTodo.priority || "medium");
      setTaskType(existingTodo.task_type || "daily");
      setState(existingTodo.state || "not_started");
      setDueDate(
        existingTodo.due_date ? new Date(existingTodo.due_date) : null
      );
      setAchievementNote(existingTodo.achievement_note || "");

      // Set parent based on what's available
      // Check both mapped fields (parent_id, life_goal_id) and raw DB fields (parent_todo_id, parent_life_goal_id)
      const parentId = existingTodo.parent_id || existingTodo.parent_todo_id;
      const lifeGoalId =
        existingTodo.life_goal_id || existingTodo.parent_life_goal_id;

      if (parentId) {
        setSelectedParentId(parentId);
        setSelectedParentType("todo");
        setSelectedParentValue(`todo:${parentId}`);
        setPreviousParentId(parentId);
        setPreviousParentType("todo");
      } else if (lifeGoalId) {
        setSelectedParentId(lifeGoalId);
        setSelectedParentType("life_goal");
        setSelectedParentValue(`life_goal:${lifeGoalId}`);
        setPreviousParentId(lifeGoalId);
        setPreviousParentType("life_goal");
      } else {
        setSelectedParentId(null);
        setSelectedParentType(null);
        setSelectedParentValue(NO_PARENT_VALUE);
        setPreviousParentId(null);
        setPreviousParentType(null);
      }
      setErrors(null);
      setUserChangedParent(false);
    } else if (!existingTodo && visible) {
      // Reset form for new todo
      resetForm();
    }
  }, [existingTodo, visible]);

  // Note: possibleParents are automatically fetched by React Query via usePossibleParents hook
  // No manual fetching needed - React Query handles it when taskType or existingTodo?.id changes

  // Re-sync parent selection after possibleParents are fetched
  // This ensures parent is set even if possibleParents list hasn't loaded yet
  useEffect(() => {
    // If user already changed the parent in this session, do not override it
    if (userChangedParent) {
      return;
    }
    if (existingTodo && visible) {
      const parentId = existingTodo.parent_id || existingTodo.parent_todo_id;
      const lifeGoalId =
        existingTodo.life_goal_id || existingTodo.parent_life_goal_id;

      // Always sync with existingTodo data - set parent even if not in possibleParents yet
      // (parent might be completed or filtered, but we still want to show it)
      if (parentId) {
        // Convert to string for comparison
        const parentIdStr = parentId?.toString();
        const selectedParentIdStr = selectedParentId?.toString();

        if (!selectedParentId || selectedParentIdStr !== parentIdStr) {
          console.log("Setting parent from existingTodo:", {
            parentId,
            parentIdStr,
            selectedParentId,
            selectedParentIdStr,
          });
          setSelectedParentId(parentIdStr);
          setSelectedParentType("todo");
          setSelectedParentValue(`todo:${parentIdStr}`);
          if (
            !previousParentId ||
            previousParentId?.toString() !== parentIdStr
          ) {
            setPreviousParentId(parentIdStr);
            setPreviousParentType("todo");
          }
        }
      } else if (lifeGoalId) {
        // Convert to string for comparison
        const lifeGoalIdStr = lifeGoalId?.toString();
        const selectedParentIdStr = selectedParentId?.toString();

        if (!selectedParentId || selectedParentIdStr !== lifeGoalIdStr) {
          console.log("Setting life goal from existingTodo:", {
            lifeGoalId,
            lifeGoalIdStr,
            selectedParentId,
            selectedParentIdStr,
          });
          setSelectedParentId(lifeGoalIdStr);
          setSelectedParentType("life_goal");
          setSelectedParentValue(`life_goal:${lifeGoalIdStr}`);
          if (
            !previousParentId ||
            previousParentId?.toString() !== lifeGoalIdStr
          ) {
            setPreviousParentId(lifeGoalIdStr);
            setPreviousParentType("life_goal");
          }
        }
      } else if (!parentId && !lifeGoalId && selectedParentId) {
        // If existingTodo has no parent but we have selectedParentId, clear it
        setSelectedParentId(null);
        setSelectedParentType(null);
        setSelectedParentValue(NO_PARENT_VALUE);
      }
    }
  }, [
    possibleParents,
    existingTodo,
    visible,
    fetchingParents,
    selectedParentId,
    previousParentId,
    userChangedParent,
  ]);

  // Reset form function
  const resetForm = () => {
    setTaskName("");
    setDescription("");
    setPriority("medium");
    setTaskType("daily");
    setState("not_started");
    setDueDate(null);
    setAchievementNote("");
    setSelectedParentId(null);
    setSelectedParentType(null);
    setSelectedParentValue(NO_PARENT_VALUE);
    setPreviousParentId(null);
    setPreviousParentType(null);
    setErrors(null);
    setUserChangedParent(false);
  };

  // Note: possibleParents is now fetched automatically by React Query via usePossibleParents hook
  // The manual fetchPossibleParents function is no longer needed since React Query handles fetching
  // based on taskType and existingTodo?.id changes

  // Handle parent change
  const handleParentChange = (value) => {
    setUserChangedParent(true);
    // Treat placeholder or explicit "no parent" selections as null
    if (!value || value === NO_PARENT_VALUE) {
      // Check if we're clearing a parent during edit (had a parent before)
      if (existingTodo && (previousParentId || previousParentType)) {
        setPendingParentChange({ id: null, type: null });
        setShowParentChangeConfirm(true);
      } else {
        handleParentSelection(null, null);
      }
      setSelectedParentValue(NO_PARENT_VALUE);
      return;
    }

    // Parse the value - format: "type:id"
    const parts = value.split(":");
    const parentType = parts[0];
    const parentId = parts[1];
    setSelectedParentValue(value);

    // Check if parent is changing during edit
    if (
      existingTodo &&
      // Only confirm if there WAS a previous parent
      (previousParentId || previousParentType) &&
      (parentId !== previousParentId?.toString() ||
        parentType !== previousParentType)
    ) {
      // Show confirmation dialog
      setPendingParentChange({ id: parentId, type: parentType });
      setShowParentChangeConfirm(true);
    } else {
      handleParentSelection(parentId, parentType);
    }
  };

  const handleParentSelection = (parentId, parentType) => {
    setUserChangedParent(true);
    const normalizedId = parentId != null ? parentId.toString() : null;
    setSelectedParentId(normalizedId);
    setSelectedParentType(parentType || null);
    if (!normalizedId || !parentType) {
      setSelectedParentValue(NO_PARENT_VALUE);
    } else {
      setSelectedParentValue(`${parentType}:${normalizedId}`);
    }

    // Validate hierarchy
    if (taskType && normalizedId && parentType) {
      // Find the actual parent to get its task_type
      let actualParentType = parentType;

      if (parentType === "todo") {
        // Look up the todo parent's task_type
        const parentTodo = possibleParents.find(
          (p) => p.type === "todo" && p.id?.toString() === normalizedId
        );
        if (parentTodo && parentTodo.task_type) {
          actualParentType = parentTodo.task_type;
        }
      } else if (parentType === "life_goal") {
        actualParentType = "life_goal";
      }

      const validation = validateHierarchyRules(taskType, actualParentType);
      if (!validation.isValid) {
        setErrors(validation.message);
      } else {
        setErrors(null);
      }
    } else if (!normalizedId || !parentType) {
      // No parent selected, clear errors
      setErrors(null);
    }
  };

  const handleConfirmParentChange = () => {
    if (pendingParentChange) {
      handleParentSelection(pendingParentChange.id, pendingParentChange.type);
      setPreviousParentId(pendingParentChange.id);
      setPreviousParentType(pendingParentChange.type);
    }
    setShowParentChangeConfirm(false);
    setPendingParentChange(null);
  };

  const handleCancelParentChange = () => {
    setShowParentChangeConfirm(false);
    setPendingParentChange(null);
  };

  // Handle date picker
  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type !== "dismissed" && selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const clearDate = () => {
    setDueDate(null);
  };

  // Validate form
  const isFormValid = () => {
    if (!taskName.trim()) {
      return false;
    }
    if (!taskType) {
      return false;
    }
    // Check hierarchy validation
    if (selectedParentId && selectedParentType && taskType) {
      // Find the actual parent to get its task_type
      let actualParentType = selectedParentType;

      if (selectedParentType === "todo") {
        // Look up the todo parent's task_type
        const parentTodo = possibleParents.find(
          (p) =>
            p.type === "todo" &&
            p.id?.toString() === selectedParentId?.toString()
        );
        if (parentTodo && parentTodo.task_type) {
          actualParentType = parentTodo.task_type;
        }
      } else if (selectedParentType === "life_goal") {
        actualParentType = "life_goal";
      }

      const validation = validateHierarchyRules(taskType, actualParentType);
      if (!validation.isValid) {
        return false;
      }
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid()) {
      setErrors(
        "Please fill in all required fields and ensure valid hierarchy"
      );
      return;
    }

    setErrors(null);

    // Prepare data object
    const todoData = {
      title: taskName.trim(),
      task_name: taskName.trim(),
      description: description.trim() || null,
      priority: priority,
      task_type: taskType,
      due_date: dueDate ? dueDate.toISOString() : null,
    };

    // Only include parent_todo_id OR life_goal_id (not both)
    if (selectedParentId && selectedParentType === "todo") {
      todoData.parent_id = selectedParentId;
      todoData.life_goal_id = null;
    } else if (selectedParentId && selectedParentType === "life_goal") {
      todoData.life_goal_id = selectedParentId;
      todoData.parent_id = null;
    } else {
      todoData.parent_id = null;
      todoData.life_goal_id = null;
    }

    // Add state and achievement note if editing
    if (existingTodo) {
      todoData.state = state;
      if (state === "completed" && achievementNote.trim()) {
        todoData.achievement_note = achievementNote.trim();
      }
    }

    if (existingTodo) {
      updateTodoMutation.mutate(
        { id: existingTodo.id, updates: todoData },
        {
          onSuccess: () => {
            resetForm();
            onSuccess();
          },
          onError: (error) => {
            setErrors(error.message || "Failed to update task");
          },
        }
      );
    } else {
      createTodoMutation.mutate(todoData, {
        onSuccess: () => {
          resetForm();
          onSuccess();
        },
        onError: (error) => {
          setErrors(error.message || "Failed to create task");
        },
      });
    }
  };

  // Format picker items
  const formatPickerItems = () => {
    const items = [
      {
        label: "✕ None (No Parent)",
        value: NO_PARENT_VALUE,
        key: "none_option",
        color: "#5A2DFF",
      },
    ];

    const todoParents = possibleParents.filter((p) => p.type === "todo");
    const lifeGoalParents = possibleParents.filter(
      (p) => p.type === "life_goal"
    );

    if (lifeGoalParents.length > 0) {
      lifeGoalParents.forEach((parent) => {
        items.push({
          label: `🎯 ${parent.name || parent.title}`,
          value: `life_goal:${parent.id}`,
          key: `life_goal_${parent.id}`,
          color: "#4527A0",
        });
      });
    }

    if (todoParents.length > 0) {
      const taskTypeEmoji = {
        daily: "📅",
        weekly: "📆",
        monthly: "🗓️",
        yearly: "📆",
      };

      todoParents.forEach((parent) => {
        const emoji = taskTypeEmoji[parent.task_type] || "📝";
        items.push({
          label: `${emoji} ${parent.title || parent.task_name} (${
            parent.task_type
          })`,
          value: `todo:${parent.id}`,
          key: `todo_${parent.id}`,
          color: "#1A237E",
        });
      });
    }

    return items;
  };

  const getSelectedParentValue = () => selectedParentValue || NO_PARENT_VALUE;

  // Get display text for selected parent
  const getSelectedParentLabel = () => {
    const value = getSelectedParentValue();
    if (value === NO_PARENT_VALUE || !value) {
      return "Select a parent task or goal...";
    }
    const items = formatPickerItems();
    const selectedItem = items.find((item) => item.value === value);
    return selectedItem
      ? selectedItem.label
      : "Select a parent task or goal...";
  };

  return (
    <>
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dialogHeaderGradient}
          >
            <Dialog.Title style={styles.dialogTitleContainer}>
              <RNText style={styles.dialogTitleText}>
                {existingTodo ? "Edit Task" : "Create Task"}
              </RNText>
            </Dialog.Title>
          </LinearGradient>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              style={styles.scrollView}
              nestedScrollEnabled={false}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Task Name Input */}
              <TextInput
                label="Task Name *"
                value={taskName}
                onChangeText={setTaskName}
                onFocus={() => {
                  if (errors) setErrors(null);
                }}
                mode="outlined"
                style={styles.input}
                disabled={
                  createTodoMutation.isPending || updateTodoMutation.isPending
                }
              />

              {/* Description Input */}
              <TextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}
                disabled={
                  createTodoMutation.isPending || updateTodoMutation.isPending
                }
              />

              {/* Task Type Chips - Grid Layout */}
              <Text style={styles.label}>Task Type *</Text>
              <View style={styles.taskTypeContainer}>
                <Chip
                  selected={taskType === "daily"}
                  onPress={() => {
                    setTaskType("daily");
                    // Reset parent selection when type changes
                    setSelectedParentId(null);
                    setSelectedParentType(null);
                    if (errors) setErrors(null);
                  }}
                  style={styles.taskTypeChip}
                  mode={taskType === "daily" ? "flat" : "outlined"}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                >
                  Daily
                </Chip>
                <Chip
                  selected={taskType === "weekly"}
                  onPress={() => {
                    setTaskType("weekly");
                    // Reset parent selection when type changes
                    setSelectedParentId(null);
                    setSelectedParentType(null);
                    if (errors) setErrors(null);
                  }}
                  style={styles.taskTypeChip}
                  mode={taskType === "weekly" ? "flat" : "outlined"}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                >
                  Weekly
                </Chip>
                <Chip
                  selected={taskType === "monthly"}
                  onPress={() => {
                    setTaskType("monthly");
                    // Reset parent selection when type changes
                    setSelectedParentId(null);
                    setSelectedParentType(null);
                    if (errors) setErrors(null);
                  }}
                  style={styles.taskTypeChip}
                  mode={taskType === "monthly" ? "flat" : "outlined"}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                >
                  Monthly
                </Chip>
                <Chip
                  selected={taskType === "yearly"}
                  onPress={() => {
                    setTaskType("yearly");
                    // Reset parent selection when type changes
                    setSelectedParentId(null);
                    setSelectedParentType(null);
                    if (errors) setErrors(null);
                  }}
                  style={styles.taskTypeChip}
                  mode={taskType === "yearly" ? "flat" : "outlined"}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                >
                  Yearly
                </Chip>
              </View>

              {/* Priority Chips */}
              <Text style={styles.label}>Priority</Text>
              <View style={styles.chipContainer}>
                <Chip
                  selected={priority === "low"}
                  onPress={() => setPriority("low")}
                  style={styles.chip}
                  mode={priority === "low" ? "flat" : "outlined"}
                >
                  Low
                </Chip>
                <Chip
                  selected={priority === "medium"}
                  onPress={() => setPriority("medium")}
                  style={styles.chip}
                  mode={priority === "medium" ? "flat" : "outlined"}
                >
                  Medium
                </Chip>
                <Chip
                  selected={priority === "high"}
                  onPress={() => setPriority("high")}
                  style={styles.chip}
                  mode={priority === "high" ? "flat" : "outlined"}
                >
                  High
                </Chip>
              </View>

              {/* State Selection (if editing) */}
              {existingTodo && (
                <>
                  <Text style={styles.label}>Status</Text>
                  <SegmentedButtons
                    value={state}
                    onValueChange={setState}
                    buttons={[
                      { value: "not_started", label: "Not Started" },
                      { value: "in_progress", label: "In Progress" },
                      { value: "completed", label: "Completed" },
                    ]}
                    style={styles.segmentedButtons}
                  />
                </>
              )}

              {/* Due Date Picker */}
              <Text style={styles.label}>Due Date</Text>
              <View style={styles.dateContainer}>
                <Button
                  mode="outlined"
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateButton}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                >
                  {dueDate ? format(dueDate, "PPP") : "Select Due Date"}
                </Button>
                {dueDate && (
                  <Button
                    mode="text"
                    onPress={clearDate}
                    style={styles.clearDateButton}
                    disabled={
                      createTodoMutation.isPending ||
                      updateTodoMutation.isPending
                    }
                  >
                    Clear
                  </Button>
                )}
              </View>

              {/* Parent Selection */}
              <Text style={styles.label}>Parent Task/Goal</Text>
              {fetchingParents ? (
                <Text style={styles.loadingText}>Loading parents...</Text>
              ) : (
                <TouchableOpacity
                  style={styles.pickerContainer}
                  onPress={() =>
                    !(
                      createTodoMutation.isPending ||
                      updateTodoMutation.isPending
                    ) && setShowParentPicker(true)
                  }
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                  activeOpacity={0.7}
                >
                  <RNText style={styles.pickerInput}>
                    {getSelectedParentLabel()}
                  </RNText>
                  <View style={styles.pickerIconContainer}>
                    <RNText style={styles.pickerIcon}>▾</RNText>
                  </View>
                </TouchableOpacity>
              )}

              {/* Achievement Note (if completed) */}
              {state === "completed" && (
                <TextInput
                  label="Achievement Note"
                  value={achievementNote}
                  onChangeText={setAchievementNote}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                  disabled={
                    createTodoMutation.isPending || updateTodoMutation.isPending
                  }
                />
              )}

              {/* Validation Errors */}
              {errors && <Text style={styles.error}>{errors}</Text>}
            </ScrollView>
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={onDismiss}
              disabled={
                createTodoMutation.isPending || updateTodoMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              onPress={handleSubmit}
              loading={
                createTodoMutation.isPending || updateTodoMutation.isPending
              }
              disabled={
                !isFormValid() ||
                createTodoMutation.isPending ||
                updateTodoMutation.isPending
              }
              mode="contained"
            >
              {existingTodo ? "Update" : "Create"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Custom Parent Picker Modal */}
      <Modal
        visible={showParentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParentPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowParentPicker(false)}
        >
          <View style={styles.pickerModalContent}>
            <LinearGradient
              colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
              style={styles.pickerModalHeader}
            >
              <RNText style={styles.pickerModalTitle}>Select Parent</RNText>
              <TouchableOpacity
                onPress={() => setShowParentPicker(false)}
                style={styles.pickerModalCloseButton}
              >
                <RNText style={styles.pickerModalCloseText}>✕</RNText>
              </TouchableOpacity>
            </LinearGradient>
            <FlatList
              data={formatPickerItems()}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    getSelectedParentValue() === item.value &&
                      styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    handleParentChange(item.value);
                    setShowParentPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <RNText
                    style={[
                      styles.pickerOptionText,
                      getSelectedParentValue() === item.value &&
                        styles.pickerOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </RNText>
                </TouchableOpacity>
              )}
              style={styles.pickerOptionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Parent Change Confirmation */}
      <ParentConfirmationDialog
        visible={showParentChangeConfirm}
        onCancel={handleCancelParentChange}
        onConfirm={handleConfirmParentChange}
        newParent={pendingParentChange}
      />
    </>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: "90%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  dialogHeaderGradient: {
    // borderRadius: 12,
    // borderBottomLeftRadius: 0,
    // borderBottomRightRadius: 0,
    // borderTopLeftRadius: 0,
    // borderTopRightRadius: 0,
    overflow: "hidden",
    backgroundColor: "#3B1CB0",
    borderWidth: 14,
    borderColor: "#FFFFFF",
  },
  dialogTitleContainer: {
    backgroundColor: "transparent",
    margin: 0,
    padding: 16,
    paddingVertical: 18,
  },
  dialogTitleText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  dialogContent: {
    maxHeight: 450,
    paddingHorizontal: 0,
    backgroundColor: "#F8F5FF",
  },
  scrollView: {
    maxHeight: 450,
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  segmentedButtons: {
    marginBottom: 16,
    borderRadius: 28,
    backgroundColor: "#EDE7F6",
    borderWidth: 1,
    borderColor: "#B39DDB",
  },
  segmentButton: {
    flex: 1,
    minWidth: 0,
  },
  segmentLabel: {
    fontSize: 14,
  },
  taskTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  taskTypeChip: {
    width: "48%",
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chipContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  chip: {
    marginRight: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
  },
  clearDateButton: {
    minWidth: 60,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    zIndex: 100,
    elevation: 6,
    borderWidth: 2,
    borderColor: "#5A2DFF",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#5A2DFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerInput: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 40,
    flex: 1,
    color: "#333",
    fontFamily: "Quicksand-Regular",
  },
  pickerPlaceholder: {
    color: "#7E57C2",
    fontSize: 16,
    fontWeight: "500",
  },
  pickerIconContainer: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  pickerIcon: {
    fontSize: 16,
    color: "#5A2DFF",
    fontFamily: "Quicksand-Regular",
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pickerModalTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: "Quicksand-Bold",
  },
  pickerModalCloseButton: {
    padding: 4,
  },
  pickerModalCloseText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontFamily: "Quicksand-Bold",
  },
  pickerOptionsList: {
    maxHeight: 400,
  },
  pickerOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  pickerOptionSelected: {
    backgroundColor: "#EDE7F6",
  },
  pickerOptionText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Quicksand-Regular",
  },
  pickerOptionTextSelected: {
    color: "#5A2DFF",
    fontFamily: "Quicksand-Medium",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    fontStyle: "italic",
  },
  error: {
    color: "#B00020",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
  },
});

export default TodoFormModal;
