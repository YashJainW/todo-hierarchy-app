import supabase from "../lib/supabase";
import { Alert } from "react-native";

/**
 * This file now contains only mutation functions and helper utilities.
 * Query hooks have been moved to src/hooks/queries/useTodosQueries.js
 * Mutation hooks have been moved to src/hooks/mutations/useTodoMutations.js
 */

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
  // daily can have: weekly, monthly, yearly todos, or life goal
  if (taskType === "daily") {
    if (
      parentType === "weekly" ||
      parentType === "monthly" ||
      parentType === "yearly" ||
      parentType === "life_goal"
    ) {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message:
        "Daily tasks can only have weekly, monthly, yearly todos or life goals as parents",
    };
  }

  // weekly can have: monthly, yearly todos, or life goal
  if (taskType === "weekly") {
    if (
      parentType === "monthly" ||
      parentType === "yearly" ||
      parentType === "life_goal"
    ) {
      return { isValid: true, message: "" };
    }
    return {
      isValid: false,
      message:
        "Weekly tasks can only have monthly, yearly todos or life goals as parents",
    };
  }

  // monthly can have: yearly todo, or life goal
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

    // Map frontend column names to database column names
    const insertData = {
      task_name: todoData.task_name || todoData.title,
      description: todoData.description || null,
      priority: todoData.priority || null,
      task_type: todoData.task_type,
      state: todoData.state || "not_started",
      due_date: todoData.due_date || null,
      achievement_note: todoData.achievement_note || null,
      user_id: user.id,
    };

    // Map parent_id to parent_todo_id and life_goal_id to parent_life_goal_id
    if (todoData.parent_id) {
      insertData.parent_todo_id = todoData.parent_id;
      insertData.parent_life_goal_id = null;
      delete insertData.parent_id; // Remove to avoid sending invalid column
      delete insertData.life_goal_id; // Remove to avoid sending invalid column
    } else if (todoData.life_goal_id) {
      insertData.parent_life_goal_id = todoData.life_goal_id;
      insertData.parent_todo_id = null;
      delete insertData.parent_id; // Remove to avoid sending invalid column
      delete insertData.life_goal_id; // Remove to avoid sending invalid column
    } else {
      insertData.parent_todo_id = null;
      insertData.parent_life_goal_id = null;
      delete insertData.parent_id; // Remove to avoid sending invalid column
      delete insertData.life_goal_id; // Remove to avoid sending invalid column
    }

    // Remove any title field if it exists (we use task_name)
    if (insertData.title) {
      delete insertData.title;
    }

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

// Helper function to recursively check parent when child is checked and all siblings are complete
const cascadeCheckParent = async (childId) => {
  try {
    // Get user ID
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return;
    }

    // Get the child task to find its parent
    const { data: childTask, error: childError } = await supabase
      .from("todos")
      .select("parent_todo_id, state")
      .eq("id", childId)
      .eq("user_id", user.id)
      .single();

    if (childError || !childTask || !childTask.parent_todo_id) {
      // No parent or error, stop cascading
      return;
    }

    // Get all siblings (including the child we just checked)
    const { data: siblings, error: siblingsError } = await supabase
      .from("todos")
      .select("id, state")
      .eq("parent_todo_id", childTask.parent_todo_id)
      .eq("user_id", user.id);

    if (siblingsError) {
      console.error("Error fetching siblings:", siblingsError);
      return;
    }

    // Check if all siblings are now completed
    const allSiblingsComplete =
      siblings &&
      siblings.length > 0 &&
      siblings.every((sibling) => sibling.state === "completed");

    if (!allSiblingsComplete) {
      // Not all siblings are complete, don't check parent
      return;
    }

    // Get the parent task
    const { data: parentTask, error: parentError } = await supabase
      .from("todos")
      .select("id, state")
      .eq("id", childTask.parent_todo_id)
      .eq("user_id", user.id)
      .single();

    if (parentError || !parentTask) {
      console.error("Error fetching parent:", parentError);
      return;
    }

    // If parent is not already completed, check it
    if (parentTask.state !== "completed") {
      const { error: updateError } = await supabase
        .from("todos")
        .update({
          state: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", parentTask.id);

      if (updateError) {
        console.error("Error updating parent:", updateError);
        return;
      }

      // Recursively cascade up to grandparent
      await cascadeCheckParent(parentTask.id);
    }
  } catch (error) {
    console.error("Error in cascadeCheckParent:", error);
  }
};

// Helper function to recursively check all children when parent is completed
const cascadeCheckChildren = async (parentId) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return;
    }

    const { data: children, error: childrenError } = await supabase
      .from("todos")
      .select("id, state")
      .eq("parent_todo_id", parentId)
      .eq("user_id", user.id);

    if (childrenError) {
      console.error("Error fetching children:", childrenError);
      return;
    }

    if (!children || children.length === 0) {
      return;
    }

    const childrenToCheck = children.filter(
      (child) => child.state !== "completed"
    );

    if (childrenToCheck.length > 0) {
      const { error: updateError } = await supabase
        .from("todos")
        .update({
          state: "completed",
          completed_at: new Date().toISOString(),
        })
        .in(
          "id",
          childrenToCheck.map((c) => c.id)
        );

      if (updateError) {
        console.error("Error checking children:", updateError);
        return;
      }
    }

    // Recursively check grandchildren for ALL children (ensures deeper levels complete)
    for (const child of children) {
      await cascadeCheckChildren(child.id);
    }
  } catch (error) {
    console.error("Error in cascadeCheckChildren:", error);
  }
};

