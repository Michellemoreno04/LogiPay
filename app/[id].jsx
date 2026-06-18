import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { useAlert } from '../context/AlertContext';
import { useLocalData } from '../context/LocalDataContext';
import { db } from '../firebaseConfig/config';
import {
  addTransaction,
  deleteClient,
  deleteTransaction,
  editTransaction,
} from '../utils/clientService';
import { getCache, setCache } from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';


// ─── Helpers de formato ──────────────────────────────────────────────────────

/** Convierte un Firestore Timestamp o Date en string legible. */
const formatDate = (createdAt) => {
  if (!createdAt) return 'Pendiente...';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Formatea un número con separadores de miles, permitiendo un decimal. */
const formatNumber = (value) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return value; // Evitar múltiples puntos decimales
  if (parts[0] === '') return cleaned;
  parts[0] = new Intl.NumberFormat('en-US').format(Number(parts[0]));
  return parts.join('.');
};

/** Formatea monto como moneda (ej. $1,234.00). */
const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);


// ─── Componente principal ────────────────────────────────────────────────────

export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user, userData, updateLocalUserData } = useAuth();
  const { clients, addTransactionOptimistic, editTransactionOptimistic, deleteTransactionOptimistic, deleteClientOptimistic } = useLocalData();
  const { showAlert } = useAlert();

  // ─── Estado del cliente y transacciones ─────────────────────────────────
  const [client, setClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingClient, setLoadingClient] = useState(true);

  // ─── Estado del modal de transacción ─────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('payment');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ─── Estado del modal de opciones ────────────────────────────────────────
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ─── Estado del modal de detalles de transacción y opciones ───────────────
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const [transactionOptionsVisible, setTransactionOptionsVisible] = useState(false);
  const [selectedTxForOptions, setSelectedTxForOptions] = useState(null);
  const [txMenuPosition, setTxMenuPosition] = useState({ x: 0, y: 0 });


  // ─── Carga del cliente con fallback offline en 3 capas ───────────────────
  //
  //  Capa 1: caché individual   → client_ID_uid   (la más rápida)
  //  Capa 2: caché de lista     → clients_uid     (fallback si no hay capa 1)
  //  Capa 3: Firestore listener → tiempo real cuando hay internet
  //
  //  IMPORTANTE: el listener de Firestore NUNCA pone null si ya cargamos
  //  datos desde caché. Evita el bug de "cliente no encontrado" offline.
  //
  useEffect(() => {
    if (!user || !id) return;
    let isMounted = true;
    let unsubscribe = null;
    // Bandera local para saber si el caché ya respondió con datos
    let loadedFromCache = false;

    const loadClient = async () => {
      // Capa 1: caché individual (guardado al crear el cliente)
      const cached = await getCache(`client_${id}_${user.uid}`);
      if (cached && isMounted) {
        setClient(cached);
        setLoadingClient(false);
        loadedFromCache = true;
      }

      // Capa 2: si no hay caché individual, buscar en la lista general
      if (!cached) {
        const cachedList = await getCache(`clients_${user.uid}`);
        const found = cachedList?.find((c) => c.id === id) ?? null;
        if (found && isMounted) {
          setClient(found);
          // Persistir como caché individual para próximas visitas
          await setCache(`client_${id}_${user.uid}`, found);
          setLoadingClient(false);
          loadedFromCache = true;
        }
      }

      // Capa 3: Firestore en tiempo real (actualiza si hay internet)
      const clientRef = doc(db, 'users', user.uid, 'clients', id);
      unsubscribe = onSnapshot(
        clientRef,
        (snap) => {
          if (!isMounted) return;
          if (snap.exists()) {
            // Documento existe en Firestore → actualizar estado y caché
            const data = { id: snap.id, ...snap.data() };
            setClient(data);
            setCache(`client_${id}_${user.uid}`, data);
          }
          // Si snap.exists() === false pero ya tenemos datos del caché,
          // NO tocar el estado (el cliente aún no se sincronió con Firestore).
          // Solo marcar null si realmente no hay ningún dato.
          if (!snap.exists() && !loadedFromCache) {
            setClient(null);
          }
          setLoadingClient(false);
        },
        (error) => {
          // Sin internet: ya tenemos datos de las capas 1 o 2
          console.warn('[id.jsx] Firestore client listener:', error.code);
          if (isMounted) setLoadingClient(false);
        }
      );
    };

    syncOutbox(); // Intentar sincronizar pendientes al abrir la pantalla
    loadClient();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, id]);


  // ─── Carga de transacciones con fallback offline ──────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    let isMounted = true;
    let unsubscribe = null;
    let loadedFromCache = false;

    const loadTransactions = async () => {
      // Caché primero para respuesta inmediata
      const cached = await getCache(`clientTx_${id}_${user.uid}`);
      if (cached && isMounted) {
        setTransactions(cached);
        if (cached.length > 0) {
          loadedFromCache = true;
        }
      }

      // Firestore en tiempo real
      const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');
      const q = query(txRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          if (!snapshot.empty) {
            const txData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              date: formatDate(doc.data().createdAt),
            }));
            setTransactions(txData);
            setCache(`clientTx_${id}_${user.uid}`, txData); // Mantener caché fresco
            loadedFromCache = true;
          } else if (!loadedFromCache) {
            // Si el snapshot está vacío y no teníamos datos en caché, 
            // entonces sí está vacío. Si teníamos datos (por transacciones offline), no los borramos.
            setTransactions([]);
            setCache(`clientTx_${id}_${user.uid}`, []);
          }
        },
        (error) => {
          // Sin internet: ya tenemos datos del caché
          console.warn('[id.jsx] Firestore transactions listener:', error.code);
        }
      );
    };

    loadTransactions();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, id]);


  // ─── Abrir modal (nueva transacción) ─────────────────────────────────────
  const openModal = useCallback((type) => {
    setTransactionType(type);
    setAmount('');
    setTitle(type === 'debt' ? 'Deuda' : 'Pago');
    setDescription('');
    setEditingTransactionId(null);
    setModalVisible(true);
  }, []);

  // ─── Abrir modal (editar transacción) ────────────────────────────────────
  const openEditModal = useCallback((transaction) => {
    setTransactionType(transaction.type);
    setAmount(transaction.amount.toString());
    setTitle(transaction.title || transaction.description || '');
    setDescription(transaction.description !== transaction.title ? (transaction.description || '') : '');
    setEditingTransactionId(transaction.id);
    setModalVisible(true);
  }, []);

  // ─── Cerrar modal y resetear estado ──────────────────────────────────────
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransactionId(null);
    setAmount('');
    setTitle('');
    setDescription('');
  }, []);

  // ─── Modales de detalles y opciones de transacción ────────────────────────
  const openDetailsModal = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setDetailsModalVisible(true);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetailsModalVisible(false);
    setSelectedTransaction(null);
  }, []);

  const openTransactionOptions = useCallback((transaction, event) => {
    setSelectedTxForOptions(transaction);
    if (event && event.nativeEvent) {
      const { pageX, pageY } = event.nativeEvent;
      setTxMenuPosition({ x: pageX, y: pageY });
    }
    setTransactionOptionsVisible(true);
  }, []);


  // ─── Guardar transacción (nueva o editada) ────────────────────────────────
  const handleSaveTransaction = async () => {
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Ingresa un título.');
      return;
    }

    setSaving(true);
    try {
      if (editingTransactionId) {
        await _editTransaction(parsedAmount);
      } else {
        await _addTransaction(parsedAmount);
      }

      syncOutbox(); // Intentar subir a Firebase si hay internet
      DeviceEventEmitter.emit('local-db-changed');
      showAlert('Transacción guardada exitosamente', 'success');
      closeModal();
    } catch (error) {
      console.error('[id.jsx] handleSaveTransaction:', error);
      showAlert('No se pudo guardar la transacción. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Lógica interna: agregar nueva transacción. */
  const _addTransaction = async (parsedAmount) => {
    // El servicio encola en outbox y actualiza la caché SQLite
    const { txId, balanceChange, totalField, newTx } = await addTransaction({
      uid: user.uid,
      clientId: id,
      type: transactionType,
      amount: parsedAmount,
      title: title.trim(),
      description: description.trim(),
    });

    // Actualizar UI optimista
    setTransactions((prev) => [newTx, ...prev]);
    setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + balanceChange } : prev);

    // Actualizar totales locales en memoria
    if (updateLocalUserData) {
      updateLocalUserData({ [totalField]: (userData?.[totalField] || 0) + parsedAmount });
    }

    // Reflejar en contexto global
    if (addTransactionOptimistic) {
      await addTransactionOptimistic({
        txId,
        clientId: id,
        clientName: client?.name || 'Sin nombre',
        type: transactionType,
        amount: parsedAmount,
        title: title.trim(),
        description: description.trim(),
      });
    }
  };

  /** Lógica interna: editar transacción existente. */
  const _editTransaction = async (parsedAmount) => {
    const oldTx = transactions.find((t) => t.id === editingTransactionId);
    if (!oldTx) throw new Error('Transacción no encontrada');

    // El servicio encola en outbox y actualiza la caché SQLite
    const { netBalanceChange, paymentDiff, debtDiff } = await editTransaction({
      uid: user.uid,
      clientId: id,
      txId: editingTransactionId,
      oldType: oldTx.type,
      oldAmount: oldTx.amount,
      newType: transactionType,
      newAmount: parsedAmount,
      newTitle: title.trim(),
      newDescription: description.trim(),
    });

    // Actualizar UI optimista
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransactionId
          ? { ...t, type: transactionType, amount: parsedAmount, title: title.trim(), description: description.trim() }
          : t
      )
    );
    setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + netBalanceChange } : prev);

    // Actualizar totales locales en memoria
    if (updateLocalUserData) {
      const localUpdate = {};
      if (paymentDiff !== 0) localUpdate.totalPayment = (userData?.totalPayment || 0) + paymentDiff;
      if (debtDiff !== 0) localUpdate.totalDebt = (userData?.totalDebt || 0) + debtDiff;
      if (Object.keys(localUpdate).length > 0) updateLocalUserData(localUpdate);
    }

    // Reflejar en contexto global
    if (editTransactionOptimistic) {
      await editTransactionOptimistic({
        txId: editingTransactionId,
        clientId: id,
        oldType: oldTx.type,
        oldAmount: oldTx.amount,
        newType: transactionType,
        newAmount: parsedAmount,
        newTitle: title.trim(),
        newDescription: description.trim(),
      });
    }
  };


  // ─── Eliminar transacción ─────────────────────────────────────────────────
  const handleDeleteTransaction = (txIdToDel = editingTransactionId) => {
    Alert.alert(
      'Eliminar Transacción',
      '¿Estás seguro de que deseas eliminar esta transacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const oldTx = transactions.find((t) => t.id === txIdToDel);
              if (!oldTx) return;

              // El servicio encola en outbox y actualiza la caché SQLite
              const { balanceChange, totalField } = await deleteTransaction({
                uid: user.uid,
                clientId: id,
                txId: txIdToDel,
                type: oldTx.type,
                amount: oldTx.amount,
              });

              // Actualizar UI optimista
              setTransactions((prev) => prev.filter((t) => t.id !== txIdToDel));
              setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + balanceChange } : prev);

              // Actualizar totales locales en memoria
              if (updateLocalUserData) {
                updateLocalUserData({ [totalField]: (userData?.[totalField] || 0) - oldTx.amount });
              }

              // Reflejar en contexto global
              if (deleteTransactionOptimistic) {
                await deleteTransactionOptimistic({ txId: txIdToDel, clientId: id, type: oldTx.type, amount: oldTx.amount });
              }

              syncOutbox();
              DeviceEventEmitter.emit('local-db-changed');
              showAlert('Transacción eliminada exitosamente', 'success');
              closeModal();
            } catch (error) {
              console.error('[id.jsx] handleDeleteTransaction:', error);
              showAlert('No se pudo eliminar la transacción.', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };


  // ─── Eliminar cliente ─────────────────────────────────────────────────────
  const handleDeleteClient = async () => {
    Alert.alert(
      'Eliminar Cliente',
      '¿Estás seguro de que deseas eliminar a este cliente? Esta acción no se puede deshacer y se borrarán todas sus transacciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setOptionsVisible(false);
            try {
              // El servicio encola en outbox, revierte totales y actualiza caché
              const { totalPaymentReverted, totalDebtReverted } = await deleteClient({
                uid: user.uid,
                clientId: id,
                transactions,
              });

              // Actualizar totales locales en memoria
              if (updateLocalUserData) {
                updateLocalUserData({
                  totalPayment: (userData?.totalPayment || 0) - totalPaymentReverted,
                  totalDebt: (userData?.totalDebt || 0) - totalDebtReverted,
                });
              }

              // Reflejar en contexto global
              if (deleteClientOptimistic) {
                await deleteClientOptimistic(id);
              }

              syncOutbox();
              DeviceEventEmitter.emit('local-db-changed');
              router.back();
              showAlert('Cliente eliminado correctamente.', 'success');
            } catch (error) {
              console.error('[id.jsx] handleDeleteClient:', error);
              showAlert('No se pudo eliminar el cliente.', 'error');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };


  // ─── Renderer de fila de transacción ─────────────────────────────────────
  const renderTransaction = ({ item }) => (
    <TouchableOpacity style={styles.transactionCard} onPress={() => openDetailsModal(item)} activeOpacity={0.7}>
      <View style={styles.transactionIconContainer}>
        <View style={[styles.iconBg, { backgroundColor: item.type === 'payment' ? '#E8F9EE' : '#FDECEA' }]}>
          <Ionicons
            name={item.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={28}
            color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
          />
        </View>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDescription}>{item.title || item.description}</Text>
        {item.description && item.description !== item.title ? (
          <Text style={styles.transactionSubDescription} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={styles.transactionDate}>{item.date}</Text>

      </View>
      <View style={styles.transactionRightCol}>
        <Text style={[styles.transactionAmount, item.type === 'payment' ? styles.positiveBalance : styles.negativeBalance]}>
          {item.type === 'payment' ? '+' : '-'}${formatCurrency(item.amount)}
        </Text>
        <TouchableOpacity
          style={styles.optionsIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={(e) => { e.stopPropagation(); openTransactionOptions(item, e); }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );


  // ─── Estados de carga y error ─────────────────────────────────────────────

  if (loadingClient) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4C669F" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

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


  // ─── Render principal ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>

        {/* ── Cabecera con info del cliente ── */}
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
              balance < 0 ? styles.negativeBalance : balance > 0 ? styles.positiveBalance : styles.neutralBalance,
            ]}>
              ${formatCurrency(Math.abs(balance))} {balance < 0 ? '(Debe)' : balance > 0 ? '(A favor)' : ''}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, styles.paymentButton]} onPress={() => openModal('payment')}>
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Abonar Pago</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.debtButton]} onPress={() => openModal('debt')}>
              <Ionicons name="remove-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Agregar Deuda</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Lista de transacciones ── */}
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

        {/* ── Modal: agregar / editar transacción ── */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: Platform.OS === 'ios' ? 60 : 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalContainer}>
                {/* Header del modal */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    <TouchableOpacity onPress={closeModal}>
                      <Text style={styles.modalCancel}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {editingTransactionId ? 'Editar Transacción' : (transactionType === 'payment' ? 'Abonar Pago' : 'Agregar Deuda')}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    {/* Botón de eliminar movido a las opciones, pero lo mantenemos por si acaso */}
                  </View>
                </View>

                {/* Chip con nombre del cliente */}
                <View style={styles.clientChip}>
                  <Ionicons name="person-circle-outline" size={20} color="#4C669F" />
                  <Text style={styles.clientChipText}>{client.name}</Text>
                </View>

                {/* Selector de tipo */}
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

                {/* Monto */}
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

                {/* Título */}
                <Text style={styles.inputLabel}>Título *</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder={transactionType === 'payment' ? 'Ej. Abono a cuenta...' : 'Ej. Préstamo de material...'}
                  placeholderTextColor="#C7C7CC"
                  value={title}
                  onChangeText={setTitle}
                />

                {/* Descripción */}
                <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Detalles adicionales..."
                  placeholderTextColor="#C7C7CC"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Botón guardar */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!amount || !title.trim() || saving) && styles.saveButtonDisabled,
                    transactionType === 'payment' ? styles.savePaymentTheme : styles.saveDebtTheme,
                  ]}
                  onPress={handleSaveTransaction}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.saveButtonText}>Guardar Transacción</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Modal: opciones del cliente ── */}
        <Modal
          visible={optionsVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setOptionsVisible(false)}
        >
          <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
            <View style={styles.optionsContent}>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setOptionsVisible(false);
                  router.push({
                    pathname: '/add-user',
                    params: {
                      clientId: client.id,
                      name: client.name,
                      phone: client.phone || '',
                      email: client.email || '',
                    },
                  });
                }}
              >
                <Ionicons name="create-outline" size={22} color="#4C669F" />
                <Text style={styles.optionText}>Editar cliente</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity style={styles.optionItem} onPress={handleDeleteClient}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <Text style={[styles.optionText, { color: '#FF3B30' }]}>Eliminar cliente</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Modal: Detalles de la transacción ── */}
        <Modal
          visible={detailsModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={closeDetailsModal}
        >
          <TouchableOpacity style={styles.detailsOverlay} activeOpacity={1} onPress={closeDetailsModal}>
            <TouchableOpacity activeOpacity={1} style={styles.detailsModalContent}>
              {selectedTransaction && (
                <>
                  {/* Header con icono y título */}
                  <View style={styles.detailsHeader}>
                    <View style={[styles.iconBg, {
                      backgroundColor: selectedTransaction.type === 'payment' ? '#E8F9EE' : '#FDECEA',
                      marginRight: 12,
                      width: 48, height: 48, borderRadius: 24,
                    }]}>
                      <Ionicons
                        name={selectedTransaction.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={30}
                        color={selectedTransaction.type === 'payment' ? '#34C759' : '#FF3B30'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsTitle}>{selectedTransaction.title || selectedTransaction.description}</Text>
                      <Text style={styles.detailsDate}>{selectedTransaction.date}</Text>
                    </View>
                  </View>

                  {/* Nombre del cliente */}
                  <View style={styles.detailsClientRow}>
                    <Ionicons name="person-circle-outline" size={18} color="#4C669F" />
                    <Text style={styles.detailsClientName}>{client?.name || 'Cliente'}</Text>
                  </View>

                  {/* Monto */}
                  <View style={styles.detailsBody}>
                    <Text style={styles.detailsLabel}>Monto</Text>
                    <Text style={[styles.detailsAmount, selectedTransaction.type === 'payment' ? styles.positiveBalance : styles.negativeBalance]}>
                      {selectedTransaction.type === 'payment' ? '+' : '-'}${formatCurrency(selectedTransaction.amount)}
                    </Text>

                    {/* Descripción (solo si existe y es diferente al título) */}
                    {selectedTransaction.description && selectedTransaction.description !== selectedTransaction.title && (
                      <>
                        <Text style={[styles.detailsLabel, { marginTop: 16 }]}>Descripción</Text>
                        <Text style={styles.detailsDescriptionText}>{selectedTransaction.description}</Text>
                      </>
                    )}
                  </View>

                  {/* Acciones: Editar | Cerrar */}
                  <View style={styles.detailsActions}>
                    <TouchableOpacity
                      style={[styles.detailsActionBtn, styles.detailsEditBtn]}
                      onPress={() => { closeDetailsModal(); openEditModal(selectedTransaction); }}
                    >
                      <Ionicons name="create-outline" size={18} color="#4C669F" />
                      <Text style={[styles.detailsActionText, { color: '#4C669F' }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailsActionBtn, styles.detailsCloseButton]}
                      onPress={closeDetailsModal}
                    >
                      <Text style={styles.detailsCloseText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── Modal: Opciones de transacción ── */}
        <Modal
          visible={transactionOptionsVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setTransactionOptionsVisible(false)}
        >
          <TouchableOpacity style={styles.txOptionsOverlay} activeOpacity={1} onPress={() => setTransactionOptionsVisible(false)}>
            <View
              style={[
                styles.txOptionsContent,
                {
                  top: (() => {
                    const { height: screenHeight } = Dimensions.get('window');
                    const menuHeight = 110;
                    let calculatedTop = txMenuPosition.y + menuHeight > screenHeight - 40
                      ? txMenuPosition.y - menuHeight - 10
                      : txMenuPosition.y + 10;
                    return Math.max(20, calculatedTop);
                  })(),
                  right: 20,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setTransactionOptionsVisible(false);
                  if (selectedTxForOptions) openEditModal(selectedTxForOptions);
                }}
              >
                <Ionicons name="create-outline" size={22} color="#4C669F" />
                <Text style={styles.optionText}>Editar Transacción</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setTransactionOptionsVisible(false);
                  if (selectedTxForOptions) handleDeleteTransaction(selectedTxForOptions.id);
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <Text style={[styles.optionText, { color: '#FF3B30' }]}>Eliminar Transacción</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Overlay de eliminando ── */}
        {deleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.deletingText}>Eliminando cliente...</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}


// ─── Estilos ──────────────────────────────────────────────────────────────────

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
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  transactionSubDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#AEAEB2',
    marginBottom: 2,
  },
  transactionClient: {
    fontSize: 12,
    color: '#AEAEB2',
  },
  transactionRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingLeft: 6,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
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
  /* ── Modal de transacción ── */
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
    flex: 2,
    textAlign: 'center',
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
  titleInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 20,
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
  /* ── Modal de opciones ── */
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
    width: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  txOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  txOptionsContent: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    width: 240,
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
  optionsIcon: {
    padding: 6,
    marginTop: 2,
  },
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  detailsModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  detailsClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  detailsClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C669F',
    marginLeft: 6,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 15,
    marginBottom: 15,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  detailsDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  detailsBody: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailsAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  detailsDescriptionText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  detailsActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  detailsEditBtn: {
    backgroundColor: '#F0F4FF',
  },
  detailsActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailsCloseButton: {
    backgroundColor: '#F2F2F7',
  },
  detailsCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
