import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>¡Holaaa de nuevo!</Text>
        <Text style={styles.subtitle}>Aquí tienes un resumen de hoy.</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={32} color="#34C759" />
          <Text style={styles.statValue}>$1,240</Text>
          <Text style={styles.statLabel}>Cobrado hoy</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={32} color="#FF9500" />
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.quickActions}>
          <Link href="/add-user" asChild>
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.iconCircle, { backgroundColor: '#4C669F' }]}>
                <Ionicons name="person-add" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>Nuevo Cliente</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/add-transaction" asChild>
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.iconCircle, { backgroundColor: '#34C759' }]}>
                <Ionicons name="cash" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>Transacción</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actividad Reciente</Text>
        <View style={styles.activityItem}>
          <Ionicons name="add-circle" size={24} color="#4C669F" />
          <View style={styles.activityInfo}>
            <Text style={styles.activityText}>Cobro a Juan Pérez</Text>
            <Text style={styles.activityTime}>Hace 2 horas</Text>
          </View>
          <Text style={styles.activityAmount}>+$50.00</Text>
        </View>
        <View style={styles.activityItem}>
          <Ionicons name="remove-circle" size={24} color="#FF3B30" />
          <View style={styles.activityInfo}>
            <Text style={styles.activityText}>Deuda de Ana Martínez</Text>
            <Text style={styles.activityTime}>Hace 5 horas</Text>
          </View>
          <Text style={[styles.activityAmount, { color: '#FF3B30' }]}>-$1,200</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { padding: 20, paddingTop: 30 },
  welcome: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  subtitle: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
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
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around' },
  actionButton: { alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10
  },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityText: { fontSize: 16, fontWeight: '500' },
  activityTime: { fontSize: 12, color: '#8E8E93' },
  activityAmount: { fontSize: 16, fontWeight: 'bold', color: '#34C759' }
});
