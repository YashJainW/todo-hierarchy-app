import { Text, TextInput, Platform } from "react-native";

/**
 * Setup global font family for React Native Text and TextInput components
 * This patches the components to always apply Quicksand font, even when styles override
 */
export const setupGlobalFonts = () => {
  // Use Platform-specific font name if needed
  const fontFamily = Platform.select({
    android: "Quicksand-Regular",
    ios: "Quicksand-Regular",
    default: "Quicksand-Regular",
  });

  try {
    // Set defaultProps for Text - this applies to all Text components
    // that don't have explicit fontFamily in their style
    Text.defaultProps = Text.defaultProps || {};
    const existingTextStyle = Text.defaultProps.style;
    Text.defaultProps.style = Array.isArray(existingTextStyle)
      ? [{ fontFamily }, ...existingTextStyle]
      : existingTextStyle
      ? [{ fontFamily }, existingTextStyle]
      : { fontFamily };

    // Set defaultProps for TextInput
    TextInput.defaultProps = TextInput.defaultProps || {};
    const existingInputStyle = TextInput.defaultProps.style;
    TextInput.defaultProps.style = Array.isArray(existingInputStyle)
      ? [{ fontFamily }, ...existingInputStyle]
      : existingInputStyle
      ? [{ fontFamily }, existingInputStyle]
      : { fontFamily };

    console.log(`✅ Global font setup completed - Using font: ${fontFamily}`);
    console.log(`   Text.defaultProps:`, Text.defaultProps);
    console.log(`   TextInput.defaultProps:`, TextInput.defaultProps);
    return true;
  } catch (error) {
    console.warn("⚠️ Could not setup global fonts:", error);
    return false;
  }
};
