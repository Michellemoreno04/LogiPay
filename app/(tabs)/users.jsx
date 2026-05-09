import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig/config';
import { useAuth } from '../../authContext/authContext';
import { SafeAreaView } from 'react-native-safe-area-context';




export default function UsersScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'clients'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const clientsData = [];
      querySnapshot.forEach((doc) => {
        clientsData.push({ id: doc.id, ...doc.data() });
      });
      setClients(clientsData);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredUsers = clients.filter(client =>
    (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.phone || '').includes(searchQuery)
  );




  const renderItem = ({ item }) => (
    <Link href={`/${item.id}`} asChild>
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userPhone}>{item.phone}</Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Saldo</Text>
          <Text style={[
            styles.balanceAmount,
            (item.balance || 0) < 0 ? styles.negativeBalance :
              (item.balance || 0) > 0 ? styles.positiveBalance :
                styles.neutralBalance
          ]}>
            ${Math.abs(item.balance || 0).toFixed(2)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
      </TouchableOpacity>
    </Link>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar clientes..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"

                  placeholderTextColor="#8E8E93"
                />
              </View>

              <Text style={styles.label}>Historial de clientes</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No se encontraron clientes.</Text>
            </View>
          }
        />
      </SafeAreaView>

      <Link href="/add-user" asChild>
        <TouchableOpacity style={styles.fab}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debtCard: {
    marginRight: 8,
  },
  paymentCard: {
    marginLeft: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 20,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#1C1C1E',
    height: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#8E8E93',
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  negativeBalance: {
    color: '#FF3B30',
  },
  positiveBalance: {
    color: '#34C759',
  },
  neutralBalance: {
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A3A3C',
    marginTop: 16,
  },
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
});
