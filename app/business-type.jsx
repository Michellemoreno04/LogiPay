import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../authContext/authContext';

export default function BusinessTypeScreen() {
  const router = useRouter();
  const { saveBusinessType } = useAuth();

  const handleSelectType = (type) => {
    saveBusinessType(type);
    router.push('/business-name');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>¿Qué tipo de uso le darás a la LogiPay?</Text>
        <Text style={styles.subtitle}>
          Selecciona el modelo que mejor se adapte a tus necesidades para personalizar tu experiencia.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {/* Option 1: Organization */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => handleSelectType('organization')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="business" size={32} color="#1E88E5" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Organización</Text>
            <Text style={styles.cardDescription}>
              Ideal para registrar pagos recurrentes o cuotas de una organización o club.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
        </TouchableOpacity>

        {/* Option 2: Business */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => handleSelectType('comercial')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="storefront" size={32} color="#43A047" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Negocio Comercial</Text>
            <Text style={styles.cardDescription}>
              Ideal para registrar y gestionar deudas de clientes y controlar ingresos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  }
});
