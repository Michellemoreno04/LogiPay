import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
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
  };

  const handleNextStep = () => {
    saveBusinessType(selectedType);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ─── Gradient Top Hero Header ─── */}
      <LinearGradient
        colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroHeader}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <View style={styles.headerTopRow}>
          {step === 2 ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              <Text style={styles.backButtonText}>Paso 1</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>PASO {step} DE 2</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: step === 1 ? '50%' : '100%' },
            ]}
          />
        </View>

        <Text style={styles.heroTitle}>
          {step === 1 ? '¿Cómo usarás LogiPay?' : 'Configura tu Negocio'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {step === 1
            ? 'Personalizaremos tu experiencia según tu modelo de trabajo.'
            : 'Personaliza los datos que aparecerán en tus recibos y facturas.'}
        </Text>
      </LinearGradient>

      {/* ─── Content Body ─── */}
      {step === 1 ? (
        <View style={styles.bodyContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentStep1}
          >
            <Text style={styles.sectionHeading}>Selecciona una modalidad</Text>

            {/* Option 1: Negocio Comercial */}
            <TouchableOpacity
              style={[
                styles.typeCard,
                selectedType === 'comercial' && styles.typeCardSelected,
              ]}
              activeOpacity={0.88}
              onPress={() => handleSelectType('comercial')}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: selectedType === 'comercial' ? '#DCFCE7' : '#F1F5F9' },
                  ]}
                >
                  <Ionicons
                    name="storefront"
                    size={26}
                    color={selectedType === 'comercial' ? '#16A34A' : '#64748B'}
                  />
                </View>

                <View style={styles.headerTextCol}>
                  <View style={styles.titleBadgeRow}>
                    <Text style={styles.cardTitle}>Negocio Comercial</Text>
                    <View style={styles.tagBadgeGreen}>
                      <Text style={styles.tagBadgeGreenText}>Popular</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubtitle}>Colmados, tiendas, ventas y servicios</Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    selectedType === 'comercial' && styles.radioOuterActive,
                  ]}
                >
                  {selectedType === 'comercial' && <View style={styles.radioInner} />}
                </View>
              </View>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.featureText}>Registro de ventas diarias y fiados</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.featureText}>Control de deudores y recordatorios</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.featureText}>Generación e impresión de facturas</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Option 2: Organización / Club */}
            <TouchableOpacity
              style={[
                styles.typeCard,
                selectedType === 'organization' && styles.typeCardSelected,
              ]}
              activeOpacity={0.88}
              onPress={() => handleSelectType('organization')}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: selectedType === 'organization' ? '#DBEAFE' : '#F1F5F9' },
                  ]}
                >
                  <Ionicons
                    name="business"
                    size={26}
                    color={selectedType === 'organization' ? '#2563EB' : '#64748B'}
                  />
                </View>

                <View style={styles.headerTextCol}>
                  <View style={styles.titleBadgeRow}>
                    <Text style={styles.cardTitle}>Organización o Club</Text>
                    <View style={styles.tagBadgeBlue}>
                      <Text style={styles.tagBadgeBlueText}>Cuotas</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubtitle}>Clubes, juntas, gremios y membresías</Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    selectedType === 'organization' && styles.radioOuterActive,
                  ]}
                >
                  {selectedType === 'organization' && <View style={styles.radioInner} />}
                </View>
              </View>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                  <Text style={styles.featureText}>Gestión de aportes y mensualidades</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                  <Text style={styles.featureText}>Padrón de miembros y estatus de pago</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                  <Text style={styles.featureText}>Recibos de cuotas periódicas</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.infoPill}>
              <Ionicons name="shield-checkmark" size={18} color="#4C669F" />
              <Text style={styles.infoPillText}>
                Podrás cambiar este modo más adelante desde tu perfil.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Floating Action Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={handleNextStep}
            >
              <LinearGradient
                colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.primaryButtonText}>Continuar al Paso 2</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.bodyContainer}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContentStep2}
                keyboardShouldPersistTaps="handled"
              >
                {/* ─── Card 1: Datos Principales ─── */}
                <View style={styles.formCard}>
                  <View style={styles.formCardHeader}>
                    <View style={[styles.cardIconSmall, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="storefront-outline" size={18} color="#4C669F" />
                    </View>
                    <View>
                      <Text style={styles.formCardTitle}>Nombre de tu Negocio *</Text>
                      <Text style={styles.formCardSubtitle}>Este nombre encabezará todas tus operaciones</Text>
                    </View>
                  </View>

                  <View style={styles.inputBox}>
                    <Ionicons name="business-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej. Comercial Los Ángeles"
                      placeholderTextColor="#94A3B8"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* ─── Card 2: Información para Facturación ─── */}
                <View style={styles.formCard}>
                  <View style={styles.formCardHeader}>
                    <View style={[styles.cardIconSmall, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="document-text-outline" size={18} color="#16A34A" />
                    </View>
                    <View>
                      <Text style={styles.formCardTitle}>Datos para Facturas y Recibos</Text>
                      <Text style={styles.formCardSubtitle}>Aparecerán impresos en los comprobantes (opcional)</Text>
                    </View>
                  </View>

                  {/* Dirección */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Dirección del Negocio</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ej. Av. 27 de Febrero #123, Santo Domingo"
                        placeholderTextColor="#94A3B8"
                        value={address}
                        onChangeText={setAddress}
                      />
                    </View>
                  </View>

                  {/* Teléfono */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Teléfono de Contacto</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="call-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ej. (809) 555-0199"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                      />
                    </View>
                  </View>

                  {/* RNC */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>RNC / Identificación Fiscal</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="card-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ej. 130-12345-6"
                        placeholderTextColor="#94A3B8"
                        value={rnc}
                        onChangeText={setRnc}
                      />
                    </View>
                  </View>
                </View>

                {/* ─── Card 3: Mensaje al pie de factura ─── */}
                <View style={styles.formCard}>
                  <View style={styles.formCardHeader}>
                    <View style={[styles.cardIconSmall, { backgroundColor: '#FDF2F8' }]}>
                      <Ionicons name="chatbox-ellipses-outline" size={18} color="#DB2777" />
                    </View>
                    <View>
                      <Text style={styles.formCardTitle}>Mensaje al Pie de Factura</Text>
                      <Text style={styles.formCardSubtitle}>Texto de agradecimiento al final del recibo</Text>
                    </View>
                  </View>

                  <View style={[styles.inputBox, styles.textAreaBox]}>
                    <TextInput
                      style={[styles.textInput, styles.textAreaInput]}
                      placeholder="Ej. ¡Gracias por preferirnos! Vuelva pronto."
                      placeholderTextColor="#94A3B8"
                      value={invoiceFooter}
                      onChangeText={setInvoiceFooter}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Bottom Action Button */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!name.trim() || loading) && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={handleContinue}
                  disabled={!name.trim() || loading}
                >
                  <LinearGradient
                    colors={
                      !name.trim() || loading
                        ? ['#94A3B8', '#94A3B8']
                        : ['#1A1F4B', '#2D3A8C', '#4C669F']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Guardar y Comenzar</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // ─── Top Header ───
  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30,
    left: -30,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },

  // ─── Body Layout ───
  bodyContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContentStep1: {
    padding: 20,
    paddingBottom: 24,
  },
  scrollContentStep2: {
    padding: 20,
    paddingBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 14,
    marginTop: 4,
  },

  // ─── Step 1 Cards ───
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  typeCardSelected: {
    borderColor: '#4C669F',
    backgroundColor: '#FFFFFF',
    shadowColor: '#4C669F',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  tagBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeGreenText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  tagBadgeBlue: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeBlueText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioOuterActive: {
    borderColor: '#4C669F',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4C669F',
  },
  featuresList: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    marginTop: 8,
  },
  infoPillText: {
    fontSize: 12.5,
    color: '#4338CA',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },

  // ─── Step 2 Form Cards ───
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cardIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  formCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  fieldGroup: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 50,
  },
  textAreaBox: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: 10,
    marginTop: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    height: '100%',
  },
  textAreaInput: {
    height: 64,
    textAlignVertical: 'top',
  },

  // ─── Bottom Actions ───
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  gradientBtn: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
