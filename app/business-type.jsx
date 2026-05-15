import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../authContext/authContext';

export default function BusinessSetupScreen() {
  const router = useRouter();
  const { user, saveBusinessType, saveBusinessName, updateUserData } = useAuth();
  
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectType = (type) => {
    setSelectedType(type);
    saveBusinessType(type);
    setStep(2);
  };

  const handleContinue = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (user) {
        // Si el usuario ya está logueado (por ejemplo, después de login social o retorno)
        // Guardamos la configuración en su perfil de Firestore
        await updateUserData({
          businessName: name.trim(),
          businessType: selectedType
        });
      } else {
        saveBusinessName(name.trim());
      }
      router.push('/(tabs)');
    } catch (error) {
      console.error("Error saving business details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>¿Qué tipo de uso le darás a LogiPay?</Text>
          <Text style={styles.subtitle}>
            Selecciona el modelo que mejor se adapte a tus necesidades para personalizar tu experiencia.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Option 1: Organization */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => handleSelectType('organization')}
          >
            <View style={[styles.iconWrapper, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="business" size={32} color="#1E88E5" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Organización</Text>
              <Text style={styles.cardDescription}>
                Ideal para registrar pagos recurrentes o cuotas de una organización o club.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          {/* Option 2: Business */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => handleSelectType('comercial')}
          >
            <View style={[styles.iconWrapper, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="storefront" size={32} color="#43A047" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Negocio Comercial</Text>
              <Text style={styles.cardDescription}>
                Ideal para registrar y gestionar deudas de clientes y controlar ingresos.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.containerKeyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>¿Cuál es el nombre de tu negocio?</Text>
            <Text style={styles.subtitle}>
              Ingresa el nombre para personalizar tu experiencia en LogiPay.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nombre de tu negocio/organización"
              placeholderTextColor="#8E8E93"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            style={[styles.continueButton, !name.trim() && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!name.trim() || loading}
          >
            <Text style={styles.continueButtonText}>{loading ? 'Guardando...' : 'Continuar'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 20,
    paddingTop: 60,
  },
  containerKeyboard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  inner: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1C1C1E',
  },
  continueButton: {
    backgroundColor: '#4C669F',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#A0AABF',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  }
});
