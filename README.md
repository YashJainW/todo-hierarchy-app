# Todo Hierarchy App

A sophisticated React Native task management application with hierarchical task organization, life goals tracking, and comprehensive statistics. Built with Expo, Supabase, and React Navigation.

## 📱 Features

### Core Functionality

- **Hierarchical Task Management**
  - Create tasks organized in a tree structure (Yearly → Monthly → Weekly → Daily)
  - Visual representation of task hierarchy with expandable/collapsible groups
  - Parent tasks automatically track completion progress based on child tasks
  - Smart indentation and visual indicators for hierarchy levels

- **Life Goals Integration**
  - Create and manage life goals
  - Assign tasks to life goals
  - Track completion percentage for each life goal based on child tasks
  - Visual progress bars with color-coded completion status

- **Task Management**
  - Create, edit, and delete tasks with rich metadata
  - Priority levels (High, Medium, Low) with visual badges (H/M/L indicators)
  - Due date tracking with formatted display
  - Task states: Not Started, In Progress, Completed
  - Cascading completion/uncompletion behavior

- **Smart Deletion Options**
  - **For Tasks with Children:**
    - **Reparent to Parent**: Children are moved to the deleted task's parent
    - **Clear References**: Children become root tasks
    - **Delete All (Cascade)**: Recursively delete all descendants
  - **For Life Goals with Tasks:**
    - **Clear References**: Remove life goal association from tasks
    - **Delete All (Cascade)**: Recursively delete all associated tasks

- **Dashboard View**
  - Task groups displayed hierarchically
  - Collapsible groups with smart default state (only leaf tasks visible)
  - Tap leaf tasks to expand full hierarchy
  - Highlight selected tasks with visual feedback
  - Summary statistics (Total, Completed, In Progress)

- **Statistics Screen**
  - Overall progress summary
  - Per-task statistics with completion percentages
  - Sortable by progress, type, or creation date
  - Color-coded progress bars

- **User Authentication**
  - Secure authentication via Supabase
  - Persistent sessions
  - User-specific data isolation

## 🛠️ Tech Stack

### Frontend
- **React Native** (0.81.5) with **Expo** (~54.0.20)
- **React Navigation** (v7) for navigation
- **React Native Paper** for Material Design UI components
- **React Context API** for state management
- **React Hooks** for component logic

### Backend
- **Supabase** (PostgreSQL database)
- **Supabase Auth** for authentication
- **PostgreSQL Functions** (RPC) for complex queries

### Key Libraries
- `expo-linear-gradient`: Gradient button styling
- `date-fns`: Date formatting and manipulation
- `react-native-picker-select`: Dropdown selections
- `expo-secure-store`: Secure credential storage

## 📁 Project Structure

