import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../authContext/authContext';


export default function ProfileScreen() {

  const router = useRouter();
  const { user, logout, userData } = useAuth();

  const handleDeleteAccount = () => {
    router.push('/delete-account');
  };

  const goToEditProfile = () => {
    router.push('/edit-profile');
  };

  const gotToTerms = () => {
    const url = "https://docs.google.com/document/d/17LlGB0Y6MSfKoRVlKr0SbYyaG8UG8YdVAFO_VNn4Kbo/edit?usp=sharing"
    Linking.openURL(url);
  };

  const gotPrivacy = () => {
    const url = "https://docs.google.com/document/d/1uqLAvQK6iBXlmJZUoyk3dD4iw7dW5Qjbdy53UXhnPmE/edit?usp=sharing"
    Linking.openURL(url);
  };

  const handleSupport = () => {
    const email = "morenov.dev@gmail.com";
    const subject = encodeURIComponent(`Soporte LogiPay - ${userData?.firstName || ''} ${userData?.lastName || ''}`);
    const body = encodeURIComponent(`Hola,\n\nNecesito ayuda con LogiPay.\n\nMis datos:\n- Correo: ${user?.email || 'N/A'}\n- Negocio: ${userData?.businessName || 'N/A'}\n\n[Describe tu problema aquí]`);

    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };



  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={100} color="#4C669F" />
        </View>
        <Text style={styles.userName}>
          {userData ? `${userData.firstName} ${userData.lastName}` : 'Cargando...'}
        </Text>
        {userData?.businessName && (
          <Text style={styles.businessName}>{userData.businessName}</Text>
        )}
        <Text style={styles.userEmail}>{user?.email || 'email@ejemplo.com'}</Text>
      </View>

      <View style={styles.menu}>
        <Text style={styles.menuTitle}>Ajustes</Text>
        <TouchableOpacity style={styles.menuItem} onPress={goToEditProfile}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="settings-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Editar perfil</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>



        <Text style={styles.menuTitle}>Información</Text>
        <TouchableOpacity style={styles.menuItem} onPress={gotPrivacy}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Privacidad y Seguridad</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={gotToTerms}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="information-circle-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Terminos y condiciones</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleSupport}>
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="help-circle-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Ayuda y Soporte</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <Text style={styles.menuTitle}>Cuenta</Text>

        <TouchableOpacity style={[styles.menuItem, { marginTop: 0, borderBottomWidth: 0 }]}
          onPress={handleDeleteAccount}
        >
          <View style={[styles.iconBox, { backgroundColor: '#E5E5EA' }]}>
            <Ionicons name="trash-outline" size={20} color="#1C1C1E" />
          </View>
          <Text style={styles.menuText}>Eliminar cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={logout}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FF95001A' }]}>
            <Ionicons name="log-out-outline" size={20} color="#FF9500" />
          </View>
          <Text style={[styles.menuText, { color: '#FF9500' }]}>Cerrar Sesión</Text>
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
  businessName: { fontSize: 18, color: '#4C669F', marginTop: 4, fontWeight: '600' },
  userEmail: { fontSize: 16, color: '#8E8E93', marginTop: 2 },
  menu: { marginTop: 20 },
  menuTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginLeft: 16, marginVertical: 8, textTransform: 'uppercase' },
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
  version: { textAlign: 'center', color: '#8E8E93', fontSize: 12, marginVertical: 30 },
});
