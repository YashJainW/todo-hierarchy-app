/**
 * Centralized Query Keys for React Query
 *
 * This file contains all query key definitions used throughout the app.
 * Using a centralized file prevents typos and makes refactoring easier.
 */

export const queryKeys = {
  // Dashboard tasks
  dashboardTasks: ["dashboardTasks"],

  // Statistics
  stats: ["stats"],

  // Life goals
  lifeGoals: ["lifeGoals"],

  // Life goal with stats (specific goal)
  lifeGoal: (id) => ["lifeGoal", id],

  // Todo children (tasks under a parent)
  todoChildren: (parentId) => ["todoChildren", parentId],

  // Possible parents for a task (for parent selection)
  possibleParents: (taskType, currentTodoId) => [
    "possibleParents",
    taskType,
    currentTodoId,
  ],

  // Goal tasks (tasks associated with a life goal)
  goalTasks: (goalId) => ["goalTasks", goalId],
};
