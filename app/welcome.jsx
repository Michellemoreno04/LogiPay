import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="wallet" size={80} color="#4C669F" />
        </View>
        <Text style={styles.title}>Bienvenido a LogiPay</Text>
        <Text style={styles.subtitle}>
          Tu solución ideal para gestionar pagos, registrar deudas y mantener el control financiero de tu negocio u organización de manera sencilla y segura.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push('/business-type')}
        >
          <Text style={styles.buttonText}>Comenzar</Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 140,
    height: 140,
    backgroundColor: '#E8EDF2',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
  },
  button: {
    backgroundColor: '#4C669F',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 10,
  }
});
