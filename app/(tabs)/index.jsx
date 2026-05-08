import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../authContext/authContext';
import { collection, query, onSnapshot, orderBy, limit, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig/config';
import { useEffect, useState, useMemo } from 'react';
import OrganisazionScreen from '../organisazionScreen';
import ComercialScreen from '../comercialScreen';

// ─── Helper: relative time in Spanish ───
function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const { user, userData } = useAuth();

  const [clients, setClients] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const formatNumber = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return adjustAmount;
    if (parts[0] === '') return cleaned;
    parts[0] = new Intl.NumberFormat('en-US').format(Number(parts[0]));
    return parts.join('.');
  };

  const openAdjustModal = () => {
    const currentTotal = (userData?.totalDebt || 0) - (userData?.totalPayment || 0);
    setAdjustAmount(formatNumber(Math.max(0, currentTotal).toFixed(2)));
    setAdjustNote('');
    setAdjustModalVisible(true);
  };

  const handleSaveAdjustment = async () => {
    const newTotal = parseFloat(adjustAmount.replace(/,/g, ''));
    if (isNaN(newTotal) || newTotal < 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }
    if (!adjustNote.trim()) {
      Alert.alert('Error', 'Ingresa una nota o descripción.');
      return;
    }

    setSavingAdjust(true);
    try {
      const currentTotal = (userData?.totalDebt || 0) - (userData?.totalPayment || 0);
      const difference = newTotal - currentTotal;

      if (Math.abs(difference) < 0.01) {
        setAdjustModalVisible(false);
        setSavingAdjust(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const txRef = collection(db, 'users', user.uid, 'transactions');

      // Si el nuevo total es mayor, es una deuda nueva. Si es menor, es un pago.
      const adjustType = difference > 0 ? 'debt' : 'payment';
      const absDiff = Math.abs(difference);

      await addDoc(txRef, {
        type: adjustType,
        amount: absDiff,
        description: `Ajuste: ${adjustNote.trim()} (Total anterior: $${currentTotal.toFixed(2)})`,
        createdAt: serverTimestamp(),
      });

      if (adjustType === 'payment') {
        await updateDoc(userRef, {
          totalPayment: increment(absDiff),
        });
      } else {
        await updateDoc(userRef, {
          totalDebt: increment(absDiff),
        });
      }

      setAdjustModalVisible(false);
      setAdjustAmount('');
      setAdjustNote('');
    } catch (error) {
      console.error('Error saving adjustment:', error);
      Alert.alert('Error', 'No se pudo guardar el ajuste. Intenta de nuevo.');
    } finally {
      setSavingAdjust(false);
    }
  };


  // ─── 1. Real-time listener for clients list ───
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'clients'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setClients(data);
    });

    return () => unsubscribe();
  }, [user]);

  // ─── 2. Real-time listeners for recent transactions per client ───
  useEffect(() => {
    if (!user) return;

    if (clients.length === 0) {
      setRecentActivity([]);
      setLoadingActivity(false);
      return;
    }

    const unsubscribes = [];
    // Store transactions grouped by clientId so each listener can update its slice
    const txByClient = {};

    clients.forEach((client) => {
      const txQ = query(
        collection(db, 'users', user.uid, 'clients', client.id, 'transactions'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsub = onSnapshot(txQ, (snap) => {
        const txs = [];
        snap.forEach((doc) => {
          const data = doc.data();
          txs.push({
            id: doc.id,
            ...data,
            clientName: client.name || 'Sin nombre',
            clientId: client.id,
            // Keep the Firestore timestamp for sorting
            _timestamp: data.createdAt?.toMillis?.() || 0,
            // Convert to Date for display
            _date: data.createdAt?.toDate?.() || null,
          });
        });
        txByClient[client.id] = txs;

        // Merge all client transactions, sort by newest, take top 10
        const merged = Object.values(txByClient).flat();
        merged.sort((a, b) => b._timestamp - a._timestamp);
        setRecentActivity(merged.slice(0, 5));
        setLoadingActivity(false);
      }, (error) => {
        console.error('Error fetching transactions for client', client.id, error);
        setLoadingActivity(false);
      });

      unsubscribes.push(unsub);
    });

    // Listener para transacciones globales (ajustes)
    const globalTxQ = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const globalUnsub = onSnapshot(globalTxQ, (snap) => {
      const txs = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        txs.push({
          id: docSnap.id,
          ...data,
          clientName: 'Ajuste de Total',
          clientId: 'global',
          _timestamp: data.createdAt?.toMillis?.() || 0,
          _date: data.createdAt?.toDate?.() || null,
        });
      });
      txByClient['global'] = txs;

      const merged = Object.values(txByClient).flat();
      merged.sort((a, b) => b._timestamp - a._timestamp);
      setRecentActivity(merged.slice(0, 5));
    }, (error) => {
      console.error('Error fetching global transactions', error);
    });
    unsubscribes.push(globalUnsub);

    return () => unsubscribes.forEach((fn) => fn());
  }, [user, clients]);

  // ─── Render a single activity item ───
  const renderActivityItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.activityItem}
      activeOpacity={0.7}
      onPress={() => item.clientId !== 'global' && router.push(`/${item.clientId}`)}
    >
      <View style={[
        styles.activityIconBg,
        { backgroundColor: item.type === 'payment' ? '#E8F9EE' : '#FDECEA' }
      ]}>
        <Ionicons
          name={item.type === 'payment' ? 'add-circle' : 'remove-circle'}
          size={24}
          color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
        />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Text style={styles.activityDescription} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.activityTime}>{timeAgo(item._date)}</Text>
      </View>
      <Text style={[
        styles.activityAmount,
        { color: item.type === 'payment' ? '#34C759' : '#FF3B30' }
      ]}>
        {item.type === 'payment' ? '+' : '-'}${item.amount?.toFixed(2) || '0.00'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.welcome}>{userData?.businessName}</Text>
          <Text style={styles.businessTypeTag}>{userData?.businessType}</Text>
          <Text style={styles.subtitle}>Aquí tienes un resumen de hoy. </Text>
        </View>

        <View style={styles.statsGrid}>
          {userData?.businessType === 'organization' ? (
            <OrganisazionScreen userData={userData} onAdjust={openAdjustModal} />
          ) : userData?.businessType === 'comercial' ? (
            <>
              <ComercialScreen userData={userData} onAdjust={openAdjustModal} />
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actividad Reciente</Text>
            <TouchableOpacity onPress={() => router.push('/all-transactions')}>
              <Text style={styles.viewMoreText}>Ver más</Text>
            </TouchableOpacity>
          </View>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4C669F" />
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="receipt-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyText}>No hay actividad reciente.</Text>
              <Text style={styles.emptySubText}>Las transacciones de tus clientes aparecerán aquí.</Text>
            </View>
          ) : (
            recentActivity.map(renderActivityItem)
          )}
        </View>
      </ScrollView>

      {/* ─── Ajuste Modal ─── */}
      <Modal
        visible={adjustModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAdjustModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                    <Text style={styles.modalCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Ajustar Total</Text>
                  <View style={{ width: 70 }} />
                </View>

                <Text style={styles.inputLabel}>Nuevo Monto Total *</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                    value={adjustAmount}
                    onChangeText={(text) => setAdjustAmount(formatNumber(text))}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>

                <Text style={styles.inputLabel}>Nota del Ajuste *</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Ej. Corrección de saldo..."
                  placeholderTextColor="#C7C7CC"
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                  multiline
                  numberOfLines={2}
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!adjustAmount || !adjustNote.trim() || savingAdjust) && styles.saveButtonDisabled,
                    { backgroundColor: '#4C669F' } // Azul neutro para el ajuste total
                  ]}
                  onPress={handleSaveAdjustment}
                  disabled={!adjustAmount || !adjustNote.trim() || savingAdjust}
                >
                  {savingAdjust ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Guardar Nuevo Total</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Link href="/add-user" asChild>
        <TouchableOpacity style={styles.fab}>
          <FontAwesome6 name="user-plus" size={24} color="white" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', marginTop: 30 },
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
  businessTypeTag: {
    fontSize: 12,
    color: '#4C669F',
    fontWeight: '600',
    marginTop: 4,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E' },
  viewMoreText: { fontSize: 14, color: '#4C669F', fontWeight: '600' },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  activityDescription: { fontSize: 13, color: '#636366', marginTop: 2 },
  activityTime: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  activityAmount: { fontSize: 16, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4C669F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  adjustBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  adjustBtnText: {
    color: '#4C669F',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCancel: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  typeButtonActivePayment: {
    backgroundColor: '#34C759',
  },
  typeButtonActiveDebt: {
    backgroundColor: '#FF3B30',
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  typeButtonTextActive: {
    color: 'white',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 24,
    color: '#1C1C1E',
    marginRight: 5,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#1C1C1E',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  savePaymentTheme: {
    backgroundColor: '#34C759',
  },
  saveDebtTheme: {
    backgroundColor: '#FF3B30',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
