import React from "react";
import { View } from "react-native";
import { Portal, Dialog, Button, Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useTutorial } from "../../context/TutorialContext";
import { useAuth } from "../../context/AuthContext";

const TutorialPromptModal = () => {
  const { showPrompt, startTutorial, skipTutorial } = useTutorial();
  const { session } = useAuth();

  if (!showPrompt || !session) return null;

  return (
    <Portal>
      <Dialog visible onDismiss={skipTutorial} style={{ borderRadius: 12, overflow: "hidden" }}>
        <LinearGradient
          colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ padding: 16 }}
        >
          <Text style={{ color: "#fff", fontFamily: "Quicksand-Bold", fontSize: 18, textAlign: "center" }}>
            Take a quick tour?
          </Text>
        </LinearGradient>
        <Dialog.Content style={{ backgroundColor: "#F8F5FF" }}>
          <Text style={{ fontFamily: "Quicksand-Regular", color: "#333" }}>
            Would you like a quick tutorial to learn what each screen and button does?
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={{ backgroundColor: "#fff" }}>
          <Button onPress={skipTutorial}>Skip</Button>
          <Button mode="contained" onPress={startTutorial}>
            Start Tutorial
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default TutorialPromptModal;


