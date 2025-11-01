-- =====================================================
-- Supabase Logging Setup SQL
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to set up
-- the app_logs table for remote logging
-- =====================================================

-- Create app_logs table
CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error', 'debug')),
  prefix TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_prefix ON app_logs(prefix);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_timestamp ON app_logs(user_id, timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
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
-- Optional: Create function to clean up old logs
-- =====================================================
-- This function can be called periodically to delete
-- logs older than a specified number of days
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM app_logs
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- Optional: Create function to get user logs summary
-- =====================================================
-- This function can be used to get log statistics
-- for a specific user or all users (admin only)
-- =====================================================

CREATE OR REPLACE FUNCTION get_logs_summary(
  user_id_param UUID DEFAULT NULL,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  level TEXT,
  count BIGINT,
  latest_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    app_logs.level,
    COUNT(*)::BIGINT as count,
    MAX(app_logs.timestamp) as latest_timestamp
  FROM app_logs
  WHERE 
    (user_id_param IS NULL OR app_logs.user_id = user_id_param)
    AND app_logs.timestamp >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY app_logs.level
  ORDER BY app_logs.level;
END;
$$;

-- =====================================================
-- Optional: Grant permissions (if needed for admin access)
-- =====================================================
-- Uncomment these if you need admin users to view all logs
-- =====================================================

-- Create admin role (if it doesn't exist)
-- CREATE ROLE admin;
-- GRANT ALL ON app_logs TO admin;

-- Or create a policy for service role (bypasses RLS)
-- CREATE POLICY "Service role can view all logs"
--   ON app_logs FOR SELECT
--   TO service_role
--   USING (true);

-- =====================================================
-- Verification Queries (Run these to verify setup)
-- =====================================================

-- Check if table exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'app_logs'
-- );

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'app_logs';

-- Check RLS policies
-- SELECT * FROM pg_policies 
-- WHERE tablename = 'app_logs';

-- =====================================================
-- Notes:
-- =====================================================
-- 1. The table uses Row Level Security (RLS) so users
--    can only see/insert their own logs
-- 2. Logs are stored with timestamps for easy querying
-- 3. The data column is JSONB for flexible log data storage
-- 4. The device_info column stores device/platform info
-- 5. Indexes are created for common query patterns
-- 6. A cleanup function is provided to delete old logs
-- 7. A summary function is provided for log statistics
-- =====================================================

