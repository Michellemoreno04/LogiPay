import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebaseConfig/config';
import { useAuth } from './authContext/authContext';

export default function AddUserScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión para guardar clientes.');
      return;
    }
    setLoading(true);
    try {
      const parsedBalance = parseFloat(initialBalance.replace(/,/g, '')) || 0;
      const clientsRef = collection(db, 'users', user.uid, 'clients');
      await addDoc(clientsRef, {
        name,
        phone,
        email,
        notes,
        balance: -parsedBalance,
        createdAt: new Date(),
      });

      // Update the user's totalDebt with the initial balance
      if (parsedBalance > 0) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          totalDebt: increment(parsedBalance),
        });
      }

      router.back();
    } catch (error) {
      console.error('Error saving user:', error);
      Alert.alert('Error', 'No se pudo guardar el cliente.');
    } finally {
      setLoading(false);
    }
  };


  const formatNumber = (value) => {
    // quitar todo lo que no sea número
    const cleaned = value.replace(/[^0-9]/g, '');

    // evitar string vacío
    if (!cleaned) return '';

    // formatear con comas
    return new Intl.NumberFormat('en-US').format(Number(cleaned));
  };
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nombre Completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor="#8E8E93"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 809-111-2222"
            placeholderTextColor="#8E8E93"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Saldo Inicial</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 0.00"
            placeholderTextColor="#8E8E93"
            value={initialBalance}
            onChangeText={(text) => setInitialBalance(formatNumber(text))}
            keyboardType="decimal-pad" //para que salga el . en el teclado

          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. juan@correo.com"
            placeholderTextColor="#8E8E93"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notas Adicionales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Detalles sobre el cliente..."
            placeholderTextColor="#8E8E93"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!name || loading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!name || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Cliente</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#1C1C1E',

  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4C669F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#A0B0D0',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
