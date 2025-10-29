import React, { useState, useEffect } from "react";
import { ScrollView, View, StyleSheet, Platform } from "react-native";
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
import RNPickerSelect from "react-native-picker-select";
import { format } from "date-fns";
import {
  getPossibleParents,
  createTodo,
  updateTodo,
  validateHierarchyRules,
} from "../../hooks/useTodos";
import ParentConfirmationDialog from "./ParentConfirmationDialog";

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
  const [possibleParents, setPossibleParents] = useState([]);
  const [previousParentId, setPreviousParentId] = useState(null);
  const [previousParentType, setPreviousParentType] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState(null);
  const [fetchingParents, setFetchingParents] = useState(false);

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
      if (existingTodo.parent_id) {
        setSelectedParentId(existingTodo.parent_id);
        setSelectedParentType("todo");
        setPreviousParentId(existingTodo.parent_id);
        setPreviousParentType("todo");
      } else if (existingTodo.life_goal_id) {
        setSelectedParentId(existingTodo.life_goal_id);
        setSelectedParentType("life_goal");
        setPreviousParentId(existingTodo.life_goal_id);
        setPreviousParentType("life_goal");
      } else {
        setSelectedParentId(null);
        setSelectedParentType(null);
        setPreviousParentId(null);
        setPreviousParentType(null);
      }
      setErrors(null);
    } else if (!existingTodo && visible) {
      // Reset form for new todo
      resetForm();
    }
  }, [existingTodo, visible]);

  // Fetch possible parents when taskType changes
  useEffect(() => {
    if (visible && taskType) {
      fetchPossibleParents();
    }
  }, [taskType, visible, existingTodo?.id]);

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
    setPreviousParentId(null);
    setPreviousParentType(null);
    setErrors(null);
  };

  // Fetch possible parents
  const fetchPossibleParents = async () => {
    try {
      setFetchingParents(true);
      const parents = await getPossibleParents(
        taskType,
        existingTodo?.id || null
      );
      setPossibleParents(parents || []);
    } catch (error) {
      console.error("Error fetching possible parents:", error);
      setPossibleParents([]);
    } finally {
      setFetchingParents(false);
    }
  };

  // Handle parent change
  const handleParentChange = (value) => {
    if (value === "none" || value === null) {
      handleParentSelection(null, null);
      return;
    }

    // Parse the value - format: "type:id" or just id
    const parts = value.split(":");
    const parentType = parts[0];
    const parentId = parts[1] || value;

    // Check if parent is changing during edit
    if (
      existingTodo &&
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
    setSelectedParentId(parentId);
    setSelectedParentType(parentType);

    // Validate hierarchy
    if (taskType && parentType) {
      const validation = validateHierarchyRules(taskType, parentType);
      if (!validation.isValid) {
        setErrors(validation.message);
      } else {
        setErrors(null);
      }
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
    if (selectedParentType && taskType) {
      const validation = validateHierarchyRules(taskType, selectedParentType);
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

    setLoading(true);
    setErrors(null);

    try {
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

      let result;
      if (existingTodo) {
        result = await updateTodo(existingTodo.id, todoData);
      } else {
        result = await createTodo(todoData);
      }

      if (result.error) {
        setErrors(result.error);
      } else {
        resetForm();
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrors(error.message || "Failed to save task");
    } finally {
      setLoading(false);
    }
  };

  // Format picker items
  const formatPickerItems = () => {
    const items = [{ label: "None", value: "none", key: "none" }];

    // Group by type
    const todoParents = possibleParents.filter((p) => p.type === "todo");
    const lifeGoalParents = possibleParents.filter(
      (p) => p.type === "life_goal"
    );

    if (lifeGoalParents.length > 0) {
      items.push({
        label: "── Life Goals ──",
        value: "header_life_goals",
        key: "header_life_goals",
        disabled: true,
      });
      lifeGoalParents.forEach((parent) => {
        items.push({
          label: parent.name || parent.title,
          value: `life_goal:${parent.id}`,
          key: `life_goal_${parent.id}`,
        });
      });
    }

    if (todoParents.length > 0) {
      items.push({
        label: "── Todo Parents ──",
        value: "header_todos",
        key: "header_todos",
        disabled: true,
      });
      todoParents.forEach((parent) => {
        items.push({
          label: `${parent.title || parent.task_name} (${parent.task_type})`,
          value: `todo:${parent.id}`,
          key: `todo_${parent.id}`,
        });
      });
    }

    return items;
  };

  const getSelectedParentValue = () => {
    if (!selectedParentId || !selectedParentType) {
      return "none";
    }
    return `${selectedParentType}:${selectedParentId}`;
  };

  return (
    <>
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
          <Dialog.Title>
            {existingTodo ? "Edit Task" : "Create Task"}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Task Name Input */}
              <TextInput
                label="Task Name *"
                value={taskName}
                onChangeText={(text) => {
                  setTaskName(text);
                  if (errors) setErrors(null);
                }}
                mode="outlined"
                style={styles.input}
                disabled={loading}
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
                disabled={loading}
              />

              {/* Task Type Segmented Buttons */}
              <Text style={styles.label}>Task Type *</Text>
              <SegmentedButtons
                value={taskType}
                onValueChange={(value) => {
                  setTaskType(value);
                  // Reset parent selection when type changes
                  setSelectedParentId(null);
                  setSelectedParentType(null);
                  if (errors) setErrors(null);
                }}
                buttons={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ]}
                style={styles.segmentedButtons}
              />

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
                  disabled={loading}
                >
                  {dueDate ? format(dueDate, "PPP") : "Select Due Date"}
                </Button>
                {dueDate && (
                  <Button
                    mode="text"
                    onPress={clearDate}
                    style={styles.clearDateButton}
                    disabled={loading}
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
                <RNPickerSelect
                  onValueChange={handleParentChange}
                  items={formatPickerItems()}
                  value={getSelectedParentValue()}
                  placeholder={{
                    label: "Select parent (optional)",
                    value: null,
                  }}
                  style={{
                    inputIOS: styles.pickerInput,
                    inputAndroid: styles.pickerInput,
                    placeholder: styles.pickerPlaceholder,
                  }}
                  disabled={loading}
                />
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
                  disabled={loading}
                />
              )}

              {/* Validation Errors */}
              {errors && <Text style={styles.error}>{errors}</Text>}
            </ScrollView>
          </Dialog.ScrollArea>

          <Dialog.Actions>
            <Button onPress={onDismiss} disabled={loading}>
              Cancel
            </Button>
            <Button
              onPress={handleSubmit}
              loading={loading}
              disabled={!isFormValid() || loading}
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
  },
  scrollArea: {
    maxHeight: 500,
    paddingHorizontal: 0,
  },
  scrollContent: {
    padding: 16,
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
  },
  chipContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  chip: {
    marginRight: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  dateButton: {
    flex: 1,
  },
  clearDateButton: {
    minWidth: 60,
  },
  pickerInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  pickerPlaceholder: {
    color: "#999",
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
