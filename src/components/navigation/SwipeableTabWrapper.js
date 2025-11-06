import React, { useRef } from "react";
import { PanResponder, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

// Define tab order
const TAB_ORDER = ["Do It", "Backlog", "Stats", "Goals", "Profile"];

/**
 * Wrapper component that adds swipe gestures to navigate between tabs
 * Swipe left to go to next tab, swipe right to go to previous tab
 */
const SwipeableTabWrapper = ({ children, tabName }) => {
  const navigation = useNavigation();
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (more horizontal than vertical)
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        const swipeThreshold = 50; // Minimum distance for a swipe
        const velocityThreshold = 0.3; // Minimum velocity for a swipe

        // Check if it's a valid swipe (either by distance or velocity)
        if (Math.abs(dx) > swipeThreshold || Math.abs(vx) > velocityThreshold) {
          // Find current tab index
          const currentIndex = TAB_ORDER.indexOf(tabName);
          
          if (currentIndex === -1) {
            // Tab name not found in order, skip navigation
            return;
          }

          if (dx > 0) {
            // Swipe right - go to previous tab
            const prevIndex = Math.max(0, currentIndex - 1);
            if (prevIndex !== currentIndex) {
              const prevTab = TAB_ORDER[prevIndex];
              navigation.navigate("MainTabs", { screen: prevTab });
            }
          } else {
            // Swipe left - go to next tab
            const nextIndex = Math.min(TAB_ORDER.length - 1, currentIndex + 1);
            if (nextIndex !== currentIndex) {
              const nextTab = TAB_ORDER[nextIndex];
              navigation.navigate("MainTabs", { screen: nextTab });
            }
          }
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

export default SwipeableTabWrapper;

