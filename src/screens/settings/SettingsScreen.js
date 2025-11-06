import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, Text } from "react-native";
import {
  Card,
  TextInput,
  Button,
  Divider,
  List,
  ActivityIndicator,
  Switch,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import TutorialHighlight from "../../components/tutorial/TutorialHighlight";
import { useTutorial } from "../../context/TutorialContext";

const SettingsScreen = () => {
  const { user, updateProfile, updatePassword } = useAuth();
  const { resetTutorial, startTutorial } = useTutorial();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Auto-deletion settings
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const MAX_DAYS = 365;

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      // Load auto-delete settings from user metadata
      const meta = user?.user_metadata || {};
      const enabled = Boolean(meta.autoDeleteEnabled);
      const daysVal = Number(meta.autoDeleteDays) || 30;
      setAutoDeleteEnabled(enabled);
      setAutoDeleteDays(String(Math.min(daysVal, MAX_DAYS)));
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSettingsUpdate = async () => {
    setSaving(true);

    try {
      let daysNum = Number(autoDeleteDays) || 0;
      if (daysNum < 0) daysNum = 0;
      if (daysNum > MAX_DAYS) daysNum = MAX_DAYS;

      const result = await updateProfile({
        username: user?.user_metadata?.username || "",
        full_name: user?.user_metadata?.full_name || null,
        autoDeleteEnabled: autoDeleteEnabled,
        autoDeleteDays: daysNum,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      Alert.alert("Success", "Settings saved successfully!");
    } catch (error) {
      console.error("Error updating settings:", error);
      Alert.alert("Error", error.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  // Check if password form has changes
  const hasPasswordChanges = () => {
    const hasAll =
      currentPassword.trim().length > 0 &&
      newPassword.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      newPassword.trim() === confirmPassword.trim();
    return hasAll;
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword.trim()) {
      setPasswordError("Current password is required");
      return;
    }

    // Validation
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setChangingPassword(true);

    try {
      // Verify current password by signing in
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (reauthError) {
        setPasswordError("Current password is incorrect");
        setChangingPassword(false);
        return;
      }

      const result = await updatePassword(newPassword);

      if (result.error) {
        throw new Error(result.error);
      }

      setPasswordSuccess(true);
      // Clear form after successful password change
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError(error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (settingsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tutorial Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.gradientTitle}>Tutorial</Text>
          </LinearGradient>
          <Card.Content style={styles.cardContent}>
            <TutorialHighlight stepId="profile.settings">
              <View />
            </TutorialHighlight>
            <Button
              mode="contained"
              onPress={async () => {
                await resetTutorial();
                startTutorial();
              }}
              style={styles.updateButton}
            >
              Replay Tutorial
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Auto Deletion Settings */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.gradientTitle}>Auto Delete Completed Todos</Text>
          </LinearGradient>
          <Card.Content style={styles.cardContent}>
            <List.Item
              title="Enable Auto Deletion"
              description="Delete completed todo trees older than the configured days"
              right={() => (
                <Switch
                  value={autoDeleteEnabled}
                  onValueChange={setAutoDeleteEnabled}
                />
              )}
              style={styles.statItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <TextInput
              label="Delete items older than (days)"
              mode="outlined"
              keyboardType="numeric"
              value={autoDeleteDays}
              onChangeText={(t) => setAutoDeleteDays(t.replace(/[^0-9]/g, ""))}
              right={<TextInput.Affix text="days" />}
              style={styles.input}
              disabled={!autoDeleteEnabled}
            />
            <Text style={styles.warningText}>
              Maximum retention is 365 days. Items older than 1 year are deleted
              automatically.
            </Text>
            <Button
              mode="contained"
              onPress={handleSettingsUpdate}
              style={styles.updateButton}
              loading={saving}
              disabled={saving}
            >
              Save Settings
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Password Change Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.gradientTitle}>Change Password</Text>
          </LinearGradient>
          <Card.Content style={styles.cardContent}>
            {/* Current Password */}
            <TextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setPasswordError(null);
              }}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              disabled={changingPassword}
              textColor="#000000"
              activeOutlineColor="#6200ee"
              outlineColor="#CCCCCC"
            />

            {/* New Password */}
            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError(null);
              }}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              disabled={changingPassword}
              textColor="#000000"
              activeOutlineColor="#6200ee"
              outlineColor="#CCCCCC"
            />

            {/* Confirm Password */}
            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setPasswordError(null);
              }}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              disabled={changingPassword}
              textColor="#000000"
              activeOutlineColor="#6200ee"
              outlineColor="#CCCCCC"
            />

            {/* Error/Success Messages */}
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}
            {passwordSuccess && (
              <Text style={styles.successText}>
                Password changed successfully!
              </Text>
            )}

            {/* Update Password Button */}
            <Button
              mode="contained"
              onPress={handlePasswordChange}
              loading={changingPassword}
              disabled={changingPassword || !hasPasswordChanges()}
              style={styles.updateButton}
            >
              Change Password
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    color: "#666",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderRadius: 12,
  },
  gradientHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  gradientTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    color: "#ffffff",
  },
  input: {
    marginBottom: 12,
  },
  updateButton: {
    marginTop: 8,
  },
  errorText: {
    color: "#B00020",
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    marginBottom: 8,
    marginTop: 4,
  },
  successText: {
    color: "#4caf50",
    fontSize: 14,
    fontFamily: "Quicksand-SemiBold",
    marginBottom: 8,
    marginTop: 4,
    fontWeight: "600",
  },
  divider: {
    marginVertical: 8,
  },
  statItem: {
    paddingVertical: 8,
  },
  listItemTitle: {
    fontFamily: "Quicksand-SemiBold",
  },
  listItemDescription: {
    fontFamily: "Quicksand-Regular",
  },
  cardContent: {
    paddingTop: 16,
  },
  warningText: {
    color: "#666",
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    marginTop: 4,
    marginBottom: 8,
  },
});

export default SettingsScreen;

