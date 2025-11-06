import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import BacklogScreen from "../screens/backlog/BacklogScreen";
import StatsScreen from "../screens/stats/StatsScreen";
import LifeGoalsScreen from "../screens/goals/LifeGoalsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import TaskHistoryScreen from "../screens/history/TaskHistoryScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import SwipeableTabWrapper from "../components/navigation/SwipeableTabWrapper";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainAppTabsContent = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        // Header gradient
        headerBackground: () => (
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        ),
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          color: "#ffffff",
          fontFamily: "Quicksand-Bold",
        },
        // Tab bar gradient
        tabBarBackground: () => (
          <LinearGradient
            colors={["#1F114D", "#3B1CB0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        ),
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#C5BFF3",
        tabBarStyle: {
          borderTopWidth: 0,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
          backgroundColor: "transparent",
          position: "absolute",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Quicksand-SemiBold",
        },
      }}
    >
      <Tab.Screen
        name="Do It"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabWrapper tabName="Do It">
            <DashboardScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Backlog"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="clock-alert-outline"
              size={size}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabWrapper tabName="Backlog">
            <BacklogScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Stats"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chart-bar"
              size={size}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabWrapper tabName="Stats">
            <StatsScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Goals"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="flag-checkered"
              size={size}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabWrapper tabName="Goals">
            <LifeGoalsScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabWrapper tabName="Profile">
            <ProfileScreen {...props} />
          </SwipeableTabWrapper>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const MainAppTabs = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainAppTabsContent} />
      <Stack.Screen
        name="TaskHistory"
        component={TaskHistoryScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: "Settings",
          headerStyle: {
            backgroundColor: "#3B1CB0",
          },
          headerTintColor: "#ffffff",
          headerTitleStyle: {
            fontFamily: "Quicksand-Bold",
            color: "#ffffff",
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default MainAppTabs;
