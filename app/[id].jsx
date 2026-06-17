import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
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
import { addToOutbox, getCache, setCache } from '../utils/database';
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
  const [description, setDescription] = useState('Pago');
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ─── Estado del modal de opciones ────────────────────────────────────────
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);


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

    const loadTransactions = async () => {
      // Caché primero para respuesta inmediata
      const cached = await getCache(`clientTx_${id}_${user.uid}`);
      if (cached && isMounted) {
        setTransactions(cached);
      }

      // Firestore en tiempo real
      const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');
      const q = query(txRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const txData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: formatDate(doc.data().createdAt),
          }));
          setTransactions(txData);
          setCache(`clientTx_${id}_${user.uid}`, txData); // Mantener caché fresco
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
    setDescription(type === 'debt' ? 'Deuda' : 'Pago');
    setEditingTransactionId(null);
    setModalVisible(true);
  }, []);

  // ─── Abrir modal (editar transacción) ────────────────────────────────────
  const openEditModal = useCallback((transaction) => {
    setTransactionType(transaction.type);
    setAmount(transaction.amount.toString());
    setDescription(transaction.description);
    setEditingTransactionId(transaction.id);
    setModalVisible(true);
  }, []);

  // ─── Cerrar modal y resetear estado ──────────────────────────────────────
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransactionId(null);
    setAmount('');
    setDescription('');
  }, []);


  // ─── Guardar transacción (nueva o editada) ────────────────────────────────
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
    const txRef = collection(db, 'users', user.uid, 'clients', id, 'transactions');
    const newTxRef = doc(txRef);
    const txId = newTxRef.id;

    // 1. Encolar en outbox para sincronizar cuando haya internet
    await addToOutbox(
      `users/${user.uid}/clients/${id}/transactions`,
      txId,
      { type: transactionType, amount: parsedAmount, description: description.trim(), createdAt: 'SERVER_TIMESTAMP' },
      'set'
    );

    const balanceChange = transactionType === 'payment' ? parsedAmount : -parsedAmount;
    await addToOutbox(`users/${user.uid}/clients`, id, { balance: `INCREMENT_${balanceChange}` }, 'update');

    const totalField = transactionType === 'payment' ? 'totalPayment' : 'totalDebt';
    await addToOutbox('users', user.uid, { [totalField]: `INCREMENT_${parsedAmount}` }, 'update');

    // 2. Actualizar UI y caché local de forma optimista
    const newTx = {
      id: txId,
      type: transactionType,
      amount: parsedAmount,
      description: description.trim(),
      date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }),
    };
    setTransactions((prev) => [newTx, ...prev]);
    setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + balanceChange } : prev);

    // 3. Actualizar caché SQLite
    const cachedClient = await getCache(`client_${id}_${user.uid}`);
    if (cachedClient) {
      await setCache(`client_${id}_${user.uid}`, { ...cachedClient, balance: (cachedClient.balance || 0) + balanceChange });
    }
    const cachedTxs = await getCache(`clientTx_${id}_${user.uid}`) || [];
    await setCache(`clientTx_${id}_${user.uid}`, [newTx, ...cachedTxs]);

    // 4. Actualizar totales locales del usuario
    if (updateLocalUserData) {
      updateLocalUserData({ [totalField]: (userData?.[totalField] || 0) + parsedAmount });
    }

    // 5. Reflejar en el contexto global (lista de clientes + actividad reciente)
    if (addTransactionOptimistic) {
      await addTransactionOptimistic({
        txId,
        clientId: id,
        clientName: client?.name || 'Sin nombre',
        type: transactionType,
        amount: parsedAmount,
        description: description.trim(),
      });
    }
  };

  /** Lógica interna: editar transacción existente. */
  const _editTransaction = async (parsedAmount) => {
    const oldTx = transactions.find((t) => t.id === editingTransactionId);
    if (!oldTx) throw new Error('Transacción no encontrada');

    // 1. Calcular diferencias de balance
    const oldBalanceChange = oldTx.type === 'payment' ? -oldTx.amount : oldTx.amount;
    const newBalanceChange = transactionType === 'payment' ? parsedAmount : -parsedAmount;
    const netBalanceChange = oldBalanceChange + newBalanceChange;

    let paymentDiff = 0;
    let debtDiff = 0;
    if (oldTx.type === 'payment') paymentDiff -= oldTx.amount;
    else debtDiff -= oldTx.amount;
    if (transactionType === 'payment') paymentDiff += parsedAmount;
    else debtDiff += parsedAmount;

    // 2. Encolar en outbox
    await addToOutbox(
      `users/${user.uid}/clients/${id}/transactions`,
      editingTransactionId,
      { type: transactionType, amount: parsedAmount, description: description.trim() },
      'update'
    );
    if (netBalanceChange !== 0) {
      await addToOutbox(`users/${user.uid}/clients`, id, { balance: `INCREMENT_${netBalanceChange}` }, 'update');
    }
    const userUpdate = {};
    if (paymentDiff !== 0) userUpdate.totalPayment = `INCREMENT_${paymentDiff}`;
    if (debtDiff !== 0) userUpdate.totalDebt = `INCREMENT_${debtDiff}`;
    if (Object.keys(userUpdate).length > 0) {
      await addToOutbox('users', user.uid, userUpdate, 'update');
    }

    // 3. Actualizar UI optimista
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransactionId
          ? { ...t, type: transactionType, amount: parsedAmount, description: description.trim() }
          : t
      )
    );
    setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + netBalanceChange } : prev);

    // 4. Actualizar caché SQLite
    const cachedClient = await getCache(`client_${id}_${user.uid}`);
    if (cachedClient) {
      await setCache(`client_${id}_${user.uid}`, { ...cachedClient, balance: (cachedClient.balance || 0) + netBalanceChange });
    }
    const cachedTxs = await getCache(`clientTx_${id}_${user.uid}`);
    if (cachedTxs) {
      await setCache(
        `clientTx_${id}_${user.uid}`,
        cachedTxs.map((t) =>
          t.id === editingTransactionId
            ? { ...t, type: transactionType, amount: parsedAmount, description: description.trim() }
            : t
        )
      );
    }

    // 5. Actualizar totales locales del usuario
    if (updateLocalUserData) {
      const localUpdate = {};
      if (paymentDiff !== 0) localUpdate.totalPayment = (userData?.totalPayment || 0) + paymentDiff;
      if (debtDiff !== 0) localUpdate.totalDebt = (userData?.totalDebt || 0) + debtDiff;
      if (Object.keys(localUpdate).length > 0) updateLocalUserData(localUpdate);
    }

    // 6. Reflejar en contexto global
    if (editTransactionOptimistic) {
      await editTransactionOptimistic({
        txId: editingTransactionId,
        clientId: id,
        oldType: oldTx.type,
        oldAmount: oldTx.amount,
        newType: transactionType,
        newAmount: parsedAmount,
        newDescription: description.trim(),
      });
    }
  };


  // ─── Eliminar transacción ─────────────────────────────────────────────────
  const handleDeleteTransaction = () => {
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
              const oldTx = transactions.find((t) => t.id === editingTransactionId);
              if (!oldTx) return;

              // Calcular reversión de balance
              const oldBalanceChange = oldTx.type === 'payment' ? -oldTx.amount : oldTx.amount;
              const totalField = oldTx.type === 'payment' ? 'totalPayment' : 'totalDebt';

              // Encolar en outbox
              await addToOutbox(`users/${user.uid}/clients/${id}/transactions`, editingTransactionId, null, 'delete');
              await addToOutbox(`users/${user.uid}/clients`, id, { balance: `INCREMENT_${oldBalanceChange}` }, 'update');
              await addToOutbox('users', user.uid, { [totalField]: `INCREMENT_${-oldTx.amount}` }, 'update');

              // Actualizar UI optimista
              setTransactions((prev) => prev.filter((t) => t.id !== editingTransactionId));
              setClient((prev) => prev ? { ...prev, balance: (prev.balance || 0) + oldBalanceChange } : prev);

              // Actualizar caché SQLite
              const cachedClient = await getCache(`client_${id}_${user.uid}`);
              if (cachedClient) {
                await setCache(`client_${id}_${user.uid}`, { ...cachedClient, balance: (cachedClient.balance || 0) + oldBalanceChange });
              }
              const cachedTxs = await getCache(`clientTx_${id}_${user.uid}`);
              if (cachedTxs) {
                await setCache(`clientTx_${id}_${user.uid}`, cachedTxs.filter((t) => t.id !== editingTransactionId));
              }

              // Actualizar totales locales del usuario
              if (updateLocalUserData) {
                updateLocalUserData({ [totalField]: (userData?.[totalField] || 0) - oldTx.amount });
              }

              // Reflejar en contexto global
              if (deleteTransactionOptimistic) {
                await deleteTransactionOptimistic({ txId: editingTransactionId, clientId: id, type: oldTx.type, amount: oldTx.amount });
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
              // Calcular totales del cliente para revertir
              let clientTotalDebt = 0;
              let clientTotalPayment = 0;
              transactions.forEach((tx) => {
                if (tx.type === 'payment') clientTotalPayment += tx.amount;
                else clientTotalDebt += tx.amount;
                addToOutbox(`users/${user.uid}/clients/${id}/transactions`, tx.id, null, 'delete');
              });

              // Revertir totales globales del usuario
              await addToOutbox('users', user.uid, {
                totalPayment: `INCREMENT_${-clientTotalPayment}`,
                totalDebt: `INCREMENT_${-clientTotalDebt}`,
              }, 'update');
              if (updateLocalUserData) {
                updateLocalUserData({
                  totalPayment: (userData?.totalPayment || 0) - clientTotalPayment,
                  totalDebt: (userData?.totalDebt || 0) - clientTotalDebt,
                });
              }

              // Eliminar documento del cliente
              await addToOutbox(`users/${user.uid}/clients`, id, null, 'delete');

              // Actualizar caché de la lista general
              const cachedClients = await getCache(`clients_${user.uid}`) || [];
              await setCache(`clients_${user.uid}`, cachedClients.filter((c) => c.id !== id));

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
    <TouchableOpacity style={styles.transactionCard} onPress={() => openEditModal(item)} activeOpacity={0.7}>
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
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <Text style={[styles.transactionAmount, item.type === 'payment' ? styles.positiveBalance : styles.negativeBalance]}>
        {item.type === 'payment' ? '+' : '-'}${formatCurrency(item.amount)}
      </Text>
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
                    {editingTransactionId ? (
                      <TouchableOpacity onPress={handleDeleteTransaction}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    ) : null}
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

                {/* Descripción */}
                <Text style={styles.inputLabel}>Título *</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder={transactionType === 'payment' ? 'Ej. Abono a cuenta...' : 'Ej. Préstamo de material...'}
                  placeholderTextColor="#C7C7CC"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Botón guardar */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!amount || !description.trim() || saving) && styles.saveButtonDisabled,
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
                onPress={() => { setOptionsVisible(false); Alert.alert('Info', 'Funcionalidad de editar próximamente.'); }}
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
