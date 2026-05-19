import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig/config';
import { useAuth } from '../authContext/authContext';

export default function AddUserScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [transactionType, setTransactionType] = useState('debt'); // 'payment' | 'debt'
  const [email, setEmail] = useState('');
  const [balanceDescription, setBalanceDescription] = useState('Saldo inicial');

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión para guardar clientes.');
      return;
    }
    setLoading(true);
    try {
      const parsedBalance = parseFloat(initialBalance.replace(/,/g, '')) || 0;
      const batch = writeBatch(db);

      const clientsRef = collection(db, 'users', user.uid, 'clients');
      const newClientRef = doc(clientsRef);
      const clientId = newClientRef.id;

      // payment → balance goes UP (positive), debt → balance goes DOWN (negative)
      const balance = transactionType === 'payment' ? parsedBalance : -parsedBalance;

      // 1. Create the client document
      batch.set(newClientRef, {
        name,
        phone,
        email,
        balance: balance,
        createdAt: serverTimestamp(),
      });

      // 2. If there's an initial balance, record it and update totals
      if (parsedBalance > 0) {
        const userRef = doc(db, 'users', user.uid);
        if (transactionType === 'payment') {
          batch.update(userRef, {
            totalPayment: increment(parsedBalance),
          });
        } else {
          batch.update(userRef, {
            totalDebt: increment(parsedBalance),
          });
        }

        // Add the initial transaction to the client's history
        const txRef = collection(db, 'users', user.uid, 'clients', clientId, 'transactions');
        const newTxRef = doc(txRef);
        batch.set(newTxRef, {
          type: transactionType,
          amount: parsedBalance,
          description: balanceDescription.trim() || 'Saldo inicial',
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.label}>Tipo de Saldo Inicial</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, transactionType === 'payment' && styles.typeButtonActivePayment]}
              onPress={() => setTransactionType('payment')}
            >
              <Ionicons name="arrow-down-circle" size={22} color={transactionType === 'payment' ? 'white' : '#34C759'} />
              <Text style={[styles.typeButtonText, transactionType === 'payment' && styles.typeButtonTextActive]}>Abono</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, transactionType === 'debt' && styles.typeButtonActiveDebt]}
              onPress={() => setTransactionType('debt')}
            >
              <Ionicons name="arrow-up-circle" size={22} color={transactionType === 'debt' ? 'white' : '#FF3B30'} />
              <Text style={[styles.typeButtonText, transactionType === 'debt' && styles.typeButtonTextActive]}>Deuda</Text>
            </TouchableOpacity>
          </View>
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

        {initialBalance ? (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Concepto del Saldo Inicial</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Primer Saldo, pago numero 1..."
              placeholderTextColor="#8E8E93"
              value={balanceDescription}
              onChangeText={setBalanceDescription}
              autoCapitalize="sentences"
            />
          </View>
        ) : null}

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
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  typeButtonActivePayment: {
    backgroundColor: '#34C759',
  },
  typeButtonActiveDebt: {
    backgroundColor: '#FF3B30',
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  typeButtonTextActive: {
    color: 'white',
  },
});
