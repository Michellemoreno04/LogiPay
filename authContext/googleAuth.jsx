import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { getAuth, signInWithCredential, GoogleAuthProvider } from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert } from 'react-native';
import { db } from '../firebaseConfig/config';
import { useAuth } from './authContext';

export const useGoogleAuth = () => {
  const { businessType, businessName } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });


  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await GoogleSignin.hasPlayServices();

      // Cerramos sesión previa para forzar el selector de cuentas
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        // Ignorar si no hay sesión activa
        console.log('No hay sesión activa');
      }

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No se recibió el token de Google.');
      }

      // Usar @react-native-firebase/auth (SDK nativo) en vez del JS SDK
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(getAuth(), googleCredential);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        const [firstName, ...lastNameParts] = (user.displayName || "Usuario").split(" ");
        const lastName = lastNameParts.join(" ") || "";

        await setDoc(userRef, {
          firstName,
          lastName,
          email: user.email,
          createdAt: new Date(),
          uid: user.uid,
          businessType: businessType || null,
          businessName: businessName || null,
          totalPayment: 0,
          totalDebt: 0
        });
        router.replace('/business-type');
      } else {
        router.replace('/(tabs)');
      }

    } catch (error) {
      console.error("Error logging in with Google:", error);
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // El usuario canceló
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert("Error", `Inicio de sesión ya está en progreso. (${error.message || error.code})`);
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Error", `Google Play Services no está disponible.`);
            break;
          default:
            Alert.alert("Error", `No se pudo iniciar sesión con Google: ${error.message || error.code || error}`);
        }
      } else {

        Alert.alert("Error", `Ocurrió un problema inesperado al iniciar sesión, intenta de nuevo mas tarde`);
      }
    } finally {
      setLoading(false);
    }
  };

  return { handleGoogleLogin, loading };
};

