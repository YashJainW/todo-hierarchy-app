import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, Text } from "react-native";
import {
  Card,
  Title,
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
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";

const ProfileScreen = () => {
  const { user, updateProfile, updatePassword, signOut } = useAuth();

  // Profile state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

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
  const MAX_DAYS = 365;

  // Statistics state
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    currentStreak: 0,
    memberSince: null,
  });

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
    fetchStatistics();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);

      // Try to get from profiles table first
      if (user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profileError && profileData) {
          const fetchedUsername = profileData.username || "";
          const fetchedFullName = profileData.full_name || "";
          setUsername(fetchedUsername);
          setFullName(fetchedFullName);
          setInitialUsername(fetchedUsername);
          setInitialFullName(fetchedFullName);
        } else {
          // Fallback to user metadata
          const metadata = user.user_metadata || {};
          const fetchedUsername = metadata.username || "";
          const fetchedFullName = metadata.full_name || "";
          setUsername(fetchedUsername);
          setFullName(fetchedFullName);
          setInitialUsername(fetchedUsername);
          setInitialFullName(fetchedFullName);
        }
      } else {
        // Use user metadata
        const metadata = user?.user_metadata || {};
        const fetchedUsername = metadata.username || "";
        const fetchedFullName = metadata.full_name || "";
        setUsername(fetchedUsername);
        setFullName(fetchedFullName);
        setInitialUsername(fetchedUsername);
        setInitialFullName(fetchedFullName);
      }

      // Load auto-delete settings from user metadata
      const meta = user?.user_metadata || {};
      const enabled = Boolean(meta.autoDeleteEnabled);
      const daysVal = Number(meta.autoDeleteDays) || 30;
      setAutoDeleteEnabled(enabled);
      setAutoDeleteDays(String(Math.min(daysVal, MAX_DAYS)));
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to user metadata
      const metadata = user?.user_metadata || {};
      const fetchedUsername = metadata.username || "";
      const fetchedFullName = metadata.full_name || "";
      setUsername(fetchedUsername);
      setFullName(fetchedFullName);
      setInitialUsername(fetchedUsername);
      setInitialFullName(fetchedFullName);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      if (!user?.id) return;

      // Fetch total tasks
      const { count: totalCount } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch completed tasks
      const { count: completedCount } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("state", "completed");

      // Get member since date
      const memberSince = user.created_at ? new Date(user.created_at) : null;

      setStats({
        totalTasks: totalCount || 0,
        completedTasks: completedCount || 0,
        currentStreak: 0, // TODO: Implement streak calculation
        memberSince,
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  };

  const handleProfileUpdate = async () => {
    if (!username.trim()) {
      setProfileError("Username is required");
      return;
    }

    setSaving(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      // Try to update profiles table first
      if (user?.id) {
        const { error: updateError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            username: username.trim(),
            full_name: fullName.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (updateError) {
          throw updateError;
        }
      }

      // Also update user metadata
      let daysNum = Number(autoDeleteDays) || 0;
      if (daysNum < 0) daysNum = 0;
      if (daysNum > MAX_DAYS) daysNum = MAX_DAYS;

      const result = await updateProfile({
        username: username.trim(),
        full_name: fullName.trim() || null,
        autoDeleteEnabled: autoDeleteEnabled,
        autoDeleteDays: daysNum,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setProfileSuccess(true);
      // Update initial values after successful save
      setInitialUsername(username.trim());
      setInitialFullName(fullName.trim() || "");
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileError(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Check if profile form has changes
  const hasProfileChanges = () => {
    return (
      username.trim() !== initialUsername ||
      (fullName.trim() || "") !== initialFullName
    );
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

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const result = await signOut();
          if (result.error) {
            Alert.alert("Error", result.error);
          }
        },
      },
    ]);
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading profile...</Text>
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
        {/* Profile Information Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.gradientTitle}>Profile Information</Text>
          </LinearGradient>
          <Card.Content style={styles.cardContent}>
            {/* Email (read-only) */}
            <TextInput
              label="Email"
              value={user?.email || ""}
              mode="outlined"
              style={styles.input}
              disabled
              right={<TextInput.Icon icon="lock" />}
            />

            {/* Username */}
            <TextInput
              label="Username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setProfileError(null);
              }}
              mode="outlined"
              style={styles.input}
              disabled={saving}
              textColor="#000000"
              activeOutlineColor="#6200ee"
              outlineColor="#CCCCCC"
            />

            {/* Full Name */}
            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setProfileError(null);
              }}
              mode="outlined"
              style={styles.input}
              disabled={saving}
              textColor="#000000"
              activeOutlineColor="#6200ee"
              outlineColor="#CCCCCC"
            />

            {/* Error/Success Messages */}
            {profileError && (
              <Text style={styles.errorText}>{profileError}</Text>
            )}
            {profileSuccess && (
              <Text style={styles.successText}>
                Profile updated successfully!
              </Text>
            )}

            {/* Update Button */}
            <Button
              mode="contained"
              onPress={handleProfileUpdate}
              loading={saving}
              disabled={saving || !hasProfileChanges()}
              style={styles.updateButton}
            >
              Update Profile
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
              <Switch value={autoDeleteEnabled} onValueChange={setAutoDeleteEnabled} />
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
            Maximum retention is 365 days. Items older than 1 year are deleted automatically.
          </Text>
          <Button
            mode="contained"
            onPress={handleProfileUpdate}
            style={styles.updateButton}
            loading={saving}
            disabled={saving}
          >
            Save Settings
          </Button>
        </Card.Content>
      </Card>

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

        <Divider style={styles.divider} />

        {/* Statistics Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <LinearGradient
            colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.gradientTitle}>Statistics</Text>
          </LinearGradient>
          <Card.Content style={styles.cardContent}>
            <List.Item
              title="Total Tasks"
              description={`${stats.totalTasks} tasks created`}
              left={(props) => <List.Icon {...props} icon="check-circle" />}
              style={styles.statItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />

            <List.Item
              title="Completed Tasks"
              description={`${stats.completedTasks} tasks finished`}
              left={(props) => <List.Icon {...props} icon="check-all" />}
              style={styles.statItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />

            {stats.memberSince && (
              <List.Item
                title="Member Since"
                description={format(stats.memberSince, "MMMM dd, yyyy")}
                left={(props) => <List.Icon {...props} icon="calendar" />}
                style={styles.statItem}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
            )}
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Sign Out Button */}
        <Button
          mode="contained"
          onPress={handleSignOut}
          style={styles.signOutButton}
          buttonColor="#B00020"
          textColor="#fff"
        >
          Sign Out
        </Button>
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
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    marginBottom: 16,
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
  signOutButton: {
    marginTop: 8,
    marginBottom: 32,
  },
  cardContent: {
    paddingTop: 16,
  },
});

export default ProfileScreen;