```
todo-hierarchy-app/
├── App.js                          # Root component with navigation setup
├── index.js                         # Entry point
├── app.json                         # Expo configuration
├── package.json                     # Dependencies and scripts
├── supabase_functions.sql           # PostgreSQL functions (RPC)
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   └── LoadingSpinner.js
│   │   └── todos/
│   │       ├── TaskGroup.js         # Task group container with expansion logic
│   │       ├── TaskTreeItem.js      # Recursive task tree node component
│   │       ├── TodoFormModal.js     # Create/edit task modal
│   │       └── TodoCard.js
│   │
│   ├── context/
│   │   └── AuthContext.js           # Authentication context provider
│   │
│   ├── hooks/
│   │   ├── useLifeGoals.js          # Life goals CRUD operations
│   │   ├── useRealtimeTodos.js      # Real-time task updates
│   │   └── useTodos.js               # Task CRUD operations and utilities
│   │
│   ├── lib/
│   │   └── supabase.js              # Supabase client configuration
│   │
│   ├── navigation/
│   │   ├── AuthStack.js             # Authentication screens
│   │   └── MainAppTabs.js           # Main app bottom tab navigation
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── SignUpScreen.js
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.js   # Main task dashboard
│   │   ├── goals/
│   │   │   └── LifeGoalsScreen.js   # Life goals management
│   │   ├── profile/
│   │   │   └── ProfileScreen.js
│   │   └── stats/
│   │       └── StatsScreen.js       # Statistics and progress tracking
│   │
│   └── utils/
│       ├── constants.js             # App constants
│       ├── taskHierarchy.js         # Task tree building utilities
│       └── validation.js            # Form validation helpers
│
└── assets/                          # Images and icons
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd todo-hierarchy-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create the database schema (tables for `todos`, `life_goals`, etc.)
   - Run the SQL functions from `supabase_functions.sql` in your Supabase SQL Editor

4. **Configure Supabase**
   - Update `src/lib/supabase.js` with your Supabase URL and anon key:
   ```javascript
   const supabaseUrl = 'YOUR_SUPABASE_URL'
   const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'
   ```

5. **Run the application**
   ```bash
   npm start
   # or
   yarn start
   ```

   Then:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on your physical device

## 📊 Database Schema

### Tables

#### `todos`
- `id` (uuid, primary key)
- `task_name` (text)
- `description` (text, nullable)
- `task_type` (text: 'yearly', 'monthly', 'weekly', 'daily')
- `state` (text: 'not_started', 'in_progress', 'completed')
- `priority` (text: 'high', 'medium', 'low', nullable)
- `due_date` (date, nullable)
- `parent_todo_id` (uuid, nullable, foreign key to todos.id)
- `parent_life_goal_id` (uuid, nullable, foreign key to life_goals.id)
- `user_id` (uuid, foreign key to auth.users)
- `created_at`, `updated_at`, `completed_at` (timestamps)

#### `life_goals`
- `id` (uuid, primary key)
- `name` (text)
- `description` (text, nullable)
- `user_id` (uuid, foreign key to auth.users)
- `created_at`, `updated_at` (timestamps)

### PostgreSQL Functions (RPC)

1. **`get_dashboard_tasks()`**
   - Returns all tasks with child counts and completion statistics
   - Alias columns: `parent_id`, `life_goal_id`

2. **`get_hierarchy_stats()`**
   - Returns statistics for root tasks (tasks without parents)
   - Includes total descendants, completed descendants, and completion percentage

3. **`get_possible_parents(task_type_param, current_todo_id)`**
   - Returns valid parent options for a given task type based on hierarchy rules
   - Validates hierarchy rules: daily → weekly/life_goal, weekly → monthly/life_goal, etc.

4. **`get_life_goal_stats()`**
   - Returns completion statistics for all life goals
   - Calculates total tasks, completed tasks, and completion percentage per goal

## 🎨 Key Features Explained

### Task Hierarchy Rules

The app enforces a strict hierarchy:
- **Daily** tasks can have: Weekly todos or Life Goals as parents
- **Weekly** tasks can have: Monthly todos or Life Goals as parents
- **Monthly** tasks can have: Yearly todos or Life Goals as parents
- **Yearly** tasks can have: Life Goals only as parents

### Cascading Completion Behavior

- When a parent task is marked complete, all child tasks are automatically marked complete (cascade down)
- When a child task is unchecked, parent tasks change from "completed" to "in_progress" (cascade up)
- Progress bars reflect the completion status of all descendant leaf tasks

### Task Group Expansion Logic

- **Default State**: Only leaf tasks (tasks with no children) are visible
- **Tap to Expand**: Tapping a leaf task expands the entire hierarchy showing all ancestors
- **Highlighting**: The tapped leaf task is highlighted with a background color
- **Tap Again**: Tapping the same leaf task collapses the group back to default state
- **Visual Indicators**: Leaf tasks with parents have subtle shadows/borders indicating parent hierarchy exists

### UI/UX Features

- **Priority Badges**: Circular badges with H/M/L letters for quick priority identification
- **Gradient Buttons**: Modern gradient-styled FAB for creating new tasks
- **Long-press Menu**: Long-press any task to access edit/delete options (no visible ellipsis)
- **Expand/Collapse Arrows**: Chevron icons on leaf tasks with parents (moved to metadata row after due date)
- **Color-coded Progress**: Progress bars use different colors based on completion percentage
- **Auto-refresh**: Statistics and goals screens auto-refresh on focus to show latest data
- **Real-time Updates**: Stats refresh automatically when tasks are modified

## 🧪 Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser

### Environment Setup

Make sure you have:
- Supabase project configured
- Database tables and functions created
- Supabase credentials in `src/lib/supabase.js`

## 🔒 Security

- All database queries use Row Level Security (RLS) in Supabase
- User authentication required for all operations
- User-specific data isolation at the database level
- Secure credential storage using Expo Secure Store

## 📱 Screenshots

The app includes:
- **Dashboard**: Hierarchical task view with summary statistics
- **Life Goals**: Goals management with progress tracking
- **Statistics**: Detailed completion statistics and progress
- **Profile**: User profile and settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is private and proprietary.

## 👨‍💻 Author

Developed with React Native and Supabase.

## 🙏 Acknowledgments

- Expo team for the excellent development platform
- Supabase for the backend infrastructure
- React Native Paper for the Material Design components

---

For issues, questions, or contributions, please contact the development team.

