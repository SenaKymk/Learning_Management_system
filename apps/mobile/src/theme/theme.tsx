import { createContext, ReactNode, useContext } from "react";
import { useColorScheme } from "react-native";

type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryDark: string;
  success: string;
  warning: string;
  danger: string;
};

type Theme = {
  colors: ThemeColors;
  scheme: "light" | "dark";
};

const lightTheme: Theme = {
  scheme: "light",
  colors: {
    background: "#f8fafc",
    surface: "#ffffff",
    border: "#e2e8f0",
    text: "#0f172a",
    muted: "#475569",
    primary: "#ef4444",
    primaryDark: "#b91c1c",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#e11d48"
  }
};

const darkTheme: Theme = {
  scheme: "dark",
  colors: {
    background: "#0f172a",
    surface: "#111827",
    border: "#1f2937",
    text: "#e5e7eb",
    muted: "#94a3b8",
    primary: "#ef4444",
    primaryDark: "#b91c1c",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#f43f5e"
  }
};

const ThemeContext = createContext<Theme>(darkTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = scheme === "light" ? lightTheme : darkTheme;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
