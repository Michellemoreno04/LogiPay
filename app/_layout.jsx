import { Stack, useRouter, useSegments } from "expo-router";
import AuthProvider, { useAuth } from "../authContext/authContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

function RootLayoutNav() {
  const { user, userData, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'loginScreen' || segments[0] === 'register' || segments[0] === 'business-type' || segments[0] === 'business-name';

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not logged in
      router.replace("/welcome");
    } else if (user && inAuthGroup) {
      // Si el usuario está logueado pero intenta acceder a pantallas de auth:
      if (userData && userData.businessType) {
        // Si ya tiene perfil completo, va al Home
        router.replace("/(tabs)");
      } else {
        // Si es usuario nuevo o incompleto, va a elegir tipo de negocio
        // Evitamos redirección infinita si ya está en el flujo de configuración
        const isConfiguring = segments[0] === 'business-type' || segments[0] === 'business-name';
        if (!isConfiguring) {
          router.replace("/business-type");
        }
      }
    }
  }, [user, userData, loading, segments]);

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
      <Stack.Screen name="business-name" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="loginScreen" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="add-user" options={{ title: "Nuevo Cliente", presentation: 'modal' }} />
      <Stack.Screen name="all-transactions" options={{ title: "Todas las Transacciones", presentation: 'modal' }} />
      <Stack.Screen name="delete-account" options={{ title: "Eliminar Cuenta", presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />

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
