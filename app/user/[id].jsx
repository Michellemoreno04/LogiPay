import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Mock data for UI design purposes
const MOCK_USER = {
  id: '1',
  name: 'Juan Pérez',
  phone: '555-0100',
  email: 'juan@example.com',
  balance: -50.00,
  transactions: [
    { id: 't1', type: 'debt', amount: 100.00, date: '2024-05-10', description: 'Préstamo inicial' },
    { id: 't2', type: 'payment', amount: 50.00, date: '2024-05-15', description: 'Abono quincena' },
  ]
};

export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams();
  // In a real app, we would fetch user details based on `id`.
  const user = MOCK_USER;

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionIconContainer}>
        <Ionicons
          name={item.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={32}
          color={item.type === 'payment' ? '#34C759' : '#FF3B30'}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        item.type === 'payment' ? styles.positiveBalance : styles.negativeBalance
      ]}>
        {item.type === 'payment' ? '+' : '-'}${item.amount.toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userInfoText}>{user.phone}</Text>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceTitle}>Saldo Actual</Text>
          <Text style={[
            styles.balanceMainAmount,
            user.balance < 0 ? styles.negativeBalance :
              user.balance > 0 ? styles.positiveBalance :
                styles.neutralBalance
          ]}>
            ${Math.abs(user.balance).toFixed(2)} {user.balance < 0 ? '(Debe)' : user.balance > 0 ? '(A favor)' : ''}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.paymentButton]}
            onPress={() => router.push('/add-transaction')}
          >
            <Ionicons name="add-circle-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Abonar Pago</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.debtButton]}
            onPress={() => router.push('/add-transaction')}
          >
            <Ionicons name="remove-circle-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Agregar Deuda</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History List */}
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Historial de Transacciones</Text>
        <FlatList
          data={user.transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay transacciones registradas.</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerContainer: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4C669F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  userInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  balanceBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  balanceMainAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  negativeBalance: { color: '#FF3B30' },
  positiveBalance: { color: '#34C759' },
  neutralBalance: { color: '#8E8E93' },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentButton: {
    backgroundColor: '#34C759',
  },
  debtButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  historyContainer: {
    flex: 1,
    paddingTop: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionIconContainer: {
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 20,
  },
});
