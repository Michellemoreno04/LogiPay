import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig/config';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { getUserData, saveUserData } from '../utils/database';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export default function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState(null);
  const [businessName, setBusinessName] = useState(null);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Limpiar listener anterior
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (currentUser) {
        // 1. Intentar cargar userData desde SQLite primero (para que la UI cargue rápido)
        try {
          const localData = await getUserData(currentUser.uid);
          if (localData) {
            setUserData(localData);
            setLoading(false);
          }
        } catch (e) {
          console.warn('[auth] Error loading local userData:', e);
        }

        // 2. Escuchar Firebase para mantener sincronizado (cuando hay internet)
        //    Si llegan datos nuevos de Firebase, actualizamos SQLite y el estado.
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeUserDoc = onSnapshot(
          userRef,
          async (snap) => {
            if (snap.exists()) {
              const firebaseData = snap.data();
              // Guardar en SQLite para acceso offline
              await saveUserData(currentUser.uid, firebaseData);
              setUserData(firebaseData);
            } else {
              // Documento no existe en Firebase, mantener lo que hay en SQLite
              const localData = await getUserData(currentUser.uid);
              if (localData) setUserData(localData);
            }
            setLoading(false);
          },
          async (error) => {
            // Sin internet: ya tenemos datos de SQLite
            console.warn('[auth] Firebase user listener offline:', error.code);
            const localData = await getUserData(currentUser.uid);
            if (localData) setUserData(localData);
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const logout = async () => {
    Alert.alert('Seguro que quieres cerrar sesión?', '', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/welcome');
          } catch (error) {
            console.error('Error signing out:', error);
          }
        }
      }
    ]);
  };

  const saveBusinessType = (type) => {
    setBusinessType(type);
  };

  const saveBusinessName = (name) => {
    setBusinessName(name);
  };

  const updateUserData = async (newData) => {
    if (!user) return;
    try {
      // 1. Guardar en SQLite de inmediato
      const current = await getUserData(user.uid);
      await saveUserData(user.uid, { ...current, ...newData });
      setUserData((prev) => ({ ...prev, ...newData }));

      // 2. Sincronizar con Firebase
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, newData, { merge: true });
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  };

  const updateLocalUserData = (newData) => {
    setUserData((prev) => {
      if (!prev) return newData;
      const updated = { ...prev, ...newData };
      // Persistir en SQLite en background (sin await, no bloquear UI)
      if (user) saveUserData(user.uid, updated).catch(console.error);
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      businessType,
      businessName,
      saveBusinessType,
      saveBusinessName,
      updateUserData,
      updateLocalUserData,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
