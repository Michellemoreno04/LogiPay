import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { db as firestore } from '../firebaseConfig/config';
import {
  getAllTransactions,
  getClients,
  insertTransaction,
} from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

// ─── Helper: relative time in Spanish ───
function timeAgo(ts) {
  if (!ts) return '';
  const date = ts instanceof Date ? ts : new Date(ts);
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
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Cargar desde SQLite + sincronizar Firebase en background ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribes = [];

    const loadFromSQLite = async () => {
      // 1. Cargar transacciones desde SQLite (fuente de verdad)
      const clients = await getClients(user.uid);
      const clientMap = {};
      clients.forEach((c) => { clientMap[c.id] = c.name; });

      const txs = await getAllTransactions(user.uid, 200);
      const hydrated = txs.map((tx) => ({
        ...tx,
        clientName: tx.clientName || clientMap[tx.clientId] || 'Sin nombre',
        _date: new Date(tx.createdAt),
      }));

      if (isMounted) {
        setTransactions(hydrated);
        setLoading(false);
      }
    };

    const syncFromFirebase = async () => {
      // 2. Intentar sincronizar outbox
      syncOutbox().catch(console.error);

      // 3. Escuchar Firebase para sincronizar datos de otros dispositivos
      const clients = await getClients(user.uid);

      clients.forEach((client) => {
        try {
          const txQ = query(
            collection(firestore, 'users', user.uid, 'clients', client.id, 'transactions'),
            orderBy('createdAt', 'desc')
          );
          const unsub = onSnapshot(txQ, async (snap) => {
            if (!isMounted) return;
            // Guardar en SQLite (INSERT OR REPLACE no duplica)
            for (const docSnap of snap.docs) {
              const data = docSnap.data();
              await insertTransaction(user.uid, {
                id: docSnap.id,
                clientId: client.id,
                type: data.type,
                amount: data.amount,
                title: data.title || data.description || '',
                description: data.description || '',
                date: data.createdAt?.toDate
                  ? data.createdAt.toDate().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '',
                createdAt: data.createdAt?.toMillis?.() || Date.now(),
              });
            }
            // Recargar desde SQLite
            await loadFromSQLite();
          }, (err) => {
            console.warn('[AllTx] Firebase listener offline for client', client.id, err.code);
          });
          unsubscribes.push(unsub);
        } catch (e) {
          console.warn('[AllTx] Firebase listener error:', e);
        }
      });
    };

    const init = async () => {
      await loadFromSQLite();
      syncFromFirebase().catch(console.error);
    };

    init();

    // Escuchar cambios locales (ej. nueva transacción agregada desde [id].jsx)
    const sub = DeviceEventEmitter.addListener('local-db-changed', loadFromSQLite);

    return () => {
      isMounted = false;
      unsubscribes.forEach((fn) => fn());
      sub.remove();
    };
  }, [user]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.activityItem}
      activeOpacity={0.7}
      onPress={() => item.clientId !== 'global' && router.push(`/${item.clientId}`)}
    >
      <View style={[
        styles.activityIconBg,
        { backgroundColor: item.type === 'payment' ? '#E8F9EE' : '#FDECEA' },
      ]}>
        <Ionicons
          name={item.type === 'payment' ? 'add-circle' : 'remove-circle'}
          size={24}
          color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
        />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={1}>
          {item.clientName || 'Sin nombre'}
        </Text>
        <Text style={styles.activityDescription} numberOfLines={1}>
          {item.title || item.description || '—'}
        </Text>
        <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={[
        styles.activityAmount,
        { color: item.type === 'payment' ? '#34C759' : '#FF3B30' },
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
