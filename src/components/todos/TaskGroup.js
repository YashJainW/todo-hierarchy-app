import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Divider } from "react-native-paper";
import TaskTreeNode from "./TaskTreeItem";

/**
 * Helper function to recursively collect all task IDs from a task tree
 */
const getAllTaskIds = (task) => {
  const ids = new Set();

  const collectIds = (node) => {
    if (!node || !node.id) return;
    ids.add(node.id);

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        collectIds(child);
      });
    }
  };

  collectIds(task);
  return ids;
};

/**
 * Component to display a task group (root task with its tree)
 */
const TaskGroup = ({
  rootTask,
  allTasks,
  onToggleComplete,
  onEdit,
  onDelete,
  menuVisible,
  onMenuToggle,
  getPriorityColor,
  expandAllByDefault = false,
  showEditOption = true,
  showDeleteOption = true,
  deletingTaskId = null,
}) => {
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Track which tasks should be expanded (for showing full path to leaf)
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  // Track if a leaf is currently selected to toggle collapse on second tap
  const [selectedLeafId, setSelectedLeafId] = useState(null);

  // Update expandedTaskIds when rootTask changes (e.g., when expandAllByDefault is true)
  useEffect(() => {
    if (expandAllByDefault && rootTask) {
      const allIds = getAllTaskIds(rootTask);
      setExpandedTaskIds(allIds);
    }
  }, [expandAllByDefault, rootTask?.id]);

  // Defensive check for missing rootTask
  if (!rootTask || !rootTask.id) {
    return null;
  }

  // Function to find and expand the path to a target task
  const expandPathToTask = (taskNode, targetId, path = []) => {
    if (!taskNode || !taskNode.id) return false;

    const currentPath = [...path, taskNode.id];

    if (taskNode.id === targetId) {
      // Found the target - expand all tasks in the path
      setExpandedTaskIds(new Set(currentPath));
      return true;
    }

    // Check children recursively
    if (taskNode.children && taskNode.children.length > 0) {
      for (const child of taskNode.children) {
        if (expandPathToTask(child, targetId, currentPath)) {
          return true;
        }
      }
    }

    return false;
  };

  // Handle expand group when leaf task is tapped
  const handleExpandGroup = (taskId) => {
    // If the same leaf is tapped again, collapse the group
    if (selectedLeafId === taskId && expandedTaskIds.size > 0) {
      // Collapse: clear expansion and highlight, return to default state
      setExpandedTaskIds(new Set());
      setHighlightedTaskId(null);
      setSelectedLeafId(null);
      return;
    }

    // First tap or different leaf: expand the group and highlight new leaf
    setHighlightedTaskId(taskId);
    setSelectedLeafId(taskId);

    // Expand the entire path from root to this leaf task
    expandPathToTask(rootTask, taskId);

    // Highlight persists until user taps the same leaf again to collapse
  };

  return (
    <View style={styles.groupContainer}>
      <View style={styles.treeContainer}>
        <Divider />
        {/* Task Tree */}
        {/* Render root and all leaf tasks */}
        <TaskTreeNode
          task={rootTask}
          allTasks={allTasks}
          level={0}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          menuVisible={menuVisible}
          onMenuToggle={onMenuToggle}
          getPriorityColor={getPriorityColor}
          highlightedTaskId={highlightedTaskId}
          onExpandGroup={handleExpandGroup}
          expandedTaskIds={expandedTaskIds}
          parentExpanded={true} // Root is always expanded for visibility
          selectedLeafId={selectedLeafId}
          showEditOption={showEditOption}
          showDeleteOption={showDeleteOption}
          deletingTaskId={deletingTaskId}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  treeContainer: {
    backgroundColor: "#fff",
  },
});

export default TaskGroup;