// Helper function to recursively uncheck parent when child is unchecked
const cascadeUncheckParent = async (childId) => {
  try {
    // Get user ID
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return;
    }

    // Get the child task to find its parent
    const { data: childTask, error: childError } = await supabase
      .from("todos")
      .select("parent_todo_id, state")
      .eq("id", childId)
      .eq("user_id", user.id)
      .single();

    if (childError || !childTask || !childTask.parent_todo_id) {
      // No parent or error, stop cascading
      return;
    }

    // Get the parent task
    const { data: parentTask, error: parentError } = await supabase
      .from("todos")
      .select("id, state")
      .eq("id", childTask.parent_todo_id)
      .eq("user_id", user.id)
      .single();

    if (parentError || !parentTask) {
      console.error("Error fetching parent:", parentError);
      return;
    }

    // If parent is completed, change it to in_progress
    if (parentTask.state === "completed") {
      const { error: updateError } = await supabase
        .from("todos")
        .update({
          state: "in_progress",
          completed_at: null, // Clear completed_at since it's no longer completed
        })
        .eq("id", parentTask.id);

      if (updateError) {
        console.error("Error updating parent:", updateError);
        return;
      }

      // Recursively cascade up to grandparent
      await cascadeUncheckParent(parentTask.id);
    }
  } catch (error) {
    console.error("Error in cascadeUncheckParent:", error);
  }
};

// Helper function to recursively uncheck all children
const cascadeUncheckChildren = async (parentId) => {
  try {
    // Get user ID
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return;
    }

    // Get all direct children
    const { data: children, error: childrenError } = await supabase
      .from("todos")
      .select("id, state")
      .eq("parent_todo_id", parentId)
      .eq("user_id", user.id);

    if (childrenError) {
      console.error("Error fetching children:", childrenError);
      return;
    }

    if (!children || children.length === 0) {
      return;
    }

    // Uncheck all children that are currently completed
    const childrenToUncheck = children.filter(
      (child) => child.state === "completed"
    );

    if (childrenToUncheck.length > 0) {
      // Update all completed children to not_started
      const { error: updateError } = await supabase
        .from("todos")
        .update({
          state: "not_started",
          completed_at: null,
        })
        .in(
          "id",
          childrenToUncheck.map((c) => c.id)
        );

      if (updateError) {
        console.error("Error unchecking children:", updateError);
        return;
      }

      // Recursively uncheck grandchildren
      for (const child of childrenToUncheck) {
        await cascadeUncheckChildren(child.id);
      }
    }
  } catch (error) {
    console.error("Error in cascadeUncheckChildren:", error);
  }
};

