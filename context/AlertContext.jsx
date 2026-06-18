import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

const AlertContext = createContext();

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({ visible: false, message: '', type: 'success' });
  const translateY = useRef(new Animated.Value(-150)).current;

  const showAlert = (message, type = 'success') => {
    setAlertConfig({ visible: true, message, type });
    
    try {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      console.warn('Error playing haptic feedback:', error);
    }

    // Animate in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 10,
      speed: 12,
    }).start();

    // Auto-hide after 3 seconds
    setTimeout(() => {
      hideAlert();
    }, 3000);
  };

  const hideAlert = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
    });
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alertConfig.visible && (
        <Animated.View
          style={[
            styles.alertContainer,
            { transform: [{ translateY }] },
            alertConfig.type === 'success' ? styles.success : styles.error,
          ]}
        >
          <Ionicons
            name={alertConfig.type === 'success' ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color="white"
            style={styles.icon}
          />
          <Text style={styles.alertText}>{alertConfig.message}</Text>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  alertContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 99999,
  },
  success: {
    backgroundColor: '#34C759',
  },
  error: {
    backgroundColor: '#FF3B30',
  },
  icon: {
    marginRight: 12,
  },
  alertText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
