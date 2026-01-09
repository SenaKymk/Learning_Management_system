import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { fetchCourseStudents, fetchCourses } from "../api/apiClient";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { useTheme } from "../theme/theme";

type Row = {
  id: string;
  student: string;
  course: string;
  score: number | null;
  source: string | null;
};

export default function AdminResultsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!courses) return;
      setLoading(true);
      setError(null);
      try {
        const allRows: Row[] = [];
        for (const course of courses) {
          const students = await fetchCourseStudents(course.id, "ENROLLED");
          students.forEach((student) => {
            allRows.push({
              id: `${course.id}-${student.userId}`,
              student: `${student.firstName} ${student.lastName}`,
              course: course.title,
              score: student.score ?? null,
              source: student.source ?? null
            });
          });
        }
        setRows(allRows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Results failed to load.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courses]);

  const listHeader = (
    <View style={styles.hero}>
      <Text style={styles.title}>Results</Text>
      <Text style={styles.subtitle}>See all grades across courses.</Text>
      {loading ? <Text style={styles.subtitle}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <Screen scrollable={false}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.label}>{item.student}</Text>
                <Text style={styles.subtitle}>{item.course}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.subtitle}>Source: {item.source ?? "-"}</Text>
                <Text style={styles.label}>Score: {item.score ?? "-"}</Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: { text: string; muted: string; danger: string }) =>
  StyleSheet.create({
    hero: { marginBottom: 14 },
    title: { color: colors.text, fontSize: 22, fontWeight: "700" },
    subtitle: { color: colors.muted },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    label: {
      color: colors.text,
      fontWeight: "700"
    },
    error: {
      color: colors.danger
    }
  });
