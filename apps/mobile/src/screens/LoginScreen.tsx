import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiRequestError } from "../api/errors";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<any>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.isNetwork) {
          setError("Backend unreachable");
        } else if (err.status === 401) {
          setError("Invalid credentials");
        } else {
          setError(err.message || "Login failed");
        }
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to manage your courses and exams.</Text>
      </View>
      <Card>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={loading ? "Signing in..." : "Sign in"} onPress={handleSubmit} disabled={loading} />
        <View style={styles.footerRow}>
          <Text style={styles.subtitle}>New here?</Text>
          <Button label="Create account" variant="secondary" onPress={() => navigation.navigate("Register")} />
        </View>
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: { text: string; muted: string; danger: string }) =>
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
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12
    }
  });
