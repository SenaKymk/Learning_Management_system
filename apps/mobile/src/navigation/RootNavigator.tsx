import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminResultsScreen from "../screens/AdminResultsScreen";
import BiometricLockScreen from "../screens/BiometricLockScreen";
import CourseDetailScreen from "../screens/CourseDetailScreen";
import CoursesScreen from "../screens/CoursesScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ResultsScreen from "../screens/ResultsScreen";
import SebScreen from "../screens/SebScreen";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

export type RootStackParamList = {
  Tabs: undefined;
  CourseDetail: { courseId: string; title?: string };
};

export type TabsParamList = {
  Courses: undefined;
  Results: undefined;
  AdminDashboard: undefined;
  AdminResults: undefined;
  Seb: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();
const AuthStack = createNativeStackNavigator();

function LoadingScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading session...</Text>
    </View>
  );
}

function AuthNavigator() {
  const { colors } = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
    </AuthStack.Navigator>
  );
}

function TabsNavigator({ role }: { role: "ADMIN" | "INSTRUCTOR" | "STUDENT" | null }) {
  const { colors } = useTheme();
  const isAdmin = role === "ADMIN";
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Tab.Screen name="Courses" component={CoursesScreen} options={{ title: "Courses" }} />
      {isAdmin ? (
        <>
          <Tab.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{ title: "Dashboard" }}
          />
          <Tab.Screen
            name="AdminResults"
            component={AdminResultsScreen}
            options={{ title: "Results" }}
          />
        </>
      ) : (
        <Tab.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
      )}
      <Tab.Screen name="Seb" component={SebScreen} options={{ title: "SEB" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { loading, token, role, locked } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return <LoadingScreen />;
  }

  if (token && locked) {
    return <BiometricLockScreen />;
  }

  if (!token) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen
        name="Tabs"
        options={{ headerShown: false }}
      >
        {(props) => <TabsNavigator {...props} role={role} />}
      </Stack.Screen>
      <Stack.Screen
        name="CourseDetail"
        component={CourseDetailScreen}
        options={({ route }) => ({ title: route.params.title ?? "Course Detail" })}
      />
    </Stack.Navigator>
  );
}

const makeStyles = (colors: { background: string; text: string }) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 10
    },
    loadingText: {
      color: colors.text
    }
  });
