import React, { useMemo } from "react";
import Tooltip from "react-native-walkthrough-tooltip";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useTutorial } from "../../context/TutorialContext";

const TutorialHighlight = ({ stepId, children }) => {
  const { isActive, steps, currentStepIndex, isTransitioning, nextStep, prevStep } = useTutorial();

  const { isCurrent, content, isFirst, isLast } = useMemo(() => {
    const current = steps[currentStepIndex];
    const isCurrentStep = isActive && current?.id === stepId;
    return {
      isCurrent: isCurrentStep,
      content: current?.text || "",
      isFirst: currentStepIndex === 0,
      isLast: currentStepIndex === steps.length - 1,
    };
  }, [isActive, steps, currentStepIndex, stepId]);

  // Don't render tooltip if not current step, unless we're transitioning (to prevent flicker)
  if (!isCurrent && !isTransitioning) {
    return <>{children}</>;
  }
  
  // During transition, keep showing the tooltip if it was visible
  if (isTransitioning && !isCurrent) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      isVisible={true}
      content={
        <View style={{ maxWidth: 260 }}>
          <Text style={{ fontFamily: "Quicksand-SemiBold", marginBottom: 8 }}>{content}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Button onPress={prevStep} disabled={isFirst} mode="text">
              Previous
            </Button>
            <Button onPress={nextStep} mode="contained">
              {isLast ? "Finish" : "Next"}
            </Button>
          </View>
        </View>
      }
      placement="bottom"
      showChildInTooltip={false}
      useInteractionManager
    >
      <View>{children}</View>
    </Tooltip>
  );
};

export default TutorialHighlight;


