import supabase from "../lib/supabase";
import { Alert } from "react-native";

/**
 * This file now contains only mutation functions for life goals.
 * Query hooks have been moved to src/hooks/queries/useLifeGoalsQueries.js
 * Mutation hooks have been moved to src/hooks/mutations/useLifeGoalMutations.js
 */

// Create a new life goal
export const createLifeGoal = async (name, description) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("life_goals")
      .insert([
        {
          name,
          description: description || null,
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error creating life goal:", error);
    return {
      data: null,
      error: error.message || "Failed to create life goal",
    };
  }
};

// Update an existing life goal
export const updateLifeGoal = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from("life_goals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error updating life goal:", error);
    return {
      data: null,
      error: error.message || "Failed to update life goal",
    };
  }
};

// Delete a life goal
export const deleteLifeGoal = async (id, showAlert = true) => {
  try {
    // Check if any todos reference this goal as parent
    const { data: children, error: childrenError } = await supabase
      .from("todos")
      .select("id, task_name, parent_todo_id")
      .eq("parent_life_goal_id", id);

    if (childrenError) {
      console.warn("Error checking children:", childrenError);
    }

    const hasChildren = children && children.length > 0;

    // If life goal has children (todos that reference it), handle them
    if (hasChildren) {
      // If showAlert is true, show Alert with options
      if (showAlert) {
        return new Promise((resolve) => {
          Alert.alert(
            "Delete Life Goal",
            `This life goal has ${children.length} child todo(s). What would you like to do with the children?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () =>
                  resolve({ data: null, error: "Deletion cancelled" }),
              },
              {
                text: "Clear References",
                onPress: async () => {
                  // Clear parent_life_goal_id from all children
                  // If child has parent_todo_id, keep it; otherwise make it root
                  const result = await performDeleteLifeGoal(
                    id,
                    children,
                    true
                  );
                  resolve(result);
                },
              },
              {
                text: "Delete All (Cascade)",
                style: "destructive",
                onPress: async () => {
                  // Cascade delete all children
                  const result = await performDeleteLifeGoal(
                    id,
                    children,
                    false,
                    true
                  );
                  resolve(result);
                },
              },
            ]
          );
        });
      }

      // If showAlert is false, default to clearing references
      return await performDeleteLifeGoal(id, children, true);
    }

    // No children, proceed with deletion
    return await performDeleteLifeGoal(id);
  } catch (error) {
    console.error("Error deleting life goal:", error);
    return {
      data: null,
      error: error.message || "Failed to delete life goal",
    };
  }
};

// Helper function to perform the actual life goal delete
const performDeleteLifeGoal = async (
  id,
  children = null,
  clearReferences = false,
  cascadeDelete = false
) => {
  try {
    // If cascade delete is requested, delete all children recursively first
    if (cascadeDelete && children && children.length > 0) {
      // Helper function to recursively delete a todo and all its descendants
      const deleteTodoRecursively = async (todoId) => {
        // Get all children of this todo
        const { data: todoChildren } = await supabase
          .from("todos")
          .select("id")
          .eq("parent_todo_id", todoId);

        // Recursively delete grandchildren first
        if (todoChildren && todoChildren.length > 0) {
          for (const grandChild of todoChildren) {
            await deleteTodoRecursively(grandChild.id);
          }
        }

        // Then delete this todo
        const { error: deleteError } = await supabase
          .from("todos")
          .delete()
          .eq("id", todoId);

        if (deleteError) {
          throw deleteError;
        }
      };

      // Delete all children recursively
      for (const child of children) {
        await deleteTodoRecursively(child.id);
      }
    }
    // If children provided and clearReferences is true, clear their parent_life_goal_id references
    else if (children && children.length > 0 && clearReferences) {
      // Clear parent_life_goal_id from children
      // Keep parent_todo_id if it exists, otherwise children become root tasks
      const { error: clearError } = await supabase
        .from("todos")
        .update({
          parent_life_goal_id: null,
        })
        .in(
          "id",
          children.map((c) => c.id)
        );

      if (clearError) {
        throw clearError;
      }
    }

    // Now delete the life goal
    const { data, error } = await supabase
      .from("life_goals")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error performing life goal delete:", error);
    return {
      data: null,
      error: error.message || "Failed to delete life goal",
    };
  }
};
