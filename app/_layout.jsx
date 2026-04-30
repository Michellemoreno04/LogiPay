import { Stack, useRouter, useSegments } from "expo-router";
import AuthProvider, { useAuth } from "./authContext/authContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'business-type';

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not logged in
      router.replace("/welcome");
    } else if (user && inAuthGroup) {
      // Redirect to main tabs if logged in
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#4C669F" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4C669F',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="business-type" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ title: "Detalles del Cliente" }} />
      <Stack.Screen name="add-user" options={{ title: "Nuevo Cliente", presentation: 'modal' }} />
      <Stack.Screen name="add-transaction" options={{ title: "Nueva Transacción", presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
