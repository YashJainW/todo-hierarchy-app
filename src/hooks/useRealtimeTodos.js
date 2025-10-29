import { useEffect } from "react";
import supabase from "../lib/supabase";

/**
 * Hook for real-time updates on the todos table
 * @param {Function} callback - Callback function to execute on changes (typically refetch)
 */
export const useRealtimeTodos = (callback) => {
  useEffect(() => {
    // Create channel
    const channel = supabase
      .channel("public:todos")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "todos",
        },
        (payload) => {
          console.log("Realtime change:", payload);
          // Call the callback to refetch data
          if (callback) {
            callback();
          }
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
};

/**
 * Hook for real-time updates on the life_goals table
 * @param {Function} callback - Callback function to execute on changes (typically refetch)
 */
export const useRealtimeLifeGoals = (callback) => {
  useEffect(() => {
    // Create channel
    const channel = supabase
      .channel("public:life_goals")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "life_goals",
        },
        (payload) => {
          console.log("Realtime change:", payload);
          // Call the callback to refetch data
          if (callback) {
            callback();
          }
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
};
