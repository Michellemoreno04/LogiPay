import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SnappySpringConfig, TourProvider, TourZone, useTour } from 'react-native-lumen';
import { useAuth } from '../../authContext/authContext';
import ActivityItem from '../../components/ActivityItem';

import StatsCards from '../../components/StatsCards';
import { useLocalData } from '../../context/LocalDataContext';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <TourProvider
      stepsOrder={['step-1']}
      config={{
        springConfig: SnappySpringConfig,
        enableGlow: true,
        preventInteraction: true,
        labels: { finish: 'Entendido' },
        renderCard: () => null,
      }}
    >
      <HomeScreenContent />
    </TourProvider>
  );
}


function HomeScreenContent() {
  const { user, userData, updateUserData } = useAuth();
  const { start, currentStep, next, stop, steps, orderedStepKeys, scrollViewRef } = useTour();
  const { recentActivity } = useLocalData();

  // ─── Date filter for activity ───
  const ACTIVITY_FILTERS = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'all', label: 'Todo' },
  ];
  const [activityFilter, setActivityFilter] = useState('today');

  const filteredActivity = useMemo(() => {
    const now = new Date();
    return recentActivity.filter((item) => {
      const d = item.createdAt ? new Date(item.createdAt) : null;
      if (!d) return activityFilter === 'all';
      if (activityFilter === 'today') {
        return d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
      }
      if (activityFilter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (activityFilter === 'month') {
        return d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth();
      }
      return true;
    });
  }, [recentActivity, activityFilter]);

  const [businessTypeMenuVisible, setBusinessTypeMenuVisible] = useState(false);

  const handleChangeBusinessType = async (type) => {
    setBusinessTypeMenuVisible(false);
    if (type === userData?.businessType) return;
    try {
      await updateUserData({ businessType: type });
    } catch (e) {
      console.error('Error updating businessType:', e);
    }
  };

  const [loadingActivity, setLoadingActivity] = useState(false);
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


  // ─── Get greeting based on time of day ───
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── Custom Tour Tooltip (positioned at top) ─── */}
      {currentStep != null && steps[currentStep] && (() => {
        const stepData = steps[currentStep];
        const currentIdx = orderedStepKeys.indexOf(currentStep);
        const isLast = currentIdx === orderedStepKeys.length - 1;
        return (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 64 : 48,
              left: 16,
              right: 16,
              zIndex: 9999,
              backgroundColor: '#fff',
              borderRadius: 18,
              padding: 20,
              shadowColor: '#1A1F4B',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
              elevation: 24,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1F4B', marginBottom: 6 }}>
              {stepData.name}
            </Text>
            <Text style={{ fontSize: 14, color: '#555', lineHeight: 21, marginBottom: 18 }}>
              {stepData.description}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={isLast ? stop : next}
                style={{
                  backgroundColor: '#4C669F',
                  paddingHorizontal: 22,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {isLast ? 'Entendido' : 'Siguiente'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      <ScrollView
        ref={scrollViewRef}
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
              <TouchableOpacity
                style={styles.businessBadge}
                onPress={() => setBusinessTypeMenuVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={userData?.businessType === 'organization' ? 'business' : 'storefront'}
                  size={14}
                  color="#A8C0FF"
                />
                <Text style={styles.businessTypeTag}>
                  {userData?.businessType === 'organization' ? 'Organización' : 'Comercial'}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#A8C0FF" />
              </TouchableOpacity>
            </View>

            {/* ─── Dropdown de tipo de negocio ─── */}
            <Modal
              visible={businessTypeMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setBusinessTypeMenuVisible(false)}
            >
              <TouchableOpacity
                style={styles.menuOverlay}
                activeOpacity={1}
                onPress={() => setBusinessTypeMenuVisible(false)}
              >
                <View style={styles.menuCard}>
                  <Text style={styles.menuTitle}>Tipo de Negocio</Text>
                  <TouchableOpacity
                    style={[
                      styles.menuOption,
                      userData?.businessType === 'organization' && styles.menuOptionActive,
                    ]}
                    onPress={() => handleChangeBusinessType('organization')}
                  >
                    <Ionicons
                      name="business"
                      size={18}
                      color={userData?.businessType === 'organization' ? '#4C669F' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.menuOptionText,
                        userData?.businessType === 'organization' && styles.menuOptionTextActive,
                      ]}
                    >
                      Organización
                    </Text>
                    {userData?.businessType === 'organization' && (
                      <Ionicons name="checkmark-circle" size={18} color="#4C669F" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.menuOption,
                      userData?.businessType !== 'organization' && styles.menuOptionActive,
                    ]}
                    onPress={() => handleChangeBusinessType('commercial')}
                  >
                    <Ionicons
                      name="storefront"
                      size={18}
                      color={userData?.businessType !== 'organization' ? '#4C669F' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.menuOptionText,
                        userData?.businessType !== 'organization' && styles.menuOptionTextActive,
                      ]}
                    >
                      Comercial
                    </Text>
                    {userData?.businessType !== 'organization' && (
                      <Ionicons name="checkmark-circle" size={18} color="#4C669F" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
            <Text style={styles.subtitle}>Aquí tienes un resumen de hoy</Text>
          </Animated.View>
        </LinearGradient>

        {/* ─── Stats Cards ─── */}
        <View style={styles.cardsContainer}>
          <TourZone
            stepKey="step-1"
            name="Resumen Financiero"
            description="Aquí puedes ver el total de tus finanzas y llevar el control de tus ingresos."
            order={1}
            borderRadius={20}
          >
            <View style={styles.statsGrid}>
              {!userData ? (
                // Tarjeta esqueleto mientras cargan los datos
                <View style={styles.skeletonCard}>
                  <ActivityIndicator size="small" color="#4C669F" />
                </View>
              ) : (
                <StatsCards userData={userData} />
              )}
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

          {/* ─── Filter Pills ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityFilterRow}
            style={styles.activityFilterScroll}
          >
            {ACTIVITY_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.activityFilterPill,
                  activityFilter === f.key && styles.activityFilterPillActive,
                ]}
                onPress={() => setActivityFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.activityFilterText,
                    activityFilter === f.key && styles.activityFilterTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4C669F" />
              <Text style={styles.loadingText}>Cargando actividad...</Text>
            </View>
          ) : filteredActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="receipt-outline" size={36} color="#4C669F" />
              </View>
              <Text style={styles.emptyText}>Sin actividad</Text>
              <Text style={styles.emptySubText}>
                No hay registros para este período.
              </Text>
            </View>
          ) : (
            filteredActivity.map((item) => <ActivityItem key={item.id} item={item} />)
          )}
        </View>
      </ScrollView>



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

  // ─── Business Type Menu ───
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: 280,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  menuOptionActive: {
    backgroundColor: '#EEF2FF',
  },
  menuOptionText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '600',
  },
  menuOptionTextActive: {
    color: '#1A1F4B',
    fontWeight: '700',
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
    flexDirection: 'column',
  },
  skeletonCard: {
    flex: 1,
    margin: 4,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
  // ─── Activity Filter Pills ───
  activityFilterScroll: {
    marginBottom: 14,
  },
  activityFilterRow: {
    gap: 8,
    flexDirection: 'row',
    paddingRight: 4,
  },
  activityFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  activityFilterPillActive: {
    backgroundColor: '#4C669F',
    borderColor: '#4C669F',
  },
  activityFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activityFilterTextActive: {
    color: '#FFFFFF',
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
