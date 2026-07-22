import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

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

function OnboardingSlide({ item }) {
  return (
    <View style={styles.slideContainer}>
      <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.iconContainer, { backgroundColor: item.bg }]}>
        <Ionicons name={item.icon} size={32} color={item.gradient[0]} />
      </Animated.View>
      <Animated.Text
        entering={FadeInUp.delay(300).duration(500)}
        style={styles.slideTitle}
      >
        {item.title}
      </Animated.Text>
      <Animated.Text
        entering={FadeInUp.delay(400).duration(500)}
        style={styles.slideDesc}
      >
        {item.desc}
      </Animated.Text>
    </View>
  );
}

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
      {/* Hero Image Background */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../assets/images/mujer-en-colmado.png')}
          style={styles.heroImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', '#F8F9FA']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Top Bar inside hero */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeContainer}>
           <Text style={styles.welcomeText}>Bienvenido a</Text>
           <Text style={styles.brandText}>LogiPay</Text>
        </View>
      </View>

      {/* Bottom Sheet Card */}
      <View style={styles.bottomSheet}>
        <FlatList
          ref={flatListRef}
          data={BENEFITS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => <OnboardingSlide item={item} />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          style={styles.flatList}
        />

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

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContinue}
          style={styles.ctaWrapper}
        >
          <LinearGradient
            colors={['#4C669F', '#3B5998']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>
              {isLastSlide ? '¡Comenzar ahora!' : 'Siguiente'}
            </Text>
            <Ionicons 
              name={isLastSlide ? "rocket-outline" : "arrow-forward"} 
              size={20} 
              color="white" 
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  heroContainer: {
    height: SCREEN_HEIGHT * 0.55,
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  welcomeContainer: {
    position: 'absolute',
    bottom: 60,
    left: 24,
  },
  welcomeText: {
    fontSize: 24,
    color: 'white',
    fontWeight: '600',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  brandText: {
    fontSize: 42,
    color: 'white',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -40,
    paddingTop: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  flatList: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#4C669F',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#E5E7EB',
  },
  ctaWrapper: {
    paddingHorizontal: 24,
    marginTop: 10,
  },
  ctaBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
