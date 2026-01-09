import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { fetchMyGrades } from "../api/apiClient";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { useTheme } from "../theme/theme";

export default function ResultsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data, isLoading, error } = useQuery({
    queryKey: ["myGrades"],
    queryFn: fetchMyGrades
  });

  const listHeader = (
    <View style={styles.hero}>
      <Text style={styles.title}>My results</Text>
      <Text style={styles.subtitle}>Latest grades</Text>
      {isLoading ? <Text style={styles.subtitle}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>Results failed to load.</Text> : null}
      {data?.length === 0 ? <Text style={styles.subtitle}>No grades yet.</Text> : null}
    </View>
  );

  return (
    <Screen scrollable={false}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.label}>{item.courseTitle}</Text>
            <Text style={styles.subtitle}>Source: {item.source}</Text>
            <Text style={styles.label}>Score: {item.score ?? "-"}</Text>
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
    label: { color: colors.text, fontWeight: "700" },
    error: { color: colors.danger }
  });
