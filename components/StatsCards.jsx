import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useLocalData } from '../context/LocalDataContext';

const formatCurrency = (value) =>
  Math.abs(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatNumber = (value) =>
  (value ?? 0).toLocaleString('en-US');

// ─── Modal de ajuste ───
function AdjustModal({ visible, label, currentValue, isCurrency, accentColors, onSave, onClose }) {
  const [inputValue, setInputValue] = useState(String(currentValue ?? 0));
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      setInputValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '0');
      setReason('');
    }
  }, [visible, currentValue]);

  const handleSave = () => {
    const parsed = parseFloat(inputValue.replace(/,/g, ''));
    if (isNaN(parsed)) {
      Alert.alert('Valor inválido', 'Por favor ingresa un número válido.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Campo obligatorio', 'Por favor explica el motivo del cambio.');
      return;
    }
    onSave(parsed, reason.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.sheet}>
                {/* Handle bar */}
                <View style={modalStyles.handle} />

                {/* Encabezado */}
                <View style={modalStyles.header}>
                  <LinearGradient colors={accentColors} style={modalStyles.iconCircle}>
                    <Ionicons name="create-outline" size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={modalStyles.title}>Ajustar monto</Text>
                    <Text style={modalStyles.subtitle}>{label}</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
                    <Ionicons name="close" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                </View>

                {/* Campo */}
                <View style={[modalStyles.inputWrapper, { borderColor: accentColors[0] + '55' }]}>
                  {isCurrency && (
                    <Text style={[modalStyles.currency, { color: accentColors[0] }]}>$</Text>
                  )}
                  <TextInput
                    style={modalStyles.input}
                    value={inputValue}
                    onChangeText={setInputValue}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                  />
                </View>

                {/* Motivo del cambio */}
                <Text style={modalStyles.reasonLabel}>Motivo del cambio *</Text>
                <View style={[modalStyles.reasonInputWrapper, { borderColor: accentColors[0] + '33' }]}>
                  <TextInput
                    style={modalStyles.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Explica el porqué del cambio..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    maxLength={150}
                  />
                </View>

                {/* Botones */}
                <View style={modalStyles.btnRow}>
                  <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn} activeOpacity={0.7}>
                    <Text style={modalStyles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} activeOpacity={0.8} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={accentColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={modalStyles.saveBtn}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={modalStyles.saveText}>Guardar</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Paleta corporativa compartida ───
const CORP = {
  iconBg: '#F0F2F7',
  iconColor: '#1A1F4B',
  valueColor: '#0F1629',
  labelColor: '#6B7280',
  divider: '#E8EAF0',
  editColor: '#9CA3AF',
  upColor: '#374151',
  downColor: '#6B7280',
  cardBg: ['#FFFFFF', '#FAFBFE'],
  shadow: '#1A1F4B',
  MODAL_ACCENT: ['#1A1F4B', '#2D3A8C'],
};

// ─── Tarjeta individual con monto ───
function MetricCard({ icon, label, value, isLoading, trend, onEditValue, accentColors }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.94} style={{ flex: 1 }}>
        <View style={styles.statCard}>
          {/* Línea superior sutil */}
          <View style={styles.topDivider} />

          <View style={styles.cardInner}>
            {/* Fila superior: ícono + tendencia */}
            <View style={styles.cardTopRow}>
              <View style={styles.iconBg}>
                <Ionicons name={icon} size={16} color={CORP.iconColor} />
              </View>
              {trend !== undefined && (
                <View style={styles.trendBadge}>
                  <Ionicons
                    name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={trend >= 0 ? CORP.upColor : CORP.downColor}
                  />
                </View>
              )}
            </View>

            {/* Etiqueta */}
            <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>

            {/* Valor */}
            {isLoading ? (
              <ActivityIndicator size="small" color={CORP.iconColor} style={styles.loader} />
            ) : (
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                ${formatCurrency(value)}
              </Text>
            )}

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Ionicons name="pencil-outline" size={11} color={CORP.editColor} />
              <Text style={styles.footerText}>Editar</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <AdjustModal
        visible={modalVisible}
        label={label}
        currentValue={value}
        isCurrency
        accentColors={CORP.MODAL_ACCENT}
        onSave={(val, reason) => onEditValue && onEditValue(val, reason)}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Tarjeta de conteo (sin símbolo $) ───
function CountCard({ icon, label, count, isLoading, onEditValue, accentColors }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.94} style={{ flex: 1 }}>
        <View style={styles.statCard}>
          {/* Línea superior sutil */}
          <View style={styles.topDivider} />

          <View style={styles.cardInner}>
            {/* Fila superior: ícono */}
            <View style={styles.cardTopRow}>
              <View style={styles.iconBg}>
                <Ionicons name={icon} size={16} color={CORP.iconColor} />
              </View>
            </View>

            {/* Etiqueta */}
            <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>

            {/* Valor */}
            {isLoading ? (
              <ActivityIndicator size="small" color={CORP.iconColor} style={styles.loader} />
            ) : (
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(count)}
              </Text>
            )}

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Ionicons name="pencil-outline" size={11} color={CORP.editColor} />
              <Text style={styles.footerText}>Editar</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <AdjustModal
        visible={modalVisible}
        label={label}
        currentValue={count}
        isCurrency={false}
        accentColors={CORP.MODAL_ACCENT}
        onSave={(val, reason) => onEditValue && onEditValue(val, reason)}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Componente principal ───
const StatsCards = ({ userData, onAdjust }) => {
  const { clients, products, recentSales, todaySales, loadingClients, loadingProducts } = useLocalData();

  // Overrides locales por tarjeta
  const [overrides, setOverrides] = useState({});
  const setOverride = (key, val, reason) => {
    setOverrides((prev) => ({ ...prev, [key]: val }));
    if (onAdjust) {
      onAdjust(key, val, reason);
    }
  };

  const isLoadingUser = userData?.totalDebt === undefined;
  const isOrg = userData?.businessType === 'organization';

  // Control del día actual local para resetear automáticamente
  const [currentDayKey, setCurrentDayKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      setCurrentDayKey((prev) => {
        if (prev !== key) return key;
        return prev;
      });
    }, 15000); // Verificar cada 15 segundos si cambió el día

    return () => clearInterval(interval);
  }, []);

  const todaySalesFiltered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return (todaySales || []).filter((s) => s.createdAt >= startOfToday);
  }, [todaySales, currentDayKey]);

  const { totalIngresado, totalDeudas, clientesActivos, clientesMorosos } = useMemo(() => {
    let ingresado = 0;
    let deudas = 0;
    let activos = 0;
    let morosos = 0;
    for (const c of clients) {
      const bal = c.balance ?? 0;
      if (bal > 0) { ingresado += bal; activos++; }
      else if (bal < 0) { deudas += Math.abs(bal); morosos++; }
      else { activos++; }
    }
    return { totalIngresado: ingresado, totalDeudas: deudas, clientesActivos: clients.length, clientesMorosos: morosos };
  }, [clients]);

  const { gananciaVentas, totalVentasAmount, totalVentas, productosRegistrados } = useMemo(() => {
    let ganancia = 0;
    let ventasAmount = 0;
    for (const s of todaySalesFiltered) {
      ventasAmount += s.totalAmount ?? 0;
      const buyP = s.buyPrice ?? 0;
      const profit = ((s.unitPrice ?? 0) - buyP) * (s.quantity ?? 1);
      ganancia += profit;
    }
    return { gananciaVentas: ganancia, totalVentasAmount: ventasAmount, totalVentas: todaySalesFiltered.length, productosRegistrados: products.length };
  }, [todaySalesFiltered, products]);

  return (
    <View style={styles.container}>
      {isOrg ? (
        // ─── Modo Organización: solo Deudas ───
        <>
          <View style={styles.row}>
            <MetricCard
              icon="alert-circle-outline"
              label="Deudas Pendientes"
              value={overrides['deudas'] ?? totalDeudas}
              isLoading={loadingClients}
              trend={-1}
              onEditValue={(v, r) => setOverride('deudas', v, r)}
            />
          </View>
        </>
      ) : (
        // ─── Modo Comercial: tarjetas principales ───
        <>
          {/* Fila 1: Ingresado + Deudas */}
          <View style={styles.row}>
            <MetricCard
              icon="trending-up-outline"
              label="Total Ingresado"
              value={overrides['ingresado'] ?? totalVentasAmount}
              isLoading={loadingProducts}
              trend={1}
              onEditValue={(v, r) => setOverride('ingresado', v, r)}
            />
            <MetricCard
              icon="alert-circle-outline"
              label="Deudas Pendientes"
              value={overrides['deudas'] ?? totalDeudas}
              isLoading={loadingClients}
              trend={-1}
              onEditValue={(v, r) => setOverride('deudas', v, r)}
            />
          </View>

          {/* Fila 2: Ganancia ventas + Ventas count */}
          <View style={styles.row}>
            <MetricCard
              icon="bar-chart-outline"
              label="Ganancia por Ventas"
              value={overrides['ganancia'] ?? gananciaVentas}
              isLoading={loadingProducts}
              trend={1}
              onEditValue={(v, r) => setOverride('ganancia', v, r)}
            />
            <CountCard
              icon="receipt-outline"
              label="Ventas de hoy"
              count={overrides['ventas'] ?? totalVentas}
              isLoading={loadingProducts}
              onEditValue={(v, r) => setOverride('ventas', v, r)}
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  cardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    minHeight: 128,
    borderWidth: 1,
    borderColor: '#ECEEF4',
  },
  topDivider: {
    height: 2,
    backgroundColor: '#5360d5ff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    opacity: 0.85,
  },
  cardInner: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F0F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 13,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F1629',
    letterSpacing: -0.4,
    minHeight: 25,
  },
  loader: {
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F7',
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

// ─── Estilos del modal (bottom-sheet) ───
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,15,40,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E8',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1F4B',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 18,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonInputWrapper: {
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    minHeight: 54,
  },
  reasonInput: {
    fontSize: 14,
    color: '#1A1F4B',
    textAlignVertical: 'top',
    padding: 0,
  },
  currency: {
    fontSize: 32,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    fontSize: 38,
    fontWeight: '800',
    color: '#1A1F4B',
    padding: 0,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

export default StatsCards;
