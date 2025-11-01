import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import supabase from "../../lib/supabase";
import { queryKeys } from "../queryKeys";
import { logger } from "../../utils/logger";

/**
 * Hook to fetch dashboard tasks
 * Replaces the old useDashboardTasks custom hook
 */
export const useDashboardTasks = () => {
  return useQuery({
    queryKey: queryKeys.dashboardTasks,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_tasks");

      if (error) {
        logger.error("[useDashboardTasks] Query failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
        });
        throw new Error(error.message || "Failed to fetch dashboard tasks");
      }

      logger.log("[useDashboardTasks] Query successful:", {
        taskCount: data?.length || 0,
      });
      return data || [];
    },
  });
};

/**
 * Hook to fetch hierarchy statistics
 * Replaces the old useStats custom hook
 * Includes realtime subscription to invalidate on changes
 */
export const useStats = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hierarchy_stats");

      if (error) {
        logger.error("[useStats] Query failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
        });
        throw new Error(error.message || "Failed to fetch statistics");
      }

      logger.log("[useStats] Query successful:", {
        hasData: !!data,
      });
      return data || null;
    },
  });

  // Setup realtime subscription to invalidate stats when todos change
  useEffect(() => {
    const channel = supabase
      .channel("stats-todos-listener")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload) => {
          logger.debug("[useStats] Realtime event received:", {
            event: payload.eventType,
            table: payload.table,
          });
          // Invalidate stats query to trigger refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        // Ignore cleanup errors
      }
    };
  }, [queryClient]);

  return query;
};

/**
 * Hook to fetch children of a specific parent todo
 * Replaces the old useTodoChildren custom hook
 */
export const useTodoChildren = (parentId) => {
  return useQuery({
    queryKey: queryKeys.todoChildren(parentId),
    queryFn: async () => {
      if (!parentId) {
        return [];
      }

      const { data: user } = await supabase.auth.getUser();

      if (!user?.user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("parent_todo_id", parentId)
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[useTodoChildren] Query failed:", {
          parentId,
          message: error.message,
          code: error.code,
        });
        throw new Error(error.message || "Failed to fetch children");
      }

      logger.log("[useTodoChildren] Query successful:", {
        parentId,
        childCount: data?.length || 0,
      });
      return data || [];
    },
    enabled: !!parentId, // Only run query if parentId exists
  });
};

/**
 * Hook to fetch possible parents for a task
 * Used in TodoFormModal for parent selection
 * Uses the get_possible_parents RPC function which enforces hierarchy rules:
 * - daily → weekly todo, life goal
 * - weekly → monthly todo, life goal
 * - monthly → yearly todo, life goal
 * - yearly → life goal only
 */
export const usePossibleParents = (taskType, currentTodoId = null) => {
  return useQuery({
    queryKey: queryKeys.possibleParents(taskType, currentTodoId),
    queryFn: async () => {
      if (!taskType) {
        return [];
      }

      // Use the RPC function which enforces hierarchy rules
      const { data, error } = await supabase.rpc("get_possible_parents", {
        task_type_param: taskType,
        current_todo_id: currentTodoId || null,
      });

      if (error) {
        logger.error("[usePossibleParents] Query failed:", {
          taskType,
          currentTodoId,
          message: error.message,
          code: error.code,
        });
        throw new Error(
          error.message || "Failed to fetch possible parents"
        );
      }

      logger.log("[usePossibleParents] Query successful:", {
        taskType,
        parentCount: data?.length || 0,
      });

      // Format the data to match the expected structure
      return (data || []).map((item) => {
        if (item.type === "life_goal") {
          return {
            id: item.id,
            name: item.name,
            title: item.name,
            type: "life_goal",
          };
        } else {
          return {
            id: item.id,
            task_name: item.task_name,
            title: item.task_name,
            task_type: item.task_type,
            type: "todo",
          };
        }
      });
    },
    enabled: !!taskType, // Only run query if taskType exists
  });
};

/**
 * Hook to fetch tasks associated with a specific life goal
 * Used in LifeGoalsScreen to show goal's children
 */
export const useGoalTasks = (goalId) => {
  return useQuery({
    queryKey: queryKeys.goalTasks(goalId),
    queryFn: async () => {
      if (!goalId) {
        return [];
      }

      const { data: user } = await supabase.auth.getUser();

      if (!user?.user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("todos")
        .select("id, task_name, state, due_date, task_type")
        .eq("parent_life_goal_id", goalId)
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[useGoalTasks] Query failed:", {
          goalId,
          message: error.message,
          code: error.code,
        });
        throw new Error(error.message || "Failed to fetch goal tasks");
      }

      logger.log("[useGoalTasks] Query successful:", {
        goalId,
        taskCount: data?.length || 0,
      });
      return data || [];
    },
    enabled: !!goalId, // Only run query if goalId exists
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnMount: true, // Always refetch when component mounts
  });
};
