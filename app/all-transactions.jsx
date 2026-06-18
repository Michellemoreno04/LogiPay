import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { useLocalData } from '../context/LocalDataContext';
import { db } from '../firebaseConfig/config';

// ─── Helper: relative time in Spanish ───
function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function AllTransactionsScreen() {
  const { user } = useAuth();
  const { pendingOpsRef } = useLocalData();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);

  const { getCache, setCache } = require('../utils/database');
  const { syncOutbox } = require('../utils/syncEngine');

  // 1. Fetch all clients first
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribe = null;

    const init = async () => {
      syncOutbox();
      const cached = await getCache(`clients_${user.uid}`);
      if (cached && isMounted) setClients(cached);

      const q = query(collection(db, 'users', user.uid, 'clients'));
      unsubscribe = onSnapshot(q, (snap) => {
        const data = [];
        snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        if (isMounted) {
          setClients(data);
          setCache(`clients_${user.uid}`, data);
        }
      });
    };
    init();
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // 2. Listen to all transactions for all clients + global
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    if (clients.length === 0) {
      // Still might have global transactions
    }

    const unsubscribes = [];
    const txByClient = {};

    const initTransactions = async () => {
      const cachedTxs = await getCache(`allTx_${user.uid}`);
      if (cachedTxs && isMounted) {
        const hydrated = cachedTxs.map(tx => ({
          ...tx,
          _date: tx._timestamp ? new Date(tx._timestamp) : null
        }));
        setTransactions(hydrated);
        setLoading(false);
      }

      const updateMerged = () => {
        let merged = Object.values(txByClient).flat();

        if (pendingOpsRef && pendingOpsRef.current) {
          // 1. Remove deleted
          merged = merged.filter(tx => !pendingOpsRef.current.deletedTxIds.has(tx.id));
          // 2. Apply updates
          merged = merged.map(tx => pendingOpsRef.current.updatedTxs[tx.id] || tx);
          // 3. Apply adds
          const existingIds = new Set(merged.map(tx => tx.id));
          Object.values(pendingOpsRef.current.addedTxs).forEach(tx => {
            if (!existingIds.has(tx.id)) {
              merged.push(tx);
            }
          });
        }

        merged.sort((a, b) => b._timestamp - a._timestamp);
        if (isMounted) {
          setTransactions(merged.map(tx => ({ ...tx, _date: new Date(tx._timestamp) })));
          setLoading(false);
          setCache(`allTx_${user.uid}`, merged);
        }
      };

      // Listen to each client's transactions
      clients.forEach((client) => {
        const txQ = query(
          collection(db, 'users', user.uid, 'clients', client.id, 'transactions'),
          orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(txQ, (snap) => {
          const txs = [];
          snap.forEach((doc) => {
            const data = doc.data();
            txs.push({
              id: doc.id,
              ...data,
              clientName: client.name || 'Sin nombre',
              clientId: client.id,
              _timestamp: data.createdAt?.toMillis?.() || 0,
            });
          });
          txByClient[client.id] = txs;
          updateMerged();
        }, (error) => {
          console.error('Error fetching transactions for client', client.id, error);
        });
        unsubscribes.push(unsub);
      });

      // Listen to global transactions (adjustments)
      const globalTxQ = query(
        collection(db, 'users', user.uid, 'transactions'),
        orderBy('createdAt', 'desc')
      );
      const globalUnsub = onSnapshot(globalTxQ, (snap) => {
        const txs = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          txs.push({
            id: docSnap.id,
            ...data,
            clientName: 'Ajuste de Total',
            clientId: 'global',
            _timestamp: data.createdAt?.toMillis?.() || 0,
          });
        });
        txByClient['global'] = txs;
        updateMerged();
      }, (error) => {
        console.error('Error fetching global transactions', error);
      });
      unsubscribes.push(globalUnsub);
    };

    initTransactions();

    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('local-db-changed', () => {
      initTransactions();
    });

    return () => {
      isMounted = false;
      unsubscribes.forEach((fn) => fn());
      sub.remove();
    };
  }, [user, clients]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.activityItem}
      activeOpacity={0.7}
      onPress={() => item.clientId !== 'global' && router.push(`/${item.clientId}`)}
    >
      <View style={[
        styles.activityIconBg,
        { backgroundColor: item.type === 'payment' ? '#E8F9EE' : '#FDECEA' }
      ]}>
        <Ionicons
          name={item.type === 'payment' ? 'add-circle' : 'remove-circle'}
          size={24}
          color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
        />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Text style={styles.activityDescription} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.activityTime}>{timeAgo(item._date)}</Text>
      </View>
      <Text style={[
        styles.activityAmount,
        { color: item.type === 'payment' ? '#34C759' : '#FF3B30' }
      ]}>
        {item.type === 'payment' ? '+' : '-'}${item.amount?.toFixed(2) || '0.00'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Todos los movimientos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4C669F" />
          <Text style={styles.loadingText}>Cargando transacciones...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#C7C7CC" />
          <Text style={styles.emptyText}>No hay movimientos aún</Text>
          <Text style={styles.emptySubText}>Tus transacciones aparecerán aquí</Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <FlashList
            data={transactions}
            renderItem={renderItem}
            estimatedItemSize={90}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F2F2F7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  activityIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 15,
  },
  activityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  activityDescription: {
    fontSize: 14,
    color: '#636366',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  activityAmount: {
    fontSize: 17,
    fontWeight: 'bold',
  },
});
