import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
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
import { useAlert } from '../context/AlertContext';
import { useLocalData } from '../context/LocalDataContext';
import { createClient, editClient } from '../utils/clientService';
import { syncOutbox } from '../utils/syncEngine';

export default function AddUserScreen() {
  const { user, userData, updateLocalUserData } = useAuth();
  const { addClientOptimistic, editClientOptimistic } = useLocalData();
  const { showAlert } = useAlert();

  const params = useLocalSearchParams();
  const isEditing = !!params.clientId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(params.name || '');
  const [phone, setPhone] = useState(params.phone || '');
  const [email, setEmail] = useState(params.email || '');
  const [initialBalance, setInitialBalance] = useState('');
  const [transactionType, setTransactionType] = useState('debt'); // 'payment' | 'debt'
  const [balanceDescription, setBalanceDescription] = useState('Saldo inicial');

  const handleSave = async () => {
    if (!user) {
      showAlert('Debes iniciar sesión para guardar clientes.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await editClient({
          uid: user.uid,
          clientId: params.clientId,
          name,
          phone,
          email,
        });

        if (editClientOptimistic) {
          await editClientOptimistic({
            clientId: params.clientId,
            name,
            phone,
            email,
          });
        }
        DeviceEventEmitter.emit('local-db-changed');
        syncOutbox();
        showAlert('Cliente actualizado exitosamente', 'success');
        router.back();
        return;
      }

      const parsedBalance = parseFloat(initialBalance.replace(/,/g, '')) || 0;

      // Toda la lógica de negocio queda en el servicio
      const { clientId, initialTxId, balance } = await createClient({
        uid: user.uid,
        name,
        phone,
        email,
        parsedBalance,
        transactionType,
        balanceDescription: balanceDescription.trim() || 'Saldo inicial',
      });

      // Actualizar totales locales del usuario en memoria
      if (parsedBalance > 0 && updateLocalUserData) {
        const debtChange = transactionType === 'payment' ? -parsedBalance : parsedBalance;
        updateLocalUserData({
          totalDebt: (userData?.totalDebt || 0) + debtChange,
        });
      }

      // Actualizar contexto local (lista global + actividad reciente)
      if (addClientOptimistic) {
        await addClientOptimistic({
          clientId,
          txId: initialTxId,
          name,
          phone,
          email,
          balance,
          transactionType,
          parsedBalance,
          balanceDescription: balanceDescription.trim() || 'Saldo inicial',
        });
      }

      DeviceEventEmitter.emit('local-db-changed');
      syncOutbox(); // Intenta sincronizar si hay internet; si no, queda en el outbox
      showAlert('Cliente guardado exitosamente', 'success');
      router.back();
    } catch (error) {
      console.error('[add-user] handleSave:', error);
      showAlert('No se pudo guardar el cliente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (!cleaned) return '';
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

        {!isEditing && (
          <>
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
          <Text style={styles.label}>{transactionType === 'payment' ? 'Abono Inicial' : 'Deuda Inicial'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 0.00"
            placeholderTextColor="#8E8E93"
            value={initialBalance}
            onChangeText={(text) => setInitialBalance(formatNumber(text))}
            keyboardType="decimal-pad"
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
          </>
        )}

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
            <Text style={styles.saveButtonText}>{isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}</Text>
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
