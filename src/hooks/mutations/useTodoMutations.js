import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { queryKeys } from "../queryKeys";
import { createTodo, updateTodo, deleteTodo } from "../useTodos";
import { logger } from "../../utils/logger";

/**
 * Mutation hook for creating a new todo
 * Automatically invalidates related queries on success
 */
export const useCreateTodoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (todoData) => {
      const result = await createTodo(todoData);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      logger.log("[useCreateTodoMutation] Todo created successfully:", {
        todoId: data?.id,
        taskName: data?.task_name,
      });
      // Invalidate all related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      // Invalidate possibleParents queries so newly created tasks appear in parent dropdown
      queryClient.invalidateQueries({ queryKey: ["possibleParents"] });
      // Refetch lifeGoals and goalTasks immediately if they're active
      queryClient.refetchQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.refetchQueries({ queryKey: ["goalTasks"] });
      // Also invalidate so inactive queries refetch when screen comes into focus
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.invalidateQueries({ queryKey: ["goalTasks"] });
      queryClient.invalidateQueries({ queryKey: ["todoChildren"] });
    },
    onError: (error) => {
      logger.error("[useCreateTodoMutation] Failed to create todo:", {
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to create task");
    },
  });
};

/**
 * Mutation hook for updating a todo
 * Implements optimistic updates for smooth UX (especially for task toggling)
 */
