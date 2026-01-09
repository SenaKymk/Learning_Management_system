import "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { configureNotifications } from "./src/notifications/pushNotifications";
import { AuthProvider } from "./src/providers/AuthProvider";
import { ThemeProvider } from "./src/theme/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30
    }
  }
});

export default function App() {
  const handleAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === "active");
  };

  useEffect(() => {
    configureNotifications();
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            <StatusBar style="auto" />
          </SafeAreaProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
