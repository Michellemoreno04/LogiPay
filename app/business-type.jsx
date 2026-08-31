import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../authContext/authContext';

export default function BusinessSetupScreen() {
  const router = useRouter();
  const { user, userData, saveBusinessType, saveBusinessName, updateUserData } = useAuth();

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('comercial');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [rnc, setRnc] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('¡Gracias por su compra!');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userData) {
      if (userData.businessName) setName(userData.businessName);
      if (userData.businessType) setSelectedType(userData.businessType);
      if (userData.businessAddress) setAddress(userData.businessAddress);
      if (userData.businessPhone) setPhone(userData.businessPhone);
      if (userData.businessRnc) setRnc(userData.businessRnc);
      if (userData.invoiceFooter) setInvoiceFooter(userData.invoiceFooter);
    }
  }, [userData]);

  const handleSelectType = (type) => {
    setSelectedType(type);
    saveBusinessType(type);
    setStep(2);
  };

  const handleContinue = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        businessName: name.trim(),
        businessType: selectedType,
        businessAddress: address.trim(),
        businessPhone: phone.trim(),
        businessRnc: rnc.trim(),
        invoiceFooter: invoiceFooter.trim() || '¡Gracias por su compra!',
      };

      if (user) {
        await updateUserData(payload);
      } else {
        saveBusinessName(name.trim());
      }
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error saving business details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header & Step Indicator */}
          <View style={styles.header}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>PASO 1 DE 2</Text>
            </View>
            <Text style={styles.title}>¿Qué tipo de uso le darás a LogiPay?</Text>
            <Text style={styles.subtitle}>
              Selecciona el modelo que mejor se adapte a tus necesidades para personalizar tu experiencia.
            </Text>
          </View>

          {/* Cards Options */}
          <View style={styles.cardsContainer}>
            {/* Option 1: Organization */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedType === 'organization' && styles.cardSelected,
              ]}
              activeOpacity={0.85}
              onPress={() => handleSelectType('organization')}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="business" size={28} color="#2563EB" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Organización / Club</Text>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Cuotas</Text>
                  </View>
                </View>
                <Text style={styles.cardDescription}>
                  Ideal para gestionar aportes, mensualidades o cuotas recurrentes de miembros.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
            </TouchableOpacity>

            {/* Option 2: Business */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedType === 'comercial' && styles.cardSelected,
              ]}
              activeOpacity={0.85}
              onPress={() => handleSelectType('comercial')}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="storefront" size={28} color="#16A34A" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Negocio Comercial</Text>
                  <View style={[styles.tagBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.tagBadgeText, { color: '#15803D' }]}>Ventas</Text>
                  </View>
                </View>
                <Text style={styles.cardDescription}>
                  Ideal para registrar ventas, cuentas por cobrar de clientes e inventario.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.footerInfoContainer}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
            <Text style={styles.footerInfoText}>
              Podrás cambiar el tipo de negocio en cualquier momento desde tu perfil.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.containerKeyboard}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Navigation Header */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
              <Text style={styles.backButtonText}>Paso anterior</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>PASO 2 DE 2</Text>
              </View>
              <Text style={styles.title}>Configura tu Negocio y Facturación</Text>
              <Text style={styles.subtitle}>
                Ingresa el nombre y la información que aparecerá en tus facturas y comprobantes.
              </Text>
            </View>

            {/* Section 1: Basic Info */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="business-outline" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Información del Negocio</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre del Negocio / Organización *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="storefront-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Comercial Los Ángeles"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>

            {/* Section 2: Invoice Setup */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="document-text-outline" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Datos para Facturas y Recibos</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Esta información se imprimirá en los comprobantes de tus clientes (opcional).
              </Text>

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dirección Física</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="location-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Av. 27 de Febrero #123, Santo Domingo"
                    placeholderTextColor="#94A3B8"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono de Contacto</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. (809) 555-0199"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              {/* RNC / ID Fiscal */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>RNC / Identificación Fiscal (Opcional)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="card-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 130-12345-6"
                    placeholderTextColor="#94A3B8"
                    value={rnc}
                    onChangeText={setRnc}
                  />
                </View>
              </View>
            </View>

            {/* Section 3: Prescribed Footer Text */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="chatbox-ellipses-outline" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Mensaje al Pie de Factura</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Texto de despedida o agradecimiento que aparecerá al final de cada factura o recibo emitido.
              </Text>

              <View style={styles.inputGroup}>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Ej. ¡Gracias por su compra!"
                    placeholderTextColor="#94A3B8"
                    value={invoiceFooter}
                    onChangeText={setInvoiceFooter}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                <View style={styles.prescribedNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
                  <Text style={styles.prescribedNoteText}>
                    Puedes personalizar este texto en cualquier momento en tu perfil.
                  </Text>
                </View>
              </View>
            </View>

            {/* Save Action */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!name.trim() || loading) && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!name.trim() || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.continueButtonText}>Guardar y Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  containerKeyboard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  header: {
    marginBottom: 24,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 12,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginVertical: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#FAFAFF',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  tagBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  cardDescription: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 19,
  },
  footerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  footerInfoText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 2,
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  textAreaWrapper: {
    minHeight: 84,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  textArea: {
    textAlignVertical: 'top',
    height: 64,
  },
  prescribedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  prescribedNoteText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#4F46E5',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