export const useUpdateTodoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const result = await updateTodo(id, updates);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    // Optimistic update - runs immediately before mutation
    onMutate: async ({ id, updates }) => {
      logger.debug("[useUpdateTodoMutation] Starting optimistic update:", {
        todoId: id,
        updates,
      });
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboardTasks });

      // Snapshot the previous value for rollback
      const previousTasks = queryClient.getQueryData(queryKeys.dashboardTasks);

      // Helper to find all descendant IDs recursively (for cascade down)
      const findAllDescendantIds = (taskId, allTasks) => {
        const descendants = new Set();
        const findChildren = (parentId) => {
          const children = allTasks.filter(
            (t) =>
              (t.parent_id === parentId || t.parent_todo_id === parentId) &&
              !descendants.has(t.id)
          );
          children.forEach((child) => {
            descendants.add(child.id);
            findChildren(child.id);
          });
        };
        findChildren(taskId);
        return Array.from(descendants);
      };

      // Helper to find all ancestor IDs recursively (for cascade up)
      const findAllAncestorIds = (taskId, allTasks) => {
        const ancestors = new Set();
        let currentTask = allTasks.find((t) => t.id === taskId);

        while (currentTask) {
          const parentId = currentTask.parent_id || currentTask.parent_todo_id;
          if (!parentId) break;

          const parent = allTasks.find((t) => t.id === parentId);
          if (!parent) break;

          ancestors.add(parent.id);
          currentTask = parent;
        }

        return Array.from(ancestors);
      };

      // Helper to check if all siblings of a task are completed
      const areAllSiblingsCompleted = (taskId, allTasks) => {
        const task = allTasks.find((t) => t.id === taskId);
        if (!task) return false;

        const parentId = task.parent_id || task.parent_todo_id;
        if (!parentId) return false; // No parent, so can't check siblings

        // Get all siblings (tasks with same parent)
        const siblings = allTasks.filter(
          (t) =>
            t.id !== taskId && // Exclude self
            (t.parent_id === parentId || t.parent_todo_id === parentId)
        );

        if (siblings.length === 0) return true; // Only child, so "all" siblings are complete

        // Check if all siblings are completed
        return siblings.every((sibling) => sibling.state === "completed");
      };

      // Helper to find ancestors that should be checked (all their children are complete)
      const findAncestorsToCheck = (taskId, allTasks) => {
        const ancestorsToCheck = [];
        const consideredCompleted = new Set([taskId]);
        let currentTaskId = taskId;

        while (currentTaskId) {
          const currentTask = allTasks.find((t) => t.id === currentTaskId);
          if (!currentTask) break;

          const parentId = currentTask.parent_id || currentTask.parent_todo_id;
          if (!parentId) break;

          const parent = allTasks.find((t) => t.id === parentId);
          if (!parent) break;

          // Gather siblings (including current task)
          const siblings = allTasks.filter(
            (t) => t.parent_id === parentId || t.parent_todo_id === parentId
          );

          const allSiblingsComplete = siblings.every((sibling) => {
            if (consideredCompleted.has(sibling.id)) {
              return true;
            }
            return sibling.state === "completed";
          });

          if (!allSiblingsComplete) {
            break; // Can't cascade further up if any sibling still incomplete
          }

          // Mark parent as considered complete for higher-level checks
          consideredCompleted.add(parent.id);

          if (parent.state !== "completed") {
            ancestorsToCheck.push(parent.id);
          }

          currentTaskId = parent.id;
        }

        return ancestorsToCheck;
      };

      // Get current tasks data to calculate cascade changes
      const currentTasks =
        queryClient.getQueryData(queryKeys.dashboardTasks) || [];
      if (currentTasks.length === 0) {
        return { previousTasks };
      }

      const taskToUpdate = currentTasks.find((t) => t.id === id);
      if (!taskToUpdate) {
        return { previousTasks };
      }

      const currentState = taskToUpdate.state;
      const newState = updates.state;

      // Check if we're changing state (especially unchecking)
      const isUnchecking =
        currentState === "completed" && newState !== "completed";
      const isChecking =
        currentState !== "completed" && newState === "completed";

      // Collect all affected IDs upfront (calculate before updating cache)
      const allDescendantIds = findAllDescendantIds(id, currentTasks);
      const ancestorsToUncheck = isUnchecking
        ? findAllAncestorIds(id, currentTasks)
        : [];
      const ancestorsToCheck = isChecking
        ? findAncestorsToCheck(id, currentTasks)
        : [];

      // Create sets for fast lookup
      const descendantsSet = new Set(allDescendantIds);
      const ancestorsSet = new Set(ancestorsToUncheck);
      const ancestorsToCheckSet = new Set(ancestorsToCheck);

      // Optimistically update the cache with cascade logic
      queryClient.setQueryData(queryKeys.dashboardTasks, (old) => {
        if (!old || old.length === 0) return old;

        // Apply updates in a single pass
        return old.map((task) => {
          // Update the main task
          if (task.id === id) {
            const optimisticTask = { ...task, ...updates };

            // If state is changing to completed, set completed_at
            if (isChecking) {
              optimisticTask.completed_at = new Date().toISOString();
            }

            // If state is changing from completed, clear completed_at
            if (isUnchecking) {
              optimisticTask.completed_at = null;
            }

            return optimisticTask;
          }

          // CASCADE DOWN: If unchecking parent, uncheck all descendants
          if (
            isUnchecking &&
            descendantsSet.has(task.id) &&
            task.state === "completed"
          ) {
            return {
              ...task,
              state: "not_started",
              completed_at: null,
            };
          }

          // CASCADE DOWN: If checking parent, check all descendants
          if (
            isChecking &&
            descendantsSet.has(task.id) &&
            task.state !== "completed"
          ) {
            return {
              ...task,
              state: "completed",
              completed_at: new Date().toISOString(),
            };
          }

          // CASCADE UP: If unchecking child, uncheck parent if it was completed
          if (
            isUnchecking &&
            ancestorsSet.has(task.id) &&
            task.state === "completed"
          ) {
            return {
              ...task,
              state: "in_progress",
              completed_at: null,
            };
          }

          // CASCADE UP: If checking child and all siblings are now complete, check parent
          // This now works because we've implemented server-side cascade-up for checking
          if (
            isChecking &&
            ancestorsToCheckSet.has(task.id) &&
            task.state !== "completed"
          ) {
            return {
              ...task,
              state: "completed",
              completed_at: new Date().toISOString(),
            };
          }

          return task;
        });
      });

      // Also optimistically update goalTasks cache if the task or its parent belongs to a goal
      // This ensures LifeGoalsScreen shows updates immediately
      const allAffectedTaskIds = new Set([
        id,
        ...allDescendantIds,
        ...ancestorsToCheck,
        ...ancestorsToUncheck,
      ]);

      // Get all goalTasks queries (active and inactive) and update them optimistically
      // We need to update all queries, not just active ones, so updates persist when navigating
      const goalTasksQueries = queryClient.getQueryCache().findAll({
        queryKey: ["goalTasks"],
      });

      const previousGoalTasks = {};

      goalTasksQueries.forEach((query) => {
        const goalId = query.queryKey[1];
        // Get cached data - use getQueryData to get the actual cached value
        const currentGoalTasks =
          queryClient.getQueryData(["goalTasks", goalId]) || [];

        if (!currentGoalTasks || currentGoalTasks.length === 0) {
          return; // Skip if no cached data
        }

        // Check if the updated task or any affected task belongs to this goal
        const hasAffectedTask = currentGoalTasks.some((task) =>
          allAffectedTaskIds.has(task.id)
        );

        if (hasAffectedTask) {
          previousGoalTasks[goalId] = currentGoalTasks;

          // Update goalTasks with the same cascade logic
          const updatedGoalTasks = currentGoalTasks.map((task) => {
            // Update the main task
            if (task.id === id) {
              const optimisticTask = { ...task, ...updates };
              if (isChecking) {
                optimisticTask.completed_at = new Date().toISOString();
              }
              if (isUnchecking) {
                optimisticTask.completed_at = null;
              }
              return optimisticTask;
            }

            // CASCADE DOWN: If checking parent, check all descendants
            if (
              isChecking &&
              descendantsSet.has(task.id) &&
              task.state !== "completed"
            ) {
              return {
                ...task,
                state: "completed",
                completed_at: new Date().toISOString(),
              };
            }

            // CASCADE UP: If checking child and all siblings are now complete, check parent
            if (
              isChecking &&
              ancestorsToCheckSet.has(task.id) &&
              task.state !== "completed"
            ) {
              return {
                ...task,
                state: "completed",
                completed_at: new Date().toISOString(),
              };
            }

            // CASCADE UP: If unchecking child, uncheck parent
            if (
              isUnchecking &&
              ancestorsSet.has(task.id) &&
              task.state === "completed"
            ) {
              return {
                ...task,
                state: "in_progress",
                completed_at: null,
              };
            }

            return task;
          });

          queryClient.setQueryData(["goalTasks", goalId], updatedGoalTasks);
        }
      });

      // Return context with snapshot for potential rollback
      return { previousTasks, previousGoalTasks };
    },
    // Rollback on error
    onError: (error, variables, context) => {
      // Restore the previous data
      if (context?.previousTasks) {
        queryClient.setQueryData(
          queryKeys.dashboardTasks,
          context.previousTasks
        );
      }

      // Restore previous goalTasks data
      if (context?.previousGoalTasks) {
        Object.entries(context.previousGoalTasks).forEach(([goalId, tasks]) => {
          queryClient.setQueryData(["goalTasks", goalId], tasks);
        });
      }

      logger.error("[useUpdateTodoMutation] Failed to update todo:", {
        todoId: variables?.id,
        updates: variables?.updates,
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to update task");
    },
    // Always refresh aggregated data after the mutation completes
    onSettled: (data, error, variables) => {
      if (!error) {
        logger.log("[useUpdateTodoMutation] Todo updated successfully:", {
          todoId: variables?.id,
          updates: variables?.updates,
        });
      }
      // We skip invalidating dashboardTasks to avoid flicker—the optimistic
      // update keeps that cache in sync. We still invalidate aggregated views
      // so their derived metrics stay accurate.
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      // Invalidate possibleParents queries in case task type or state changed
      queryClient.invalidateQueries({ queryKey: ["possibleParents"] });
      // Refetch lifeGoals and goalTasks immediately if they're active (screen is visible)
      queryClient.refetchQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.refetchQueries({ queryKey: ["goalTasks"] });
      // Also invalidate so inactive queries refetch when screen comes into focus
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.invalidateQueries({ queryKey: ["goalTasks"] });
      queryClient.invalidateQueries({ queryKey: ["todoChildren"] });
    },
  });
};

