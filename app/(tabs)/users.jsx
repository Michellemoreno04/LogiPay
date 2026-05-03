import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Mock data for UI design purposes
const MOCK_USERS = [
  { id: '1', name: 'Juan Pérez', phone: '555-0100', balance: -50.00 }, // Owes 50
  { id: '2', name: 'María García', phone: '555-0101', balance: 150.00 }, // Paid 150 ahead
  { id: '3', name: 'Carlos López', phone: '555-0102', balance: 0.00 }, // Even
  { id: '4', name: 'Ana Martínez', phone: '555-0103', balance: -1200.00 }, // Owes 1200
];

export default function UsersScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = MOCK_USERS.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone.includes(searchQuery)
  );

  // Calculate totals from mock data
  const totalDebt = MOCK_USERS.reduce((acc, user) => user.balance < 0 ? acc + Math.abs(user.balance) : acc, 0);
  const totalPayments = MOCK_USERS.reduce((acc, user) => user.balance > 0 ? acc + user.balance : acc, 0);

  const renderHeader = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.debtCard]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-up-circle" size={24} color="#FF3B30" />
          <Text style={styles.summaryTitle}>Por Cobrar</Text>
        </View>
        <Text style={[styles.summaryAmount, styles.negativeBalance]}>${totalDebt.toFixed(2)}</Text>
      </View>

      <View style={[styles.summaryCard, styles.paymentCard]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-down-circle" size={24} color="#34C759" />
          <Text style={styles.summaryTitle}>A Favor</Text>
        </View>
        <Text style={[styles.summaryAmount, styles.positiveBalance]}>${totalPayments.toFixed(2)}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <Link href={`/user/${item.id}`} asChild>
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userPhone}>{item.phone}</Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Saldo</Text>
          <Text style={[
            styles.balanceAmount,
            item.balance < 0 ? styles.negativeBalance :
              item.balance > 0 ? styles.positiveBalance :
                styles.neutralBalance
          ]}>
            ${Math.abs(item.balance).toFixed(2)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
      </TouchableOpacity>
    </Link>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={() => (
          <View>
            {renderHeader()}

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

            <Text style={styles.label}>Historial de pagos y deudas</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No se encontraron clientes.</Text>
          </View>
        }
      />

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
