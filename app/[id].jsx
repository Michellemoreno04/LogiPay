import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import ClientDetailsModals from '../components/modales/ClientDetailsModals';
import { useAlert } from '../context/AlertContext';
import { useLocalData } from '../context/LocalDataContext';
import { db as firestore } from '../firebaseConfig/config';
import {
  addTransaction,
  deleteClient,
  deleteTransaction,
  editTransaction,
} from '../utils/clientService';
import {
  getClientById,
  getTransactionsByClient,
  insertClient,
  insertTransaction,
} from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';


// ─── Helpers de formato ──────────────────────────────────────────────────────

/** Convierte un Firestore Timestamp o Date en string legible. */
const formatDate = (createdAt) => {
  if (!createdAt) return 'Pendiente...';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};



/** Formatea monto como moneda (ej. $1,234.00). */
const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);


export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user, userData, updateLocalUserData } = useAuth();
  const { clients: contextClients, addTransactionOptimistic, editTransactionOptimistic, deleteTransactionOptimistic, deleteClientOptimistic } = useLocalData();
  const { showAlert } = useAlert();

  // ─── Estado del cliente y transacciones ─────────────────────────────────
  const [client, setClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingClient, setLoadingClient] = useState(true);

  // Recargar datos locales del cliente desde SQLite
  const reloadClientFromDb = useCallback(async () => {
    if (!user || !id) return;
    const localClient = await getClientById(user.uid, id);
    if (localClient) setClient(localClient);
  }, [user, id]);

  // Sincronizar client desde contextClients si cambia en memoria
  useEffect(() => {
    if (!id || !contextClients || contextClients.length === 0) return;
    const found = contextClients.find((c) => c.id === id);
    if (found) {
      setClient((prev) => (prev ? { ...prev, ...found } : found));
    }
  }, [contextClients, id]);

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


  // ─── Carga del cliente desde SQLite (fuente de verdad) ───────────────────
  //  Capa 1: SQLite local (inmediato, funciona sin internet)
  //  Capa 2: Firebase en background (sincroniza cuando hay internet)
  useEffect(() => {
    if (!user || !id) return;
    let isMounted = true;
    let unsubscribe = null;

    const loadClient = async () => {
      // 1. Cargar desde SQLite inmediatamente
      const localClient = await getClientById(user.uid, id);
      if (localClient && isMounted) {
        setClient(localClient);
        setLoadingClient(false);
      }

      // 2. Sincronizar desde Firebase en background
      try {
        const clientRef = doc(firestore, 'users', user.uid, 'clients', id);
        unsubscribe = onSnapshot(
          clientRef,
          async (snap) => {
            if (!isMounted) return;
            if (snap.exists()) {
              const data = { id: snap.id, ...snap.data() };
              // Normalizar Firestore Timestamp
              if (data.createdAt?.toMillis) data.createdAt = data.createdAt.toMillis();
              // Guardar en SQLite
              await insertClient(user.uid, data);
              // Recargar desde SQLite como fuente de verdad
              const updated = await getClientById(user.uid, id);
              if (isMounted && updated) setClient(updated);
            } else if (!localClient) {
              // No existe en Firebase ni en SQLite
              if (isMounted) setClient(null);
            }
            if (isMounted) setLoadingClient(false);
          },
          (error) => {
            // Sin internet: ya tenemos datos de SQLite
            console.warn('[id.jsx] Firebase client listener offline:', error.code);
            if (isMounted) setLoadingClient(false);
          }
        );
      } catch (e) {
        console.warn('[id.jsx] Firebase client listener error:', e);
        if (isMounted) setLoadingClient(false);
      }
    };

    syncOutbox();
    loadClient();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, id]);


  // ─── Carga de transacciones desde SQLite ──────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    let isMounted = true;
    let unsubscribe = null;

    const loadTransactions = async () => {
      // 1. Cargar desde SQLite inmediatamente
      const localTxs = await getTransactionsByClient(user.uid, id);
      if (isMounted) {
        setTransactions(localTxs.map((tx) => ({
          ...tx,
          date: tx.date || formatDate(tx.createdAt),
        })));
      }

      // 2. Sincronizar desde Firebase en background
      try {
        const txRef = collection(firestore, 'users', user.uid, 'clients', id, 'transactions');
        const q = query(txRef, orderBy('createdAt', 'desc'));
        unsubscribe = onSnapshot(
          q,
          async (snapshot) => {
            if (!isMounted) return;
            // Guardar en SQLite (INSERT OR REPLACE no duplica)
            for (const docSnap of snapshot.docs) {
              const data = docSnap.data();
              await insertTransaction(user.uid, {
                id: docSnap.id,
                clientId: id,
                type: data.type,
                amount: data.amount,
                title: data.title || data.description || '',
                description: data.description || '',
                date: data.createdAt?.toDate
                  ? formatDate(data.createdAt)
                  : (data.date || ''),
                createdAt: data.createdAt?.toMillis?.() || Date.now(),
              });
            }
            // Recargar desde SQLite
            const updated = await getTransactionsByClient(user.uid, id);
            if (isMounted) {
              setTransactions(updated.map((tx) => ({
                ...tx,
                date: tx.date || formatDate(tx.createdAt),
              })));
            }
          },
          (error) => {
            console.warn('[id.jsx] Firebase transactions listener offline:', error.code);
          }
        );
      } catch (e) {
        console.warn('[id.jsx] Firebase transactions listener error:', e);
      }
    };

    loadTransactions();

    const handleLocalDbChanged = () => {
      reloadClientFromDb();
      loadTransactions();
    };

    // Escuchar cambios locales para refrescar cliente y transacciones
    const sub = DeviceEventEmitter.addListener('local-db-changed', handleLocalDbChanged);

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      sub.remove();
    };
  }, [user, id, reloadClientFromDb]);


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
    const { txId, balanceChange, newTx } = await addTransaction({
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
      const debtChange = transactionType === 'payment' ? -parsedAmount : parsedAmount;
      updateLocalUserData({ totalDebt: (userData?.totalDebt || 0) + debtChange });
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
    const { netBalanceChange, debtDiff } = await editTransaction({
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
      if (debtDiff !== 0) updateLocalUserData({ totalDebt: (userData?.totalDebt || 0) + debtDiff });
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
              const { balanceChange, debtDiff } = await deleteTransaction({
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
                if (debtDiff !== 0) updateLocalUserData({ totalDebt: (userData?.totalDebt || 0) + debtDiff });
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
              const { totalDebtReverted } = await deleteClient({
                uid: user.uid,
                clientId: id,
                transactions,
              });

              // Actualizar totales locales en memoria
              if (updateLocalUserData) {
                updateLocalUserData({
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
  const renderTransaction = ({ item }) => {
    let isInvoice = false;
    let invoiceItems = [];
    let subtitlePreview = null;

    if (item.description) {
      try {
        const parsed = JSON.parse(item.description);
        if (parsed && parsed.isInvoice && Array.isArray(parsed.items)) {
          isInvoice = true;
          invoiceItems = parsed.items;
          subtitlePreview = invoiceItems
            .map((i) => `${i.quantity}x ${i.productName}`)
            .join(', ');
        }
      } catch (e) {
        // No es JSON o es una descripción simple
      }
    }

    const iconName = isInvoice
      ? 'receipt-outline'
      : item.type === 'payment'
      ? 'arrow-down-circle'
      : 'arrow-up-circle';
    const iconColor = isInvoice
      ? '#2D8C5A'
      : item.type === 'payment'
      ? '#34C759'
      : '#FF3B30';
    const iconBgColor = isInvoice
      ? '#E8F5EE'
      : item.type === 'payment'
      ? '#E8F9EE'
      : '#FDECEA';

    return (
      <TouchableOpacity style={styles.transactionCard} onPress={() => openDetailsModal(item)} activeOpacity={0.7}>
        <View style={styles.transactionIconContainer}>
          <View style={[styles.iconBg, { backgroundColor: iconBgColor }]}>
            <Ionicons name={iconName} size={26} color={iconColor} />
          </View>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{item.title || item.description}</Text>
          {subtitlePreview ? (
            <Text style={styles.transactionSubDescription} numberOfLines={1}>{subtitlePreview}</Text>
          ) : item.description && item.description !== item.title && !isInvoice ? (
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
  };


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

        <ClientDetailsModals
          modalVisible={modalVisible}
          closeModal={closeModal}
          optionsVisible={optionsVisible}
          setOptionsVisible={setOptionsVisible}
          detailsModalVisible={detailsModalVisible}
          closeDetailsModal={closeDetailsModal}
          transactionOptionsVisible={transactionOptionsVisible}
          setTransactionOptionsVisible={setTransactionOptionsVisible}
          client={client}
          selectedTransaction={selectedTransaction}
          selectedTxForOptions={selectedTxForOptions}
          txMenuPosition={txMenuPosition}
          transactionType={transactionType}
          setTransactionType={setTransactionType}
          amount={amount}
          setAmount={setAmount}
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          editingTransactionId={editingTransactionId}
          saving={saving}
          deleting={deleting}
          handleSaveTransaction={handleSaveTransaction}
          handleDeleteClient={handleDeleteClient}
          handleDeleteTransaction={handleDeleteTransaction}
          openEditModal={openEditModal}
        />
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',

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
  optionsIcon: {
    padding: 6,
    marginTop: 2,
  },
});
