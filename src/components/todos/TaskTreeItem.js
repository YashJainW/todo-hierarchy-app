import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Text,
  Checkbox,
  Chip,
  ProgressBar,
  Menu,
  IconButton,
} from "react-native-paper";
import { format } from "date-fns";
import { getAllDescendants } from "../../utils/taskHierarchy";

/**
 * Recursive component to render a task and its children in a table-like structure
 */
const TaskTreeNode = ({
  task,
  level = 0,
  onToggleComplete,
  onEdit,
  onDelete,
  menuVisible,
  onMenuToggle,
  getPriorityColor,
  highlightedTaskId = null,
  onExpandGroup = null,
  expandedTaskIds = new Set(),
  parentExpanded = true, // Whether parent is expanded (for rendering children)
  selectedLeafId = null, // Currently selected leaf (for persistent highlight)
  showEditOption = true,
  showDeleteOption = true,
}) => {
  // Check if this is a leaf task (no children)
  const hasChildren = task.children && task.children.length > 0;
  const isLeafTask = !hasChildren;

  // Determine if this task should be expanded:
  // 1. Leaf tasks are always expanded
  // 2. If this task's ID is in expandedTaskIds (path to highlighted leaf)
  // 3. Otherwise collapsed (parents are hidden by default)
  // Root starts collapsed, parents start collapsed, only expand if in path to leaf
  const shouldBeExpanded = expandedTaskIds.has(task.id);
  const [expanded, setExpanded] = useState(shouldBeExpanded);

  // Update expanded state when expandedTaskIds changes
  // When expandedTaskIds is cleared (collapse), reset to false
  // When expandedTaskIds includes this task, set to true
  useEffect(() => {
    if (expandedTaskIds.has(task.id)) {
      setExpanded(true);
    } else if (expandedTaskIds.size === 0) {
      // If expandedTaskIds is cleared, collapse this task (unless it's a leaf)
      // Leaf tasks remain visible, but non-leaf tasks should collapse
      if (!isLeafTask) {
        setExpanded(false);
      }
    }
  }, [expandedTaskIds, task.id, isLeafTask]);

  // Defensive checks for missing task data
  if (!task || !task.id) {
    return null;
  }

  const isCompleted = task.state === "completed";
  // Highlight if this task is the selected leaf (persistent) or just tapped (temporary)
  const isHighlighted =
    selectedLeafId === task.id || highlightedTaskId === task.id;

  // Check if this task has a parent (not root level)
  const hasParent = level > 0;

  // Calculate progress based on ALL descendant leaf tasks
  // This ensures a parent (e.g., monthly/yearly) reflects deeper children (e.g., weekly/daily)
  const descendants = getAllDescendants(task);
  const leafDescendants = descendants.filter(
    (node) => !node.children || node.children.length === 0
  );
  const totalTasks = leafDescendants.length;
  const completedTasks = leafDescendants.filter(
    (t) => t.state === "completed"
  ).length;
  let progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  // Clamp to [0, 1] to avoid any rendering glitches from rounding/precision
  if (Number.isNaN(progress)) progress = 0;
  progress = Math.max(0, Math.min(1, progress));
  try {
    if (hasChildren) {
      console.log("ProgressCalc", {
        id: task.id,
        name: task.task_name || task.title,
        type: task.task_type,
        totalLeaves: totalTasks,
        completedLeaves: completedTasks,
        progress,
      });
    }
  } catch {}
  // Show progress whenever this task has children
  const shouldShowProgress = totalTasks > 0;

  const indentWidth = level * 20; // 20px per level for indentation
  // When the group is collapsed (no expandedTaskIds), do not indent leaf rows
  const isGroupExpanded = expandedTaskIds && expandedTaskIds.size > 0;

  const formatDate = (date) => {
    if (!date) return null;
    try {
      return format(new Date(date), "MMM dd, yyyy");
    } catch {
      return null;
    }
  };

  const formattedDate = formatDate(task.due_date);
  const formattedCompletedDate = isCompleted && task.completed_at 
    ? formatDate(task.completed_at) 
    : null;

  const taskTypeColors = {
    yearly: "#9C27B0",
    monthly: "#2196F3",
    weekly: "#FF9800",
    daily: "#4CAF50",
  };

  const taskTypeColor = taskTypeColors[task.task_type] || "#9E9E9E";

  // Priority visuals: darker color badge with letter H/M/L
  const priorityColor = task.priority ? getPriorityColor(task.priority) : null;
  const priorityLetter =
    task.priority?.toLowerCase() === "high"
      ? "H"
      : task.priority?.toLowerCase() === "medium"
      ? "M"
      : task.priority?.toLowerCase() === "low"
      ? "L"
      : null;

  // Handle leaf task tap - expand group and all parents
  const handleTaskTap = () => {
    if (isLeafTask && hasParent && onExpandGroup) {
      // If it's a leaf task with parent, expand the whole group
      // All parents will be expanded via the TaskGroup's expand functionality
      onExpandGroup(task.id);
    }
  };

  // Determine if this task row should be visible:
  // - Leaf tasks: Always visible (these are the actionable items) - at any level
  // - Root (level 0): Hidden by default, visible only if in expansion path
  // - Parent tasks (level > 0): Hidden by default, visible only if in expansion path
  // When expandedTaskIds is empty: only leaf tasks are visible
  const isRowVisible =
    isLeafTask || // Leaf tasks are always visible (covers all levels including root)
    expandedTaskIds.has(task.id); // Parents and roots only visible when in expansion path

  return (
    <View>
      {/* Task Row - Show if it's root (when expanded), leaf, or expanded parent */}
      {isRowVisible && (
        <View
          style={[
            styles.taskRow,
            isCompleted && styles.taskRowCompleted,
            level === 0 && styles.taskRowRoot,
            isHighlighted && isLeafTask && styles.taskRowHighlighted,
            isLeafTask && hasParent && styles.leafTaskWithParent,
          ]}
        >
          {/* Checkbox Column */}
          <View style={styles.checkboxColumn}>
            <Checkbox
              status={isCompleted ? "checked" : "unchecked"}
              onPress={() => onToggleComplete(task)}
            />
          </View>

          {/* Task Name Column - Main content area with full width for text */}
          <TouchableOpacity
            style={[
              styles.taskNameColumn,
              { paddingLeft: isGroupExpanded ? indentWidth : 8 },
            ]}
            activeOpacity={0.7}
            delayLongPress={300}
            onLongPress={() => onMenuToggle(task.id, true)}
            onPress={() => {
              if (hasChildren) {
                // Toggle expand/collapse for parent tasks
                setExpanded(!expanded);
              } else if (isLeafTask) {
                // If it's a leaf task, expand the whole group
                handleTaskTap();
              }
            }}
          >
            <View style={styles.taskNameContent}>
              <View style={styles.taskNameRow}>
                {/* Priority badge (preferred). Falls back to type indicator if no priority */}
                {priorityColor ? (
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: priorityColor },
                    ]}
                  >
                    {priorityLetter && (
                      <Text style={styles.priorityBadgeText}>
                        {priorityLetter}
                      </Text>
                    )}
                  </View>
                ) : (
                  <LinearGradient
                    colors={[taskTypeColor, taskTypeColor + "CC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.typeIndicator}
                  />
                )}
                {/* Task name with proper width */}
                <Text
                  style={[
                    styles.taskNameText,
                    isCompleted && styles.taskNameCompleted,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {task.task_name || task.title || "Untitled Task"}
                </Text>

                {/* Chevron moved to metadata row */}
              </View>

              {/* Metadata Row */}
              <View style={styles.metadataRow}>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: taskTypeColor + "15" },
                  ]}
                >
                  <Text
                    style={[styles.typeBadgeText, { color: taskTypeColor }]}
                  >
                    {task.task_type || "task"}
                  </Text>
                </View>
                {formattedDate && (
                  <Text style={styles.metadataText}>Due: {formattedDate}</Text>
                )}
                {formattedCompletedDate && (
                  <Text style={[styles.metadataText, styles.completedDateText]}>
                    Completed: {formattedCompletedDate}
                  </Text>
                )}
                {isLeafTask && hasParent && (
                  <IconButton
                    icon={
                      selectedLeafId === task.id &&
                      (expandedTaskIds?.size || 0) > 0
                        ? "chevron-down"
                        : "chevron-right"
                    }
                    size={18}
                    iconColor="#666"
                    style={styles.expandIcon}
                    onPress={handleTaskTap}
                  />
                )}
                {shouldShowProgress && (
                  <Text style={styles.progressText}>
                    {completedTasks}/{totalTasks} completed
                  </Text>
                )}
              </View>

              {/* Description */}
              {task.description && (
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {task.description}
                </Text>
              )}

              {/* Progress Bar */}
              {shouldShowProgress && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.round(progress * 100)}%`,
                          backgroundColor: taskTypeColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Actions Column (no visible button; opened via long-press) */}
          <View style={styles.actionsColumn}>
            <Menu
              visible={menuVisible[task.id] || false}
              onDismiss={() => onMenuToggle(task.id, false)}
              anchor={<View style={styles.menuAnchor} />}
            >
              {showEditOption && (
                <Menu.Item
                  onPress={() => {
                    onMenuToggle(task.id, false);
                    onEdit(task);
                  }}
                  title="Edit"
                  leadingIcon="pencil"
                />
              )}
              {showDeleteOption && (
                <Menu.Item
                  onPress={() => {
                    onMenuToggle(task.id, false);
                    onDelete(task);
                  }}
                  title="Delete"
                  leadingIcon="delete"
                  titleStyle={{ color: "#B00020" }}
                />
              )}
            </Menu>
          </View>
        </View>
      )}

      {/* Children Rows - Always render children so leaf tasks are always visible */}
      {/* Children need to be rendered so their visibility can be evaluated (leaf tasks should always show) */}
      {hasChildren && task.children && task.children.length > 0 && (
        <View style={styles.childrenContainer}>
          {task.children
            .filter((child) => child && child.id)
            .map((child) => {
              // Always render children - leaf tasks will always be visible via isRowVisible
              // Parent tasks will only be visible when in expandedTaskIds path
              return (
                <TaskTreeNode
                  key={`${child.id}-${level}`}
                  task={child}
                  level={level + 1}
                  onToggleComplete={onToggleComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  menuVisible={menuVisible}
                  onMenuToggle={onMenuToggle}
                  getPriorityColor={getPriorityColor}
                  highlightedTaskId={highlightedTaskId}
                  onExpandGroup={onExpandGroup}
                  expandedTaskIds={expandedTaskIds}
                  parentExpanded={expanded || expandedTaskIds.has(task.id)}
                  selectedLeafId={selectedLeafId}
                  showEditOption={showEditOption}
                  showDeleteOption={showDeleteOption}
                />
              );
            })}
        </View>
      )}
    </View>
  );
};

// Helper function to expand all parents of a task
const expandAllParents = (task, level, setExpanded) => {
  if (level > 0) {
    setExpanded(true);
  }
};

// Export as TaskTreeNode for recursive use
export default TaskTreeNode;

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  taskRowRoot: {
    backgroundColor: "#fafafa",
    borderBottomWidth: 2,
    borderBottomColor: "#6200ee",
  },
  taskRowCompleted: {
    opacity: 0.7,
  },
  taskRowHighlighted: {
    backgroundColor: "#e3f2fd", // Light blue background for selected leaf
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3", // Blue accent border
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  leafTaskWithParent: {
    // Visual indicator that parent tasks exist above
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fafafa",
  },
  checkboxColumn: {
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 8,
  },
  taskNameColumn: {
    flex: 1,
    paddingRight: 8,
    paddingLeft: 8,
    minWidth: 0, // Allow flex to work properly
  },
  taskNameContent: {
    flex: 1,
  },
  taskNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  typeIndicator: {
    width: 3,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  taskNameText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    color: "#000",
    flex: 1,
    marginRight: 6,
    minWidth: 0, // Allow text to truncate properly
  },
  taskNameCompleted: {
    textDecorationLine: "line-through",
    color: "#666",
  },
  inlinePriorityChip: {
    height: 20,
    margin: 0,
    marginRight: 4,
  },
  expandIcon: {
    margin: 0,
    marginLeft: 4,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    textTransform: "capitalize",
  },
  priorityBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  priorityBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 11,
    fontFamily: "Quicksand-Regular",
    color: "#666",
    marginRight: 8,
  },
  completedDateText: {
    color: "#4CAF50",
    fontWeight: "600",
    marginRight: 8,
  },
  progressText: {
    fontSize: 11,
    fontFamily: "Quicksand-Regular",
    color: "#666",
    marginRight: 8,
  },
  descriptionText: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#666",
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e0e0e0",
    overflow: "hidden",
    marginRight: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    color: "#6200ee",
    minWidth: 35,
  },
  actionsColumn: {
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 8,
  },
  menuAnchor: {
    width: 1,
    height: 1,
  },
  childrenContainer: {
    backgroundColor: "#fafafa",
  },
});

// Helper function to recursively expand all parents
export const expandTaskPath = (taskTree, targetId, level = 0) => {
  // This function can be used to programmatically expand path to a task
  // For now, we handle it in the component itself
};
