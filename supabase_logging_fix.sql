-- =====================================================
-- Supabase Logging RLS Policy Fix
-- =====================================================
-- Run this SQL to fix the RLS policy that's blocking
-- log inserts with null user_id (system/anonymous logs)
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own logs" ON app_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON app_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON app_logs;

-- RLS Policy: Users can view their own logs
-- Allows users to see their own logs, or system logs (null user_id) when not authenticated
CREATE POLICY "Users can view their own logs"
  ON app_logs FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (user_id IS NULL AND auth.uid() IS NULL)
  );

-- RLS Policy: Users can insert their own logs
-- Allows authenticated users to insert logs with their own user_id
-- Allows unauthenticated users to insert logs with null user_id (system/anonymous logs)
-- Note: The logger automatically updates queued logs with user_id when user logs in
CREATE POLICY "Users can insert their own logs"
  ON app_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR (user_id IS NULL AND auth.uid() IS NULL)
  );

-- RLS Policy: Users can delete their own logs (optional - for log cleanup)
-- Allows users to delete their own logs only
CREATE POLICY "Users can delete their own logs"
  ON app_logs FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Alternative: More Permissive Policy (if above doesn't work)
-- =====================================================
-- If you still have issues, you can temporarily use this
-- more permissive policy, but it's less secure:
-- =====================================================

-- Uncomment this section if the above doesn't work:
/*
DROP POLICY IF EXISTS "Users can view their own logs" ON app_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON app_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON app_logs;

-- More permissive: Allow authenticated users to insert any user_id or null
CREATE POLICY "Users can insert their own logs"
  ON app_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
  );

CREATE POLICY "Users can view their own logs"
  ON app_logs FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL
  );
*/

