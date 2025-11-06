import React, { useEffect, useState } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import {
  PaperProvider,
  DefaultTheme,
  configureFonts,
} from "react-native-paper";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupGlobalFonts } from "./src/utils/fontSetup";
import { logger } from "./src/utils/logger";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import MainAppTabs from "./src/navigation/MainAppTabs";
import AuthStack from "./src/navigation/AuthStack";
import { TutorialProvider } from "./src/context/TutorialContext";
import TutorialPromptModal from "./src/components/tutorial/TutorialPromptModal";
import { navigationRef } from "./src/navigation/navigationRef";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create QueryClient instance with default configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh for 5 min
      gcTime: 1000 * 60 * 30, // 30 minutes - cache time (formerly cacheTime)
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: false, // Don't refetch on window focus (mobile app)
      refetchOnReconnect: true, // Refetch when reconnecting
    },
    mutations: {
      retry: 1, // Retry failed mutations once
    },
  },
});

logger.log("[App] QueryClient initialized:", {
  staleTime: "5 minutes",
  gcTime: "30 minutes",
  queryRetry: 2,
  mutationRetry: 1,
});

// Custom theme with Quicksand font
const createTheme = (fontsLoaded) => {
  if (!fontsLoaded) {
    logger.warn(
      "[App] Creating theme without fonts loaded, using DefaultTheme"
    );
    return DefaultTheme;
  }

  // React Native Paper requires platform-specific font configuration
  const fontConfig = {
    ios: {
      regular: {
        fontFamily: "Quicksand-Regular",
        fontWeight: "normal",
      },
      medium: {
        fontFamily: "Quicksand-Medium",
        fontWeight: "normal",
      },
      light: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
      thin: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
    },
    android: {
      regular: {
        fontFamily: "Quicksand-Regular",
        fontWeight: "normal",
      },
      medium: {
        fontFamily: "Quicksand-Medium",
        fontWeight: "normal",
      },
      light: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
      thin: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
    },
    web: {
      regular: {
        fontFamily: "Quicksand-Regular",
        fontWeight: "normal",
      },
      medium: {
        fontFamily: "Quicksand-Medium",
        fontWeight: "normal",
      },
      light: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
      thin: {
        fontFamily: "Quicksand-Light",
        fontWeight: "normal",
      },
    },
  };

  // Configure fonts with proper MD2 handling
  const configuredFonts = configureFonts({ config: fontConfig, isV3: false });

  // Create MD3 variant mappings with full font config objects
  // Copy all properties from baseFont to ensure compatibility
  const createMD3Variant = (baseFont) => {
    if (!baseFont) return configuredFonts.regular;
    return {
      ...baseFont,
      fontFamily: baseFont.fontFamily || "Quicksand-Regular",
      fontWeight: baseFont.fontWeight || "normal",
    };
  };

  const theme = {
    ...DefaultTheme,
    isV3: false, // Explicitly set Material Design 2
    fonts: {
      ...configuredFonts,
      // Map MD3 variants to MD2 fonts as fallback (with full config objects)
      bodySmall: createMD3Variant(configuredFonts.regular),
      bodyMedium: createMD3Variant(configuredFonts.regular),
      bodyLarge: createMD3Variant(configuredFonts.regular),
      labelSmall: createMD3Variant(configuredFonts.regular),
      labelMedium: createMD3Variant(configuredFonts.medium),
      labelLarge: createMD3Variant(configuredFonts.medium),
      titleSmall: createMD3Variant(configuredFonts.medium),
      titleMedium: createMD3Variant(configuredFonts.medium),
      titleLarge: createMD3Variant(configuredFonts.medium),
      headlineSmall: createMD3Variant(configuredFonts.medium),
      headlineMedium: createMD3Variant(configuredFonts.medium),
      headlineLarge: createMD3Variant(configuredFonts.medium),
      displaySmall: createMD3Variant(configuredFonts.medium),
      displayMedium: createMD3Variant(configuredFonts.medium),
      displayLarge: createMD3Variant(configuredFonts.medium),
    },
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

  // Log theme creation
  if (fontsLoaded) {
    logger.log("[App] Theme created successfully:", {
      hasFonts: true,
      primaryColor: "#6200ee",
    });
  }

  return theme;
};

// RootNavigator component
const RootNavigator = () => {
  const { session } = useAuth();

  // Log navigation state changes
  React.useEffect(() => {
    logger.log("[App] Navigation state changed:", {
      hasSession: !!session,
      userId: session?.user?.id,
      route: session ? "MainAppTabs" : "AuthStack",
    });
  }, [session]);

  // Conditionally render MainAppTabs or AuthStack based on session
  return session ? <MainAppTabs /> : <AuthStack />;
};

// Inner app component that has access to AuthProvider
const AppContent = ({ fontsLoaded, theme }) => {
  const { loading: authLoading } = useAuth();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    const prepareApp = async () => {
      if (fontsLoaded && !authLoading) {
        logger.log("[App] Preparing app:", {
          fontsLoaded: true,
          authLoading: false,
        });

        // Setup global fonts for Text and TextInput components
        try {
        setupGlobalFonts();
          logger.log("[App] Global fonts setup completed");
        } catch (error) {
          logger.error("[App] Failed to setup global fonts:", {
            message: error.message,
            stack: error.stack,
          });
        }

        // Minimum delay to ensure splash screen is visible
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Hide splash screen only after both fonts and auth are loaded
        try {
          await SplashScreen.hideAsync();
          logger.log("[App] Splash screen hidden successfully");
          setIsReady(true);
        } catch (error) {
          logger.error("[App] Failed to hide splash screen:", {
            message: error.message,
            stack: error.stack,
          });
          setIsReady(true);
        }
      } else {
        logger.debug("[App] Waiting for app initialization:", {
          fontsLoaded,
          authLoading,
        });
      }
    };

    prepareApp();
  }, [fontsLoaded, authLoading, theme]);

  // Render a View with splash background color while loading to ensure visibility
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: "#2F1E78" }} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <TutorialProvider>
      <RootNavigator />
        <TutorialPromptModal />
      </TutorialProvider>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
};

// App component
export default function App() {
  logger.log("[App] App component initialized");

  // Load Quicksand font files
  const [fontsLoaded, fontError] = useFonts({
    "Quicksand-Light": require("./assets/fonts/Quicksand-Light.ttf"),
    "Quicksand-Regular": require("./assets/fonts/Quicksand-Regular.ttf"),
    "Quicksand-Medium": require("./assets/fonts/Quicksand-Medium.ttf"),
    "Quicksand-SemiBold": require("./assets/fonts/Quicksand-SemiBold.ttf"),
    "Quicksand-Bold": require("./assets/fonts/Quicksand-Bold.ttf"),
  });

  // Log font loading status
  React.useEffect(() => {
    if (fontError) {
      logger.error("[App] Font loading failed:", {
        message: fontError.message,
        stack: fontError.stack,
      });
    } else if (fontsLoaded) {
      logger.log("[App] All fonts loaded successfully:", {
        fonts: [
          "Quicksand-Light",
          "Quicksand-Regular",
          "Quicksand-Medium",
          "Quicksand-SemiBold",
          "Quicksand-Bold",
        ],
      });
    }
  }, [fontsLoaded, fontError]);

  // Create theme - always call this, even if fonts not loaded (for hooks consistency)
  const theme = createTheme(fontsLoaded);

  // Show splash screen while fonts are loading
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <AppContent fontsLoaded={fontsLoaded} theme={theme} />
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
