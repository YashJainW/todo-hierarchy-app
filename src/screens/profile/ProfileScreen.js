import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, Text } from "react-native";
import {
  Card,
  TextInput,
  Button,
  Divider,
  List,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabase";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, updateProfile, signOut } = useAuth();

  // Profile state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

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

      // Also update user metadata (preserve existing settings)
      const meta = user?.user_metadata || {};
      const result = await updateProfile({
        username: username.trim(),
        full_name: fullName.trim() || null,
        autoDeleteEnabled: meta.autoDeleteEnabled || false,
        autoDeleteDays: meta.autoDeleteDays || 30,
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

        {/* Settings Button */}
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsButton}
          icon={() => (
            <MaterialCommunityIcons name="cog" size={20} color="#fff" />
          )}
        >
          Settings
        </Button>

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
  settingsButton: {
    marginTop: 8,
    marginBottom: 8,
  },
});

export default ProfileScreen;
