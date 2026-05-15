import { Stack } from "expo-router";
import AuthProvider from "../authContext/authContext";
import {
  TourProvider,
  SnappySpringConfig,
} from 'react-native-lumen';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Desactiva el modo estricto de Reanimated para suprimir las advertencias de react-native-lumen
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootLayoutNav() {


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
      <TourProvider
        stepsOrder={['step-1', 'step-2']}
        config={{ springConfig: SnappySpringConfig, enableGlow: true }}
      >
        <RootLayoutNav />
      </TourProvider>
    </AuthProvider>
  );
}
