import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  Platform,
  Text as RNText,
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
import RNPickerSelect from "react-native-picker-select";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import {
  getPossibleParents,
  createTodo,
  updateTodo,
  validateHierarchyRules,
} from "../../hooks/useTodos";
import supabase from "../../lib/supabase";
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
  // Controlled picker value (e.g., "todo:<uuid>" or "life_goal:<uuid>")
  const [selectedParentValue, setSelectedParentValue] = useState(null);
  // Guard to prevent re-sync effect from overwriting user's selection during edit
  const [userChangedParent, setUserChangedParent] = useState(false);
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
        setSelectedParentValue(null);
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

  // Fetch possible parents when taskType changes
  useEffect(() => {
    if (visible && taskType) {
      fetchPossibleParents();
    }
  }, [taskType, visible, existingTodo?.id]);

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
        setSelectedParentValue(null);
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
    setSelectedParentValue(null);
    setPreviousParentId(null);
    setPreviousParentType(null);
    setErrors(null);
    setUserChangedParent(false);
  };

  // Fetch possible parents
  const fetchPossibleParents = async () => {
    try {
      setFetchingParents(true);
      const parents = await getPossibleParents(
        taskType,
        existingTodo?.id || null
      );

      // Add current parent to the list if it exists but not in the fetched list
      // This handles cases where parent is completed or filtered but still should be selectable
      if (existingTodo) {
        const parentId = existingTodo.parent_id || existingTodo.parent_todo_id;
        const lifeGoalId =
          existingTodo.life_goal_id || existingTodo.parent_life_goal_id;

        if (parentId) {
          const parentInList = parents?.some(
            (p) =>
              p.type === "todo" &&
              (p.id === parentId || p.id?.toString() === parentId?.toString())
          );

          if (!parentInList) {
            // Fetch the parent todo details to add it to the list
            const { data: parentTodo } = await supabase
              .from("todos")
              .select("id, task_name, task_type")
              .eq("id", parentId)
              .single();

            if (parentTodo) {
              parents.push({
                id: parentTodo.id,
                task_name: parentTodo.task_name,
                task_type: parentTodo.task_type,
                type: "todo",
              });
            }
          }
        } else if (lifeGoalId) {
          const goalInList = parents?.some(
            (p) =>
              p.type === "life_goal" &&
              (p.id === lifeGoalId ||
                p.id?.toString() === lifeGoalId?.toString())
          );

          if (!goalInList) {
            // Fetch the life goal details to add it to the list
            const { data: lifeGoal } = await supabase
              .from("life_goals")
              .select("id, name")
              .eq("id", lifeGoalId)
              .single();

            if (lifeGoal) {
              parents.push({
                id: lifeGoal.id,
                name: lifeGoal.name,
                type: "life_goal",
              });
            }
          }
        }
      }

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
    setUserChangedParent(true);
    // Handle null, undefined, empty string, or "none" - all mean no parent
    if (!value || value === "none" || value === null) {
      // Check if we're clearing a parent during edit (had a parent before)
      if (existingTodo && (previousParentId || previousParentType)) {
        setPendingParentChange({ id: null, type: null });
        setShowParentChangeConfirm(true);
      } else {
        handleParentSelection(null, null);
      }
      setSelectedParentValue(null);
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
      setSelectedParentValue(null);
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
    const items = [];

    // // Add placeholder as first item (to clear parent selection)
    // items.push({
    //   label: "Select parent (optional)",
    //   value: null,
    //   key: "placeholder",
    // });

    // Group by type
    const todoParents = possibleParents.filter((p) => p.type === "todo");
    const lifeGoalParents = possibleParents.filter(
      (p) => p.type === "life_goal"
    );

    // Add life goals
    lifeGoalParents.forEach((parent) => {
      items.push({
        label: parent.name || parent.title,
        value: `life_goal:${parent.id}`,
        key: `life_goal_${parent.id}`,
      });
    });

    // Add todo parents
    todoParents.forEach((parent) => {
      items.push({
        label: `${parent.title || parent.task_name} (${parent.task_type})`,
        value: `todo:${parent.id}`,
        key: `todo_${parent.id}`,
      });
    });

    return items;
  };

  const getSelectedParentValue = () => selectedParentValue;

  return (
    <>
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <RNText style={styles.dialogTitleText}>
              {existingTodo ? "Edit Task" : "Create Task"}
            </RNText>
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              style={styles.scrollView}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              bounces={false}
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
                  {
                    value: "daily",
                    label: "Daily",
                    style: styles.segmentButton,
                    labelStyle: styles.segmentLabel,
                  },
                  {
                    value: "weekly",
                    label: "Weekly",
                    style: styles.segmentButton,
                    labelStyle: styles.segmentLabel,
                  },
                  {
                    value: "monthly",
                    label: "Monthly",
                    style: styles.segmentButton,
                    labelStyle: styles.segmentLabel,
                  },
                  {
                    value: "yearly",
                    label: "Yearly",
                    style: styles.segmentButton,
                    labelStyle: styles.segmentLabel,
                  },
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
                  useNativeAndroidPickerStyle={false}
                  pickerProps={{
                    accessibilityLabel: "Select parent",
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
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActions}>
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
    maxHeight: "85%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  dialogTitle: {
    backgroundColor: "#5A2DFF",
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
  pickerInput: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#B39DDB",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  pickerPlaceholder: {
    color: "#7E57C2",
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
