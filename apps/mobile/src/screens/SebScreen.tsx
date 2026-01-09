import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { checkSeb, getUserRole } from "../api/apiClient";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { useTheme } from "../theme/theme";

type SebStatus = "loading" | "ok" | "blocked";

export default function SebScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [sebStatus, setSebStatus] = useState<SebStatus>("loading");
  const [sebError, setSebError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  useEffect(() => {
    const run = async () => {
      setRole((await getUserRole()) ?? null);
      try {
        await checkSeb("");
        setSebStatus("ok");
      } catch (err) {
        const message = err instanceof Error ? err.message : "SEB check failed.";
        setSebError(message);
        setSebStatus("blocked");
      }
    };
    run();
  }, []);

  const handleTestMedia = async () => {
    const cam = await requestCameraPermission();
    const mic = await requestMicrophonePermission();
    setMediaReady(cam.granted && mic.granted);
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Safe Exam Browser</Text>
        <Text style={styles.subtitle}>Check SEB status and device permissions.</Text>
      </View>
      <Card>
        {role === "STUDENT" ? (
          <Text style={styles.subtitle}>SEB validation is required before exams.</Text>
        ) : null}
        {sebStatus === "loading" ? <Text style={styles.subtitle}>Checking...</Text> : null}
        {sebStatus === "ok" ? <Text style={styles.success}>SEB detected.</Text> : null}
        {sebStatus === "blocked" ? <Text style={styles.error}>SEB required.</Text> : null}
        {sebError ? <Text style={styles.error}>{sebError}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Camera & Microphone Test</Text>
        <Text style={styles.subtitle}>Request access and confirm preview.</Text>
        <Button label="Request permissions" variant="secondary" onPress={handleTestMedia} />
        <View style={styles.badges}>
          <Text style={styles.subtitle}>
            Camera: {cameraPermission?.granted ? "Granted" : "Not granted"}
          </Text>
          <Text style={styles.subtitle}>
            Microphone: {microphonePermission?.granted ? "Granted" : "Not granted"}
          </Text>
        </View>
        {mediaReady ? (
          <View style={styles.previewBox}>
            <CameraView style={styles.preview} facing="front" />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: {
  text: string;
  muted: string;
  border: string;
  danger: string;
  success: string;
}) =>
  StyleSheet.create({
    hero: { marginBottom: 14 },
    title: { color: colors.text, fontSize: 22, fontWeight: "700" },
    subtitle: { color: colors.muted },
    sectionTitle: { color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 6 },
    error: { color: colors.danger },
    success: { color: colors.success },
    badges: { marginTop: 8, gap: 4 },
    previewBox: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden"
    },
    preview: { width: "100%", height: 220 }
  });
