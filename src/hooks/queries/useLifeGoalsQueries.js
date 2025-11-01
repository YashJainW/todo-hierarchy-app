import { useQuery } from "@tanstack/react-query";
import supabase from "../../lib/supabase";
import { queryKeys } from "../queryKeys";
import { logger } from "../../utils/logger";

/**
 * Hook to fetch all life goals with statistics
 * Replaces the old useLifeGoals custom hook
 */
export const useLifeGoals = () => {
  return useQuery({
    queryKey: queryKeys.lifeGoals,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_life_goal_stats");

      if (error) {
        logger.error("[useLifeGoals] Query failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
        });
        throw new Error(error.message || "Failed to fetch life goals");
      }

      logger.log("[useLifeGoals] Query successful:", {
        goalCount: data?.length || 0,
      });
      return data || [];
    },
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnMount: true, // Always refetch when component mounts
  });
};

/**
 * Hook to fetch a specific life goal with its details
 * Can be used for detailed views
 */
export const useLifeGoal = (goalId) => {
  return useQuery({
    queryKey: queryKeys.lifeGoal(goalId),
    queryFn: async () => {
      if (!goalId) {
        return null;
      }

      const { data: user } = await supabase.auth.getUser();

      if (!user?.user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("life_goals")
        .select("*")
        .eq("id", goalId)
        .eq("user_id", user.user.id)
        .single();

      if (error) {
        logger.error("[useLifeGoal] Query failed:", {
          goalId,
          message: error.message,
          code: error.code,
        });
        throw new Error(error.message || "Failed to fetch life goal");
      }

      logger.log("[useLifeGoal] Query successful:", {
        goalId,
        hasData: !!data,
      });
      return data;
    },
    enabled: !!goalId, // Only run query if goalId exists
  });
};
