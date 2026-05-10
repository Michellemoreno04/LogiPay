import { useEffect, useState } from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig/config';
import { useAuth } from './authContext';
import { Alert } from 'react-native';

export const useGoogleAuth = () => {
  const { businessType, businessName } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initGoogle = async () => {
      try {
        await GoogleSignin.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        });
        setIsReady(true);
      } catch (error) {
        console.error("Error configuring Google Sign-In:", error);
      }
    };
    initGoogle();
  }, []);

  const handleGoogleLogin = async () => {
    if (isAuthenticating || !isReady) return;
    setIsAuthenticating(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Cerramos sesión previa para forzar el selector de cuentas
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        // Ignorar si no hay sesión activa
      }

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No se recibió el token de Google.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
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
      }
    } catch (error) {
      console.error("Error logging in with Google:", error);
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // El usuario canceló
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert("Error", "Inicio de sesión ya está en progreso.");
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Error", "Google Play Services no está disponible.");
            break;
          default:
            Alert.alert("Error", "No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
        }
      } else {
        Alert.alert("Error", "Ocurrió un problema inesperado al iniciar sesión.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return { handleGoogleLogin, request: isReady, isAuthenticating };
};
