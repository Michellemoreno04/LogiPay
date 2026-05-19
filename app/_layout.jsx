import { Stack, useRouter } from "expo-router";
import AuthProvider, { useAuth } from "../authContext/authContext";
import {
  TourProvider,
  SnappySpringConfig,
} from 'react-native-lumen';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { useEffect } from "react";
import * as Updates from 'expo-updates';
import { Alert, StatusBar } from 'react-native';

// Desactiva el modo estricto de Reanimated para suprimir las advertencias de react-native-lumen
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          Alert.alert(
            "Actualización disponible",
            "Hay una nueva versión de la aplicación. ¿Deseas descargarla e instalarla ahora?",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Actualizar",
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (e) {
                    Alert.alert("Error", "No se pudo instalar la actualización.");
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.log(`Error al buscar actualizaciones: ${error}`);
      }
    }

    // Comprobar actualizaciones solo si no estamos en entorno de desarrollo local
    if (!__DEV__) {
      onFetchUpdateAsync();
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    //console.log("user", user?.uid);
    if (!user) {
      router.replace('/welcome');
    }
  }, [loading, user]);


  return (
    <>
      <StatusBar barStyle={"dark-content"} />
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
    </>
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
