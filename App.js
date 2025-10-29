import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider, DefaultTheme } from "react-native-paper";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import MainAppTabs from "./src/navigation/MainAppTabs";
import AuthStack from "./src/navigation/AuthStack";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Custom theme extending DefaultTheme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#6200ee",
    accent: "#03dac4",
    background: "#f5f5f5",
    surface: "#ffffff",
    error: "#B00020",
    text: "#000000",
    onSurface: "#000000",
    disabled: "#00000061",
    placeholder: "#00000061",
    backdrop: "#00000080",
  },
};

// RootNavigator component
const RootNavigator = () => {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Hide splash screen when loading is complete
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  // Conditionally render MainAppTabs or AuthStack based on session
  return session ? <MainAppTabs /> : <AuthStack />;
};

// App component
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
