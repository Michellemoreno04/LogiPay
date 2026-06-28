import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Componente visual de tarjeta para compartir una transacción.
 * Se renderiza en un View oculto y se captura con react-native-view-shot.
 *
 * Props:
 *   - transaction: objeto de transacción
 *   - clientName: string con el nombre del cliente
 *   - innerRef: ref que apunta al View raíz (para capturar con viewShot)
 */
export default function ShareTransactionCard({ transaction, clientName, innerRef }) {
  if (!transaction) return null;

  const isPayment = transaction.type === 'payment';
  const gradientColors = isPayment
    ? ['#1a6b3a', '#28a058', '#34C759']
    : ['#8B0000', '#c0392b', '#FF3B30'];

  const accentColor = isPayment ? '#34C759' : '#FF3B30';
  const amountSign = isPayment ? '+' : '-';
  const typeLabel = isPayment ? 'PAGO RECIBIDO' : 'DEUDA REGISTRADA';
  const typeIcon = isPayment ? 'arrow-down-circle' : 'arrow-up-circle';

  const dateStr = transaction.date || formatDate(transaction.createdAt) || '';

  return (
    <View ref={innerRef} style={styles.wrapper} collapsable={false}>
      {/* Fondo con gradiente */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Círculos decorativos de fondo */}
        <View style={[styles.circle, styles.circleBig]} />
        <View style={[styles.circle, styles.circleSmall]} />

        {/* Header: badge de tipo */}
        <View style={styles.header}>
          <View style={styles.typeBadge}>
            <Ionicons name={typeIcon} size={14} color={accentColor} />
            <Text style={[styles.typeLabel, { color: accentColor }]}>{typeLabel}</Text>
          </View>
          <Text style={styles.appName}>LogiPay</Text>
        </View>

        {/* Monto principal */}
        <View style={styles.amountSection}>
          <Text style={styles.currencySymbol}>$</Text>
          <Text style={styles.amountValue}>
            {amountSign}{formatCurrency(transaction.amount)}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Info de la transacción */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color="rgba(255,255,255,0.7)" />
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Concepto</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {transaction.title || transaction.description || '—'}
              </Text>
            </View>
          </View>

          {transaction.description && transaction.description !== transaction.title && (
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.7)" />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>Nota</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{transaction.description}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoValue}>{clientName || '—'}</Text>
            </View>
          </View>

          {dateStr ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.7)" />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>Fecha</Text>
                <Text style={styles.infoValue}>{dateStr}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>Comprobante generado con LogiPay</Text>
          <View style={styles.footerDot} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 360,
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: 24,
    padding: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  // Decorativos
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleBig: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  circleSmall: {
    width: 120,
    height: 120,
    bottom: -30,
    left: -30,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  // Monto
  amountSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginTop: 8,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 56,
    fontWeight: '900',
    color: 'white',
    lineHeight: 60,
    letterSpacing: -1,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  // Info rows
  infoSection: {
    gap: 14,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
