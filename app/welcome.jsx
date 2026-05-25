import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Decorative Background ── */}
      <View style={styles.bgDecoration}>
        <LinearGradient
          colors={['#E8EEFF', '#F0F2F8', '#F8F9FA']}
          style={styles.bgGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.bgCircle3} />
      </View>

      {/* ── Hero ── */}
      <View style={styles.content}>
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.iconContainer}
        >
          <LinearGradient
            colors={['#4C669F', '#3B5998', '#35519fff']}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="wallet" size={56} color="white" />
          </LinearGradient>
          {/* Glowing ring */}
          <View style={styles.glowRing} />
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(400).duration(600)}
          style={styles.title}
        >
          Bienvenido a{'\n'}
          <Text style={styles.titleAccent}>LogiPay</Text>
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(550).duration(600)}
          style={styles.subtitle}
        >
          Tu solución ideal para gestionar pagos, registrar deudas y mantener el control
          financiero de tu negocio u organización.
        </Animated.Text>

        {/* Mini feature pills */}
        <Animated.View
          entering={FadeInUp.delay(700).duration(500)}
          style={styles.featurePills}
        >
          {['Pagos', 'Clientes', 'Reportes'].map((label, i) => (
            <View key={label} style={styles.pill}>
              <Ionicons
                name={['card-outline', 'people-outline', 'stats-chart-outline'][i]}
                size={14}
                color="#4C669F"
              />
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── Footer Buttons ── */}
      <Animated.View
        entering={FadeInUp.delay(800).duration(500)}
        style={styles.footer}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/onboarding')}
        >
          <LinearGradient
            colors={['#4C669F', '#3B5998', '#192f6a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Comenzar</Text>
            <View style={styles.buttonArrow}>
              <Ionicons name="arrow-forward" size={18} color="#4C669F" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonLogin}
          activeOpacity={0.8}
          onPress={() => router.push('/loginScreen')}
        >
          <Text style={styles.buttonTextLogin}>Ya tengo una cuenta</Text>
        </TouchableOpacity>
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

  // ── Background Decoration ──
  bgDecoration: {
    ...StyleSheet.absoluteFillObject,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(76, 102, 159, 0.06)',
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(76, 102, 159, 0.04)',
    bottom: 200,
    left: -60,
  },
  bgCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.04)',
    top: 200,
    left: 40,
  },

  // ── Hero ──
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#192f6a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  glowRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(76, 102, 159, 0.12)',
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    color: '#1A1F4B',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 42,
  },
  titleAccent: {
    fontWeight: '900',
    color: '#4C669F',
    fontSize: 38,
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
    marginBottom: 24,
  },

  // ── Feature Pills ──
  featurePills: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.12)',
  },
  pillText: {
    fontSize: 13,
    color: '#4C669F',
    fontWeight: '600',
  },

  // ── Footer ──
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
  },
  button: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#192f6a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLogin: {
    marginTop: 14,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  buttonTextLogin: {
    color: '#4C669F',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
