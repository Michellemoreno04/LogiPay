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
  const { user } = useAuth();
  const { addClientOptimistic, editClientOptimistic } = useLocalData();
  const { showAlert } = useAlert();

  const params = useLocalSearchParams();
  const isEditing = !!params.clientId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(params.name || '');
  const [phone, setPhone] = useState(params.phone || '');
  const [email, setEmail] = useState(params.email || '');

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

      // Crear cliente sin saldo inicial
      const { clientId } = await createClient({
        uid: user.uid,
        name,
        phone,
        email,
        parsedBalance: 0,
        transactionType: 'debt',
        balanceDescription: '',
      });

      // Actualizar contexto local (lista global)
      if (addClientOptimistic) {
        await addClientOptimistic({
          clientId,
          txId: null,
          name,
          phone,
          email,
          balance: 0,
          transactionType: 'debt',
          parsedBalance: 0,
          balanceDescription: '',
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
});