/**
 * Mutation hook for deleting a todo
 * Handles both simple deletion and deletion with children
 */
export const useDeleteTodoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, showAlert = true }) => {
      const result = await deleteTodo(id, showAlert);

      // If deletion was cancelled, don't throw error
      if (result.error === "Deletion cancelled") {
        return { cancelled: true };
      }

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data, variables) => {
      // Don't invalidate if deletion was cancelled
      if (data?.cancelled) {
        logger.debug("[useDeleteTodoMutation] Todo deletion cancelled:", {
          todoId: variables?.id,
        });
        return;
      }

      logger.log("[useDeleteTodoMutation] Todo deleted successfully:", {
        todoId: variables?.id,
      });
      // Invalidate related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      // Invalidate possibleParents queries so deleted tasks are removed from parent dropdown
      queryClient.invalidateQueries({ queryKey: ["possibleParents"] });
      // Refetch lifeGoals and goalTasks immediately if they're active
      queryClient.refetchQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.refetchQueries({ queryKey: ["goalTasks"] });
      // Also invalidate so inactive queries refetch when screen comes into focus
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.invalidateQueries({ queryKey: ["goalTasks"] });
      queryClient.invalidateQueries({ queryKey: ["todoChildren"] });
    },
    onError: (error, variables) => {
      logger.error("[useDeleteTodoMutation] Failed to delete todo:", {
        todoId: variables?.id,
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to delete task");
    },
  });
};
