import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BENEFITS = [
  {
    icon: 'wallet-outline',
    color: '#4C669F',
    bg: '#EEF2FF',
    title: 'Control Total',
    desc: 'Gestiona ingresos, deudas y pagos en un solo lugar con visión en tiempo real.',
  },
  {
    icon: 'people-outline',
    color: '#7C3AED',
    bg: '#F5F0FF',
    title: 'Clientes Organizados',
    desc: 'Mantén un registro claro de cada cliente, su historial y saldo pendiente.',
  },
  {
    icon: 'shield-checkmark-outline',
    color: '#059669',
    bg: '#ECFDF5',
    title: 'Seguro y Confiable',
    desc: 'Tus datos están protegidos con autenticación segura y respaldo en la nube.',
  },
  {
    icon: 'bar-chart-outline',
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'Reportes Claros',
    desc: 'Visualiza el desempeño de tu negocio con resúmenes financieros detallados.',
  },
  {
    icon: 'flash-outline',
    color: '#DC2626',
    bg: '#FFF1F1',
    title: 'Rápido y Sencillo',
    desc: 'Interfaz intuitiva diseñada para que registres operaciones en segundos.',
  },
];

// ─── Benefit Card ────────────────────────────────────────────────────────────
function BenefitCard({ item, index }) {
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  React.useEffect(() => {
    const delay = index * 90;
    translateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 120 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 120 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={[styles.cardIcon, { backgroundColor: item.bg }]}>
        <Ionicons name={item.icon} size={28} color={item.color} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.desc}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const [showBenefits, setShowBenefits] = useState(false);

  // Sheet animation values
  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Hero scale-down when sheet opens
  const heroScale = useSharedValue(1);
  const heroOpacity = useSharedValue(1);

  // Open handler (JS thread — no worklet needed)
  const openBenefits = useCallback(() => {
    heroScale.value = withTiming(0.9, { duration: 350, easing: Easing.out(Easing.cubic) });
    heroOpacity.value = withTiming(0.4, { duration: 350 });
    backdropOpacity.value = withTiming(1, { duration: 400 });
    sheetTranslateY.value = withSpring(0, {
      damping: 22,
      stiffness: 140,
      mass: 0.9,
    });
    setShowBenefits(true);
  }, []);

  // Close handler (JS thread — no worklet needed)
  const closeBenefits = useCallback(() => {
    sheetTranslateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 160 });
    backdropOpacity.value = withTiming(0, { duration: 300 });
    heroScale.value = withTiming(1, { duration: 350 });
    heroOpacity.value = withTiming(1, { duration: 350 });
    setShowBenefits(false);
  }, []);

  const handleContinue = useCallback(() => {
    closeBenefits();
    setTimeout(() => router.push('/login'), 350);
  }, []);

  // Animated styles
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
    opacity: heroOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* ── Hero ── */}
      <Animated.View style={[styles.content, heroStyle]}>
        <View style={styles.iconContainer}>
          <Ionicons name="wallet" size={80} color="#4C669F" />
        </View>
        <Text style={styles.title}>Bienvenido a LogiPay</Text>
        <Text style={styles.subtitle}>
          Tu solución ideal para gestionar pagos, registrar deudas y mantener el control
          financiero de tu negocio u organización de manera sencilla y segura.
        </Text>
      </Animated.View>

      {/* ── Footer Buttons ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={openBenefits}
        >
          <Text style={styles.buttonText}>Comenzar</Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonLogin}
          activeOpacity={0.8}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.buttonTextLogin}>Ya tengo una cuenta</Text>
        </TouchableOpacity>
      </View>

      {/* ── Backdrop ── */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={closeBenefits} />
      </Animated.View>

      {/* ── Benefits Bottom Sheet ── */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>¿Por qué LogiPay?</Text>
            <Text style={styles.sheetSubtitle}>Todo lo que tu negocio necesita</Text>
          </View>
          <Pressable onPress={closeBenefits} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#636366" />
          </Pressable>
        </View>

        {/* Benefit cards */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {showBenefits && BENEFITS.map((item, index) => (
            <BenefitCard key={item.title} item={item} index={index} />
          ))}
        </ScrollView>

        {/* CTA */}
        <View style={styles.sheetFooter}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleContinue} activeOpacity={0.85}>
            <Ionicons name="rocket-outline" size={20} color="white" />
            <Text style={styles.ctaText}>¡Comenzar ahora!</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // ── Hero ──
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 140,
    height: 140,
    backgroundColor: '#E8EDF2',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },

  // ── Footer ──
  footer: {
    padding: 30,
    paddingBottom: 50,
  },
  button: {
    backgroundColor: '#4C669F',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  buttonIcon: { marginLeft: 10 },
  buttonLogin: {
    marginTop: 16,
    height: 56,
    borderRadius: 28,
    borderColor: '#4C669F',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextLogin: {
    color: '#4C669F',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,30,0.55)',
    zIndex: 10,
  },

  // ── Sheet ──
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.88,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 44,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: 0.3,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#636366',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  // ── Scroll ──
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 19,
  },

  // ── Sheet Footer ──
  sheetFooter: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  ctaButton: {
    backgroundColor: '#4C669F',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
