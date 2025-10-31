import React, { useEffect } from "react";
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
import { setupGlobalFonts } from "./src/utils/fontSetup";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import MainAppTabs from "./src/navigation/MainAppTabs";
import AuthStack from "./src/navigation/AuthStack";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Custom theme with Quicksand font
const createTheme = (fontsLoaded) => {
  if (!fontsLoaded) return DefaultTheme;

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

  return {
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

  // Show loader while checking auth state
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  // Conditionally render MainAppTabs or AuthStack based on session
  return session ? <MainAppTabs /> : <AuthStack />;
};

// App component
export default function App() {
  // Load Quicksand font files
  const [fontsLoaded] = useFonts({
    "Quicksand-Light": require("./assets/fonts/Quicksand-Light.ttf"),
    "Quicksand-Regular": require("./assets/fonts/Quicksand-Regular.ttf"),
    "Quicksand-Medium": require("./assets/fonts/Quicksand-Medium.ttf"),
    "Quicksand-SemiBold": require("./assets/fonts/Quicksand-SemiBold.ttf"),
    "Quicksand-Bold": require("./assets/fonts/Quicksand-Bold.ttf"),
  });

  // Create theme - always call this, even if fonts not loaded (for hooks consistency)
  const theme = createTheme(fontsLoaded);

  useEffect(() => {
    if (fontsLoaded) {
      console.log("✅ Quicksand fonts loaded successfully!");

      // Setup global fonts for Text and TextInput components
      setupGlobalFonts();

      // Debug: Log theme configuration
      if (theme.fonts) {
        console.log("✅ Theme configured with Quicksand fonts");
        console.log("   Regular font:", theme.fonts.regular);
        console.log("   MD3 variant (bodySmall):", theme.fonts.bodySmall);
        console.log("   MD3 variant (labelLarge):", theme.fonts.labelLarge);
      }

      SplashScreen.hideAsync();
    } else {
      console.log("⏳ Loading Quicksand fonts...");
    }
  }, [fontsLoaded, theme]);

  if (!fontsLoaded) {
    return null;
  }

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
