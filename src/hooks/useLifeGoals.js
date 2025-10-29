import { useState, useEffect } from "react";
import supabase from "../lib/supabase";

// Custom hook for managing life goals
export const useLifeGoals = () => {
  const [lifeGoals, setLifeGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLifeGoals = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("life_goals")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setLifeGoals(data || []);
    } catch (err) {
      console.error("Error fetching life goals:", err);
      setError(err.message || "Failed to fetch life goals");
      setLifeGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLifeGoals();
  }, []);

  return {
    lifeGoals,
    loading,
    error,
    refetch: fetchLifeGoals,
  };
};

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
export const deleteLifeGoal = async (id) => {
  try {
    // Check if any todos reference this goal
    const { data: todos, error: todosError } = await supabase
      .from("todos")
      .select("id")
      .eq("life_goal_id", id)
      .limit(1);

    if (todosError) {
      console.warn("Error checking todos:", todosError);
    }

    if (todos && todos.length > 0) {
      return {
        data: null,
        error:
          "Cannot delete life goal. It is referenced by one or more todos.",
      };
    }

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
    console.error("Error deleting life goal:", error);
    return {
      data: null,
      error: error.message || "Failed to delete life goal",
    };
  }
};
