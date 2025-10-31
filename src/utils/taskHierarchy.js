/**
 * Utility functions for building and managing task hierarchies
 */

/**
 * Builds a tree structure from a flat list of tasks
 * Groups tasks by root task (tasks without parents)
 *
 * @param {Array} tasks - Flat array of tasks
 * @returns {Array} Array of root tasks with nested children
 */
export const buildTaskTree = (tasks) => {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Create a map for quick lookup using string IDs for comparison
  const taskMap = new Map();
  const rootTasks = [];
  const processedIds = new Set();

  // Normalize ID to string for consistent comparison
  const normalizeId = (id) => {
    if (!id) return null;
    return id.toString();
  };

  // First pass: Create nodes for all tasks (deep copy to avoid mutations)
  tasks.forEach((task) => {
    if (!task || !task.id) {
      return; // Skip invalid tasks
    }

    const taskId = normalizeId(task.id);
    if (!taskId || processedIds.has(taskId)) {
      return; // Skip invalid or duplicate IDs
    }
    processedIds.add(taskId);

    // Create a deep copy to avoid mutating original task objects
    // Preserve all properties from the original task
    taskMap.set(taskId, {
      ...task,
      id: task.id, // Keep original ID (not normalized) for compatibility
      children: [],
      // Ensure all required fields are present
      state: task.state || "not_started",
      task_name: task.task_name || task.title || "",
      task_type: task.task_type || "",
    });
  });

  // Second pass: Build parent-child relationships
  // Note: The get_dashboard_tasks function returns 'parent_id' (aliased from parent_todo_id)
  // and 'life_goal_id' (aliased from parent_life_goal_id)
  // We need to check both parent_id and parent_todo_id for compatibility
  const nodesProcessed = new Set(); // Track which nodes have been processed

  tasks.forEach((task) => {
    const nodeId = normalizeId(task.id);
    if (!nodeId) {
      console.warn(`Invalid node ID for task:`, task);
      return;
    }

    const node = taskMap.get(nodeId);

    if (!node) {
      console.warn(`Task node not found for ID: ${task.id}`);
      return;
    }

    // Skip if already processed (to avoid duplicates)
    if (nodesProcessed.has(nodeId)) {
      return;
    }

    // Check both field names (parent_id from RPC, parent_todo_id from direct queries)
    const parentTodoId = normalizeId(task.parent_id || task.parent_todo_id);

    // Only link if parent is another todo (in the same list)
    // Tasks with only life_goal_id (no todo parent) are treated as root tasks
    if (parentTodoId && taskMap.has(parentTodoId)) {
      const parent = taskMap.get(parentTodoId);
      // Ensure children array exists
      if (!parent.children) {
        parent.children = [];
      }
      // Only add if not already in children
      if (!parent.children.find((child) => normalizeId(child.id) === nodeId)) {
        parent.children.push(node);
      }
      nodesProcessed.add(nodeId);
    } else {
      // This is a root task (no todo parent, may have life_goal parent)
      // Only add if not already in rootTasks
      if (!rootTasks.find((root) => normalizeId(root.id) === nodeId)) {
        rootTasks.push(node);
      }
      nodesProcessed.add(nodeId);
    }
  });

  // Log debug info
  console.log(
    `Built task tree: ${rootTasks.length} root tasks from ${tasks.length} total tasks`
  );

  // Sort children within each node by task_type hierarchy and creation date
  const sortTasks = (taskList) => {
    const typeOrder = { yearly: 0, monthly: 1, weekly: 2, daily: 3 };

    return taskList
      .sort((a, b) => {
        // First sort by type (yearly > monthly > weekly > daily)
        const typeDiff =
          (typeOrder[a.task_type] || 99) - (typeOrder[b.task_type] || 99);
        if (typeDiff !== 0) return typeDiff;

        // Then by creation date (newer first)
        const aDate = new Date(a.created_at || 0);
        const bDate = new Date(b.created_at || 0);
        return bDate - aDate;
      })
      .map((task) => {
        // Recursively sort children
        if (task.children && task.children.length > 0) {
          task.children = sortTasks(task.children);
        }
        return task;
      });
  };

  // Sort root tasks and all nested children
  return sortTasks(rootTasks);
};

/**
 * Gets all descendants of a task (including nested children)
 * @param {Object} task - Task node with children
 * @returns {Array} Flat array of all descendant tasks
 */
export const getAllDescendants = (task) => {
  if (!task || !task.children || task.children.length === 0) {
    return [];
  }

  const descendants = [];

  const collectDescendants = (node) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        descendants.push(child);
        collectDescendants(child);
      });
    }
  };

  collectDescendants(task);
  return descendants;
};

/**
 * Calculates progress for a task based on its children
 * @param {Object} task - Task node with children
 * @returns {Object} Progress info with total, completed, percentage
 */
export const calculateTaskProgress = (task) => {
  const descendants = getAllDescendants(task);
  const total = descendants.length;
  const completed = descendants.filter((t) => t.state === "completed").length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    percentage: Math.round(percentage),
  };
};

/**
 * Finds a task in the tree by ID
 * @param {Array} tree - Root tasks array
 * @param {string} id - Task ID to find
 * @returns {Object|null} Found task or null
 */
export const findTaskInTree = (tree, id) => {
  for (const root of tree) {
    if (root.id === id) {
      return root;
    }
    const findInChildren = (node) => {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          if (child.id === id) {
            return child;
          }
          const found = findInChildren(child);
          if (found) return found;
        }
      }
      return null;
    };
    const found = findInChildren(root);
    if (found) return found;
  }
  return null;
};