// Update an existing todo
export const updateTodo = async (id, updates) => {
  try {
    // Handle completion state changes
    const updateData = { ...updates };

    let shouldCascadeCheckChildren = false;
    let shouldCascadeCheckParent = false;
    let shouldCascadeUncheck = false;

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
        shouldCascadeCheckChildren = true;
        shouldCascadeCheckParent = true;
      }

      // If state changing from 'completed', set completed_at to null
      if (currentState === "completed" && newState !== "completed") {
        updateData.completed_at = null;
        shouldCascadeUncheck = true;
      }
    }

    // Map frontend column names to database column names
    // Handle task_name/title mapping
    if (updates.title || updates.task_name) {
      updateData.task_name = updates.task_name || updates.title;
      delete updateData.title; // Always remove title, we don't have this column
    }

    // Map parent_id to parent_todo_id and handle life_goal_id mapping
    if (updates.parent_id !== undefined) {
      updateData.parent_todo_id = updates.parent_id;
      delete updateData.parent_id;
      // If parent_id is set, clear parent_life_goal_id
      if (updates.parent_id) {
        updateData.parent_life_goal_id = null;
      }
    }
    if (updates.life_goal_id !== undefined) {
      updateData.parent_life_goal_id = updates.life_goal_id;
      delete updateData.life_goal_id;
      // If life_goal_id is set, clear parent_todo_id
      if (updates.life_goal_id) {
        updateData.parent_todo_id = null;
      }
    }
    // If both are null/undefined, ensure both database columns are null
    if (
      updates.parent_id === null &&
      (updates.life_goal_id === null || updates.life_goal_id === undefined)
    ) {
      updateData.parent_todo_id = null;
      updateData.parent_life_goal_id = null;
    }

    // Remove any fields that don't exist in the database schema
    delete updateData.title; // Remove title - we use task_name
    delete updateData.parent_id; // Remove parent_id - we use parent_todo_id
    delete updateData.life_goal_id; // Remove life_goal_id - we use parent_life_goal_id

    const { data, error } = await supabase
      .from("todos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Perform cascades after the update succeeds so the database state is current
    if (shouldCascadeCheckChildren) {
      await cascadeCheckChildren(id);
    }

    if (shouldCascadeCheckParent) {
      await cascadeCheckParent(id);
    }

    if (shouldCascadeUncheck) {
      await cascadeUncheckChildren(id);
      await cascadeUncheckParent(id);
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
    // Get the task to check for parent and children
    const { data: todo, error: todoError } = await supabase
      .from("todos")
      .select("parent_todo_id, parent_life_goal_id")
      .eq("id", id)
      .single();

    if (todoError) {
      throw todoError;
    }

    // Check if todo has children
    const { data: children, error: childrenError } = await supabase
      .from("todos")
      .select("id, task_name")
      .eq("parent_todo_id", id);

    if (childrenError) {
      console.warn("Error checking children:", childrenError);
    }

    const hasChildren = children && children.length > 0;
    const hasParent = todo.parent_todo_id || todo.parent_life_goal_id;

    // If task has children, show options to handle them
    if (hasChildren) {
      // If showAlert is true, show Alert with options
      if (showAlert) {
        return new Promise((resolve) => {
          // Determine the default action text based on whether there's a parent
          const defaultActionText = hasParent
            ? "Reparent to Parent"
            : "Clear References";

          Alert.alert(
            "Delete Todo",
            `This todo has ${children.length} child todo(s). What would you like to do with the children?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () =>
                  resolve({ data: null, error: "Deletion cancelled" }),
              },
              {
                text: defaultActionText,
                onPress: async () => {
                  if (hasParent) {
                    // Reparent children to the deleted task's parent
                    const result = await performDelete(id, children);
                    resolve(result);
                  } else {
                    // Clear parent references from children
                    const result = await performDelete(id, children, true);
                    resolve(result);
                  }
                },
              },
              {
                text: "Delete All (Cascade)",
                style: "destructive",
                onPress: async () => {
                  // Cascade delete all children
                  const result = await performDelete(id, children, false, true);
                  resolve(result);
                },
              },
            ]
          );
        });
      }

      // If showAlert is false, default based on whether there's a parent
      if (hasParent) {
        return await performDelete(id, children);
      } else {
        return await performDelete(id, children, true);
      }
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
const performDelete = async (
  id,
  children = null,
  clearReferences = false,
  cascadeDelete = false
) => {
  try {
    // If cascade delete is requested, delete all children recursively first
    if (cascadeDelete && children && children.length > 0) {
      // Recursively delete all children (cascade)
      for (const child of children) {
        // Get child's children for recursive deletion
        const { data: grandChildren } = await supabase
          .from("todos")
          .select("id")
          .eq("parent_todo_id", child.id);

        if (grandChildren && grandChildren.length > 0) {
          // Recursively delete grandchildren first
          await performDelete(child.id, grandChildren, false, true);
        } else {
          // No grandchildren, just delete the child
          const { error: deleteChildError } = await supabase
            .from("todos")
            .delete()
            .eq("id", child.id);

          if (deleteChildError) {
            console.error("Error deleting child:", deleteChildError);
            throw deleteChildError;
          }
        }
      }
    }
    // If children provided and clearReferences is true, clear their parent references
    else if (children && children.length > 0 && clearReferences) {
      // Clear parent references from children (make them root tasks)
      const { error: clearError } = await supabase
        .from("todos")
        .update({
          parent_todo_id: null,
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
    // If children provided and we're reparenting (has parent)
    else if (children && children.length > 0) {
      // Get the task being deleted to find its parent BEFORE deleting
      const { data: todo, error: todoError } = await supabase
        .from("todos")
        .select("parent_todo_id, parent_life_goal_id")
        .eq("id", id)
        .single();

      if (todoError) {
        throw todoError;
      }

      // Reparent all children to the deleted task's parent
      const reparentData = {};

      if (todo.parent_todo_id) {
        reparentData.parent_todo_id = todo.parent_todo_id;
        reparentData.parent_life_goal_id = null;
      } else if (todo.parent_life_goal_id) {
        reparentData.parent_life_goal_id = todo.parent_life_goal_id;
        reparentData.parent_todo_id = null;
      }

      // Always update children - either to parent or clear references if no parent
      if (reparentData.parent_todo_id || reparentData.parent_life_goal_id) {
        // Update all children to point to the deleted task's parent
        // Always explicitly set both fields to ensure proper reparenting
        const updateData = {
          parent_todo_id: reparentData.parent_todo_id ?? null,
          parent_life_goal_id: reparentData.parent_life_goal_id ?? null,
        };

        const { error: reparentError } = await supabase
          .from("todos")
          .update(updateData)
          .in(
            "id",
            children.map((c) => c.id)
          );

        if (reparentError) {
          console.error("Error reparenting children:", reparentError);
          throw reparentError;
        }

        console.log(
          `Reparented ${children.length} children to parent:`,
          updateData
        );
      } else {
        // If no parent, clear parent references from children
        const { error: clearError } = await supabase
          .from("todos")
          .update({
            parent_todo_id: null,
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
    }

    // Now delete the task
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
