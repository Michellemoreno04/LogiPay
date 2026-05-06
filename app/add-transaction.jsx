import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AddTransactionScreen() {
  const [type, setType] = useState('payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    // In a real app, this would save to a database.
    console.log('Saved transaction:', { type, amount, description });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Type Selector */}
        <Text style={styles.label}>Tipo de Transacción</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'payment' && styles.typeButtonActivePayment]}
            onPress={() => setType('payment')}
          >
            <Ionicons name="arrow-down-circle" size={24} color={type === 'payment' ? 'white' : '#34C759'} />
            <Text style={[styles.typeButtonText, type === 'payment' && styles.typeButtonTextActive]}>Pago a favor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'debt' && styles.typeButtonActiveDebt]}
            onPress={() => setType('debt')}
          >
            <Ionicons name="arrow-up-circle" size={24} color={type === 'debt' ? 'white' : '#FF3B30'} />
            <Text style={[styles.typeButtonText, type === 'debt' && styles.typeButtonTextActive]}>Deuda</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Monto *</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Concepto / Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={type === 'payment' ? "Ej. Abono a cuenta..." : "Ej. Préstamo de material..."}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!amount || !description) && styles.saveButtonDisabled,
            type === 'payment' ? styles.paymentTheme : styles.debtTheme
          ]}
          onPress={handleSave}
          disabled={!amount || !description}
        >
          <Text style={styles.saveButtonText}>Guardar Transacción</Text>
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
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 25,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: 'white',
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    fontSize: 24,
    color: '#1C1C1E',
    marginRight: 5,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
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
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  paymentTheme: {
    backgroundColor: '#34C759',
  },
  debtTheme: {
    backgroundColor: '#FF3B30',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D1D6',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
