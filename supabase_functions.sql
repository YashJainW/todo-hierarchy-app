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
      rt.created_at
    FROM todos rt
    WHERE rt.user_id = auth.uid()
      AND rt.parent_todo_id IS NULL
  ),
  task_hierarchy AS (
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

