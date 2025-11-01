# Remote Logging Setup Guide

This guide explains how to set up and use the Supabase remote logging feature.

## 📋 Overview

The app now supports remote logging to Supabase, which allows you to:
- Store logs in your Supabase database
- View logs associated with specific users
- Query logs for debugging and analysis
- Automatically batch logs for efficient sending
- Retry failed log sends

## 🚀 Quick Start

### 1. Set Up Supabase Table

Run the SQL file `supabase_logging_setup.sql` in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `supabase_logging_setup.sql`
5. Run the query

This will create:
- `app_logs` table for storing logs
- Indexes for faster queries
- Row Level Security (RLS) policies
- Optional cleanup and summary functions

### 2. Enable Remote Logging

Edit `src/utils/constants.js` and set remote logging to enabled:

```javascript
export const LOGGING_CONFIG = {
  // ... other config ...
  
  remoteLogging: {
    enabled: true, // Change this to true
    batchSize: 10,
    batchInterval: 5000,
    retryOnFailure: true,
    maxRetries: 3,
    retryDelay: 2000,
    sendErrorsOnly: false, // Set to true to only send errors
  },
};
```

### 3. Verify Setup

Once enabled, logs will automatically be sent to Supabase. You can verify by:

1. Using the app and generating some logs
2. Checking the `app_logs` table in Supabase
3. Querying logs with SQL:

```sql
-- View recent logs
SELECT * FROM app_logs 
ORDER BY timestamp DESC 
LIMIT 50;

-- View logs for a specific user
SELECT * FROM app_logs 
WHERE user_id = 'USER_ID_HERE'
ORDER BY timestamp DESC;

-- View error logs only
SELECT * FROM app_logs 
WHERE level = 'error'
ORDER BY timestamp DESC;
```

## ⚙️ Configuration Options

### Remote Logging Configuration

Located in `src/utils/constants.js`:

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable/disable remote logging |
| `batchSize` | `10` | Number of logs to send in each batch |
| `batchInterval` | `5000` | Milliseconds between batch sends |
| `retryOnFailure` | `true` | Retry failed log sends |
| `maxRetries` | `3` | Maximum retry attempts |
| `retryDelay` | `2000` | Delay between retries (ms) |
| `sendErrorsOnly` | `false` | If `true`, only send error-level logs |

### Example Configurations

**Development (verbose logging):**
```javascript
remoteLogging: {
  enabled: true,
  batchSize: 5,        // Smaller batches
  batchInterval: 2000,  // Send more frequently
  sendErrorsOnly: false,
}
```

**Production (errors only):**
```javascript
remoteLogging: {
  enabled: true,
  batchSize: 20,        // Larger batches
  batchInterval: 10000, // Send less frequently
  sendErrorsOnly: true, // Only errors
}
```

## 📊 Log Table Structure

The `app_logs` table has the following structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | User ID (from auth.users) |
| `level` | TEXT | Log level: 'log', 'warn', 'error', 'debug' |
| `prefix` | TEXT | Log prefix/identifier |
| `data` | JSONB | Log data (structured) |
| `timestamp` | TIMESTAMPTZ | Log timestamp |
| `device_info` | JSONB | Device/platform information |
| `created_at` | TIMESTAMPTZ | Record creation time |

## 🔍 Querying Logs

### Basic Queries

**Recent logs:**
```sql
SELECT * FROM app_logs 
ORDER BY timestamp DESC 
LIMIT 100;
```

**Logs by user:**
```sql
SELECT * FROM app_logs 
WHERE user_id = 'USER_ID'
ORDER BY timestamp DESC;
```

**Logs by level:**
```sql
SELECT * FROM app_logs 
WHERE level = 'error'
ORDER BY timestamp DESC;
```

**Logs by time range:**
```sql
SELECT * FROM app_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Advanced Queries

**Error summary by user:**
```sql
SELECT 
  user_id,
  COUNT(*) as error_count,
  MAX(timestamp) as latest_error
FROM app_logs
WHERE level = 'error'
GROUP BY user_id
ORDER BY error_count DESC;
```

**Logs by prefix:**
```sql
SELECT * FROM app_logs
WHERE prefix LIKE '[App]%'
ORDER BY timestamp DESC;
```

**Most common errors:**
```sql
SELECT 
  prefix,
  COUNT(*) as count,
  MAX(timestamp) as latest
FROM app_logs
WHERE level = 'error'
GROUP BY prefix
ORDER BY count DESC
LIMIT 10;
```

## 🧹 Maintenance

### Clean Up Old Logs

Use the provided function to delete logs older than a specified number of days:

```sql
-- Delete logs older than 30 days (default)
SELECT cleanup_old_logs();

-- Delete logs older than 7 days
SELECT cleanup_old_logs(7);
```

### Get Log Summary

Get log statistics using the summary function:

```sql
-- Summary for all users (last 7 days)
SELECT * FROM get_logs_summary();

-- Summary for a specific user
SELECT * FROM get_logs_summary('USER_ID');

