import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig/config';
import { useAuth } from './authContext';
import { Alert } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const { businessType, businessName } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response) {
      if (response.type === 'success') {
        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);

        signInWithCredential(auth, credential)
          .then(async (userCredential) => {
            const user = userCredential.user;
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
              // Dividir el displayName de Google en nombre y apellido
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
            // El cambio de estado de autenticación será detectado por AuthProvider
            // y el enrutamiento se manejará en _layout.jsx
            setIsAuthenticating(false);
          })
          .catch((error) => {
            console.error("Error logging in with Google:", error);
            Alert.alert("Error", "No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
            setIsAuthenticating(false);
          });
      } else {
        setIsAuthenticating(false);
      }
    }
  }, [response, businessType, businessName]);

  const handleGoogleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error("Error al mostrar el prompt de Google:", error);
      Alert.alert("Error", "Ocurrió un problema al intentar iniciar sesión con Google.");
      setIsAuthenticating(false);
    }
  };

  return { handleGoogleLogin, request, isAuthenticating };
};
