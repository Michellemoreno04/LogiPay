import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../authContext/authContext';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import { useEffect, useState, useMemo } from 'react';
import OrganisazionScreen from '../organisazionScreen';
import ComercialScreen from '../comercialScreen';

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

export default function HomeScreen() {
  const { user, userData } = useAuth();

  const [clients, setClients] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // ─── 1. Real-time listener for clients list ───
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'clients'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setClients(data);
    });

    return () => unsubscribe();
  }, [user]);

  // ─── 2. Real-time listeners for recent transactions per client ───
  useEffect(() => {
    if (!user) return;

    if (clients.length === 0) {
      setRecentActivity([]);
      setLoadingActivity(false);
      return;
    }

    const unsubscribes = [];
    // Store transactions grouped by clientId so each listener can update its slice
    const txByClient = {};

    clients.forEach((client) => {
      const txQ = query(
        collection(db, 'users', user.uid, 'clients', client.id, 'transactions'),
        orderBy('createdAt', 'desc'),
        limit(5)
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
            // Keep the Firestore timestamp for sorting
            _timestamp: data.createdAt?.toMillis?.() || 0,
            // Convert to Date for display
            _date: data.createdAt?.toDate?.() || null,
          });
        });
        txByClient[client.id] = txs;

        // Merge all client transactions, sort by newest, take top 10
        const merged = Object.values(txByClient).flat();
        merged.sort((a, b) => b._timestamp - a._timestamp);
        setRecentActivity(merged.slice(0, 10));
        setLoadingActivity(false);
      }, (error) => {
        console.error('Error fetching transactions for client', client.id, error);
        setLoadingActivity(false);
      });

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach((fn) => fn());
  }, [user, clients]);

  // ─── Render a single activity item ───
  const renderActivityItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.activityItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/user/${item.clientId}`)}
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
          {item.type === 'payment' ? 'Pago de' : 'Deuda de'} {item.clientName}
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.welcome}>{userData?.businessName}</Text>
          <Text style={styles.subtitle}>Aquí tienes un resumen de hoy. {userData?.businessType}</Text>
        </View>

        <View style={styles.statsGrid}>
          {userData?.businessType === 'organization' ? (
            <OrganisazionScreen userData={userData} />
          ) : userData?.businessType === 'comercial' ? (
            <>
              <ComercialScreen userData={userData} />
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4C669F" />
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="receipt-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyText}>No hay actividad reciente.</Text>
              <Text style={styles.emptySubText}>Las transacciones de tus clientes aparecerán aquí.</Text>
            </View>
          ) : (
            recentActivity.map(renderActivityItem)
          )}
        </View>
      </ScrollView>

      <Link href="/add-user" asChild>
        <TouchableOpacity style={styles.fab}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { padding: 20, paddingTop: 30 },
  welcome: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  subtitle: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
  statsGrid: { flexDirection: 'row', padding: 10, justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    margin: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#1C1C1E' },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  activityDescription: { fontSize: 13, color: '#636366', marginTop: 2 },
  activityTime: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  activityAmount: { fontSize: 16, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4C669F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
