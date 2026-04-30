import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../authContext/authContext';

export default function ProfileScreen() {

  const router = useRouter();
  const { user, logout } = useAuth();








  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={100} color="#4C669F" />
        </View>
        <Text style={styles.userName}>Administrador</Text>
        <Text style={styles.userEmail}>admin@logipay.com</Text>
      </View>

      <View style={styles.menu}>
        <Text style={styles.menuTitle}>Ajustes</Text>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="settings-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Configuración de la cuenta</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="notifications-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Notificaciones</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <Text style={styles.menuTitle}>Información</Text>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Privacidad y Seguridad</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="help-circle-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Ayuda y Soporte</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { marginTop: 30, borderBottomWidth: 0 }]}
          onPress={logout}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FF3B301A' }]}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          </View>
          <Text style={[styles.menuText, { color: '#FF3B30' }]}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>LogiPay v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  profileHeader: { alignItems: 'center', paddingVertical: 40, backgroundColor: 'white' },
  avatarContainer: { marginBottom: 15 },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#1C1C1E' },
  userEmail: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
  menu: { marginTop: 20 },
  menuTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginLeft: 16, marginBottom: 8, textTransform: 'uppercase' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C7C7CC'
  },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuText: { flex: 1, fontSize: 17, color: '#1C1C1E' },
  version: { textAlign: 'center', color: '#8E8E93', fontSize: 12, marginVertical: 30 }
});
