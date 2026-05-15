import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../authContext/authContext';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig/config';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OrganisazionScreen from '../organisazionScreen';
import ComercialScreen from '../comercialScreen';
import ActivityItem from '../../components/ActivityItem';
import AdjustModal from '../../components/AdjustModal';
import { TourZone, useTour } from 'react-native-lumen';



export default function HomeScreen() {
  const { user, userData } = useAuth();

  const { start } = useTour();

  useEffect(() => {
    const checkTour = async () => {
      if (!user) return;
      try {
        const hasSeenTour = await AsyncStorage.getItem(`hasSeenTour_${user.uid}`);
        if (hasSeenTour !== 'true') {
          setTimeout(() => {
            start();
            AsyncStorage.setItem(`hasSeenTour_${user.uid}`, 'true');
          }, 500);
        }
      } catch (error) {
        console.error('Error handling tour status:', error);
      }
    };

    checkTour();
  }, [user, start]);

  const [clients, setClients] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const [adjustModalVisible, setAdjustModalVisible] = useState(false);

  const openAdjustModal = () => {
    setAdjustModalVisible(true);
  };


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
        setRecentActivity(merged.slice(0, 5));
        setLoadingActivity(false);
      }, (error) => {
        console.error('Error fetching transactions for client', client.id, error);
        setLoadingActivity(false);
      });

      unsubscribes.push(unsub);
    });

    // Listener para transacciones globales (ajustes)
    const globalTxQ = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(5)
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
          _date: data.createdAt?.toDate?.() || null,
        });
      });
      txByClient['global'] = txs;

      const merged = Object.values(txByClient).flat();
      merged.sort((a, b) => b._timestamp - a._timestamp);
      setRecentActivity(merged.slice(0, 5));
    }, (error) => {
      console.error('Error fetching global transactions', error);
    });
    unsubscribes.push(globalUnsub);

    return () => unsubscribes.forEach((fn) => fn());
  }, [user, clients]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.welcome} numberOfLines={1} adjustsFontSizeToFit>
              {userData?.businessName || 'Tu Negocio'}
            </Text>
          </View>
          <View style={styles.badgeContainer}>
            <View style={styles.businessBadge}>
              <Text style={styles.businessTypeTag}>{userData?.businessType || 'Comercial'}</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Aquí tienes un resumen de hoy.</Text>
        </View>

        <TourZone
          stepKey="step-2"
          name="Resumen Financiero"
          description="Aquí puedes ver el total de tus finanzas."
          order={1}
          borderRadius={16}
        >
          <View style={styles.statsGrid}>
            {userData?.businessType === 'organization' ? (
              <OrganisazionScreen userData={userData} onAdjust={openAdjustModal} />
            ) : userData?.businessType === 'comercial' ? (
              <>
                <ComercialScreen userData={userData} onAdjust={openAdjustModal} />
              </>
            ) : null}
          </View>
        </TourZone>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actividad Reciente</Text>
            <TouchableOpacity onPress={() => router.push('/all-transactions')}>
              <Text style={styles.viewMoreText}>Ver más</Text>
            </TouchableOpacity>
          </View>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4C669F" />
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="receipt-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyText}>Aun no tienes actividad.</Text>
              <Text style={styles.emptySubText}>Los registros de tus los usuarios aparecerán aquí.</Text>
            </View>
          ) : (
            recentActivity.map((item) => <ActivityItem key={item.id} item={item} />)
          )}
        </View>
      </ScrollView>

      {/* ─── Ajuste Modal ─── */}
      <AdjustModal
        visible={adjustModalVisible}
        onClose={() => setAdjustModalVisible(false)}
        userData={userData}
        user={user}
      />



      <TourZone
        stepKey="step-1"
        name="Agregar Cliente"
        description="Aquí puedes agregar tus clientes."
        order={2}
        shape="circle"
        style={styles.fabContainer}
      >
        <Link href="/add-user" asChild>
          <TouchableOpacity style={styles.fabButton}>
            <FontAwesome6 name="user-plus" size={24} color="white" />
          </TouchableOpacity>
        </Link>
      </TourZone>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', marginTop: 30 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '800',
    color: '#04047ab1',
    letterSpacing: -0.5,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  businessBadge: {
    backgroundColor: '#E5EFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  subtitle: { fontSize: 16, color: '#8E8E93' },
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
  businessTypeTag: {
    fontSize: 12,
    color: '#4C669F',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E' },
  viewMoreText: { fontSize: 14, color: '#4C669F', fontWeight: '600' },
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
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
  },
  fabButton: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
});
