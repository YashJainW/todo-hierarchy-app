-- Fix for get_dashboard_tasks function
-- Run this in your Supabase SQL Editor
-- Uses correct column names: parent_todo_id, parent_life_goal_id
-- Handles empty results gracefully

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_dashboard_tasks();

-- Create the corrected function
CREATE OR REPLACE FUNCTION get_dashboard_tasks()
RETURNS TABLE (
  id uuid,
  title text,
  task_name text,
  task_type text,
  state text,
  priority text,
  description text,
  due_date date,
  parent_id uuid,
  life_goal_id uuid,
  user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_children_count bigint,
  children_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH child_counts AS (
    SELECT 
      child.parent_todo_id as parent_id,
      COUNT(*)::bigint as total_count,
      COUNT(*) FILTER (WHERE child.state = 'completed')::bigint as completed_count
    FROM todos child
    WHERE child.parent_todo_id IS NOT NULL
      AND child.user_id = auth.uid()
    GROUP BY child.parent_todo_id
  )
  SELECT 
    t.id,
    COALESCE(t.task_name, '') as title,
    t.task_name,
    t.task_type,
    t.state,
    t.priority,
    t.description,
    t.due_date,
    t.parent_todo_id as parent_id,
    t.parent_life_goal_id as life_goal_id,
    t.user_id,
    t.created_at,
    t.updated_at,
    t.completed_at,
    COALESCE(cc.completed_count, 0)::bigint as completed_children_count,
    COALESCE(cc.total_count, 0)::bigint as children_count
  FROM todos t
  LEFT JOIN child_counts cc ON cc.parent_id = t.id
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dashboard_tasks() TO authenticated;

-- Verify the function was created successfully
-- You can test it with: SELECT * FROM get_dashboard_tasks();

-- ============================================================================
-- Function: get_hierarchy_stats
-- Returns statistics for root tasks (tasks without parents)
-- ============================================================================

DROP FUNCTION IF EXISTS get_hierarchy_stats();

CREATE OR REPLACE FUNCTION get_hierarchy_stats()
RETURNS TABLE (
  id uuid,
  root_task_name text,
  task_type text,
  created_at timestamptz,
  due_date date,
  total_descendants bigint,
  completed_descendants bigint,
  completion_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE root_tasks AS (
    SELECT 
      rt.id,
      rt.task_name,
      rt.task_type,
      rt.created_at,
      rt.due_date
    FROM todos rt
    WHERE rt.user_id = auth.uid()
      AND rt.parent_todo_id IS NULL
  ),
  task_hierarchy AS (
    -- Include each root itself so leaf roots are counted
    SELECT 
      rt.id as root_id,
      rt.id as descendant_id,
      (SELECT t.state FROM todos t WHERE t.id = rt.id) as descendant_state
    FROM root_tasks rt
    UNION ALL
    -- Anchor: all direct children of root tasks
    SELECT 
      child.parent_todo_id as root_id,
      child.id as descendant_id,
      child.state as descendant_state
    FROM todos child
    WHERE child.user_id = auth.uid()
      AND child.parent_todo_id IN (SELECT rt2.id FROM root_tasks rt2)
    UNION ALL
    -- Recursive: nested children
    SELECT 
      th.root_id,
      child.id as descendant_id,
      child.state as descendant_state
    FROM todos child
    INNER JOIN task_hierarchy th ON child.parent_todo_id = th.descendant_id
    WHERE child.user_id = auth.uid()
  ),
  task_descendants AS (
    SELECT 
      th.root_id,
      COUNT(*)::bigint as total_descendants,
      COUNT(*) FILTER (WHERE th.descendant_state = 'completed')::bigint as completed_descendants
    FROM task_hierarchy th
    GROUP BY th.root_id
  )
  SELECT 
    rt.id,
    rt.task_name as root_task_name,
    rt.task_type,
    rt.created_at,
    rt.due_date,
    COALESCE(td.total_descendants, 0)::bigint as total_descendants,
    COALESCE(td.completed_descendants, 0)::bigint as completed_descendants,
    CASE 
      WHEN COALESCE(td.total_descendants, 0) > 0 THEN
        ROUND(
          (COALESCE(td.completed_descendants, 0)::numeric / td.total_descendants::numeric) * 100, 
          2
        )
      ELSE 0
    END as completion_percentage
  FROM root_tasks rt
  LEFT JOIN task_descendants td ON td.root_id = rt.id
  ORDER BY rt.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_hierarchy_stats() TO authenticated;

-- ============================================================================
-- Function: get_possible_parents
-- Returns valid parent options (todos and life_goals) for a given task type
-- Based on hierarchy rules:
--   daily → weekly todo, life goal
--   weekly → monthly todo, life goal
--   monthly → yearly todo, life goal
--   yearly → life goal only
-- ============================================================================

DROP FUNCTION IF EXISTS get_possible_parents(text, uuid);

CREATE OR REPLACE FUNCTION get_possible_parents(
  task_type_param text,
  current_todo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  title text,
  task_name text,
  task_type text,
  type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH valid_todo_types AS (
    SELECT unnest(
      CASE task_type_param
        WHEN 'daily' THEN ARRAY['weekly']::text[]
        WHEN 'weekly' THEN ARRAY['monthly']::text[]
        WHEN 'monthly' THEN ARRAY['yearly']::text[]
        WHEN 'yearly' THEN ARRAY[]::text[]
        ELSE ARRAY[]::text[]
      END
    ) as allowed_type
  ),
  valid_todos AS (
    SELECT 
      t.id,
      NULL::text as name,
      NULL::text as title,
      COALESCE(t.task_name, 'Untitled Task')::text as task_name,
      t.task_type,
      'todo'::text as type
    FROM todos t
    WHERE t.user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM valid_todo_types WHERE allowed_type = t.task_type)
      AND (current_todo_id IS NULL OR t.id != current_todo_id)
      AND t.state != 'completed' -- Usually don't want to add children to completed tasks
      AND t.task_name IS NOT NULL -- Ensure task_name exists
      AND t.task_type IS NOT NULL -- Ensure task_type exists
  ),
  valid_life_goals AS (
    SELECT 
      lg.id,
      COALESCE(lg.name, 'Unnamed Goal')::text as name,
      NULL::text as title,
      NULL::text as task_name,
      NULL::text as task_type,
      'life_goal'::text as type
    FROM life_goals lg
    WHERE lg.user_id = auth.uid()
      AND lg.name IS NOT NULL -- Ensure name exists
  )
  -- Return todos (if allowed for this task type)
  SELECT * FROM valid_todos
  UNION ALL
  -- Return life goals (always allowed)
  SELECT * FROM valid_life_goals
  ORDER BY type, task_type, name, task_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_possible_parents(text, uuid) TO authenticated;

-- ============================================================================
-- Function: get_life_goal_stats
-- Returns completion statistics for life goals based on their child tasks
-- ============================================================================

DROP FUNCTION IF EXISTS get_life_goal_stats();

CREATE OR REPLACE FUNCTION get_life_goal_stats()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  total_tasks bigint,
  completed_tasks bigint,
  completion_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH task_counts AS (
    SELECT 
      lg.id,
      lg.name,
      lg.description,
      lg.user_id,
      lg.created_at,
      lg.updated_at,
      COUNT(t.id)::bigint as total_tasks,
      COUNT(t.id) FILTER (WHERE t.state = 'completed')::bigint as completed_tasks
    FROM life_goals lg
    LEFT JOIN todos t ON t.parent_life_goal_id = lg.id
    WHERE lg.user_id = auth.uid()
    GROUP BY lg.id, lg.name, lg.description, lg.user_id, lg.created_at, lg.updated_at
  )
  SELECT 
    tc.id,
    tc.name,
    tc.description,
    tc.user_id,
    tc.created_at,
    tc.updated_at,
    COALESCE(tc.total_tasks, 0)::bigint as total_tasks,
    COALESCE(tc.completed_tasks, 0)::bigint as completed_tasks,
    CASE 
      WHEN COALESCE(tc.total_tasks, 0) = 0 THEN 0::numeric
      ELSE ROUND(
        (COALESCE(tc.completed_tasks, 0)::numeric / COALESCE(tc.total_tasks, 1)::numeric) * 100,
        2
      )
    END as completion_percentage
  FROM task_counts tc
  ORDER BY tc.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_life_goal_stats() TO authenticated;

