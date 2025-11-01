/**
 * Centralized logging utility
 * Logs are only output if enabled via configuration
 * Supports: Console logging, File logging (optional), Supabase remote logging (optional)
 */

// Import configuration and dependencies
import { LOGGING_CONFIG } from "./constants";
import { Platform } from "react-native";
import supabase from "../lib/supabase";

/**
 * Check if logging is enabled for a specific level
 */
const isLoggingEnabled = (level) => {
  if (!LOGGING_CONFIG.enabled) {
    return false;
  }

  // Check if specific level is enabled
  if (LOGGING_CONFIG.levels && !LOGGING_CONFIG.levels[level]) {
    return false;
  }

  return true;
};

/**
 * Format log message with prefix
 */
const formatMessage = (prefix, data) => {
  if (!data) {
    return prefix;
  }

  // If data is an object, combine with prefix for structured logging
  if (typeof data === "object" && !Array.isArray(data)) {
    return { prefix, ...data };
  }

  // If data is a string or other primitive, combine both
  return { prefix, data };
};

/**
 * Remote logging queue and batch processing
 */
let logQueue = [];
let isSendingLogs = false;
let batchTimer = null;
let currentUserId = null;

/**
 * Set the current user ID for logging context
 * Call this when user logs in/out
 */
export const setLoggingUserId = (userId) => {
  const previousUserId = currentUserId;
  currentUserId = userId;

  // If user logged in (previousUserId was null, now has userId),
  // update queued logs with null user_id to use the new user_id
  if (previousUserId === null && userId !== null && logQueue.length > 0) {
    logQueue.forEach((log) => {
      if (log.userId === null) {
        log.userId = userId;
      }
    });
  }

  // Flush any pending logs before switching users (if switching from one user to another)
  if (
    previousUserId !== null &&
    previousUserId !== userId &&
    logQueue.length > 0
  ) {
    sendLogsToSupabase();
  }
};

/**
 * Get device information for logging context
 */
const getDeviceInfo = () => {
  return {
    platform: Platform.OS,
    version: Platform.Version,
    // Add more device info if needed
  };
};

/**
 * Queue log for remote sending to Supabase
 */
const queueLogForRemote = (level, prefix, data, userId = null) => {
  if (!LOGGING_CONFIG.remoteLogging?.enabled) return;

  // If sendErrorsOnly is true, only queue error logs
  if (LOGGING_CONFIG.remoteLogging.sendErrorsOnly && level !== "error") {
    return;
  }

  const logUserId = userId || currentUserId;

  logQueue.push({
    level,
    prefix,
    data: typeof data === "object" && !Array.isArray(data) ? data : { data },
    userId: logUserId,
    timestamp: new Date().toISOString(),
    deviceInfo: getDeviceInfo(),
  });

  // Trigger batch send if queue reaches threshold
  if (logQueue.length >= LOGGING_CONFIG.remoteLogging.batchSize) {
    sendLogsToSupabase();
  } else if (!batchTimer) {
    // Schedule periodic batch send
    batchTimer = setTimeout(() => {
      batchTimer = null;
      sendLogsToSupabase();
    }, LOGGING_CONFIG.remoteLogging.batchInterval);
  }
};

/**
 * Send logs to Supabase asynchronously (batched)
 */
let retryCount = 0;
const sendLogsToSupabase = async () => {
  if (isSendingLogs || logQueue.length === 0) {
    return;
  }

  // Clear any pending batch timer
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  isSendingLogs = true;
  const logsToSend = logQueue.splice(0, LOGGING_CONFIG.remoteLogging.batchSize);

  try {
    // Prepare log entries for insertion
    const logEntries = logsToSend.map((log) => ({
      user_id: log.userId || null,
      level: log.level,
      prefix: log.prefix,
      data: log.data,
      timestamp: log.timestamp,
      device_info: log.deviceInfo,
    }));

    // Insert logs into Supabase
    const { error } = await supabase.from("app_logs").insert(logEntries);

    if (error) {
      throw error;
    }

    // Reset retry count on success
    retryCount = 0;

    // Continue sending if queue has more logs
    if (logQueue.length > 0) {
      setTimeout(() => sendLogsToSupabase(), 100); // Small delay between batches
    }
  } catch (error) {
    // Put logs back in queue for retry if enabled
    if (
      LOGGING_CONFIG.remoteLogging.retryOnFailure &&
      retryCount < LOGGING_CONFIG.remoteLogging.maxRetries
    ) {
      logQueue.unshift(...logsToSend); // Put back at front of queue
      retryCount++;

      // Retry after delay
      setTimeout(() => {
        sendLogsToSupabase();
      }, LOGGING_CONFIG.remoteLogging.retryDelay);
    } else {
      // Max retries reached or retry disabled - log error but don't block
      if (LOGGING_CONFIG.enabled && LOGGING_CONFIG.levels?.error) {
        console.error(
          "[Logger] Failed to send logs to Supabase after retries:",
          error.message
        );
      }
      retryCount = 0;
    }

    // Continue processing remaining queue if any
    if (logQueue.length > 0) {
      setTimeout(
        () => sendLogsToSupabase(),
        LOGGING_CONFIG.remoteLogging.retryDelay
      );
    }
  } finally {
    isSendingLogs = false;
  }
};

/**
 * Flush all pending logs to Supabase immediately
 * Useful when app is closing or user is logging out
 */
export const flushLogs = async () => {
  if (logQueue.length > 0) {
    // Send all remaining logs
    while (logQueue.length > 0) {
      await sendLogsToSupabase();
      // Small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

/**
 * Logger utility object
 */
export const logger = {
  /**
   * Log info messages
   * @param {string} prefix - Log prefix/identifier
   * @param {object|string} data - Log data
   * @param {string|null} userId - Optional user ID for remote logging
   */
  log: (prefix, data, userId = null) => {
    if (isLoggingEnabled("log")) {
      console.log(formatMessage(prefix, data));
      queueLogForRemote("log", prefix, data, userId);
    }
  },

  /**
   * Log warning messages
   * @param {string} prefix - Log prefix/identifier
   * @param {object|string} data - Log data
   * @param {string|null} userId - Optional user ID for remote logging
   */
  warn: (prefix, data, userId = null) => {
    if (isLoggingEnabled("warn")) {
      console.warn(formatMessage(prefix, data));
      queueLogForRemote("warn", prefix, data, userId);
    }
  },

  /**
   * Log error messages (always enabled if logging is on)
   * @param {string} prefix - Log prefix/identifier
   * @param {object|string} data - Log data
   * @param {string|null} userId - Optional user ID for remote logging
   */
  error: (prefix, data, userId = null) => {
    if (isLoggingEnabled("error")) {
      console.error(formatMessage(prefix, data));
      queueLogForRemote("error", prefix, data, userId);
    }
  },

  /**
   * Log debug messages
   * @param {string} prefix - Log prefix/identifier
   * @param {object|string} data - Log data
   * @param {string|null} userId - Optional user ID for remote logging
   */
  debug: (prefix, data, userId = null) => {
    if (isLoggingEnabled("debug")) {
      console.log(formatMessage(prefix, data));
      queueLogForRemote("debug", prefix, data, userId);
    }
  },
};

export default logger;
