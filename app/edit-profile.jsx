import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../authContext/authContext';

export default function EditProfileScreen() {
  const router = useRouter();
  const { userData, updateUserData } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessRnc, setBusinessRnc] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('¡Gracias por su compra!');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setBusinessName(userData.businessName || '');
      setBusinessAddress(userData.businessAddress || '');
      setBusinessPhone(userData.businessPhone || '');
      setBusinessRnc(userData.businessRnc || '');
      setInvoiceFooter(userData.invoiceFooter || '¡Gracias por su compra!');
    }
  }, [userData]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Por favor completa el nombre y apellido.');
      return;
    }

    setLoading(true);
    try {
      await updateUserData({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        businessPhone: businessPhone.trim(),
        businessRnc: businessRnc.trim(),
        invoiceFooter: invoiceFooter.trim() || '¡Gracias por su compra!',
      });
      Alert.alert('Éxito', 'Perfil actualizado correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Datos Personales */}
        <Text style={styles.sectionHeader}>Información Personal</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ingresa tu nombre"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Apellido *</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Ingresa tu apellido"
          />
        </View>

        {/* Datos del Negocio y Facturación */}
        <Text style={styles.sectionHeader}>Datos del Negocio y Facturación</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre del Negocio</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Ingresa el nombre de tu negocio"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dirección del Negocio</Text>
          <TextInput
            style={styles.input}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            placeholder="Ej. Av. 27 de Febrero #123"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Teléfono del Negocio</Text>
          <TextInput
            style={styles.input}
            value={businessPhone}
            onChangeText={setBusinessPhone}
            placeholder="Ej. (809) 123-4567"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>RNC / Identificación Fiscal (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={businessRnc}
            onChangeText={setBusinessRnc}
            placeholder="Ej. 130-12345-6"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mensaje al Pie de Factura</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={invoiceFooter}
            onChangeText={setInvoiceFooter}
            placeholder="Ej. ¡Gracias por su compra!"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.helperText}>
            Este mensaje aparecerá en la parte inferior de tus recibos y facturas.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Cambios</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C7C7CC',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 12,
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
