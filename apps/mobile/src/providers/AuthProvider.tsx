import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  clearToken,
  getToken,
  getUserRole,
  login as apiLogin,
  setUserRole,
  type UserRole
} from "../api/apiClient";
import { ApiRequestError } from "../api/errors";

const BIOMETRIC_KEY = "lms_biometric_enabled";

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  role: UserRole | null;
  biometricEnabled: boolean;
  locked: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshRole: () => Promise<UserRole | null>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const existingToken = await getToken();
      const existingRole = await getUserRole();
      const storedBiometric = (await AsyncStorage.getItem(BIOMETRIC_KEY)) === "true";
      setTokenState(existingToken);
      setRole(existingRole);
      setBiometricEnabledState(storedBiometric);
      setLocked(Boolean(existingToken) && storedBiometric);
      setLoading(false);
    };
    bootstrap();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const user = await apiLogin(email, password);
    const tokenValue = await getToken();
    setTokenState(tokenValue);
    setRole(user.role);
    setLocked(false);
  };

  const handleLogout = async () => {
    await clearToken();
    await setUserRole(null);
    setTokenState(null);
    setRole(null);
    setLocked(false);
  };

  const refreshRole = async () => {
    const nextRole = await getUserRole();
    setRole(nextRole);
    return nextRole;
  };

  const setBiometricEnabled = async (enabled: boolean) => {
    if (enabled) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        throw new Error("Biometric auth is not available on this device.");
      }
    }
    await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? "true" : "false");
    setBiometricEnabledState(enabled);
    setLocked(Boolean(token) && enabled);
  };

  const unlockWithBiometrics = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock LMS"
    });
    if (result.success) {
      setLocked(false);
    }
    return result.success;
  };

  const value = useMemo(
    () => ({
      loading,
      token,
      role,
      biometricEnabled,
      locked,
      login: handleLogin,
      logout: handleLogout,
      refreshRole,
      setBiometricEnabled,
      unlockWithBiometrics
    }),
    [loading, token, role, biometricEnabled, locked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new ApiRequestError("AuthProvider missing", null, false);
  }
  return ctx;
}
