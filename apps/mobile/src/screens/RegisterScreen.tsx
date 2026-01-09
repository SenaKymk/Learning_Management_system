import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { registerUser } from "../api/apiClient";
import { ApiRequestError } from "../api/errors";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useTheme } from "../theme/theme";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await registerUser({ email, password, firstName, lastName, studentNumber });
      setSuccess("Registration complete. You can sign in.");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setStudentNumber("");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Create a student account to continue.</Text>
      </View>
      <Card>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} />
        <TextField label="Student number" value={studentNumber} onChangeText={setStudentNumber} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        <Button label={loading ? "Submitting..." : "Create account"} onPress={handleSubmit} disabled={loading} />
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: { text: string; muted: string; danger: string; success: string }) =>
  StyleSheet.create({
    hero: {
      marginBottom: 14
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "700",
      marginBottom: 6
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14
    },
    error: {
      color: colors.danger,
      marginBottom: 8
    },
    success: {
      color: colors.success,
      marginBottom: 8
    }
  });
