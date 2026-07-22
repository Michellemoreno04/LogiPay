import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAppleAuth } from '../authContext/appleAuth';
import { useGoogleAuth } from '../authContext/googleAuth';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginSelectionScreen() {
  const router = useRouter();
  const { handleGoogleLogin, loading } = useGoogleAuth();
  const { handleAppleLogin, isAuthenticating: isAppleAuthenticating } = useAppleAuth();

  const handleGmailLogin = () => {
    router.push('/login');
  };

  const goToTerms = () => {
    const url = "https://docs.google.com/document/d/17LlGB0Y6MSfKoRVlKr0SbYyaG8UG8YdVAFO_VNn4Kbo/edit?usp=sharing"
    Linking.openURL(url);
  };

  const goToPrivacy = () => {
    const url = "https://docs.google.com/document/d/1uqLAvQK6iBXlmJZUoyk3dD4iw7dW5Qjbdy53UXhnPmE/edit?usp=sharing"
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero Image Background */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../assets/images/mujer-en-colmado.png')}
          style={styles.heroImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.1)', '#F8F9FA']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Bar inside hero */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Únete a</Text>
          <Text style={styles.brandText}>LogiPay</Text>
        </View>
      </View>

      {/* Bottom Sheet Card */}
      <View style={styles.bottomSheet}>
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.textContainer}>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>
            Elige tu método preferido para comenzar a gestionar tus finanzas con LogiPay.
          </Text>
        </Animated.View>

        {/* Buttons Container */}
        <View style={styles.buttonContainer}>
          <Animated.View entering={FadeInUp.delay(400).duration(600)}>
            <TouchableOpacity
              style={[styles.googleButton, loading && { opacity: 0.5 }]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#4C669F" />
              ) : (
                <>
                  <View style={styles.googleIconWrapper}>
                    <Ionicons name="logo-google" size={22} color="#3742dbff" />
                  </View>
                  <Text style={styles.googleButtonText}>Iniciar Sesión con Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).duration(600)}>
            <TouchableOpacity
              style={styles.gmailButton}
              onPress={handleGmailLogin}
              activeOpacity={0.8}
            >
              <View style={styles.iconWrapper}>
                <Ionicons name="mail" size={22} color="white" />
              </View>
              <Text style={styles.gmailButtonText}>Iniciar Sesión con Gmail</Text>
            </TouchableOpacity>
          </Animated.View>

          {Platform.OS === 'ios' && (
            <Animated.View entering={FadeInUp.delay(600).duration(600)}>
              <TouchableOpacity
                style={[styles.appleButton, isAppleAuthenticating && { opacity: 0.5 }]}
                onPress={handleAppleLogin}
                activeOpacity={0.8}
                disabled={isAppleAuthenticating}
              >
                {isAppleAuthenticating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <View style={styles.iconWrapper}>
                      <Ionicons name="logo-apple" size={24} color="white" />
                    </View>
                    <Text style={styles.appleButtonText}>Iniciar Sesión con Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(800).duration(600)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            Al continuar, aceptas nuestros{' '}
            <Text style={styles.linkText} onPress={goToTerms}>Términos y Condiciones</Text> y{' '}
            <Text style={styles.linkText} onPress={goToPrivacy}>política de privacidad</Text>.
          </Text>
        </Animated.View>
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
    height: SCREEN_HEIGHT * 0.45,
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
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  gmailButton: {
    backgroundColor: '#4C669F',
    flexDirection: 'row',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  gmailButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 12,
  },
  googleButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  googleButtonText: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 1,
  },
  appleButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: 30,
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#4C669F',
    fontWeight: '600',
  },
});
