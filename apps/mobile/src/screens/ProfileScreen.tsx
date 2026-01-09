import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getProfile, updateProfile, type UserProfile } from "../api/apiClient";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useI18n } from "../i18n/i18n";
import { disablePushNotifications, enablePushNotifications, getPushSettings } from "../notifications/pushNotifications";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

export default function ProfileScreen() {
  const { logout, biometricEnabled, setBiometricEnabled } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setStudentNumber(data.studentNumber ?? "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Profile could not be loaded.";
        setError(message);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadPush = async () => {
      const settings = await getPushSettings();
      setPushEnabled(settings.enabled);
      setPushToken(settings.token);
    };
    loadPush();
  }, []);

  const handleSubmit = async () => {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await updateProfile({
        firstName,
        lastName,
        studentNumber: profile.role === "STUDENT" ? studentNumber : undefined
      });
      setProfile(updated);
      setSuccess("Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setPushError(null);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
        setPushToken(null);
        return;
      }
      const token = await enablePushNotifications();
      setPushEnabled(true);
      setPushToken(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Push setup failed.";
      setPushError(message);
    }
  };

  const handleToggleBiometric = async () => {
    setBiometricError(null);
    try {
      await setBiometricEnabled(!biometricEnabled);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Biometric setup failed.";
      setBiometricError(message);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account details.</Text>
      </View>
      <Card>
        {!profile ? <Text style={styles.subtitle}>Loading...</Text> : null}
        {profile ? (
          <>
            <TextField label="Email" value={profile.email} editable={false} />
            <TextField label="First name" value={firstName} onChangeText={setFirstName} />
            <TextField label="Last name" value={lastName} onChangeText={setLastName} />
            {profile.role === "STUDENT" ? (
              <TextField
                label="Student number"
                value={studentNumber}
                onChangeText={setStudentNumber}
              />
            ) : null}
            <View style={styles.languageBox}>
              <Text style={styles.languageLabel}>{t("language")}</Text>
              <View style={styles.languageRow}>
                <Button
                  label={t("turkish")}
                  variant={locale === "tr" ? "primary" : "secondary"}
                  onPress={() => setLocale("tr")}
                />
                <Button
                  label={t("english")}
                  variant={locale === "en" ? "primary" : "secondary"}
                  onPress={() => setLocale("en")}
                />
                <Button
                  label={t("spanish")}
                  variant={locale === "es" ? "primary" : "secondary"}
                  onPress={() => setLocale("es")}
                />
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}
            <Button
              label={saving ? "Saving..." : "Save changes"}
              onPress={handleSubmit}
              disabled={saving}
            />
            <Button label="Sign out" variant="secondary" onPress={logout} />
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Push notifications</Text>
        <Text style={styles.subtitle}>
          {pushEnabled ? "Enabled" : "Disabled"}{pushToken ? " (token stored)" : ""}
        </Text>
        {pushError ? <Text style={styles.error}>{pushError}</Text> : null}
        {pushToken ? <Text style={styles.muted}>Token: {pushToken}</Text> : null}
        <Button
          label={pushEnabled ? "Disable notifications" : "Enable notifications"}
          variant="secondary"
          onPress={handleTogglePush}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Biometric unlock</Text>
        <Text style={styles.subtitle}>{biometricEnabled ? "Enabled" : "Disabled"}</Text>
        {biometricError ? <Text style={styles.error}>{biometricError}</Text> : null}
        <Button
          label={biometricEnabled ? "Disable biometrics" : "Enable biometrics"}
          variant="secondary"
          onPress={handleToggleBiometric}
        />
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: {
  text: string;
  muted: string;
  danger: string;
  success: string;
}) =>
  StyleSheet.create({
    hero: { marginBottom: 14 },
    title: { color: colors.text, fontSize: 22, fontWeight: "700" },
    subtitle: { color: colors.muted },
    error: { color: colors.danger },
    success: { color: colors.success },
    languageBox: {
      marginTop: 6,
      marginBottom: 8
    },
    languageLabel: {
      color: colors.text,
      fontWeight: "600",
      marginBottom: 6
    },
    languageRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: "700",
      marginBottom: 4
    },
    muted: {
      color: colors.muted,
      marginBottom: 8
    }
  });
