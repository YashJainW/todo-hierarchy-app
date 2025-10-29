import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigation.navigate("Login");
        setSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, navigation]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    if (
      !username.trim() ||
      !fullName.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setError("Please fill in all fields");
      return false;
    }

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return false;
    }

    if (username.includes(" ")) {
      setError("Username cannot contain spaces");
      return false;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const result = await signUp(
      email.trim(),
      password,
      username.trim(),
      fullName.trim()
    );
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  const clearError = () => {
    if (error) setError("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Title style={styles.title}>Create Account</Title>
            <Text style={styles.subtitle}>
              Sign up to get started with your account
            </Text>

            {success ? (
              <Text style={styles.successText}>
                Account created successfully! Redirecting...
              </Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TextInput
              label="Username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                clearError();
              }}
              autoCapitalize="none"
              autoComplete="username"
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />

            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                clearError();
              }}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />

            <TextInput
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError();
              }}
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading || success}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Sign Up
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Text
                style={styles.linkText}
                onPress={() => navigation.navigate("Login")}
                disabled={loading}
              >
                Sign In
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    color: "#666",
  },
  errorText: {
    color: "#B00020",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  successText: {
    color: "#4CAF50",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  linkText: {
    fontSize: 14,
    color: "#6200ee",
    fontWeight: "600",
  },
});

export default SignUpScreen;
