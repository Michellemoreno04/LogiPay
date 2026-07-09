import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuth, signInWithCredential, OAuthProvider } from '@react-native-firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import { useAuth } from './authContext';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';

export const useAppleAuth = () => {
  const { businessType, businessName } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();

  const handleAppleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const csrf = Math.random().toString(36).substring(2, 15);
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        state: csrf,
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;

      if (!identityToken) {
        throw new Error('No identity token provided.');
      }

      // Usar @react-native-firebase/auth (SDK nativo)
      const firebaseCredential = new OAuthProvider('apple.com').credential({
        idToken: identityToken,
        rawNonce: nonce,
      });
      const userCredential = await signInWithCredential(getAuth(), firebaseCredential);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          firstName: user.displayName || null,
          lastName: user.lastName || null,
          email: user.email || null,
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

    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User canceled, no action needed
      } else {
        console.error("Error logging in with Apple:", e);
        Alert.alert("Error", "No se pudo iniciar sesión con Apple. Inténtalo de nuevo.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return { handleAppleLogin, isAuthenticating };
};
