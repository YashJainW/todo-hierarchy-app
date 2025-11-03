import React, { createContext, useState, useEffect, useContext } from "react";
import supabase from "../lib/supabase";
import { logger, setLoggingUserId, flushLogs } from "../utils/logger";
// Removed client-side auto deletion trigger; handled by server cron

// Create AuthContext
const AuthContext = createContext(undefined);

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          logger.error("[AuthContext] Failed to get initial session:", {
            message: error.message,
            status: error.status,
          });
        }

        if (mounted) {
          setSession(initialSession);
          setLoading(false);
          if (initialSession) {
            // Set user ID for logging context
            setLoggingUserId(initialSession.user?.id);
            logger.log(
              "[AuthContext] Session initialized:",
              {
                userId: initialSession.user?.id,
                expiresAt: initialSession.expires_at,
              },
              initialSession.user?.id
            );
            // Auto-deletion is scheduled server-side via cron
          } else {
            // Clear user ID if no session
            setLoggingUserId(null);
          }
        }
      } catch (error) {
        logger.error("[AuthContext] Error in getInitialSession:", {
          message: error.message,
          stack: error.stack,
        });
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        // Update logging user ID when session changes
        const userId = session?.user?.id || null;
        setLoggingUserId(userId);

        logger.log(
          "[AuthContext] Auth state changed:",
          {
            event,
            hasSession: !!session,
            userId,
          },
          userId
        );
        setSession(session);
        setLoading(false);
        // Auto-deletion is scheduled server-side via cron
      }
    });

    // Cleanup function
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;
      logger.log(
        "[AuthContext] Sign in successful:",
        {
          userId,
          email: data.user?.email,
        },
        userId
      );
      return { data, error: null };
    } catch (error) {
      logger.error("[AuthContext] Sign in failed:", {
        message: error.message,
        status: error.status,
      });
      return {
        data: null,
        error:
          error.message || "Failed to sign in. Please check your credentials.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email, password, username, fullName) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // No email redirect needed
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;
      logger.log(
        "[AuthContext] Sign up successful:",
        {
          userId,
          email: data.user?.email,
        },
        userId
      );
      return { data, error: null };
    } catch (error) {
      logger.error("[AuthContext] Sign up failed:", {
        message: error.message,
        status: error.status,
      });
      return {
        data: null,
        error: error.message || "Failed to create account. Please try again.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      const currentUserId = session?.user?.id;

      // Flush any pending logs before signing out
      await flushLogs();

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setSession(null);
      setLoggingUserId(null); // Clear logging user ID
      logger.log("[AuthContext] Sign out successful", null, currentUserId);
      return { error: null };
    } catch (error) {
      logger.error(
        "[AuthContext] Sign out failed:",
        {
          message: error.message,
          status: error.status,
        },
        session?.user?.id
      );
      return {
        error: error.message || "Failed to sign out. Please try again.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) {
        throw error;
      }

      logger.log("[AuthContext] Profile update successful");
      return { data, error: null };
    } catch (error) {
      logger.error("[AuthContext] Profile update failed:", {
        message: error.message,
        status: error.status,
      });
      return {
        data: null,
        error: error.message || "Failed to update profile. Please try again.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Update password function
  const updatePassword = async (newPassword) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      logger.log("[AuthContext] Password update successful");
      return { data, error: null };
    } catch (error) {
      logger.error("[AuthContext] Password update failed:", {
        message: error.message,
        status: error.status,
      });
      return {
        data: null,
        error: error.message || "Failed to update password. Please try again.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    session,
    loading,
    user: session?.user,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// useAuth hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
