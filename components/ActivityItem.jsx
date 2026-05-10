import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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

export default function ActivityItem({ item }) {
  return (
    <TouchableOpacity
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
}

const styles = StyleSheet.create({
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
});
