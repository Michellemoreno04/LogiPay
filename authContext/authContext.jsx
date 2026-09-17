import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { db } from '../firebaseConfig/config';
import { addToOutbox, getPendingOutbox, getUserData, saveUserData } from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

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

    const unsubscribeAuth = onAuthStateChanged(getAuth(), async (currentUser) => {
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
          { includeMetadataChanges: true },
          async (snap) => {
            if (snap.metadata?.fromCache) return;

            // Verificar si hay operaciones pendientes en outbox para este usuario
            try {
              const pending = await getPendingOutbox();
              const hasPendingUserUpdates = pending.some(
                (p) => p.collection === 'users' && p.docId === currentUser.uid
              );
              if (hasPendingUserUpdates) {
                // No sobreescribir con datos antiguos de Firebase si hay cambios pendientes
                return;
              }
            } catch (e) {
              console.warn('[auth] Error checking outbox in snapshot:', e);
            }

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
            await signOut(getAuth());
            router.replace('/onboarding');
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
      // 1. Guardar en SQLite de inmediato (offline-first)
      const current = await getUserData(user.uid);
      const updated = { ...current, ...newData };
      await saveUserData(user.uid, updated);
      setUserData((prev) => ({ ...prev, ...newData }));

      // 2. Encolar en outbox para sincronizar con Firebase
      await addToOutbox('users', user.uid, newData, 'set');

      // 3. Intentar sincronizar en background si hay conexión
      syncOutbox().catch((err) => console.warn('[auth] syncOutbox error:', err));
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
