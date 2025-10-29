import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Card,
  Title,
  TextInput,
  Button,
  Divider,
  List,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabase";
import { format } from "date-fns";

const ProfileScreen = () => {
  const { user, updateProfile, updatePassword, signOut } = useAuth();

  // Profile state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
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
          setUsername(profileData.username || "");
          setFullName(profileData.full_name || "");
        } else {
          // Fallback to user metadata
          const metadata = user.user_metadata || {};
          setUsername(metadata.username || "");
          setFullName(metadata.full_name || "");
        }
      } else {
        // Use user metadata
        const metadata = user?.user_metadata || {};
        setUsername(metadata.username || "");
        setFullName(metadata.full_name || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to user metadata
      const metadata = user?.user_metadata || {};
      setUsername(metadata.username || "");
      setFullName(metadata.full_name || "");
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
      const result = await updateProfile({
        username: username.trim(),
        full_name: fullName.trim() || null,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileError(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

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
      const result = await updatePassword(newPassword);

      if (result.error) {
        throw new Error(result.error);
      }

      setPasswordSuccess(true);
      // Clear form
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
          <Card.Content>
            <Title style={styles.sectionTitle}>Profile Information</Title>

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
              disabled={saving}
              style={styles.updateButton}
            >
              Update Profile
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Password Change Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Change Password</Title>

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
              disabled={changingPassword}
              style={styles.updateButton}
            >
              Change Password
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Statistics Section */}
        <Card style={styles.card} mode="elevated" elevation={2}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Statistics</Title>

            <List.Item
              title="Total Tasks"
              description={`${stats.totalTasks} tasks created`}
              left={(props) => <List.Icon {...props} icon="check-circle" />}
              style={styles.statItem}
            />

            <List.Item
              title="Completed Tasks"
              description={`${stats.completedTasks} tasks finished`}
              left={(props) => <List.Icon {...props} icon="check-all" />}
              style={styles.statItem}
            />

            {stats.memberSince && (
              <List.Item
                title="Member Since"
                description={format(stats.memberSince, "MMMM dd, yyyy")}
                left={(props) => <List.Icon {...props} icon="calendar" />}
                style={styles.statItem}
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
    color: "#666",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
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
    marginBottom: 8,
    marginTop: 4,
  },
  successText: {
    color: "#4caf50",
    fontSize: 14,
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
  signOutButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});

export default ProfileScreen;
