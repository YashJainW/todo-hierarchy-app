import React, { useState, useMemo } from "react";
import { FlatList, View, StyleSheet, RefreshControl } from "react-native";
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

const StatsScreen = () => {
  const { stats, loading, error, refetch } = useStats();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState("percentage"); // percentage, type, date

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
        <Card.Content>
          <Title style={styles.summaryTitle}>Overall Progress</Title>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.completed}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.total}</Text>
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

    return (
      <Card style={styles.card} mode="elevated" elevation={2}>
        <Card.Title
          title={item.root_task_name || item.title || "Untitled Task"}
          subtitle={
            item.created_at
              ? `Created: ${format(new Date(item.created_at), "MMM dd, yyyy")}`
              : null
          }
          titleNumberOfLines={2}
        />
        <Card.Content>
          {item.task_type && (
            <Chip
              style={[
                styles.typeChip,
                {
                  backgroundColor:
                    item.task_type === "yearly"
                      ? "#9c27b0"
                      : item.task_type === "monthly"
                      ? "#2196f3"
                      : item.task_type === "weekly"
                      ? "#4caf50"
                      : "#ff9800",
                },
              ]}
              textStyle={styles.chipText}
            >
              {formatTaskType(item.task_type)}
            </Chip>
          )}

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
    color: "#666",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#ffebee",
    borderBottomWidth: 1,
    borderBottomColor: "#ef5350",
  },
  errorText: {
    color: "#B00020",
    marginBottom: 4,
  },
  retryText: {
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
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
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
    color: "#6200ee",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
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
  },
  typeChip: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  chipText: {
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
    color: "#666",
    fontWeight: "500",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "bold",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
  },
});

export default StatsScreen;
