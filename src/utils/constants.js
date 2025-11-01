export const TASK_TYPES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

export const TASK_STATES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

export const PRIORITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

export const TASK_TYPE_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const PRIORITY_COLORS = {
  low: "#4CAF50",
  medium: "#FF9800",
  high: "#F44336",
};

export const STATE_COLORS = {
  not_started: "#9E9E9E",
  in_progress: "#2196F3",
  completed: "#4CAF50",
};

// Hierarchy rules
export const PARENT_RULES = {
  daily: ["weekly"],
  weekly: ["monthly"],
  monthly: ["yearly"],
  yearly: [],
};

// Logging configuration
// Set enabled: true to enable logging, false to disable all logs
// You can also control individual log levels
export const LOGGING_CONFIG = {
  enabled: typeof __DEV__ !== "undefined" ? __DEV__ : true, // Automatically enabled in development, disabled in production
  // Set to true to always enable, false to always disable
  // Override: enabled: true or enabled: false

  // Control individual log levels
  levels: {
    log: true, // General info logs
    warn: true, // Warnings
    error: true, // Errors (should always be enabled for debugging)
    debug: true, // Debug messages
  },

  // Remote Supabase logging (asynchronous, batched)
  remoteLogging: {
    enabled: false, // Set to true to enable remote logging to Supabase
    batchSize: 10, // Send logs in batches of 10
    batchInterval: 5000, // Send batch every 5 seconds (ms)
    retryOnFailure: true, // Retry failed sends
    maxRetries: 3, // Maximum number of retries for failed batches
    retryDelay: 2000, // Delay between retries (ms)
    sendErrorsOnly: false, // If true, only send error-level logs remotely
  },
};
