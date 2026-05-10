import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, Pressable } from 'react-native';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';

export default function AdjustModal({ visible, onClose, userData, user }) {
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const formatNumber = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return adjustAmount;
    if (parts[0] === '') return cleaned;
    parts[0] = new Intl.NumberFormat('en-US').format(Number(parts[0]));
    return parts.join('.');
  };

  useEffect(() => {
    if (visible) {
      const currentTotal = (userData?.totalDebt || 0) - (userData?.totalPayment || 0);
      setAdjustAmount(formatNumber(Math.max(0, currentTotal).toFixed(2)));
      setAdjustNote('');
    }
  }, [visible, userData]);

  const handleSaveAdjustment = async () => {
    const newTotal = parseFloat(adjustAmount.replace(/,/g, ''));
    if (isNaN(newTotal) || newTotal < 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }
    if (!adjustNote.trim()) {
      Alert.alert('Error', 'Ingresa una nota o descripción.');
      return;
    }

    setSavingAdjust(true);
    try {
      const currentTotal = (userData?.totalDebt || 0) - (userData?.totalPayment || 0);
      const difference = newTotal - currentTotal;

      if (Math.abs(difference) < 0.01) {
        onClose();
        setSavingAdjust(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const txRef = collection(db, 'users', user.uid, 'transactions');

      const adjustType = difference > 0 ? 'debt' : 'payment';
      const absDiff = Math.abs(difference);

      await addDoc(txRef, {
        type: adjustType,
        amount: absDiff,
        description: `Ajuste: ${adjustNote.trim()} (Total anterior: $${currentTotal.toFixed(2)})`,
        createdAt: serverTimestamp(),
      });

      if (adjustType === 'payment') {
        await updateDoc(userRef, {
          totalPayment: increment(absDiff),
        });
      } else {
        await updateDoc(userRef, {
          totalDebt: increment(absDiff),
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving adjustment:', error);
      Alert.alert('Error', 'No se pudo guardar el ajuste. Intenta de nuevo.');
    } finally {
      setSavingAdjust(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Ajustar Total</Text>
                <View style={{ width: 70 }} />
              </View>

              <Text style={styles.inputLabel}>Nuevo Monto Total *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#C7C7CC"
                  value={adjustAmount}
                  onChangeText={(text) => setAdjustAmount(formatNumber(text))}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              <Text style={styles.inputLabel}>Nota del Ajuste *</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Ej. Corrección de saldo..."
                placeholderTextColor="#C7C7CC"
                value={adjustNote}
                onChangeText={setAdjustNote}
                multiline
                numberOfLines={2}
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!adjustAmount || !adjustNote.trim() || savingAdjust) && styles.saveButtonDisabled,
                  { backgroundColor: '#4C669F' }
                ]}
                onPress={handleSaveAdjustment}
                disabled={!adjustAmount || !adjustNote.trim() || savingAdjust}
              >
                {savingAdjust ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Nuevo Total</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCancel: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 24,
    color: '#1C1C1E',
    marginRight: 5,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#1C1C1E',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
