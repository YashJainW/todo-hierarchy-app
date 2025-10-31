import React, { useState, useMemo, useEffect } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  RefreshControl,
  Text as RNText,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Card,
  Title,
  Paragraph,
  ProgressBar,
  Text,
  Chip,
  ActivityIndicator,
  SegmentedButtons,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "date-fns";
import { useStats } from "../../hooks/useTodos";
import { useIsFocused } from "@react-navigation/native";

const StatsScreen = () => {
  const { stats, loading, error, refetch } = useStats();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState("percentage"); // percentage, type, date

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Auto-refresh when screen gains focus so stats reflect recent task updates
  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused]);

  // Process and sort stats
  const processedStats = useMemo(() => {
    if (!stats || !Array.isArray(stats)) {
      return [];
    }

    let sorted = [...stats];

    switch (sortBy) {
      case "percentage":
        sorted.sort(
          (a, b) =>
            (b.completion_percentage || 0) - (a.completion_percentage || 0)
        );
        break;
      case "type":
        sorted.sort((a, b) => {
          const typeOrder = { yearly: 4, monthly: 3, weekly: 2, daily: 1 };
          const aOrder = typeOrder[a.task_type] || 0;
          const bOrder = typeOrder[b.task_type] || 0;
          return bOrder - aOrder;
        });
        break;
      case "date":
        sorted.sort((a, b) => {
          const aDate = new Date(a.created_at || 0);
          const bDate = new Date(b.created_at || 0);
          return bDate - aDate;
        });
        break;
      default:
        break;
    }

    return sorted;
  }, [stats, sortBy]);

  // Calculate overall summary
  const summary = useMemo(() => {
    if (!processedStats || processedStats.length === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    const total = processedStats.reduce(
      (sum, stat) => sum + (stat.total_descendants || 0),
      0
    );
    const completed = processedStats.reduce(
      (sum, stat) => sum + (stat.completed_descendants || 0),
      0
    );
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, percentage };
  }, [processedStats]);

  // Get progress bar color based on percentage
  const getProgressColor = (percentage) => {
    if (percentage >= 100) return "#4caf50"; // green
    if (percentage >= 67) return "#2196f3"; // blue
    if (percentage >= 34) return "#ff9800"; // orange
    return "#f44336"; // red
  };

  // Format task type for display
  const formatTaskType = (type) => {
    if (!type) return "Unknown";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Summary Header Component
  const SummaryHeader = () => {
    if (processedStats.length === 0) return null;

    return (
      <Card style={styles.summaryCard} mode="elevated" elevation={3}>
        <LinearGradient
          colors={["#3B1CB0", "#5A2DFF", "#8C4BFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryGradient}
        >
          <RNText style={styles.summaryTitle}>Overall Progress</RNText>
        </LinearGradient>
        <Card.Content style={styles.summaryContent}>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryNumber, styles.summaryNumberGradient]}
              >
                {summary.completed}
              </Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryNumber, styles.summaryNumberGradient]}
              >
                {summary.total}
              </Text>
              <Text style={styles.summaryLabel}>Total Tasks</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text
                style={[
                  styles.summaryNumber,
                  { color: getProgressColor(summary.percentage) },
                ]}
              >
                {summary.percentage.toFixed(1)}%
              </Text>
              <Text style={styles.summaryLabel}>Complete</Text>
            </View>
          </View>
          <ProgressBar
            progress={summary.percentage / 100}
            color={getProgressColor(summary.percentage)}
            style={styles.summaryProgressBar}
          />
        </Card.Content>
      </Card>
    );
  };

  // StatCard Component
  const StatCard = ({ item }) => {
    const percentage = item.completion_percentage || 0;
    const completed = item.completed_descendants || 0;
    const total = item.total_descendants || 0;
    const progressColor = getProgressColor(percentage);

    // Get gradient colors based on task type
    const getCardGradient = () => {
      if (item.task_type === "yearly") return ["#9C27B0", "#BA68C8"];
      if (item.task_type === "monthly") return ["#2196F3", "#64B5F6"];
      if (item.task_type === "weekly") return ["#4CAF50", "#81C784"];
      return ["#FF9800", "#FFB74D"];
    };

    return (
      <Card style={styles.card} mode="elevated" elevation={2}>
        <LinearGradient
          colors={getCardGradient()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeaderGradient}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderContent}>
              <RNText style={styles.cardHeaderTitle} numberOfLines={2}>
                {item.root_task_name || item.title || "Untitled Task"}
              </RNText>
              {item.created_at && (
                <RNText style={styles.cardHeaderSubtitle}>
                  Created: {format(new Date(item.created_at), "MMM dd, yyyy")}
                </RNText>
              )}
            </View>
            {item.task_type && (
              <Chip
                style={[
                  styles.typeChipHeader,
                  {
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
                  },
                ]}
                textStyle={styles.chipTextHeader}
              >
                {formatTaskType(item.task_type)}
              </Chip>
            )}
          </View>
        </LinearGradient>
        <Card.Content>
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                {completed} of {total} completed
              </Text>
              <Text style={[styles.progressPercent, { color: progressColor }]}>
                {percentage.toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={percentage / 100}
              color={progressColor}
              style={styles.progressBar}
            />
          </View>
          {item.due_date && (
            <View style={styles.dueDateContainer}>
              <RNText style={styles.dueDateLabel}>Due Date:</RNText>
              <RNText style={styles.dueDateText}>
                {format(new Date(item.due_date), "MMM dd, yyyy")}
              </RNText>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Sorting Controls
  const SortControls = () => {
    if (!processedStats || processedStats.length === 0) return null;

    return (
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <SegmentedButtons
          value={sortBy}
          onValueChange={setSortBy}
          buttons={[
            { value: "percentage", label: "Progress" },
            { value: "type", label: "Type" },
            { value: "date", label: "Date" },
          ]}
          style={styles.sortButtons}
        />
      </View>
    );
  };

  if (loading && (!stats || stats.length === 0)) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText} onPress={refetch}>
            Tap to retry
          </Text>
        </View>
      )}

      <FlatList
        data={processedStats}
        keyExtractor={(item, index) =>
          item.id ? item.id.toString() : `stat-${index}`
        }
        renderItem={({ item }) => <StatCard item={item} />}
        contentContainerStyle={
          processedStats.length === 0
            ? styles.emptyContainer
            : styles.listContainer
        }
        ListHeaderComponent={
          <>
            <SummaryHeader />
            <SortControls />
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No statistics available</Text>
              <Text style={styles.emptySubtext}>
                Start creating tasks to see your progress here
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6200ee"
          />
        }
      />
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
  errorContainer: {
    padding: 16,
    backgroundColor: "#ffebee",
    borderBottomWidth: 1,
    borderBottomColor: "#ef5350",
  },
  errorText: {
    fontFamily: "Quicksand-Regular",
    color: "#B00020",
    marginBottom: 4,
  },
  retryText: {
    fontFamily: "Quicksand-Regular",
    color: "#6200ee",
    textDecorationLine: "underline",
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    color: "#999",
    textAlign: "center",
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  summaryGradient: {
    padding: 16,
    paddingBottom: 20,
  },
  summaryContent: {
    paddingTop: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    color: "#ffffff",
  },
  summaryNumberGradient: {
    color: "#6200ee",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
    color: "#6200ee",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#666",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  summaryProgressBar: {
    height: 8,
    borderRadius: 4,
  },
  sortContainer: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Quicksand-SemiBold",
    marginBottom: 8,
    color: "#000",
    paddingHorizontal: 4,
  },
  sortButtons: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  cardHeaderGradient: {
    padding: 16,
    paddingBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardHeaderContent: {
    flex: 1,
    marginRight: 12,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontFamily: "Quicksand-SemiBold",
    color: "#ffffff",
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#ffffff",
    opacity: 0.9,
  },
  typeChipHeader: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  chipTextHeader: {
    fontFamily: "Quicksand-SemiBold",
    color: "#ffffff",
    fontSize: 11,
  },
  typeChip: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  chipText: {
    fontFamily: "Quicksand-SemiBold",
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontFamily: "Quicksand-Medium",
    color: "#666",
    fontWeight: "500",
  },
  progressPercent: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    fontWeight: "bold",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
  },
  dueDateContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
  },
  dueDateLabel: {
    fontSize: 12,
    fontFamily: "Quicksand-SemiBold",
    color: "#666",
    marginRight: 8,
  },
  dueDateText: {
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
    color: "#000",
  },
});

export default StatsScreen;
