import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import {
  cloneCourse,
  createCourse,
  fetchCourses,
  getCacheMeta,
  type Course
} from "../api/apiClient";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

export default function CoursesScreen() {
  const { role } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [cloneCourseId, setCloneCourseId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<{ hit: boolean; ts: number | null }>({
    hit: false,
    ts: null
  });

  const { data: courses, isLoading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses
  });

  useEffect(() => {
    if (!courses) {
      return;
    }
    setOfflineMeta(getCacheMeta("courses"));
  }, [courses]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (cloneMode) {
        if (!cloneCourseId) {
          throw new Error("Select a course to clone.");
        }
        await cloneCourse(cloneCourseId);
      } else {
        await createCourse(title, description || undefined);
      }
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setCloneCourseId("");
      setCloneMode(false);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Action failed.";
      setFormError(message);
    }
  });

  const renderCourse = ({ item }: { item: Course }) => (
    <Card padded>
      <View style={styles.courseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.courseTitle}>{item.title}</Text>
          <Text style={styles.courseDesc}>{item.description ?? "No description"}</Text>
        </View>
        <Badge
          label={item.materialKey ? "Material ready" : "No material"}
          tone={item.materialKey ? "success" : "muted"}
        />
      </View>
      <Button
        label="Details"
        variant="secondary"
        onPress={() =>
          navigation.navigate("CourseDetail" as never, {
            courseId: item.id,
            title: item.title
          } as never)
        }
      />
    </Card>
  );

  const listHeader = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.title}>Courses</Text>
        <Text style={styles.subtitle}>Review and manage active courses.</Text>
      </View>

      {role === "ADMIN" ? (
        <Card>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>New course</Text>
            <Button
              label={showForm ? "Close" : "+ New"}
              variant="secondary"
              onPress={() => setShowForm((prev) => !prev)}
            />
          </View>
          {showForm ? (
            <View style={{ gap: 8 }}>
              <View style={styles.row}>
                <Text style={styles.label}>Clone mode</Text>
                <TextInput value={cloneMode ? "On" : "Off"} editable={false} style={styles.readonly} />
                <Button
                  label={cloneMode ? "Disable" : "Enable"}
                  variant="secondary"
                  onPress={() => setCloneMode((prev) => !prev)}
                />
              </View>
              {cloneMode ? (
                <TextField
                  label="Source course ID"
                  value={cloneCourseId}
                  onChangeText={setCloneCourseId}
                  placeholder="Course ID"
                />
              ) : (
                <>
                  <TextField label="Title" value={title} onChangeText={setTitle} />
                  <TextField
                    label="Description"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Button
                label={
                  createMutation.isPending
                    ? "Saving..."
                    : cloneMode
                      ? "Clone course"
                      : "Create course"
                }
                onPress={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {offlineMeta.hit ? (
        <Text style={styles.offline}>
          Offline data loaded{offlineMeta.ts ? ` (cached ${new Date(offlineMeta.ts).toLocaleTimeString()})` : ""}.
        </Text>
      ) : null}
      {isLoading ? <Text style={styles.subtitle}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>Courses failed to load.</Text> : null}
    </View>
  );

  return (
    <Screen scrollable={false}>
      <FlatList
        data={courses ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderCourse}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      />
    </Screen>
  );
}

const makeStyles = (colors: {
  text: string;
  muted: string;
  border: string;
  danger: string;
  warning: string;
}) =>
  StyleSheet.create({
    hero: {
      marginBottom: 14
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700"
    },
    subtitle: {
      color: colors.muted,
      marginTop: 4
    },
    courseHeader: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      marginBottom: 10
    },
    courseTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700"
    },
    courseDesc: {
      color: colors.muted,
      marginTop: 4
    },
    formHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    },
    formTitle: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    label: {
      color: colors.text,
      flex: 1
    },
    readonly: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      color: colors.text,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    error: {
      color: colors.danger,
      marginTop: 8
    },
    offline: {
      color: colors.warning,
      marginBottom: 8
    }
  });
