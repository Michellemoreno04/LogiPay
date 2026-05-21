import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TourZone, useTour } from 'react-native-lumen';
import { useAuth } from '../../authContext/authContext';
import ActivityItem from '../../components/ActivityItem';
import AdjustModal from '../../components/AdjustModal';
import { db } from '../../firebaseConfig/config';
import ComercialScreen from '../comercialScreen';
import OrganisazionScreen from '../organisazionScreen';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, userData } = useAuth();
  const { start } = useTour();

  // ─── FAB animation ───
  const fabScale = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fabScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const checkTour = async () => {
      if (!user) return;

      try {
        const hasSeenTour = await AsyncStorage.getItem(`hasSeenTour_${user.uid}`);
        if (hasSeenTour !== 'true') {

          setTimeout(() => {
            start();
            AsyncStorage.setItem(`hasSeenTour_${user.uid}`, 'true');
          }, 1000);

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

  // ─── Get greeting based on time of day ───
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Gradient Header ─── */}
        <LinearGradient
          colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <Animated.View
            style={[
              styles.headerContent,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerSlide }],
              },
            ]}
          >
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.businessName} numberOfLines={1} adjustsFontSizeToFit>
              {userData?.businessName || 'Tu Negocio'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.businessBadge}>
                <Ionicons
                  name={userData?.businessType === 'organization' ? 'business' : 'storefront'}
                  size={14}
                  color="#A8C0FF"
                />
                <Text style={styles.businessTypeTag}>
                  {userData?.businessType === 'organization' ? 'Organización' : 'Comercial'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Aquí tienes un resumen de hoy</Text>
          </Animated.View>
        </LinearGradient>

        {/* ─── Stats Cards ─── */}
        <View style={styles.cardsContainer}>
          <TourZone
            stepKey="step-2"
            name="Resumen Financiero"
            description="Aquí puedes ver el total de tus finanzas."
            order={2}
            borderRadius={20}
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
        </View>

        {/* ─── Recent Activity ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}>
                <Ionicons name="time-outline" size={18} color="#4C669F" />
              </View>
              <Text style={styles.sectionTitle}>Actividad Reciente</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/all-transactions')}
              style={styles.viewMoreBtn}
            >
              <Text style={styles.viewMoreText}>Ver más</Text>
              <Ionicons name="chevron-forward" size={16} color="#4C669F" />
            </TouchableOpacity>
          </View>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4C669F" />
              <Text style={styles.loadingText}>Cargando actividad...</Text>
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="receipt-outline" size={36} color="#4C669F" />
              </View>
              <Text style={styles.emptyText}>Aún no tienes actividad</Text>
              <Text style={styles.emptySubText}>
                Los registros de tus usuarios aparecerán aquí.
              </Text>
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

      {/* ─── FAB ─── */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TourZone
          stepKey="step-1"
          name="Agregar Cliente"
          description="Aquí puedes agregar tus clientes."
          order={1}
          shape="circle"
          borderRadius={16}
        >
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => router.push('/add-user')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#4C669F', '#3B5998', '#192f6a']}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <FontAwesome6 name="user-plus" size={22} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </TourZone>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F8',
  },

  // ─── Header ───
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    paddingBottom: 50,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -40,
    right: -60,
  },
  decorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -20,
    left: -30,
  },
  headerContent: {
    zIndex: 1,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  businessTypeTag: {
    fontSize: 12,
    color: '#C8D6FF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },

  // ─── Stats Cards ───
  cardsContainer: {
    marginTop: -30,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // ─── Section ───
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1F4B',
    letterSpacing: -0.3,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#E8EEFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewMoreText: {
    fontSize: 13,
    color: '#4C669F',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EDF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1F4B',
    marginTop: 14,
  },
  emptySubText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  // ─── FAB ───
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fabButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    shadowColor: '#192f6a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
  },
});
