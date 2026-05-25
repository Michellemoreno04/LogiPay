import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BENEFITS = [
  {
    icon: 'wallet-outline',
    gradient: ['#4C669F', '#3B5998'],
    bg: '#EEF2FF',
    title: 'Control Total',
    desc: 'Gestiona ingresos, deudas y pagos en un solo lugar con visión en tiempo real de tu negocio.',
  },
  {
    icon: 'people-outline',
    gradient: ['#7C3AED', '#6D28D9'],
    bg: '#F5F0FF',
    title: 'Clientes Organizados',
    desc: 'Mantén un registro claro de cada cliente, su historial completo y saldo pendiente.',
  },
  {
    icon: 'shield-checkmark-outline',
    gradient: ['#059669', '#047857'],
    bg: '#ECFDF5',
    title: 'Seguro y Confiable',
    desc: 'Tus datos están protegidos con autenticación segura y respaldo en la nube automático.',
  },
  {
    icon: 'bar-chart-outline',
    gradient: ['#D97706', '#B45309'],
    bg: '#FFFBEB',
    title: 'Reportes Claros',
    desc: 'Visualiza el desempeño de tu negocio con resúmenes financieros detallados y fáciles de entender.',
  },
  {
    icon: 'flash-outline',
    gradient: ['#DC2626', '#B91C1C'],
    bg: '#FFF1F1',
    title: 'Rápido y Sencillo',
    desc: 'Interfaz intuitiva diseñada para que registres operaciones en solo segundos, sin complicaciones.',
  },
];

// ─── Full-screen Onboarding Slide ────────────────────────────────────────────
function OnboardingSlide({ item, index, currentIndex }) {
  return (
    <View style={styles.slideContainer}>
      <View style={styles.slideContent}>
        {/* Icon circle */}
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <LinearGradient
            colors={item.gradient}
            style={styles.slideIconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={item.icon} size={40} color="white" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInUp.delay(350).duration(500)}
          style={styles.slideTitle}
        >
          {item.title}
        </Animated.Text>

        {/* Description */}
        <Animated.Text
          entering={FadeInUp.delay(450).duration(500)}
          style={styles.slideDesc}
        >
          {item.desc}
        </Animated.Text>

        {/* Feature indicator */}
        <Animated.View
          entering={FadeIn.delay(550).duration(400)}
          style={[styles.featureBadge, { backgroundColor: item.bg }]}
        >
          <Ionicons name="checkmark-circle" size={16} color={item.gradient[0]} />
          <Text style={[styles.featureBadgeText, { color: item.gradient[0] }]}>
            Incluido en LogiPay
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Main Onboarding Screen ──────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef(null);

  const handleContinue = useCallback(() => {
    if (currentSlide < BENEFITS.length - 1) {
      const nextIndex = currentSlide + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentSlide(nextIndex);
    } else {
      // Last slide — navigate to login
      router.push('/loginScreen');
    }
  }, [currentSlide]);

  const handleSkip = useCallback(() => {
    router.push('/loginScreen');
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentSlide(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLastSlide = currentSlide === BENEFITS.length - 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E8EEFF', '#F0F2F8', '#F8F9FA']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Decorative elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#4C669F" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Descubre LogiPay</Text>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable slides */}
      <FlatList
        ref={flatListRef}
        data={BENEFITS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        renderItem={({ item, index }) => (
          <OnboardingSlide
            item={item}
            index={index}
            currentIndex={currentSlide}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={styles.flatList}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {BENEFITS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentSlide === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContinue}
        >
          <LinearGradient
            colors={isLastSlide
              ? ['#4C669F', '#3B5998']
              : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            {isLastSlide ? (
              <>
                <Ionicons name="rocket-outline" size={20} color="white" />
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>¡Comenzar ahora!</Text>
              </>
            ) : (
              <>
                <Text style={styles.ctaText}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Swipe hint */}
        {!isLastSlide && (
          <Text style={styles.swipeHint}>
            Desliza para ver más →
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // ── Decorative ──
  decorCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(76, 102, 159, 0.08)',
    top: -60,
    right: -100,
  },
  decorCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
    bottom: 100,
    left: -60,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 102, 159, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4C669F',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.06)',
  },
  skipText: {
    fontSize: 14,
    color: '#4C669F',
    fontWeight: '600',
  },

  // ── FlatList ──
  flatList: {
    flex: 1,
  },

  // ── Slide ──
  slideContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideContent: {
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.05)',
  },
  slideIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  slideTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4C669F',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  slideDesc: {
    fontSize: 16,
    color: '#4C669F',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  featureBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Pagination ──
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#4C669F',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#4C669F',
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    paddingTop: 8,
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: SCREEN_WIDTH - 48,
    borderWidth: 1,
    borderColor: '#4C669F',
  },
  ctaText: {
    color: '#4C669F',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swipeHint: {
    fontSize: 13,
    color: '#4C669F',
    marginTop: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
