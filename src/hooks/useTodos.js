import { useState, useEffect, useCallback } from "react";
import supabase from "../lib/supabase";
import { Alert } from "react-native";

// Custom hook for dashboard tasks
export const useDashboardTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        "get_dashboard_tasks"
      );

      if (fetchError) {
        throw fetchError;
      }

      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching dashboard tasks:", err);
      setError(err.message || "Failed to fetch dashboard tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
  };
};

// Custom hook for statistics
export const useStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        "get_hierarchy_stats"
      );

      if (fetchError) {
        throw fetchError;
      }

      setStats(data || null);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err.message || "Failed to fetch statistics");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};

// Custom hook for todo children
export const useTodoChildren = (parentId) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    if (!parentId) {
      setChildren([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase.rpc(
        "get_todo_children",
        { parent_id_param: parentId }
      );

      if (fetchError) {
        throw fetchError;
      }

      setChildren(data || []);
    } catch (err) {
      console.error("Error fetching todo children:", err);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return {
    children,
    loading,
    refetch: fetchChildren,
  };
};

// Get possible parent todos for a given task type
export const getPossibleParents = async (taskType, currentTodoId = null) => {
  try {
    const { data, error } = await supabase.rpc("get_possible_parents", {
      task_type_param: taskType,
      current_todo_id: currentTodoId,
    });

    if (error) {
      throw error;
    }

    // Format the data as needed
    return data || [];
  } catch (error) {
    console.error("Error fetching possible parents:", error);
    return [];
  }
};

// Validate hierarchy rules
export const validateHierarchyRules = (taskType, parentType) => {
  // daily can have: weekly todo, life goal
  if (taskType === "daily") {
    if (parentType === "weekly" || parentType === "life_goal") {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message:
        "Daily tasks can only have weekly todos or life goals as parents",
    };
  }

  // weekly can have: monthly todo, life goal
  if (taskType === "weekly") {
    if (parentType === "monthly" || parentType === "life_goal") {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message:
        "Weekly tasks can only have monthly todos or life goals as parents",
    };
  }

  // monthly can have: yearly todo, life goal
  if (taskType === "monthly") {
    if (parentType === "yearly" || parentType === "life_goal") {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message:
        "Monthly tasks can only have yearly todos or life goals as parents",
    };
  }

  // yearly can have: life goal only
  if (taskType === "yearly") {
    if (parentType === "life_goal") {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message: "Yearly tasks can only have life goals as parents",
    };
  }

  return {
    isValid: false,
    message: "Invalid task type or parent type",
  };
};

// Create a new todo
export const createTodo = async (todoData) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Validate hierarchy rules if parent_id is provided
    if (todoData.parent_id) {
      // First, get the parent todo to check its type
      const { data: parentTodo, error: parentError } = await supabase
        .from("todos")
        .select("task_type")
        .eq("id", todoData.parent_id)
        .single();

      if (parentError) {
        throw new Error("Invalid parent todo selected");
      }

      const parentType = parentTodo.task_type;
      const validation = validateHierarchyRules(todoData.task_type, parentType);

      if (!validation.isValid) {
        return {
          data: null,
          error: validation.message,
        };
      }
    }

    // If parent is a life goal, validate differently
    if (todoData.life_goal_id && todoData.task_type) {
      const validation = validateHierarchyRules(
        todoData.task_type,
        "life_goal"
      );
      if (!validation.isValid) {
        return {
          data: null,
          error: validation.message,
        };
      }
    }

    const insertData = {
      ...todoData,
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from("todos")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error creating todo:", error);
    return {
      data: null,
      error: error.message || "Failed to create todo",
    };
  }
};

// Update an existing todo
export const updateTodo = async (id, updates) => {
  try {
    // Handle completion state changes
    const updateData = { ...updates };

    if (updates.state !== undefined) {
      // Get current state to check if we're transitioning
      const { data: currentTodo, error: currentError } = await supabase
        .from("todos")
        .select("state")
        .eq("id", id)
        .single();

      if (currentError) {
        throw currentError;
      }

      const currentState = currentTodo?.state;
      const newState = updates.state;

      // If state changing to 'completed', set completed_at
      if (newState === "completed" && currentState !== "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      // If state changing from 'completed', set completed_at to null
      if (currentState === "completed" && newState !== "completed") {
        updateData.completed_at = null;
      }
    }

    const { data, error } = await supabase
      .from("todos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error updating todo:", error);
    return {
      data: null,
      error: error.message || "Failed to update todo",
    };
  }
};

// Delete a todo
export const deleteTodo = async (id, showAlert = true) => {
  try {
    // Check if todo has children
    const { data: children, error: childrenError } = await supabase
      .from("todos")
      .select("id, title")
      .eq("parent_id", id);

    if (childrenError) {
      console.warn("Error checking children:", childrenError);
    }

    if (children && children.length > 0) {
      // If showAlert is true, show Alert confirmation
      if (showAlert) {
        return new Promise((resolve) => {
          Alert.alert(
            "Delete Todo",
            `This todo has ${children.length} child todo(s). Deleting it will also delete all children. Do you want to continue?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () =>
                  resolve({ data: null, error: "Deletion cancelled" }),
              },
              {
                text: "Delete All",
                style: "destructive",
                onPress: async () => {
                  const result = await performDelete(id);
                  resolve(result);
                },
              },
            ]
          );
        });
      }

      // If showAlert is false, return error asking for confirmation
      return {
        data: null,
        error: `Cannot delete todo. It has ${children.length} child todo(s). Please confirm cascade delete.`,
      };
    }

    // No children, proceed with deletion
    return await performDelete(id);
  } catch (error) {
    console.error("Error deleting todo:", error);
    return {
      data: null,
      error: error.message || "Failed to delete todo",
    };
  }
};

// Helper function to perform the actual delete
const performDelete = async (id) => {
  try {
    const { data, error } = await supabase
      .from("todos")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error performing delete:", error);
    return {
      data: null,
      error: error.message || "Failed to delete todo",
    };
  }
};
