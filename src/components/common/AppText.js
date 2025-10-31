import React from "react";
import { Text as RNText, StyleSheet } from "react-native";

/**
 * Global Text component that applies Quicksand font by default
 * Use this instead of Text from react-native for consistent font styling
 */
const AppText = ({ style, ...props }) => {
  return <RNText style={[styles.defaultText, style]} {...props} />;
};

const styles = StyleSheet.create({
  defaultText: {
    fontFamily: "Quicksand-Regular",
  },
});

export default AppText;
