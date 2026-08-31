import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { db as firestore } from '../firebaseConfig/config';
import {
  getClients,
  getRecentActivity,
  insertTransaction,
  insertSale,
} from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

// ─── Filter options ───
const FILTERS = [
  { key: 'today', label: 'Hoy' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all',   label: 'Todo' },
];

// ─── Filter helper ───
function filterByDate(txs, filter) {
  const now = new Date();
  return txs.filter((tx) => {
    const d = tx._date instanceof Date ? tx._date : new Date(tx.createdAt);
    if (filter === 'today') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()   === now.getMonth()    &&
             d.getDate()    === now.getDate();
    }
    if (filter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (filter === 'month') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()   === now.getMonth();
    }
    return true; // 'all'
  });
}

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
  const [activeFilter, setActiveFilter] = useState('today');

  const filtered = useMemo(() => filterByDate(transactions, activeFilter), [transactions, activeFilter]);

  // ─── Cargar desde SQLite + sincronizar Firebase en background ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribes = [];

    const loadFromSQLite = async () => {
      // Usar getRecentActivity que combina transacciones + ventas
      const rows = await getRecentActivity(user.uid, 300);
      const hydrated = rows.map((row) => ({
        ...row,
        _date: new Date(row.createdAt),
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

    // Escuchar cambios locales
    const sub = DeviceEventEmitter.addListener('local-db-changed', loadFromSQLite);
    const subSales = DeviceEventEmitter.addListener('sales-db-changed', loadFromSQLite);

    return () => {
      isMounted = false;
      unsubscribes.forEach((fn) => fn());
      sub.remove();
      subSales.remove();
    };
  }, [user]);

  const renderItem = ({ item }) => {
    const isSale    = item.type === 'sale';
    const isPayment = item.type === 'payment';

    const palette = isSale
      ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
      : isPayment
      ? { bg: '#E8F9EE', icon: '#34C759', text: '#34C759' }
      : { bg: '#FDECEA', icon: '#FF3B30', text: '#FF3B30' };

    const iconName = isSale
      ? 'cart'
      : isPayment ? 'add-circle' : 'remove-circle';

    const badgeLabel = isSale ? 'Venta' : isPayment ? 'Abono' : 'Cargo';
    const amountPrefix = isSale ? '' : isPayment ? '+' : '-';

    const title = isSale
      ? (item.clientName || 'Venta al contado')
      : (item.clientName || 'Sin nombre');

    const subtitle = isSale
      ? `🛒 ${item.description || item.productName || 'Producto'}`
      : (item.title || item.description || '—');

    return (
      <TouchableOpacity
        style={styles.activityItem}
        activeOpacity={0.7}
        onPress={() => item.clientId && item.clientId !== 'global' && router.push(`/${item.clientId}`)}
      >
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: palette.icon }]} />

        <View style={[styles.activityIconBg, { backgroundColor: palette.bg }]}>
          <Ionicons name={iconName} size={22} color={palette.icon} />
        </View>

        <View style={styles.activityInfo}>
          <Text style={styles.activityText} numberOfLines={1}>{title}</Text>
          <Text style={styles.activityDescription} numberOfLines={1}>{subtitle}</Text>
          <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.activityAmount, { color: palette.text }]}>
            {amountPrefix}${item.amount?.toFixed(2) || '0.00'}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.typeText, { color: palette.text }]}>{badgeLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Todos los movimientos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Filter Tabs ─── */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, activeFilter === f.key && styles.filterPillActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, activeFilter === f.key && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4C669F" />
          <Text style={styles.loadingText}>Cargando transacciones...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#C7C7CC" />
          <Text style={styles.emptyText}>Sin movimientos</Text>
          <Text style={styles.emptySubText}>No hay transacciones para este período</Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <FlashList
            data={filtered}
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
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F2F2F7',
  },
  filterWrapper: {
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  filterPillActive: {
    backgroundColor: '#4C669F',
    borderColor: '#4C669F',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
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
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  activityIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1F4B',
  },
  activityDescription: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#AEAEB2',
    marginTop: 4,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
