import React from "react";
import { Portal, Dialog, Text, Button } from "react-native-paper";
import { StyleSheet } from "react-native";

const ParentConfirmationDialog = ({
  visible,
  onCancel,
  onConfirm,
  newParent,
  oldParent,
}) => {
  const newParentName =
    newParent?.name ||
    newParent?.title ||
    newParent?.task_name ||
    "the selected parent";

  const oldParentName =
    oldParent?.name || oldParent?.title || oldParent?.task_name || null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel} style={styles.dialog}>
        <Dialog.Title>Change Parent?</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.message}>
            Are you sure you want to move this task to "{newParentName}"?
          </Text>
          {oldParentName && (
            <Text style={styles.secondaryMessage}>
              This will remove it from "{oldParentName}".
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>Cancel</Button>
          <Button
            onPress={onConfirm}
            mode="contained"
            style={styles.moveButton}
          >
            Move
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
    alignSelf: "center",
  },
  message: {
    fontSize: 16,
    marginBottom: 8,
    color: "#000",
  },
  secondaryMessage: {
    fontSize: 14,
    marginTop: 8,
    color: "#666",
    fontStyle: "italic",
  },
  moveButton: {
    marginLeft: 8,
  },
});

export default ParentConfirmationDialog;
