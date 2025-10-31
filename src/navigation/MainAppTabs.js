import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import StatsScreen from "../screens/stats/StatsScreen";
import LifeGoalsScreen from "../screens/goals/LifeGoalsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();

const MainAppTabs = () => {
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
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chart-bar"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={LifeGoalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="flag-checkered"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainAppTabs;
