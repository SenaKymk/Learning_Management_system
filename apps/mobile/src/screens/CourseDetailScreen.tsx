import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Linking from "expo-linking";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  approveEnrollment,
  createCourseQuestion,
  createExamResult,
  fetchCourse,
  fetchCourseQuestions,
  fetchCourseStudents,
  getCacheMeta,
  fetchEnrollmentStatus,
  fetchExamResults,
  fetchMyExamResult,
  fetchMyGrades,
  fetchRandomCourseQuestions,
  getPresignedUrl,
  exportOmrResults,
  processOmrAnswerKey,
  processOmrGrade,
  processOmrSampleAnswerKey,
  processOmrSampleGrade,
  requestEnrollment,
  rejectEnrollment,
  reorderModules,
  setCourseGrade,
  submitCourseExam,
  updateCourseMaterial,
  uploadFile,
  type CourseDetail,
  type GradeEntry,
  type GradeSource,
  type OmrAnswerKeyResult,
  type OmrGradeResult,
  type QuestionBank
} from "../api/apiClient";
import { ApiRequestError } from "../api/errors";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useI18n } from "../i18n/i18n";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<{ CourseDetail: { courseId: string } }, "CourseDetail">;

type PracticeAnswerMap = Record<string, number>;

export default function CourseDetailScreen({ route }: Props) {
  const { courseId } = route.params;
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [uploading, setUploading] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionOptions, setQuestionOptions] = useState(["", "", "", ""]);
  const [questionAnswer, setQuestionAnswer] = useState("0");
  const [questionSource, setQuestionSource] = useState<"PDF" | "MANUAL">("PDF");
  const [questionModuleId, setQuestionModuleId] = useState("");
  const [randomQuestions, setRandomQuestions] = useState<QuestionBank[]>([]);
  const [practiceAnswers, setPracticeAnswers] = useState<PracticeAnswerMap>({});
  const [practiceResult, setPracticeResult] = useState<{ score: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [gradeSources, setGradeSources] = useState<Record<string, GradeSource>>({});
  const [examStudentId, setExamStudentId] = useState("");
  const [examScoreInput, setExamScoreInput] = useState("");
  const [omrMessage, setOmrMessage] = useState<string | null>(null);
  const [omrAnswerKey, setOmrAnswerKey] = useState<OmrAnswerKeyResult | null>(null);
  const [omrGrade, setOmrGrade] = useState<OmrGradeResult | null>(null);
  const [omrLoading, setOmrLoading] = useState(false);
  const [omrError, setOmrError] = useState<string | null>(null);
  const [omrCaptureMode, setOmrCaptureMode] = useState<"ANSWER" | "STUDENT" | null>(null);
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [offlineMeta, setOfflineMeta] = useState<{ hit: boolean; ts: number | null }>({
    hit: false,
    ts: null
  });
  const [viewedContentIds, setViewedContentIds] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const enrollMutation = useMutation({
    mutationFn: () => requestEnrollment(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollmentStatus", courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Kayıt talebi başarısız";
      setError(message);
    }
  });

  const {
    data: course,
    isLoading,
    error: courseError
  } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourse(courseId)
  });

  useEffect(() => {
    if (!course) {
      return;
    }
    setOfflineMeta(getCacheMeta(`course_${courseId}`));
  }, [course, courseId]);

  const moduleTitleMap = useMemo(
    () => new Map((course?.modules ?? []).map((module) => [module.id, module.title])),
    [course?.modules]
  );

  const { data: pendingStudents } = useQuery({
    queryKey: ["courseStudents", courseId, "PENDING"],
    queryFn: () => fetchCourseStudents(courseId, "PENDING"),
    enabled: role === "ADMIN"
  });

  const { data: enrolledStudents } = useQuery({
    queryKey: ["courseStudents", courseId, "ENROLLED"],
    queryFn: () => fetchCourseStudents(courseId, "ENROLLED"),
    enabled: role === "ADMIN",
    onSuccess: (rows) => {
      const inputs: Record<string, string> = {};
      const sources: Record<string, GradeSource> = {};
      rows.forEach((row) => {
        if (row.score !== null && row.score !== undefined) {
          inputs[row.userId] = String(row.score);
        }
        sources[row.userId] = row.source ?? "MANUAL";
      });
      setGradeInputs(inputs);
      setGradeSources(sources);
    }
  });

  const { data: enrollmentStatus } = useQuery({
    queryKey: ["enrollmentStatus", courseId],
    queryFn: () => fetchEnrollmentStatus(courseId),
    enabled: role === "STUDENT" && Boolean(courseId),
    retry: false
  });

  const { data: myGrades } = useQuery({
    queryKey: ["myGrades"],
    queryFn: fetchMyGrades,
    enabled: role === "STUDENT"
  });

  const { data: myExamResult } = useQuery({
    queryKey: ["myExamResult", courseId],
    queryFn: () => fetchMyExamResult(courseId),
    enabled: role === "STUDENT"
  });

  const { data: examResults } = useQuery({
    queryKey: ["examResults", courseId],
    queryFn: () => fetchExamResults(courseId),
    enabled: role === "ADMIN"
  });

  const { data: questions } = useQuery({
    queryKey: ["courseQuestions", courseId],
    queryFn: () => fetchCourseQuestions(courseId),
    enabled: role === "ADMIN"
  });

  useEffect(() => {
    if (courseError instanceof ApiRequestError) {
      setError(courseError.message);
    }
  }, [courseError]);

  useEffect(() => {
    const loadNotes = async () => {
      const stored = await AsyncStorage.getItem(`course_notes_${courseId}`);
      setNotes(stored ?? "");
    };
    loadNotes();
  }, [courseId]);

  useEffect(() => {
    const loadViewed = async () => {
      const stored = await AsyncStorage.getItem(`course_viewed_${courseId}`);
      if (stored) {
        setViewedContentIds(JSON.parse(stored) as Record<string, boolean>);
      }
    };
    loadViewed();
  }, [courseId]);

  useEffect(() => {
    if (timerSeconds === null || timerSeconds <= 0) {
      return;
    }
    const id = setInterval(() => {
      setTimerSeconds((prev) => (prev !== null ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(id);
  }, [timerSeconds]);

  useEffect(() => {
    if (timerSeconds === 0) {
      Alert.alert(t("timerDone"));
    }
  }, [timerSeconds, t]);

  const handleUploadMaterial = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const uploadedFile = await uploadFile({
        uri: asset.uri,
        name: asset.name ?? "material.pdf",
        type: asset.mimeType ?? "application/pdf"
      });
      const updated = await updateCourseMaterial(courseId, uploadedFile.objectKey);
      queryClient.setQueryData<CourseDetail | undefined>(["course", courseId], (prev) =>
        prev ? { ...prev, materialKey: updated.materialKey } : prev
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Materyal yüklenemedi";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenMaterial = async () => {
    if (!course?.materialKey) return;
    try {
      const url = await getPresignedUrl(course.materialKey);
      await Linking.openURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Materyal açılamadı";
      setError(message);
    }
  };

  const handleApprove = async (enrollmentId: string) => {
    await approveEnrollment(enrollmentId);
    queryClient.invalidateQueries({ queryKey: ["courseStudents", courseId] });
  };

  const handleReject = async (enrollmentId: string) => {
    await rejectEnrollment(enrollmentId);
    queryClient.invalidateQueries({ queryKey: ["courseStudents", courseId] });
  };

  const handleSaveGrade = async (userId: string) => {
    const value = gradeInputs[userId];
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      Alert.alert("Hata", "Not bir sayı olmalı");
      return;
    }
    const source = gradeSources[userId] ?? "MANUAL";
    await setCourseGrade(courseId, userId, parsed, source);
    queryClient.invalidateQueries({ queryKey: ["courseStudents", courseId, "ENROLLED"] });
  };

  const handleSaveNotes = async () => {
    await AsyncStorage.setItem(`course_notes_${courseId}`, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1500);
  };

  const markContentViewed = async (contentId: string) => {
    setViewedContentIds((prev) => {
      const next = { ...prev, [contentId]: true };
      AsyncStorage.setItem(`course_viewed_${courseId}`, JSON.stringify(next));
      return next;
    });
  };

  const handleStartTimer = () => {
    setTimerSeconds(10 * 60);
  };

  const handleDownloadPdf = async (objectKey?: string | null) => {
    if (!objectKey) {
      return;
    }
    try {
      const url = await getPresignedUrl(objectKey);
      const name = objectKey.split("/").pop() ?? "material.pdf";
      const dest = FileSystem.documentDirectory + name;
      await FileSystem.downloadAsync(url, dest);
      Alert.alert(t("downloadPdf"), dest);
    } catch (err) {
      const message = err instanceof Error ? err.message : "İndirme başarısız";
      setError(message);
    }
  };

  const handleUploadAnswerKey = async () => {
    if (!courseId) {
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.name ?? "answer-key.jpg",
        type: asset.mimeType ?? "image/jpeg"
      });
      const response = await processOmrAnswerKey(courseId, uploaded.objectKey);
      setOmrAnswerKey(response);
      setOmrMessage("Answer key processed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Answer key failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
    }
  };

  const handleUploadStudentSheet = async () => {
    if (!courseId) {
      return;
    }
    if (!omrAnswerKey) {
      setOmrError("Upload answer key first");
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.name ?? "student-sheet.jpg",
        type: asset.mimeType ?? "image/jpeg"
      });
      const response = await processOmrGrade(courseId, uploaded.objectKey);
      setOmrGrade(response);
      setOmrMessage("Student sheet processed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Student sheet failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
    }
  };

  const ensureCameraPermission = async () => {
    const current = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!current?.granted) {
      setOmrError("Camera permission denied.");
      return false;
    }
    return true;
  };

  const handleStartOmrCamera = async (mode: "ANSWER" | "STUDENT") => {
    if (mode === "STUDENT" && !omrAnswerKey) {
      setOmrError("Upload answer key first");
      return;
    }
    const ok = await ensureCameraPermission();
    if (!ok) {
      return;
    }
    setOmrCaptureMode(mode);
  };

  const handleCaptureOmr = async () => {
    if (!courseId || !omrCaptureMode) {
      return;
    }
    if (!cameraRef.current?.takePictureAsync) {
      setOmrError("Camera not ready.");
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true
      });
      if (!photo?.uri) {
        throw new Error("Capture failed.");
      }
      const uploaded = await uploadFile({
        uri: photo.uri,
        name: omrCaptureMode === "ANSWER" ? "answer-key.jpg" : "student-sheet.jpg",
        type: "image/jpeg"
      });
      if (omrCaptureMode === "ANSWER") {
        const response = await processOmrAnswerKey(courseId, uploaded.objectKey);
        setOmrAnswerKey(response);
        setOmrMessage("Answer key processed");
      } else {
        const response = await processOmrGrade(courseId, uploaded.objectKey);
        setOmrGrade(response);
        setOmrMessage("Student sheet processed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Capture failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
      setOmrCaptureMode(null);
    }
  };

  const handleSampleAnswerKey = async () => {
    if (!courseId) {
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const response = await processOmrSampleAnswerKey(courseId);
      setOmrAnswerKey(response);
      setOmrMessage("Sample answer key processed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sample answer key failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
    }
  };

  const handleSampleStudentSheet = async () => {
    if (!courseId) {
      return;
    }
    if (!omrAnswerKey) {
      setOmrError("Upload answer key first");
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const response = await processOmrSampleGrade(courseId);
      setOmrGrade(response);
      setOmrMessage("Sample student processed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sample student failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
    }
  };

  const handleExportOmrJson = async () => {
    if (!courseId) {
      return;
    }
    setOmrError(null);
    setOmrLoading(true);
    try {
      const response = await exportOmrResults(courseId);
      const fileName = `omr_export_${courseId}.json`;
      const dest = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(dest, JSON.stringify(response.results, null, 2));
      setOmrMessage(`Exported JSON: ${fileName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setOmrError(message);
    } finally {
      setOmrLoading(false);
    }
  };

  const handleCreateQuestion = async () => {
    const answerIndex = Number(questionAnswer);
    if (Number.isNaN(answerIndex)) {
      setError("Cevap indeksini sayı girin");
      return;
    }
    const normalizedOptions = questionOptions.map((opt) => opt.trim());
    if (!questionText.trim()) {
      setError("Soru metni zorunlu");
      return;
    }
    if (normalizedOptions.some((opt) => opt.length === 0)) {
      setError("Tüm seçenekler zorunlu");
      return;
    }
    await createCourseQuestion(courseId, {
      text: questionText.trim(),
      options: normalizedOptions,
      answer: answerIndex,
      source: questionSource,
      moduleId: questionModuleId || undefined
    });
    queryClient.invalidateQueries({ queryKey: ["courseQuestions", courseId] });
    setQuestionText("");
    setQuestionOptions(["", "", "", ""]);
    setQuestionAnswer("0");
    setQuestionModuleId("");
  };

  const handleLoadRandomQuestions = async () => {
    try {
      const data = await fetchRandomCourseQuestions(courseId, 10);
      setRandomQuestions(data);
      setPracticeAnswers({});
      setPracticeResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sorular yüklenemedi";
      setError(message);
    }
  };

  const handleSubmitPractice = async () => {
    const answers = randomQuestions.map((question) => ({
      questionId: question.id,
      answer: practiceAnswers[question.id] ?? -1
    }));
    try {
      const result = await submitCourseExam(courseId, { answers });
      setPracticeResult({ score: result.score, total: result.total });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cevaplar gönderilemedi";
      setError(message);
    }
  };

  const moveModule = async (moduleId: string, direction: "up" | "down") => {
    if (!course?.modules) return;
    const modules = [...course.modules];
    const index = modules.findIndex((m) => m.id === moduleId);
    if (index === -1) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= modules.length) return;
    const temp = modules[target];
    modules[target] = modules[index];
    modules[index] = temp;
    const updated = modules.map((m, i) => ({ ...m, order: i + 1 }));
    queryClient.setQueryData<CourseDetail | undefined>(["course", courseId], (prev) =>
      prev ? { ...prev, modules: updated } : prev
    );
    try {
      await reorderModules(
        courseId,
        updated.map((m) => ({ id: m.id, order: m.order }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sıralama başarısız";
      setError(message);
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!course) {
    return (
      <Screen>
        <Text style={styles.error}>Kurs bulunamadı</Text>
      </Screen>
    );
  }

  const availability = (() => {
    const now = new Date();
    const availableFrom = course.availableFrom ? new Date(course.availableFrom) : null;
    const availableUntil = course.availableUntil ? new Date(course.availableUntil) : null;
    if (availableFrom && now < availableFrom) {
      return { label: "Henüz aktif değil", tone: "warning" as const };
    }
    if (availableUntil && now > availableUntil) {
      return { label: "Süresi doldu", tone: "danger" as const };
    }
    return { label: "Aktif", tone: "success" as const };
  })();

  const studentGrade: GradeEntry | undefined = myGrades?.find(
    (g) => g.courseId === course.id
  );

  return (
    <Screen>
      {offlineMeta.hit ? (
        <Card>
          <Text style={styles.offline}>
            Offline data loaded{offlineMeta.ts ? ` (cached ${new Date(offlineMeta.ts).toLocaleTimeString()})` : ""}.
          </Text>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.title}>{course.title}</Text>
        <Text style={styles.subtitle}>{course.description ?? "Açıklama yok"}</Text>
        {course.prerequisite ? (
          <Text style={styles.warning}>
            Önkoşul: {course.prerequisite.title}. Tamamlamanız önerilir.
          </Text>
        ) : null}
        <View style={styles.badgeRow}>
          <Badge label={course.materialKey ? "Materyal var" : "Materyal yok"} />
          {availability ? <Badge label={availability.label} tone={availability.tone} /> : null}
        </View>
        <View style={styles.row}>
          {role === "ADMIN" ? (
            <Button
              label={uploading ? "Yükleniyor..." : "PDF Yükle"}
              onPress={handleUploadMaterial}
              disabled={uploading}
            />
          ) : null}
          {role === "STUDENT" && course.materialKey ? (
            <Button label="Materyali aç" variant="secondary" onPress={handleOpenMaterial} />
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Öğrenciler</Text>
        {role === "ADMIN" ? (
          <>
            <Text style={styles.sectionSubtitle}>Bekleyen talepler</Text>
            {pendingStudents?.length === 0 ? (
              <Text style={styles.subtitle}>Bekleyen yok</Text>
            ) : null}
            {pendingStudents?.map((student) => (
              <View key={student.enrollmentId} style={styles.rowBetween}>
                <Text style={styles.label}>
                  {student.firstName} {student.lastName}
                </Text>
                <View style={styles.row}>
                  <Button
                    label="Onayla"
                    variant="secondary"
                    onPress={() => handleApprove(student.enrollmentId)}
                  />
                  <Button
                    label="Reddet"
                    variant="secondary"
                    onPress={() => handleReject(student.enrollmentId)}
                  />
                </View>
              </View>
            ))}

            <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>Kayıtlı öğrenciler</Text>
            {enrolledStudents?.length === 0 ? (
              <Text style={styles.subtitle}>Kayıtlı öğrenci yok</Text>
            ) : null}
            {enrolledStudents?.map((student) => (
              <View key={student.enrollmentId} style={styles.rowBetween}>
                <View>
                  <Text style={styles.label}>
                    {student.firstName} {student.lastName}
                  </Text>
                  <Text style={styles.subtitle}>Kaynak: {student.source ?? "-"}</Text>
                </View>
                <View style={styles.row}>
                  <TextInput
                    value={gradeInputs[student.userId] ?? ""}
                    onChangeText={(text) =>
                      setGradeInputs((prev) => ({ ...prev, [student.userId]: text }))
                    }
                    style={styles.numberInput}
                    keyboardType="numeric"
                    placeholder="-"
                  />
                  <TextInput
                    value={gradeSources[student.userId] ?? "MANUAL"}
                    onChangeText={(text) =>
                      setGradeSources((prev) => ({
                        ...prev,
                        [student.userId]: text as GradeSource
                      }))
                    }
                    style={[styles.numberInput, { width: 100 }]}
                    placeholder="MANUAL"
                  />
                  <Button
                    label="Kaydet"
                    variant="secondary"
                    onPress={() => handleSaveGrade(student.userId)}
                  />
                </View>
              </View>
            ))}
          </>
        ) : (
          <View>
            {enrollmentStatus?.status === "ENROLLED" ? (
              <Text style={styles.success}>Bu kursa kayıtlısın.</Text>
            ) : enrollmentStatus?.status === "PENDING" ? (
              <Text style={styles.warning}>Kayıt isteğin bekliyor.</Text>
            ) : enrollmentStatus?.status === "REJECTED" ? (
              <Text style={styles.error}>Kayıt isteğin reddedildi.</Text>
            ) : (
              <Button
                label={enrollMutation.isPending ? "Gönderiliyor..." : "Kursa katıl"}
                onPress={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
              />
            )}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Sonuçlar</Text>
        {role === "ADMIN" ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionSubtitle}>OMR sonuç ekle</Text>
              <View style={styles.row}>
                <TextInput
                  placeholder="Öğrenci ID"
                  value={examStudentId}
                  onChangeText={setExamStudentId}
                  style={[styles.numberInput, { width: 140 }]}
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  placeholder="Skor"
                  value={examScoreInput}
                  onChangeText={setExamScoreInput}
                  keyboardType="numeric"
                  style={styles.numberInput}
                  placeholderTextColor={colors.muted}
                />
                <Button
                  label="Ekle"
                  variant="secondary"
                  onPress={async () => {
                    const parsed = examScoreInput.trim() === "" ? undefined : Number(examScoreInput);
                    if (parsed !== undefined && Number.isNaN(parsed)) {
                      Alert.alert("Hata", "Skor sayı olmalı");
                      return;
                    }
                    await createExamResult(courseId, {
                      userId: examStudentId,
                      calculatedScore: parsed
                    });
                    queryClient.invalidateQueries({ queryKey: ["examResults", courseId] });
                    setExamScoreInput("");
                  }}
                  disabled={!examStudentId}
                />
              </View>
            </View>
            {examResults?.map((result) => (
              <View key={result.id} style={styles.rowBetween}>
                <Text style={styles.label}>
                  {result.user.firstName} {result.user.lastName}
                </Text>
                <Badge label={String(result.calculatedScore ?? "-")} />
              </View>
            ))}
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.subtitle}>Kurs notu: {studentGrade?.score ?? "-"}</Text>
            <Text style={styles.subtitle}>
              OMR / Exam: {myExamResult?.calculatedScore ?? "Henüz yok"}
            </Text>
          </View>
        )}
      </Card>

      {role === "STUDENT" ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("notes")}</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("notes")}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            style={styles.noteInput}
          />
          <View style={styles.row}>
            <Button label={t("saveNotes")} variant="secondary" onPress={handleSaveNotes} />
            {notesSaved ? <Text style={styles.subtitle}>Saved</Text> : null}
          </View>
          <View style={styles.timerBox}>
            <Text style={styles.subtitle}>
              {timerSeconds === null
                ? t("startTimer")
                : timerSeconds > 0
                  ? `${t("timerRunning")}: ${Math.floor(timerSeconds / 60)
                      .toString()
                      .padStart(2, "0")}:${(timerSeconds % 60).toString().padStart(2, "0")}`
                  : t("timerDone")}
            </Text>
            <Button label={t("startTimer")} variant="secondary" onPress={handleStartTimer} />
          </View>
        </Card>
      ) : null}

      {role === "ADMIN" ? (
  <Card>
    <Text style={styles.sectionTitle}>OMR Processing (A booklet)</Text>
    <Text style={styles.subtitle}>Upload answer key first, then upload student sheet.</Text>
    <View style={styles.row}>
      <Button
        label="Upload answer key"
        variant="secondary"
        onPress={handleUploadAnswerKey}
        disabled={omrLoading}
      />
      <Button
        label="Upload student sheet"
        variant="secondary"
        onPress={handleUploadStudentSheet}
        disabled={omrLoading}
      />
    </View>
    <View style={styles.row}>
      <Button
        label="Use sample answer key"
        variant="secondary"
        onPress={handleSampleAnswerKey}
        disabled={omrLoading}
      />
      <Button
        label="Use sample student"
        variant="secondary"
        onPress={handleSampleStudentSheet}
        disabled={omrLoading}
      />
    </View>
    <View style={styles.row}>
      <Button
        label="Capture answer key"
        variant="secondary"
        onPress={() => handleStartOmrCamera("ANSWER")}
        disabled={omrLoading}
      />
      <Button
        label="Capture student sheet"
        variant="secondary"
        onPress={() => handleStartOmrCamera("STUDENT")}
        disabled={omrLoading}
      />
    </View>
    {omrCaptureMode ? (
      <View style={styles.cameraBox}>
        <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
        <View style={styles.row}>
          <Button
            label={omrLoading ? "Capturing..." : "Use photo"}
            onPress={handleCaptureOmr}
            disabled={omrLoading}
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => setOmrCaptureMode(null)}
            disabled={omrLoading}
          />
        </View>
      </View>
    ) : null}
    <View style={styles.row}>
      <Button
        label="Export JSON"
        variant="secondary"
        onPress={handleExportOmrJson}
        disabled={omrLoading}
      />
    </View>
    {omrLoading ? <Text style={styles.subtitle}>Processing...</Text> : null}
    {omrError ? <Text style={styles.error}>{omrError}</Text> : null}
    {omrMessage ? <Text style={styles.subtitle}>{omrMessage}</Text> : null}
    {omrAnswerKey ? (
      <Text style={styles.subtitle}>Answer key: {omrAnswerKey.answers.join(", ")}</Text>
    ) : null}
    {omrGrade ? (
      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Student: {omrGrade.studentNumber}</Text>
        <Text style={styles.subtitle}>
          Score: {omrGrade.score} ({omrGrade.correct}/{omrGrade.total})
        </Text>
        {omrGrade.userId ? (
          <Text style={styles.subtitle}>Saved to exam results.</Text>
        ) : (
          <Text style={styles.subtitle}>Student not found or not enrolled.</Text>
        )}
        {omrGrade.warnings?.length ? (
          <Text style={styles.error}>Warnings: {omrGrade.warnings.join("; ")}</Text>
        ) : null}
      </View>
    ) : null}
  </Card>
) : null}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Modüller</Text>
          <Text style={styles.subtitle}>Sürükle yerine butonla taşı</Text>
        </View>
        {course.modules.length === 0 ? <Text style={styles.subtitle}>Modül yok</Text> : null}
        {course.modules.map((module, index) => (
          <View key={module.id} style={styles.module}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>{module.title}</Text>
              {role === "ADMIN" ? (
                <View style={styles.row}>
                  <Button
                    label="Up"
                    variant="secondary"
                    onPress={() => moveModule(module.id, "up")}
                    disabled={index === 0}
                  />
                  <Button
                    label="Down"
                    variant="secondary"
                    onPress={() => moveModule(module.id, "down")}
                    disabled={index === course.modules.length - 1}
                  />
                </View>
              ) : null}
            </View>
            {module.contents.map((content) => (
              <View key={content.id} style={styles.contentBox}>
                <Text style={styles.label}>{content.title}</Text>
                {viewedContentIds[content.id] ? (
                  <Text style={styles.subtitle}>Viewed</Text>
                ) : null}
                {content.type === "TEXT" ? (
                  <Text style={styles.subtitle}>{content.text}</Text>
                ) : content.type === "LINK" ? (
                  <Button
                    label="Open link"
                    variant="secondary"
                    onPress={() => {
                      Linking.openURL(content.url ?? "#");
                      markContentViewed(content.id);
                    }}
                  />
                ) : content.type === "VIDEO" ? (
                  content.url ? (
                    <Video
                      source={{ uri: content.url }}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      style={styles.video}
                      onLoad={() => markContentViewed(content.id)}
                    />
                  ) : (
                    <Button
                      label="Open video"
                      variant="secondary"
                      onPress={() => Linking.openURL(content.url ?? "#")}
                    />
                  )
                ) : content.type === "PDF" ? (
                  <View style={styles.row}>
                    <Button
                      label={t("openPdf")}
                      variant="secondary"
                      onPress={async () => {
                        if (!content.objectKey) return;
                        const url = await getPresignedUrl(content.objectKey);
                        Linking.openURL(url);
                        markContentViewed(content.id);
                      }}
                    />
                    <Button
                      label={t("downloadPdf")}
                      variant="secondary"
                      onPress={() => {
                        handleDownloadPdf(content.objectKey);
                        markContentViewed(content.id);
                      }}
                    />
                  </View>
                ) : (
                  <Text style={styles.subtitle}>Dosya: {content.objectKey}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Button label="Modüller" variant="secondary" onPress={() => {}} />
          <Button label="Sorular" variant="primary" onPress={() => {}} disabled />
        </View>
        {role === "ADMIN" ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            <Text style={styles.sectionTitle}>Soru ekle</Text>
            <TextField
              label="Soru"
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              numberOfLines={3}
            />
            {questionOptions.map((opt, idx) => (
              <TextField
                key={idx}
                label={`Seçenek ${idx + 1}`}
                value={opt}
                onChangeText={(text) =>
                  setQuestionOptions((prev) => prev.map((o, i) => (i === idx ? text : o)))
                }
              />
            ))}
            <TextField
              label="Doğru cevap indeksi"
              value={questionAnswer}
              onChangeText={setQuestionAnswer}
              keyboardType="numeric"
            />
            <TextField
              label="Kaynak (PDF/MANUAL)"
              value={questionSource}
              onChangeText={(text) => setQuestionSource(text as "PDF" | "MANUAL")}
            />
            <TextField
              label="Modül ID (opsiyonel)"
              value={questionModuleId}
              onChangeText={setQuestionModuleId}
            />
            <Button label="Soruyu ekle" onPress={handleCreateQuestion} />
            <Text style={styles.sectionSubtitle}>Soru bankası</Text>
            {questions?.length === 0 ? <Text style={styles.subtitle}>Soru yok</Text> : null}
            {questions?.map((q, idx) => (
              <View key={q.id} style={styles.contentBox}>
                <Text style={styles.label}>
                  {idx + 1}. {q.text}
                </Text>
                <Text style={styles.subtitle}>Kaynak: {q.source}</Text>
                <Text style={styles.subtitle}>
                  Modül: {q.moduleId ? moduleTitleMap.get(q.moduleId) ?? "Bilinmiyor" : "Atanmadı"}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Pratik sınav</Text>
              <Button label="Rastgele 10 soru" variant="secondary" onPress={handleLoadRandomQuestions} />
            </View>
            {randomQuestions.length === 0 ? (
              <Text style={styles.subtitle}>Sorular henüz yüklenmedi.</Text>
            ) : null}
            {randomQuestions.map((q, idx) => (
              <View key={q.id} style={styles.contentBox}>
                <Text style={styles.label}>
                  {idx + 1}. {q.text}
                </Text>
                {q.options.map((opt, optionIdx) => (
                  <Button
                    key={`${q.id}-${optionIdx}`}
                    label={`${optionIdx}. ${opt}`}
                    variant={practiceAnswers[q.id] === optionIdx ? "primary" : "secondary"}
                    onPress={() =>
                      setPracticeAnswers((prev) => ({ ...prev, [q.id]: optionIdx }))
                    }
                  />
                ))}
              </View>
            ))}
            {randomQuestions.length > 0 ? (
              <Button label="Gönder" onPress={handleSubmitPractice} />
            ) : null}
            {practiceResult ? (
              <Badge label={`Skor: ${practiceResult.score} / ${practiceResult.total}`} tone="success" />
            ) : null}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: {
  text: string;
  muted: string;
  warning: string;
  success: string;
  danger: string;
  border: string;
}) =>
  StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 6
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6
  },
  sectionSubtitle: {
    color: colors.text,
    fontWeight: "600",
    marginVertical: 4
  },
  warning: {
    color: colors.warning,
    marginTop: 6
  },
  offline: {
    color: colors.warning,
    fontWeight: "600"
  },
  success: {
    color: colors.success,
    marginTop: 6
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 6,
    flexWrap: "wrap"
  },
  error: {
    color: colors.danger
  },
  module: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  label: {
    color: colors.text,
    fontWeight: "600"
  },
  contentBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    gap: 4
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 100,
    marginBottom: 8
  },
  timerBox: {
    marginTop: 8,
    gap: 8
  },
  video: {
    width: "100%",
    height: 200,
    backgroundColor: "#0b1220",
    borderRadius: 8
  },
  cameraBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    gap: 8,
    padding: 8
  },
  cameraPreview: {
    width: "100%",
    height: 240
  },
  numberInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 80
  }
});