-- Summary for last 30 days
SELECT * FROM get_logs_summary(NULL, 30);
```

### Set Up Automated Cleanup

**Currently, logs are NOT automatically deleted by default.** You need to set up automatic cleanup manually.

#### Option 1: Using Supabase Cron Jobs (Recommended - Works on all plans)

1. Go to **Database** > **Cron Jobs** in your Supabase dashboard
2. Click **"Create a new cron job"**
3. Configure:
   - **Name:** `cleanup-app-logs`
   - **Schedule:** `0 2 * * *` (daily at 2 AM UTC)
   - **SQL Command:** `SELECT cleanup_old_logs(30);` (keeps logs for 30 days)
   - **Enabled:** Yes
4. Click **"Create cron job"**

**Recommended retention periods:**
- **Development:** 7-14 days
- **Production:** 30-90 days
- **Errors only:** Keep errors longer (90-180 days)

#### Option 2: Using pg_cron Extension (Supabase Pro/Enterprise)

Run the SQL file `supabase_logging_autocleanup.sql` in your SQL Editor. This sets up pg_cron to automatically delete old logs.

**Default:** Deletes logs older than 30 days, runs daily at 2 AM UTC.

**To customize retention period:**
```sql
-- Keep logs for 7 days
SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '0 2 * * *',
  $$SELECT cleanup_old_logs(7)$$
);

-- Keep logs for 90 days
SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '0 2 * * *',
  $$SELECT cleanup_old_logs(90)$$
);
```

#### Option 3: Advanced - Level-Based Cleanup

The `supabase_logging_autocleanup.sql` file includes a function to keep error logs longer than other logs:

```sql
-- Keeps debug: 7 days, log: 14 days, warn: 30 days, error: 90 days
SELECT cleanup_old_logs_by_level(7, 14, 30, 90);
```

**When logs are deleted:**
- **Default:** Daily at 2:00 AM UTC (if using pg_cron)
- **Manual:** When you run `SELECT cleanup_old_logs(30);`
- **Scheduled:** Based on your cron job schedule

**What gets deleted:**
- Logs older than the specified retention period (default: 30 days)
- Deletion is permanent - cannot be recovered

## 🔒 Security

- **Row Level Security (RLS)** is enabled by default
- Users can only view/insert their own logs
- Admin access can be granted via service role or custom policies

### Grant Admin Access (Optional)

If you need admin users to view all logs:

```sql
-- Create admin policy
CREATE POLICY "Admins can view all logs"
  ON app_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = auth.uid() 
      AND permission = 'view_all_logs'
    )
  );
```

## 🐛 Troubleshooting

### RLS Policy Error: "new row violates row-level security policy"

If you see this error when trying to insert logs:

```
ERROR [Logger] Failed to send logs to Supabase after retries: 
new row violates row-level security policy for table "app_logs"
```

**Solution:** Run the fix SQL file `supabase_logging_fix.sql`:

1. Go to Supabase SQL Editor
2. Run the contents of `supabase_logging_fix.sql`

This updates the RLS policies to allow:
- Authenticated users to insert logs with their own `user_id`
- System/anonymous logs with `null` `user_id` when user is not authenticated

### Logs Not Appearing in Supabase

1. **Check if remote logging is enabled:**
   - Verify `LOGGING_CONFIG.remoteLogging.enabled = true`

2. **Check Supabase table exists:**
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'app_logs'
   );
   ```

3. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'app_logs';
   ```

4. **Check app console for errors:**
   - Look for `[Logger] Failed to send logs to Supabase` errors

5. **Test RLS policy:**
   ```sql
   -- This should return true if policies are correct
   SELECT 
     (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL))
   FROM (SELECT auth.uid() as user_id) t;
   ```

### Performance Issues

If you're experiencing performance issues:

1. **Increase batch size:**
   ```javascript
   batchSize: 20, // Increase from 10
   ```

2. **Increase batch interval:**
   ```javascript
   batchInterval: 10000, // Increase from 5000
   ```

3. **Enable errors-only mode:**
   ```javascript
   sendErrorsOnly: true,
   ```

4. **Clean up old logs:**
   ```sql
   SELECT cleanup_old_logs(7); -- Keep only last 7 days
   ```

## 📝 Notes

- Logs are sent **asynchronously** in batches to avoid blocking the UI
- Failed log sends are automatically retried (if enabled)
- Logs are queued and sent in the background
- User ID is automatically set when user logs in/out
- Logs are flushed on sign out to ensure they're sent
- **Logs are NOT automatically deleted by default** - you must set up automatic cleanup
- Without cleanup, logs will accumulate indefinitely and use database storage

## 🔗 Related Files

- `src/utils/logger.js` - Logger implementation
- `src/utils/constants.js` - Configuration
- `src/context/AuthContext.js` - User ID management
- `supabase_logging_setup.sql` - Database setup SQL

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [JSONB Queries](https://www.postgresql.org/docs/current/datatype-json.html)

