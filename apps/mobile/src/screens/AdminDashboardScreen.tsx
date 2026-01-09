import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { fetchAdminMetrics } from "../api/apiClient";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { useTheme } from "../theme/theme";

type MetricProps = {
  label: string;
  value: number | string | undefined;
  styles: ReturnType<typeof makeStyles>;
};

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data, isLoading, error } = useQuery({
    queryKey: ["adminMetrics"],
    queryFn: fetchAdminMetrics
  });

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Admin dashboard</Text>
        <Text style={styles.subtitle}>Course and enrollment metrics.</Text>
      </View>
      {isLoading ? <Text style={styles.subtitle}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>Metrics failed to load.</Text> : null}
      <View style={styles.grid}>
        <Card>
          <Metric label="Courses" value={data?.totalCourses} styles={styles} />
        </Card>
        <Card>
          <Metric label="Students" value={data?.totalStudents} styles={styles} />
        </Card>
        <Card>
          <Metric label="Enrolled" value={data?.totalEnrolledStudents} styles={styles} />
        </Card>
        <Card>
          <Metric label="Avg grade" value={data?.averageGrade?.toFixed?.(1)} styles={styles} />
        </Card>
      </View>
    </Screen>
  );
}

function Metric({ label, value, styles }: MetricProps) {
  return (
    <View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value ?? "-"}</Text>
    </View>
  );
}

const makeStyles = (colors: { text: string; muted: string; danger: string }) =>
  StyleSheet.create({
    hero: {
      marginBottom: 14
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700"
    },
    subtitle: {
      color: colors.muted
    },
    grid: {
      gap: 10
    },
    metricLabel: {
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontSize: 12
    },
    metricValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
      marginTop: 4
    },
    error: {
      color: colors.danger
    }
  });
