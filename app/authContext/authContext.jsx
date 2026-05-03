import React, { createContext, useContext, useEffect, useState } from 'react';
// import { onAuthStateChanged, signOut } from 'firebase/auth';
// import { auth } from '../firebaseConfig/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export default function AuthProvider({ children }) {
  // SIMULACIÓN: Usuario mock para probar sin Firebase
  const [user, setUser] = useState({ uid: 'mock-user-123', email: 'test@example.com' });
  const [loading, setLoading] = useState(false);
  const [businessType, setBusinessType] = useState(null);

  useEffect(() => {
    // Check if business type is already stored
    const loadBusinessType = async () => {
      try {
        const storedType = await AsyncStorage.getItem('businessType');
        if (storedType) {
          setBusinessType(storedType);
        }
      } catch (error) {
        console.error("Error loading business type:", error);
      }
    };
    loadBusinessType();

    /* 
    COMENTADO PARA PRUEBAS SIN FIREBASE
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
    */
  }, []);

  const login = (userData) => {
    setUser(userData || { uid: 'mock-user-123', email: 'test@example.com' });
  };

  const logout = async () => {
    try {
      // await signOut(auth);
      setUser(null); // Simulación de logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const saveBusinessType = async (type) => {
    try {
      await AsyncStorage.setItem('businessType', type);
      setBusinessType(type);
    } catch (error) {
      console.error("Error saving business type:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, businessType, saveBusinessType, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
};

