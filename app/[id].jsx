import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  doc, onSnapshot, collection, addDoc, updateDoc, increment,
  query, orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import { useAuth } from '../authContext/authContext';

export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  // Client data from Firestore
  const [client, setClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingClient, setLoadingClient] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('payment'); // 'payment' | 'debt'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState(transactionType === 'payment' ? 'Pago' : 'Deuda');
  const [saving, setSaving] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ─── Real-time listener for client document ───
  useEffect(() => {
    if (!user || !id) return;

    const clientRef = doc(db, 'users', user.uid, 'clients', id);
    const unsubscribe = onSnapshot(clientRef, (snap) => {
      if (snap.exists()) {
        setClient({ id: snap.id, ...snap.data() });
      } else {
        setClient(null);
      }
      setLoadingClient(false);
    }, (error) => {
      console.error('Error listening to client:', error);
      setLoadingClient(false);
    });

    return () => unsubscribe();
  }, [user, id]);

  // ─── Real-time listener for transactions subcollection ───
  useEffect(() => {
    if (!user || !id) return;

    const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');
    const q = query(txRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const txData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        txData.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to readable date string
          date: data.createdAt
            ? data.createdAt.toDate().toLocaleDateString('es-ES', {
              year: 'numeric', month: 'short', day: 'numeric'
            })
            : 'Pendiente...',
        });
      });
      setTransactions(txData);
    }, (error) => {
      console.error('Error listening to transactions:', error);
    });

    return () => unsubscribe();
  }, [user, id]);

  // ─── Open modal with pre-selected type ───
  const openModal = useCallback((type) => {
    setTransactionType(type);
    setAmount('');
    setDescription(type === 'debt' ? 'Deuda' : 'Pago');
    setModalVisible(true);
  }, []);

  // ─── Save transaction to Firestore ───
  const handleSaveTransaction = async () => {
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Ingresa una descripción.');
      return;
    }

    setSaving(true);
    try {
      const clientRef = doc(db, 'users', user.uid, 'clients', id);
      const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');
      const userRef = doc(db, 'users', user.uid);

      // 1. Add the transaction document
      await addDoc(txRef, {
        type: transactionType,
        amount: parsedAmount,
        description: description.trim(),
        createdAt: serverTimestamp(),
      });

      // 2. Update the client's balance atomically
      // payment → balance goes UP (positive), debt → balance goes DOWN (negative)
      const balanceChange = transactionType === 'payment' ? parsedAmount : -parsedAmount;
      await updateDoc(clientRef, {
        balance: increment(balanceChange),
      });

      // 3. Update the user's global totals
      if (transactionType === 'payment') {
        await updateDoc(userRef, {
          totalPayment: increment(parsedAmount),
        });
      } else {
        await updateDoc(userRef, {
          totalDebt: increment(parsedAmount),
        });
      }

      setModalVisible(false);
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', 'No se pudo guardar la transacción. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete client from Firestore ───
  const handleDeleteClient = async () => {
    Alert.alert(
      "Eliminar Cliente",
      "¿Estás seguro de que deseas eliminar a este cliente? Esta acción no se puede deshacer y se borrarán todas sus transacciones.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setOptionsVisible(false);
            try {
              const clientRef = doc(db, 'users', user.uid, 'clients', id);
              const userRef = doc(db, 'users', user.uid);
              const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');

              // 1. Get all transactions to adjust global totals
              // Note: This is important if we want global totals to stay accurate
              const txSnap = await getDocs(txRef);
              let clientTotalDebt = 0;
              let clientTotalPayment = 0;

              txSnap.forEach(doc => {
                const data = doc.data();
                if (data.type === 'payment') {
                  clientTotalPayment += data.amount;
                } else {
                  clientTotalDebt += data.amount;
                }
              });

              const batch = writeBatch(db);

              // 2. Adjust global totals
              batch.update(userRef, {
                totalPayment: increment(-clientTotalPayment),
                totalDebt: increment(-clientTotalDebt)
              });

              // 3. Delete all transactions (Firestore subcollections aren't deleted automatically)
              txSnap.forEach(doc => {
                batch.delete(doc.ref);
              });

              // 4. Delete the client document
              batch.delete(clientRef);

              await batch.commit();

              router.back();
              Alert.alert("Éxito", "Cliente eliminado correctamente.");
            } catch (error) {
              console.error('Error deleting client:', error);
              Alert.alert('Error', 'No se pudo eliminar el cliente.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  // ─── Format number with commas ───
  const formatNumber = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount; // don't update if multiple dots
    if (parts[0] === '') return cleaned;
    parts[0] = new Intl.NumberFormat('en-US').format(Number(parts[0]));
    return parts.join('.');
  };

  // ─── Transaction row renderer ───
  const renderTransaction = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionIconContainer}>
        <View style={[
          styles.iconBg,
          { backgroundColor: item.type === 'payment' ? '#E8F9EE' : '#FDECEA' }
        ]}>
          <Ionicons
            name={item.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={28}
            color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
          />
        </View>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        item.type === 'payment' ? styles.positiveBalance : styles.negativeBalance
      ]}>
        {item.type === 'payment' ? '+' : '-'}${item.amount.toFixed(2)}
      </Text>
    </View>
  );

  // ─── Loading state ───
  if (loadingClient) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4C669F" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  // ─── Client not found ───
  if (!client) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-remove-outline" size={64} color="#C7C7CC" />
        <Text style={styles.loadingText}>Cliente no encontrado.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balance = client.balance || 0;

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopActions}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.headerIconButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(client.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{client.name}</Text>
        {client.email ? <Text style={styles.userInfoText}>{client.email}</Text> : null}
        {client.phone ? <Text style={styles.userInfoText}>{client.phone}</Text> : null}

        <View style={styles.balanceBox}>
          <Text style={styles.balanceTitle}>Saldo Actual</Text>
          <Text style={[
            styles.balanceMainAmount,
            balance < 0 ? styles.negativeBalance :
              balance > 0 ? styles.positiveBalance :
                styles.neutralBalance
          ]}>
            ${Math.abs(balance).toFixed(2)} {balance < 0 ? '(Debe)' : balance > 0 ? '(A favor)' : ''}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.paymentButton]}
            onPress={() => openModal('payment')}
          >
            <Ionicons name="add-circle-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Abonar Pago</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.debtButton]}
            onPress={() => openModal('debt')}
          >
            <Ionicons name="remove-circle-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Agregar Deuda</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History List */}
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Historial de Transacciones</Text>
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>No hay transacciones registradas.</Text>
            </View>
          }
        />
      </View>

      {/* ─── Add Transaction Modal ─── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {transactionType === 'payment' ? 'Abonar Pago' : 'Agregar Deuda'}
              </Text>
              <View style={{ width: 70 }} />
            </View>

            {/* Client name chip */}
            <View style={styles.clientChip}>
              <Ionicons name="person-circle-outline" size={20} color="#4C669F" />
              <Text style={styles.clientChipText}>{client.name}</Text>
            </View>

            {/* Type Selector */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, transactionType === 'payment' && styles.typeButtonActivePayment]}
                onPress={() => setTransactionType('payment')}
              >
                <Ionicons name="arrow-down-circle" size={22} color={transactionType === 'payment' ? 'white' : '#34C759'} />
                <Text style={[styles.typeButtonText, transactionType === 'payment' && styles.typeButtonTextActive]}>Pago</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, transactionType === 'debt' && styles.typeButtonActiveDebt]}
                onPress={() => setTransactionType('debt')}
              >
                <Ionicons name="arrow-up-circle" size={22} color={transactionType === 'debt' ? 'white' : '#FF3B30'} />
                <Text style={[styles.typeButtonText, transactionType === 'debt' && styles.typeButtonTextActive]}>Deuda</Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text style={styles.inputLabel}>Monto *</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#C7C7CC"
                value={amount}
                onChangeText={(text) => setAmount(formatNumber(text))}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Description */}
            <Text style={styles.inputLabel}>Título *</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder={transactionType === 'payment' ? 'Ej. Abono a cuenta...' : 'Ej. Préstamo de material...'}
              placeholderTextColor="#C7C7CC"
              value={transactionType === 'payment' ? 'Pago' : 'Deuda'}
              onChangeText={setDescription}
              multiline

            />

            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!amount || !description.trim() || saving) && styles.saveButtonDisabled,
                transactionType === 'payment' ? styles.savePaymentTheme : styles.saveDebtTheme
              ]}
              onPress={handleSaveTransaction}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Transacción</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ─── Options Modal ─── */}
      <Modal
        visible={optionsVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={styles.optionsContent}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsVisible(false);
                // Future option: Edit client
                Alert.alert("Info", "Funcionalidad de editar próximamente.");
              }}
            >
              <Ionicons name="create-outline" size={22} color="#4C669F" />
              <Text style={styles.optionText}>Editar cliente</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDeleteClient}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Eliminar cliente</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Deleting Overlay */}
      {deleting && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.deletingText}>Eliminando cliente...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#4C669F',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  headerContainer: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  headerIconButton: {
    padding: 8,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4C669F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  userInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  balanceBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  balanceMainAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  negativeBalance: { color: '#FF3B30' },
  positiveBalance: { color: '#34C759' },
  neutralBalance: { color: '#8E8E93' },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentButton: {
    backgroundColor: '#34C759',
  },
  debtButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  historyContainer: {
    flex: 1,
    paddingTop: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionIconContainer: {
    marginRight: 15,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 12,
    fontSize: 15,
  },

  /* ─── Modal Styles ─── */
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
  clientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  clientChipText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#4C669F',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
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
  savePaymentTheme: {
    backgroundColor: '#34C759',
  },
  saveDebtTheme: {
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
  /* ─── Options Modal Styles ─── */
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 60,
    paddingRight: 20,
  },
  optionsContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  deletingText: {
    color: 'white',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
});
