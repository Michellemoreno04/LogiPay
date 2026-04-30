import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
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
    <AuthContext.Provider value={{ user, loading, businessType, saveBusinessType, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
