import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ActivityItem({ item }) {
  const isPayment = item.type === 'payment';
  const isSale = item.type === 'sale';

  // Color palette per type
  const palette = isSale
    ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500', bar: '#FF9500' }
    : isPayment
    ? { bg: '#ECFDF3', icon: '#34C759', text: '#34C759', bar: '#34C759' }
    : { bg: '#FFF1F0', icon: '#FF3B30', text: '#FF3B30', bar: '#FF3B30' };

  const iconName = isSale
    ? 'cart'
    : isPayment
    ? 'arrow-up-circle'
    : 'arrow-down-circle';

  const badgeLabel = isSale ? 'Venta' : isPayment ? 'Abono' : 'Cargo';

  const amountPrefix = isSale ? '' : isPayment ? '+' : '-';

  return (
    <TouchableOpacity
      style={styles.activityItem}
      activeOpacity={0.65}
      onPress={() => item.clientId && item.clientId !== 'global' && router.push(`/${item.clientId}`)}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: palette.bar }]} />

      <View style={[styles.activityIconBg, { backgroundColor: palette.bg }]}>
        <Ionicons name={iconName} size={22} color={palette.icon} />
      </View>

      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Text style={styles.activityDescription} numberOfLines={1}>
          {isSale
            ? `🛒 ${item.description || item.productName || 'Producto'}`
            : item.description}
        </Text>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={11} color="#AEAEB2" />
          <Text style={styles.activityTime}>{timeAgo(item._date)}</Text>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.activityAmount, { color: palette.text }]}>
          {amountPrefix}${numberFormatter.format(item.amount) || '0.00'}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: palette.bg }]}>
          <Text style={[styles.typeText, { color: palette.text }]}>
            {badgeLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  activityIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1F4B',
    letterSpacing: -0.2,
  },
  activityDescription: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  activityTime: {
    fontSize: 11,
    color: '#AEAEB2',
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
