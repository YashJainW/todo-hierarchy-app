export const TASK_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

export const TASK_STATES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

export const TASK_TYPE_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const PRIORITY_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44336',
};

export const STATE_COLORS = {
  not_started: '#9E9E9E',
  in_progress: '#2196F3',
  completed: '#4CAF50',
};

// Hierarchy rules
export const PARENT_RULES = {
  daily: ['weekly'],
  weekly: ['monthly'],
  monthly: ['yearly'],
  yearly: [],
};

