import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppleAuth } from '../authContext/appleAuth';
import { useGoogleAuth } from '../authContext/googleAuth';



const { width } = Dimensions.get('window');

export default function LoginSelectionScreen() {
  const router = useRouter();
  const { handleGoogleLogin, loading } = useGoogleAuth();
  const { handleAppleLogin, isAuthenticating: isAppleAuthenticating } = useAppleAuth();

  const handleGmailLogin = () => {
    // Navigate to the existing email login screen
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>

        {/* Header Illustration / Icon */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(800)}
          style={styles.illustrationContainer}
        >
          <View style={styles.logoCircle}>
            <Ionicons name="person-add-outline" size={60} color="#4C669F" />
          </View>
        </Animated.View>

        {/* Text Content */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(800)}
          style={styles.textContainer}
        >
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>
            Elige tu método preferido para comenzar a gestionar tus finanzas con LogiPay.
          </Text>
        </Animated.View>

        {/* Buttons Container */}
        <View style={styles.buttonContainer}>
          <Animated.View entering={FadeInUp.delay(800).duration(800)}>
            <TouchableOpacity
              style={[styles.googleButton, (loading) && { opacity: 0.5 }]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {
                loading ? (
                  <ActivityIndicator color="#4C669F" />
                ) : (
                  <>
                    <View style={styles.googleIconWrapper}>
                      <Ionicons name="logo-google" size={22} color="#3742dbff" />
                    </View>
                    <Text style={styles.googleButtonText}>Iniciar Sesión con Google</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(600).duration(800)}>
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
            <Animated.View entering={FadeInUp.delay(1000).duration(800)}>
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
          entering={FadeInUp.delay(1200).duration(800)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            Al continuar, aceptas nuestros{' '}
            <Text style={styles.linkText} onPress={goToTerms}>Términos y Condiciones</Text> y{' '}
            <Text style={styles.linkText} onPress={goToPrivacy}>política de privacidad</Text>.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  illustrationContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8EDF2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
    marginTop: 40,
    paddingHorizontal: 10,
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
