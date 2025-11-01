import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { queryKeys } from "../queryKeys";
import {
  createLifeGoal,
  updateLifeGoal,
  deleteLifeGoal,
} from "../useLifeGoals";
import { logger } from "../../utils/logger";

/**
 * Mutation hook for creating a new life goal
 * Automatically invalidates related queries on success
 */
export const useCreateLifeGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description }) => {
      const result = await createLifeGoal(name, description);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      logger.log("[useCreateLifeGoalMutation] Life goal created successfully:", {
        goalId: data?.id,
        name: data?.name,
      });
      // Invalidate life goals query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
    },
    onError: (error) => {
      logger.error("[useCreateLifeGoalMutation] Failed to create life goal:", {
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to create life goal");
    },
  });
};

/**
 * Mutation hook for updating a life goal
 * Invalidates related queries on success
 */
export const useUpdateLifeGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const result = await updateLifeGoal(id, updates);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data, variables) => {
      logger.log("[useUpdateLifeGoalMutation] Life goal updated successfully:", {
        goalId: variables?.id,
        updates: variables?.updates,
      });
      // Invalidate both the list and the specific goal
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.invalidateQueries({
        queryKey: queryKeys.lifeGoal(variables.id),
      });
      // Also invalidate dashboard tasks as they might be affected
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTasks });
    },
    onError: (error, variables) => {
      logger.error("[useUpdateLifeGoalMutation] Failed to update life goal:", {
        goalId: variables?.id,
        updates: variables?.updates,
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to update life goal");
    },
  });
};

/**
 * Mutation hook for deleting a life goal
 * Handles both simple deletion and deletion with associated tasks
 */
export const useDeleteLifeGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, showAlert = true }) => {
      const result = await deleteLifeGoal(id, showAlert);

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
        logger.debug("[useDeleteLifeGoalMutation] Life goal deletion cancelled:", {
          goalId: variables?.id,
        });
        return;
      }

      logger.log("[useDeleteLifeGoalMutation] Life goal deleted successfully:", {
        goalId: variables?.id,
      });
      // Invalidate related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.lifeGoals });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
    onError: (error, variables) => {
      logger.error("[useDeleteLifeGoalMutation] Failed to delete life goal:", {
        goalId: variables?.id,
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Error", error.message || "Failed to delete life goal");
    },
  });
};
