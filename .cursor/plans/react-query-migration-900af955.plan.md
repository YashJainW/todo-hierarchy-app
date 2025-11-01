<!-- 900af955-eba4-4cb5-bc48-e13809cd7b58 3f99fd9a-6abb-4b34-9bde-fe855997237b -->
# React Query Migration Plan

## Overview

Migrate from custom React hooks to React Query (@tanstack/react-query) to enable optimistic updates, automatic rollback on errors, and eliminate full-screen loaders during mutations.

## Current Architecture Analysis

**Custom Hooks (to be replaced):**

- `useDashboardTasks()` - fetches dashboard tasks via `get_dashboard_tasks` RPC
- `useStats()` - fetches hierarchy stats via `get_hierarchy_stats` RPC with realtime subscriptions
- `useLifeGoals()` - fetches life goals via `get_life_goal_stats` RPC
- `useTodoChildren(parentId)` - fetches children for a specific parent

**Mutation Functions (to be converted):**

- `createTodo()`, `updateTodo()`, `deleteTodo()` - in `src/hooks/useTodos.js`
- `createLifeGoal()`, `updateLifeGoal()`, `deleteLifeGoal()` - in `src/hooks/useLifeGoals.js`

**Screens Using These Hooks:**

- `DashboardScreen` - uses `useDashboardTasks`, `updateTodo`, `deleteTodo`
- `StatsScreen` - uses `useStats`
- `LifeGoalsScreen` - uses `useLifeGoals`, CRUD operations
- Various components use `updateTodo` for task toggling

## Implementation Steps

### Phase 1: Setup & Infrastructure

**1.1 Install React Query**

```bash
npm install @tanstack/react-query
```

**1.2 Create QueryClient Provider in App.js**

- Wrap app with `QueryClientProvider`
- Configure default options (staleTime, retry, cacheTime)
- Add devtools for development (optional)

**1.3 Create Query/Mutation Keys File**

- Create `src/hooks/queryKeys.js` with centralized query key definitions
- Keys: `dashboardTasks`, `stats`, `lifeGoals`, `todoChildren`, etc.

### Phase 2: Create React Query Hooks

**2.1 Create `src/hooks/queries/useTodosQueries.js`**

- Convert `useDashboardTasks` to `useQuery` with key `['dashboardTasks']`
- Convert `useStats` to `useQuery` with key `['stats']`
  - Integrate Supabase realtime subscription to invalidate on changes
- Convert `useTodoChildren` to `useQuery` with key `['todoChildren', parentId]`

**2.2 Create `src/hooks/mutations/useTodoMutations.js`**

- `useCreateTodoMutation` - wraps `createTodo()`
  - On success: invalidate `['dashboardTasks']`, `['stats']`, `['lifeGoals']`
- `useUpdateTodoMutation` - wraps `updateTodo()`
  - **Optimistic update** for task state changes
  - On mutate: update cache immediately
  - On error: rollback to previous snapshot
  - On success: invalidate related queries
- `useDeleteTodoMutation` - wraps `deleteTodo()`
  - On success: invalidate `['dashboardTasks']`, `['stats']`

**2.3 Create `src/hooks/queries/useLifeGoalsQueries.js`**

- Convert `useLifeGoals` to `useQuery` with key `['lifeGoals']`

**2.4 Create `src/hooks/mutations/useLifeGoalMutations.js`**

- `useCreateLifeGoalMutation` - wraps `createLifeGoal()`
- `useUpdateLifeGoalMutation` - wraps `updateLifeGoal()`
- `useDeleteLifeGoalMutation` - wraps `deleteLifeGoal()`

### Phase 3: Update Screens

**3.1 Update DashboardScreen.js**

- Replace `useDashboardTasks()` with `useQuery(['dashboardTasks'])`
- Replace `handleToggleComplete` to use `useUpdateTodoMutation` with optimistic updates
- Remove manual `refetch()` calls - React Query handles automatically
- Remove `loading` state checks that cause full-screen loaders
- Use `mutation.isLoading` for individual task loading states if needed

**3.2 Update StatsScreen.js**

- Replace `useStats()` with `useQuery(['stats'])`
- Keep realtime subscription but use `queryClient.invalidateQueries(['stats'])` instead of manual refetch
- Remove manual refresh logic - use React Query's refetch

**3.3 Update LifeGoalsScreen.js**

- Replace `useLifeGoals()` with `useQuery(['lifeGoals'])`
- Use mutation hooks for create/update/delete operations
- Remove manual `refetch()` calls

**3.4 Update TodoFormModal.js**

- Use `useCreateTodoMutation` and `useUpdateTodoMutation`
- Remove manual success callbacks - mutations handle cache updates

### Phase 4: Optimistic Updates Configuration

**4.1 Configure Toggle Task Mutation (Critical for Smooth UX)**

```javascript
// In useUpdateTodoMutation
onMutate: async ({ id, updates }) => {
  await queryClient.cancelQueries(['dashboardTasks']);
  const previous = queryClient.getQueryData(['dashboardTasks']);
  
  queryClient.setQueryData(['dashboardTasks'], (old) =>
    old.map(task => task.id === id ? { ...task, ...updates } : task)
  );
  
  return { previous };
},
onError: (err, variables, context) => {
  queryClient.setQueryData(['dashboardTasks'], context.previous);
  Alert.alert('Error', err.message);
},
onSettled: () => {
  queryClient.invalidateQueries(['dashboardTasks']);
  queryClient.invalidateQueries(['stats']);
}
```

### Phase 5: Testing & Cleanup

**5.1 Test Error Scenarios**

- Network timeout during task toggle
- Rapid multiple clicks on checkbox
- Database constraint violations
- Verify automatic rollback works

**5.2 Remove Old Code**

- Delete old custom hooks from `src/hooks/useTodos.js` (keep mutation functions)
- Delete old custom hooks from `src/hooks/useLifeGoals.js` (keep mutation functions)
- Remove unused state management code

**5.3 Performance Verification**

- Verify no full-screen loaders on mutations
- Verify instant UI feedback on task toggle
- Verify automatic error recovery

## Key Benefits After Migration

1. **Smooth UX**: Task checkboxes update instantly without loaders
2. **Automatic Error Handling**: Failed mutations automatically rollback UI
3. **Race Condition Protection**: Multiple rapid clicks handled correctly
4. **Less Code**: ~40% reduction in state management boilerplate
5. **Better Cache Management**: Automatic stale data handling
6. **Retry Logic**: Configurable retry on network failures

## File Structure After Migration

```
src/
├── hooks/
│   ├── queries/
│   │   ├── useTodosQueries.js (useQuery hooks)
│   │   └── useLifeGoalsQueries.js
│   ├── mutations/
│   │   ├── useTodoMutations.js (useMutation hooks)
│   │   └── useLifeGoalMutations.js
│   ├── queryKeys.js (centralized keys)
│   ├── useTodos.js (keep mutation functions only)
│   └── useLifeGoals.js (keep mutation functions only)
```

## Migration Order (Recommended)

1. Setup (Phase 1) - 15 min
2. Dashboard mutations first (Phase 2.2 + 3.1) - 30 min
3. Dashboard queries (Phase 2.1 + 3.1) - 20 min
4. Stats (Phase 2.1 + 3.2) - 15 min
5. Life Goals (Phase 2.3, 2.4, 3.3) - 30 min
6. Testing & cleanup (Phase 5) - 20 min

Total estimated time: ~2 hours

### To-dos

- [ ] Install @tanstack/react-query package