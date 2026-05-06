import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig/config';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState(null);
  const [businessName, setBusinessName] = useState(null);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Clean up previous user document listener
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (currentUser) {
        // Real-time listener on user document so totalPayment/totalDebt stay in sync
        const userRef = doc(db, "users", currentUser.uid);
        unsubscribeUserDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            setUserData(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setLoading(false);
        });
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
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
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
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, newData, { merge: true });
      // Actualizamos el estado local para reflejar los cambios de inmediato
      setUserData((prev) => ({ ...prev, ...newData }));
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    }
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
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
