import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { CommonActions } from "@react-navigation/native";
import { tutorialSteps } from "../utils/tutorialSteps";
import { navigationRef } from "../navigation/navigationRef";
import { useAuth } from "./AuthContext";

const getTutorialCompletedKey = (userId) => `tutorial_completed_${userId || "anonymous"}`;

const TutorialContext = createContext(null);

export const useTutorial = () => {
  return useContext(TutorialContext);
};

export const TutorialProvider = ({ children }) => {
  const { session } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasCheckedFirstLogin, setHasCheckedFirstLogin] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const steps = useMemo(() => tutorialSteps, []);

  // Track previous user ID to detect login
  const [previousUserId, setPreviousUserId] = useState(null);

  // Check tutorial completion status only when user first logs in
  useEffect(() => {
    const loadState = async () => {
      const currentUserId = session?.user?.id;
      
      // If no user, reset everything
      if (!currentUserId) {
        setLoading(false);
        setShowPrompt(false);
        setIsCompleted(false);
        setPreviousUserId(null);
        setHasCheckedFirstLogin(false);
        return;
      }

      // Only check tutorial status when user first logs in (user ID changes from null/undefined to a value)
      // Skip if we've already checked for this user
      if (currentUserId === previousUserId && hasCheckedFirstLogin) {
        return;
      }

      // This is a new login (user ID changed from null/undefined to a value)
      const isNewLogin = previousUserId === null && currentUserId !== null;
      
      if (isNewLogin || (currentUserId !== previousUserId && !hasCheckedFirstLogin)) {
        try {
          const tutorialKey = getTutorialCompletedKey(currentUserId);
          const completed = await SecureStore.getItemAsync(tutorialKey);
          const isDone = completed === "true";
          setIsCompleted(isDone);
          // Show prompt only if not completed yet and this is a new login
          setShowPrompt(!isDone);
          setHasCheckedFirstLogin(true);
          setPreviousUserId(currentUserId);
          console.log("Tutorial: Loaded state for user", currentUserId, "Completed:", isDone, "Show prompt:", !isDone, "Is new login:", isNewLogin);
        } catch (error) {
          console.error("Tutorial: Error loading state:", error);
          setShowPrompt(false);
          setHasCheckedFirstLogin(true);
          setPreviousUserId(currentUserId);
        }
        setLoading(false);
      } else {
        // Update previous user ID but don't check again
        setPreviousUserId(currentUserId);
      }
    };
    loadState();
  }, [session?.user?.id, previousUserId, hasCheckedFirstLogin]);

  // Reset check flag when user logs out
  useEffect(() => {
    if (!session?.user?.id) {
      setHasCheckedFirstLogin(false);
      setShowPrompt(false);
      setIsActive(false);
      setIsCompleted(false);
      setCurrentStepIndex(0);
      setPreviousUserId(null);
    }
  }, [session?.user?.id]);

  const navigateToStepScreen = useCallback((step) => {
    return new Promise((resolve) => {
      /* minimal logging */
      
      if (!step?.screen) {
        console.warn("Tutorial: No screen specified for step:", step);
        resolve();
        return;
      }
      
      try {
        const isReady = navigationRef.isReady();
        
        if (!isReady) {
          console.warn("Tutorial: Navigation ref not ready");
          resolve();
          return;
        }
        
        // Get the current navigation state to check current tab
        const rootState = navigationRef.getRootState();
        
        const mainTabsState = rootState?.routes?.find(r => r.name === "MainTabs")?.state;
        
        const currentTab = mainTabsState?.routes?.[mainTabsState?.index || 0]?.name;
        
        // Only skip navigation if we're already on the target screen
        if (currentTab === step.screen) {
          resolve();
          return;
        }

        // Fast-path for Stats (mirror working Dashboard -> Backlog logic)
        if (step.screen === "Stats") {
          try {
            navigationRef.navigate("MainTabs", { screen: "Stats" });
            // Wait briefly to allow screen to mount
            setTimeout(() => {
              const s = navigationRef.getRootState();
              const tabs = s?.routes?.find(r => r.name === "MainTabs")?.state;
              const tabName = tabs?.routes?.[tabs?.index || 0]?.name;
              resolve();
            }, 250);
            return;
          } catch (fastErr) {
            console.error("Tutorial: Fast-path navigation to Stats failed:", fastErr);
            // fall through to generic logic
          }
        }
        
        // Navigate to the tab screen using CommonActions for proper nested navigation
        
        // Find the target tab index in the tab navigator
        const tabRoutes = mainTabsState?.routes || [];
        const targetTabIndex = tabRoutes.findIndex(r => r.name === step.screen);
        
        if (targetTabIndex === -1) {
          console.error("Tutorial: Target tab not found in routes:", step.screen);
          resolve();
          return;
        }
        
        // Use CommonActions to properly navigate to nested tab
        // Try multiple approaches to ensure navigation works
        try {
          // Approach 1: Use CommonActions.navigate with nested structure
          const navigateAction = CommonActions.navigate({
            name: "MainTabs",
            params: {
              screen: step.screen,
            },
          });
          navigationRef.dispatch(navigateAction);
          
          // Approach 2: Also try using CommonActions.reset to ensure navigation
          // This resets the navigation state to the target tab
          setTimeout(() => {
            try {
              // Build clean tab route objects with only names/params
              const cleanTabRoutes = tabRoutes.map(r => ({ name: r.name, params: r.params }));
              const resetAction = CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: "MainTabs",
                    state: {
                      index: targetTabIndex,
                      routes: cleanTabRoutes,
                    },
                  },
                ],
              });
              navigationRef.dispatch(resetAction);
            } catch (resetError) {
              console.error("Tutorial: Reset approach failed:", resetError);
            }
          }, 100);
          
          // Approach 3: Also try direct navigate as backup
          setTimeout(() => {
            try {
              navigationRef.navigate("MainTabs", { 
                screen: step.screen
              });
            } catch (backupError) {
              console.error("Tutorial: Backup navigate() failed:", backupError);
            }
          }, 150);
        } catch (navError) {
          console.error("Tutorial: Error calling dispatch():", navError);
          console.error("Tutorial: Error stack:", navError?.stack);
          // Fallback to direct navigate
          try {
            navigationRef.navigate("MainTabs", { 
              screen: step.screen
            });
          } catch (fallbackError) {
            console.error("Tutorial: Fallback navigate() also failed:", fallbackError);
            resolve();
            return;
          }
        }
        
        // Use multiple checks to ensure navigation completes
        // Check immediately, then after a short delay, then after a longer delay
        let checkCount = 0;
        const maxChecks = 5; // Increased to 5 checks
        const checkInterval = 200;
        
        const checkNavigation = () => {
          checkCount++;
          
          const newRootState = navigationRef.getRootState();
          const newMainTabsState = newRootState?.routes?.find(r => r.name === "MainTabs")?.state;
          const newTab = newMainTabsState?.routes?.[newMainTabsState?.index || 0]?.name;
          
          if (newTab === step.screen) {
            resolve();
            return;
          }
          
          if (checkCount < maxChecks) {
            // Try navigating again if we haven't reached the target
            if (checkCount === 2 || checkCount === 4) {
              try {
                const retryAction = CommonActions.navigate({
                  name: "MainTabs",
                  params: {
                    screen: step.screen,
                  },
                });
                navigationRef.dispatch(retryAction);
              } catch (retryNavError) {
                console.error("Tutorial: Error in retry dispatch():", retryNavError);
                // Fallback to direct navigate
                try {
                  navigationRef.navigate("MainTabs", { 
                    screen: step.screen
                  });
                } catch (fallbackError) {
                  console.error("Tutorial: Retry fallback navigate() also failed:", fallbackError);
                }
              }
            }
            setTimeout(checkNavigation, checkInterval);
          } else {
            // Final check - if still failed, try one more time with CommonActions
            console.warn("Tutorial: Navigation failed. Expected:", step.screen, "Got:", newTab);
            try {
              const retryAction = CommonActions.navigate({
                name: "MainTabs",
                params: {
                  screen: step.screen,
                },
              });
              navigationRef.dispatch(retryAction);
              
              setTimeout(() => {
                const finalState = navigationRef.getRootState();
                const finalTabsState = finalState?.routes?.find(r => r.name === "MainTabs")?.state;
                const finalTab = finalTabsState?.routes?.[finalTabsState?.index || 0]?.name;
                resolve();
              }, 300);
            } catch (retryError) {
              console.error("Tutorial: Final retry navigation error:", retryError);
              resolve();
            }
          }
        };
        
        // Start checking after a delay to allow navigation to process
        // Use requestAnimationFrame to ensure navigation is queued
        // Give more time for all navigation approaches to complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(checkNavigation, 300);
          });
        });
      } catch (error) {
        console.error("Tutorial: Error navigating to tutorial step:", error);
        console.error("Tutorial: Error stack:", error.stack);
        resolve();
      }
    });
  }, []);

  const startTutorial = useCallback(async () => {
    setIsActive(true);
    setShowPrompt(false);
    setIsCompleted(false);
    // Navigate to first step first
    await navigateToStepScreen(steps[0]);
    // Set index after navigation completes and screen is mounted
    setTimeout(() => {
      setCurrentStepIndex(0);
    }, 250); // Reduced from 500ms to 250ms
  }, [steps, navigateToStepScreen]);

  const skipTutorial = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsActive(false);
    setShowPrompt(false);
    setIsCompleted(true);
    const tutorialKey = getTutorialCompletedKey(session.user.id);
    await SecureStore.setItemAsync(tutorialKey, "true");
  }, [session?.user?.id]);

  const completeTutorial = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsActive(false);
    setIsCompleted(true);
    setShowPrompt(false);
    const tutorialKey = getTutorialCompletedKey(session.user.id);
    await SecureStore.setItemAsync(tutorialKey, "true");
  }, [session?.user?.id]);

  const resetTutorial = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsCompleted(false);
    setCurrentStepIndex(0);
    const tutorialKey = getTutorialCompletedKey(session.user.id);
    await SecureStore.setItemAsync(tutorialKey, "false");
  }, [session?.user?.id]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((currentIdx) => {
      const nextIdx = currentIdx + 1;
      // Check if we've reached the end
      if (nextIdx >= steps.length) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          completeTutorial();
        }, 0);
        return currentIdx;
      }
      // Get the next step
      const nextStepData = steps[nextIdx];
      if (!nextStepData) {
        console.error("Tutorial: Next step not found at index:", nextIdx, "Total steps:", steps.length);
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          completeTutorial();
        }, 0);
        return currentIdx;
      }
      // Begin transition to next step
      
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        // Set transitioning state to prevent flicker
        setIsTransitioning(true);
        
        // Navigate FIRST, then update index after navigation completes
        // This ensures we check navigation against the correct current screen
        
        const navigationPromise = navigateToStepScreen(nextStepData);
        
        navigationPromise.then(() => {
          // Small delay to ensure screen is mounted
          setTimeout(() => {
            // Update index AFTER navigation completes
            setCurrentStepIndex(nextIdx);
            setIsTransitioning(false);
          }, 200);
        }).catch((error) => {
          console.error("Tutorial: Navigation promise rejected:", error);
          console.error("Tutorial: Navigation error stack:", error?.stack);
          setIsTransitioning(false);
        });
      }, 0);
      
      // Keep current index until navigation completes
      return currentIdx;
    });
  }, [steps, completeTutorial, navigateToStepScreen]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((currentIdx) => {
      const prev = Math.max(0, currentIdx - 1);
      const step = steps[prev];
      
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        // Set transitioning state to prevent flicker
        setIsTransitioning(true);
        
        // Update index immediately to keep tooltip visible during transition
        setCurrentStepIndex(prev);
        
        // Navigate to previous step, then update after navigation completes
        navigateToStepScreen(step).then(() => {
          // Small delay to ensure screen is mounted
          setTimeout(() => {
            setIsTransitioning(false);
          }, 200);
        });
      }, 0);
      
      // Return new index immediately to prevent flicker
      return prev;
    });
  }, [steps, navigateToStepScreen]);

  const value = {
    loading,
    isActive,
    showPrompt,
    setShowPrompt,
    isCompleted,
    steps,
    currentStepIndex,
    isTransitioning,
    startTutorial,
    skipTutorial,
    nextStep,
    prevStep,
    completeTutorial,
    resetTutorial,
  };

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};


