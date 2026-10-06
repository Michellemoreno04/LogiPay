import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../authContext/authContext';
import { useLocalData } from '../context/LocalDataContext';
import { getAllClientTransactions, getInvestments, insertTransaction } from '../utils/database';



const formatCurrency = (value) =>
  Math.abs(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatNumber = (value) =>
  (value ?? 0).toLocaleString('en-US');

// ─── Formateador de input con comas de miles ───
const formatInputWithCommas = (text) => {
  // Solo dígitos y un punto decimal
  const clean = text.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  // Agrega comas al entero
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Solo un punto decimal permitido
  return parts.length > 2 ? parts[0] + '.' + parts[1] : parts.join('.');
};

// ─── Modal de ajuste ───
function AdjustModal({ visible, label, currentValue, isCurrency, accentColors, onSave, onClose }) {
  const [inputValue, setInputValue] = useState(String(currentValue ?? 0));
  const [reason, setReason] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      const raw = currentValue !== undefined && currentValue !== null ? String(currentValue) : '0';
      setInputValue(formatInputWithCommas(raw));
      setReason('');
      setKbHeight(0);
    }
  }, [visible, currentValue]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[modalStyles.sheet, { marginBottom: kbHeight }]}>
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
                  onChangeText={(text) => setInputValue(formatInputWithCommas(text))}
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
    </Modal>
  );
}

// ─── Menú desplegable de 3 puntos ───
function OptionsMenu({ onEdit, onReset, accentColor }) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const menuItems = [
    { icon: 'create-outline', label: 'Editar', action: () => { setVisible(false); onEdit(); } },
  ];

  return (
    <View>
      <TouchableOpacity
        onPress={(e) => {
          const { pageX, pageY } = e.nativeEvent;
          setAnchor({ x: pageX, y: pageY });
          setVisible(true);
        }}
        style={menuStyles.trigger}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-vertical" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={menuStyles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  menuStyles.dropdown,
                  {
                    top: anchor.y + 24,
                    left: Math.max(16, anchor.x - 110),
                  },
                ]}
              >
                {menuItems.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      menuStyles.menuItem,
                      idx < menuItems.length - 1 && menuStyles.menuItemBorder,
                    ]}
                    onPress={item.action}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icon} size={15} color={accentColor || '#4B5563'} />
                    <Text style={menuStyles.menuText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
function MetricCard({ icon, label, value, isLoading, onEditValue, onReset, accentColors }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.statCard}>
        {/* Línea superior sutil */}
        <View style={styles.topDivider} />

        <View style={styles.cardInner}>
          {/* Fila superior: ícono + menú */}
          <View style={styles.cardTopRow}>
            <View style={styles.iconBg}>
              <Ionicons name={icon} size={16} color={CORP.iconColor} />
            </View>
            <OptionsMenu
              onEdit={() => setModalVisible(true)}
              onReset={onReset}
              accentColor={CORP.iconColor}
            />
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
        </View>
      </View>

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
function CountCard({ icon, label, count, isLoading, onEditValue, onReset, accentColors }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.statCard}>
        {/* Línea superior sutil */}
        <View style={styles.topDivider} />

        <View style={styles.cardInner}>
          {/* Fila superior: ícono + menú */}
          <View style={styles.cardTopRow}>
            <View style={styles.iconBg}>
              <Ionicons name={icon} size={16} color={CORP.iconColor} />
            </View>
            <OptionsMenu
              onEdit={() => setModalVisible(true)}
              onReset={onReset}
              accentColor={CORP.iconColor}
            />
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
        </View>
      </View>

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

// ─── Meses en español (necesarios para calcular estadísticas de membresía) ───
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

// ─── Helper: Estadísticas mensuales por miembro ───
function getMemberMonthStats(member, transactions, selectedYear, selectedMonth) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const memberPayments = (transactions || []).filter(
    (tx) => tx.clientId === member.id && tx.type === 'recurring_payment'
  );

  const paymentsInSelectedMonth = memberPayments.filter((tx) => {
    const d = new Date(tx.createdAt);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });
  const totalPaidInSelectedMonth = paymentsInSelectedMonth.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  return {
    totalPaidInSelectedMonth,
    hasPaidSelectedMonth: totalPaidInSelectedMonth > 0,
  };
}

// ─── Tarjeta de Pagos Recurrentes para Organización ───
function RecurringPaymentsCard({ clients, transactions, isLoading, value, onEditValue, onReset }) {
  const [modalVisible, setModalVisible] = useState(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Total pagado este mes por todos los miembros (valor base)
  const currentMonthTotal = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((tx) => {
        if (tx.type !== 'recurring_payment') return false;
        const d = new Date(tx.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [transactions, currentYear, currentMonth]);

  // Si hay override externo lo usamos, si no el total calculado
  const displayValue = value !== undefined ? value : currentMonthTotal;

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.statCard}>
        {/* Línea superior azul vibrante */}
        <View style={[styles.topDivider, { backgroundColor: '#2563EB' }]} />

        <View style={styles.cardInner}>
          {/* Fila superior: ícono + menú */}
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBg, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="repeat-outline" size={17} color="#2563EB" />
            </View>
            <OptionsMenu
              onEdit={() => setModalVisible(true)}
              onReset={onReset}
              accentColor="#2563EB"
            />
          </View>

          {/* Etiqueta */}
          <Text style={styles.statLabel} numberOfLines={2}>
            Pagos Recurrentes
          </Text>

          {/* Valor */}
          {isLoading ? (
            <ActivityIndicator size="small" color="#2563EB" style={styles.loader} />
          ) : (
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ${formatCurrency(displayValue)}
            </Text>
          )}
        </View>
      </View>

      <AdjustModal
        visible={modalVisible}
        label="Pagos Recurrentes"
        currentValue={displayValue}
        isCurrency
        accentColors={['#2563EB', '#1D4ED8']}
        onSave={(val, reason) => onEditValue && onEditValue(val, reason)}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// Fuentes de dinero para inversión
const INVESTMENT_SOURCES = [
  {
    key: 'ingresado',
    label: 'Total Ingresado',
    icon: 'trending-up-outline',
    color: '#1A1F4B',
    bg: '#EEF0FB',
    desc: 'Se descontará del total ingresado',
  },
  {
    key: 'ganancia',
    label: 'Ganancia',
    icon: 'bar-chart-outline',
    color: '#7C3AED',
    bg: '#F5F0FF',
    desc: 'Se descontará de la ganancia por ventas',
  },
  {
    key: 'externo',
    label: 'Externo',
    icon: 'person-outline',
    color: '#D97706',
    bg: '#FFFBEB',
    desc: 'Dinero propio / externo (sin descuento)',
  },
];

// ─── Tarjeta de Inversión ───
function InvestmentCard({
  totalInvested,
  investments,
  isLoading,
  onAddInvestment,
  totalIngresado,
  gananciaVentas,
  value,
  onEditValue,
  onReset,
}) {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [note, setNote] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [selectedSource, setSelectedSource] = useState('externo');

  const displayValue = value !== undefined ? value : totalInvested;

  useEffect(() => {
    if (addModalVisible) {
      setInputValue('');
      setNote('');
      setKbHeight(0);
      setSelectedSource('externo');
    }
  }, [addModalVisible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSave = () => {
    const parsed = parseFloat(inputValue.replace(/,/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Valor inválido', 'Ingresa un monto mayor a 0.');
      return;
    }

    // Validar que haya suficiente saldo si la fuente no es externa
    if (selectedSource === 'ingresado') {
      const available = totalIngresado ?? 0;
      if (parsed > available) {
        Alert.alert(
          'Saldo insuficiente',
          `El monto ($${formatCurrency(parsed)}) supera el Total Ingresado disponible ($${formatCurrency(available)}).`
        );
        return;
      }
    } else if (selectedSource === 'ganancia') {
      const available = gananciaVentas ?? 0;
      if (parsed > available) {
        Alert.alert(
          'Saldo insuficiente',
          `El monto ($${formatCurrency(parsed)}) supera la Ganancia disponible ($${formatCurrency(available)}).`
        );
        return;
      }
    }

    onAddInvestment && onAddInvestment(parsed, note.trim(), selectedSource);
    setAddModalVisible(false);
  };

  const ACCENT = ['#059669', '#047857'];
  const activeSource = INVESTMENT_SOURCES.find((s) => s.key === selectedSource);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.statCard}>
        {/* Línea superior verde */}
        <View style={[styles.topDivider, { backgroundColor: '#059669' }]} />

        <View style={styles.cardInner}>
          {/* Fila superior: ícono + menú de 3 puntos */}
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="wallet-outline" size={16} color="#059669" />
            </View>
            <OptionsMenu
              onEdit={() => setAdjustModalVisible(true)}
              onReset={onReset}
              accentColor="#059669"
            />
          </View>

          {/* Etiqueta */}
          <Text style={styles.statLabel} numberOfLines={2}>Dinero Invertido</Text>

          {/* Valor */}
          {isLoading ? (
            <ActivityIndicator size="small" color="#059669" style={styles.loader} />
          ) : (
            <Text style={[styles.statValue, { color: '#059669' }]} numberOfLines={1} adjustsFontSizeToFit>
              ${formatCurrency(displayValue)}
            </Text>
          )}

          {/* Fila inferior: último registro a la izquierda + botón Registrar a la derecha */}
          <View style={investStyles.bottomRow}>
            {investments && investments.length > 0 ? (
              <View style={investStyles.lastEntry}>
                <Ionicons name="time-outline" size={10} color="#9CA3AF" />
                <Text style={investStyles.lastEntryText} numberOfLines={1}>
                  Último: ${formatCurrency(investments[investments.length - 1]?.amount)} 
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={investStyles.registerBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={14} color="#059669" />
              <Text style={investStyles.registerBtnText}>Registrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal para ajustar monto directamente */}
      <AdjustModal
        visible={adjustModalVisible}
        label="Dinero Invertido"
        currentValue={displayValue}
        isCurrency
        accentColors={ACCENT}
        onSave={(val, reason) => onEditValue && onEditValue(val, reason)}
        onClose={() => setAdjustModalVisible(false)}
      />

      {/* Modal para agregar inversión */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setAddModalVisible(false)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[modalStyles.sheet, { marginBottom: kbHeight }]}>
                <View style={modalStyles.handle} />

                {/* Encabezado */}
                <View style={modalStyles.header}>
                  <LinearGradient colors={ACCENT} style={modalStyles.iconCircle}>
                    <Ionicons name="wallet-outline" size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={modalStyles.title}>Registrar Inversión</Text>
                    <Text style={modalStyles.subtitle}>Agrega el monto invertido</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAddModalVisible(false)} style={modalStyles.closeBtn}>
                    <Ionicons name="close" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                </View>

                {/* ── Selector de fuente ── */}
                <Text style={[modalStyles.reasonLabel, { marginBottom: 10 }]}>¿De dónde proviene el dinero?</Text>
                <View style={investStyles.sourceRow}>
                  {INVESTMENT_SOURCES.map((src) => {
                    const isActive = selectedSource === src.key;
                    return (
                      <TouchableOpacity
                        key={src.key}
                        style={[
                          investStyles.sourceChip,
                          { borderColor: isActive ? src.color : '#E5E7EB' },
                          isActive && { backgroundColor: src.bg },
                        ]}
                        onPress={() => setSelectedSource(src.key)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={src.icon}
                          size={14}
                          color={isActive ? src.color : '#9CA3AF'}
                        />
                        <Text
                          style={[
                            investStyles.sourceChipText,
                            { color: isActive ? src.color : '#6B7280' },
                            isActive && { fontWeight: '700' },
                          ]}
                        >
                          {src.label}
                        </Text>
                        {isActive && (
                          <Ionicons name="checkmark-circle" size={13} color={src.color} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Descripción de la fuente seleccionada */}
                {activeSource && (
                  <View style={[investStyles.sourceDesc, { backgroundColor: activeSource.bg, borderColor: activeSource.color + '33' }]}>
                    <Ionicons name="information-circle-outline" size={14} color={activeSource.color} />
                    <Text style={[investStyles.sourceDescText, { color: activeSource.color }]}>
                      {activeSource.desc}
                    </Text>
                  </View>
                )}

                {/* Campo de monto */}
                <View style={[modalStyles.inputWrapper, { borderColor: ACCENT[0] + '55', marginTop: 14 }]}>
                  <Text style={[modalStyles.currency, { color: ACCENT[0] }]}>$</Text>
                  <TextInput
                    style={modalStyles.input}
                    value={inputValue}
                    onChangeText={(text) => setInputValue(formatInputWithCommas(text))}
                    keyboardType="decimal-pad"
                    autoFocus
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                  />
                </View>

                {/* Nota (opcional) */}
                <Text style={modalStyles.reasonLabel}>Nota (opcional)</Text>
                <View style={[modalStyles.reasonInputWrapper, { borderColor: ACCENT[0] + '33' }]}>
                  <TextInput
                    style={modalStyles.reasonInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Ej: Compra de inventario, equipos..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    maxLength={150}
                  />
                </View>

                {/* Botones */}
                <View style={modalStyles.btnRow}>
                  <TouchableOpacity onPress={() => setAddModalVisible(false)} style={modalStyles.cancelBtn} activeOpacity={0.7}>
                    <Text style={modalStyles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} activeOpacity={0.8} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={ACCENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={modalStyles.saveBtn}
                    >
                      <Ionicons name="add-circle" size={20} color="#fff" />
                      <Text style={modalStyles.saveText}>Registrar</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── Componente principal ───
const StatsCards = ({ userData, onAdjust }) => {
  const { user } = useAuth();
  const {
    clients,
    products,
    recentSales,
    todaySales,
    loadingClients,
    loadingProducts,
    addTransactionOptimistic,
  } = useLocalData();

  const isOrg = userData?.businessType === 'organization';

  // Transacciones de miembros para organización
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!user || !isOrg) return;
    let isMounted = true;

    const loadTxs = async () => {
      setLoadingTx(true);
      try {
        const txs = await getAllClientTransactions(user.uid);
        if (isMounted) {
          setTransactions(txs || []);
        }
      } catch (err) {
        console.error('Error loading org transactions:', err);
      } finally {
        if (isMounted) setLoadingTx(false);
      }
    };

    loadTxs();

    const sub = DeviceEventEmitter.addListener('local-db-changed', loadTxs);
    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [user, isOrg]);

  // Overrides locales por tarjeta
  const [overrides, setOverrides] = useState({});
  const setOverride = async (key, val, reason) => {
    setOverrides((prev) => ({ ...prev, [key]: val }));
    if (onAdjust) {
      onAdjust(key, val, reason);
    }

    const CARD_LABELS = {
      ingresado: 'Total Ingresado',
      deudas: 'Deudas Pendientes',
      ganancia: 'Ganancia por Ventas',
      ventas: 'Ventas de hoy',
      inversion: 'Dinero Invertido',
      recurrentes: 'Pagos Recurrentes',
    };

    const cardTitle = CARD_LABELS[key] || 'Monto';
    const now = Date.now();
    const adjTx = {
      id: `adj_${now}_${Math.random().toString(36).substring(2, 7)}`,
      clientId: 'global',
      clientName: `Ajuste: ${cardTitle}`,
      type: 'adjustment',
      amount: val,
      title: `Ajuste de ${cardTitle}`,
      description: reason ? `Motivo: ${reason}` : `Ajuste manual de ${cardTitle}`,
      rawDescription: reason || `Ajuste manual de ${cardTitle}`,
      date: new Date(now).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      createdAt: now,
    };

    if (user?.uid) {
      try {
        await insertTransaction(user.uid, adjTx);
        DeviceEventEmitter.emit('local-db-changed');
      } catch (err) {
        console.error('Error saving adjustment transaction:', err);
      }
    }

    if (addTransactionOptimistic) {
      addTransactionOptimistic(adjTx);
    }
  };
  const resetOverride = (key) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Estado de inversiones (cargado desde SQLite y actualizado reactivamente)
  const [investments, setInvestments] = useState([]);
  const totalInvested = useMemo(() =>
    investments.reduce((sum, inv) => sum + (inv.amount || 0), 0),
    [investments]
  );

  useEffect(() => {
    if (!user?.uid) return;
    let isMounted = true;

    const loadInvestmentsData = async () => {
      try {
        const rows = await getInvestments(user.uid);
        if (isMounted) {
          setInvestments(rows || []);
        }
      } catch (err) {
        console.error('Error loading investments:', err);
      }
    };

    loadInvestmentsData();

    const sub = DeviceEventEmitter.addListener('local-db-changed', loadInvestmentsData);
    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [user]);

  const handleAddInvestment = async (amount, note, source) => {
    const now = Date.now();
    const sourceLabels = { ingresado: 'Total Ingresado', ganancia: 'Ganancia', externo: 'Externo' };
    const sourceLabel = sourceLabels[source] || 'Externo';

    const invTx = {
      id: `inv_${now}_${Math.random().toString(36).substring(2, 7)}`,
      clientId: 'investment',
      clientName: 'Inversión en Negocio',
      type: 'investment',
      amount: amount,
      source: source || 'externo',
      title: note ? `Inversión: ${note}` : `Inversión al negocio (${sourceLabel})`,
      description: note || `Dinero invertido en el negocio desde ${sourceLabel}`,
      date: new Date(now).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      createdAt: now,
    };

    // Actualizar estado local inmediatamente
    setInvestments((prev) => [...prev, invTx]);

    // Registrar en SQLite
    if (user?.uid) {
      try {
        await insertTransaction(user.uid, invTx);
        DeviceEventEmitter.emit('local-db-changed');
      } catch (err) {
        console.error('Error saving investment transaction:', err);
      }
    }

    // Actualizar actividad reciente para ActivityItem
    if (addTransactionOptimistic) {
      addTransactionOptimistic(invTx);
    }
  };

  const isLoadingUser = userData?.totalDebt === undefined;

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
      
      // Buscar buyPrice en la venta o en el catálogo de productos
      let itemBuyPrice = s.buyPrice;
      if (itemBuyPrice === undefined || itemBuyPrice === null || itemBuyPrice === '') {
        const prod = products.find((p) => p.id === s.productId);
        itemBuyPrice = prod?.buyPrice;
      }

      // Solo sumar ganancia si el precio de compra fue especificado (> 0 y no vacío/null)
      const hasBuyPrice =
        itemBuyPrice !== undefined &&
        itemBuyPrice !== null &&
        itemBuyPrice !== '' &&
        !isNaN(parseFloat(itemBuyPrice)) &&
        parseFloat(itemBuyPrice) > 0;

      if (hasBuyPrice) {
        const buyP = parseFloat(itemBuyPrice);
        const profit = ((s.unitPrice ?? 0) - buyP) * (s.quantity ?? 1);
        ganancia += profit;
      }
    }

    // Descontar inversiones de hoy (persistente)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    let deductedIngresado = 0;
    let deductedGanancia = 0;

    for (const inv of investments) {
      // Filtrar solo las de hoy (o usar la fecha de la inversión)
      if (inv.createdAt >= startOfToday) {
        if (inv.source === 'ingresado') {
          deductedIngresado += (inv.amount || 0);
        } else if (inv.source === 'ganancia') {
          deductedGanancia += (inv.amount || 0);
        }
      }
    }

    ventasAmount = Math.max(0, ventasAmount - deductedIngresado);
    ganancia = Math.max(0, ganancia - deductedGanancia);

    return { gananciaVentas: ganancia, totalVentasAmount: ventasAmount, totalVentas: todaySalesFiltered.length, productosRegistrados: products.length };
  }, [todaySalesFiltered, products, investments]);

  return (
    <View style={styles.container}>
      {isOrg ? (
        // ─── Modo Organización: Deudas Pendientes + Pagos Recurrentes ───
        <>
          <View style={styles.row}>
            <MetricCard
              icon="alert-circle-outline"
              label="Deudas Pendientes"
              value={overrides['deudas'] ?? totalDeudas}
              isLoading={loadingClients}
              onEditValue={(v, r) => setOverride('deudas', v, r)}
              onReset={() => resetOverride('deudas')}
            />
            <RecurringPaymentsCard
              clients={clients}
              transactions={transactions}
              isLoading={loadingClients || loadingTx}
              value={overrides['recurrentes']}
              onEditValue={(v, r) => setOverride('recurrentes', v, r)}
              onReset={() => resetOverride('recurrentes')}
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
              onEditValue={(v, r) => setOverride('ingresado', v, r)}
              onReset={() => resetOverride('ingresado')}
            />
            <MetricCard
              icon="alert-circle-outline"
              label="Deudas Pendientes"
              value={overrides['deudas'] ?? totalDeudas}
              isLoading={loadingClients}
              onEditValue={(v, r) => setOverride('deudas', v, r)}
              onReset={() => resetOverride('deudas')}
            />
          </View>

          {/* Fila 2: Ganancia ventas + Ventas count */}
          <View style={styles.row}>
            <MetricCard
              icon="bar-chart-outline"
              label="Ganancia por Ventas"
              value={overrides['ganancia'] ?? gananciaVentas}
              isLoading={loadingProducts}
              onEditValue={(v, r) => setOverride('ganancia', v, r)}
              onReset={() => resetOverride('ganancia')}
            />
            <CountCard
              icon="receipt-outline"
              label="Ventas de hoy"
              count={overrides['ventas'] ?? totalVentas}
              isLoading={loadingProducts}
              onEditValue={(v, r) => setOverride('ventas', v, r)}
              onReset={() => resetOverride('ventas')}
            />
          </View>

          {/* Fila 3: Inversión */}
          <View style={styles.row}>
            <InvestmentCard
              totalInvested={totalInvested}
              investments={investments}
              isLoading={false}
              onAddInvestment={handleAddInvestment}
              totalIngresado={overrides['ingresado'] ?? totalVentasAmount}
              gananciaVentas={overrides['ganancia'] ?? gananciaVentas}
              value={overrides['inversion']}
              onEditValue={(v, r) => setOverride('inversion', v, r)}
              onReset={() => resetOverride('inversion')}
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
});

// ─── Estilos del menú de opciones ───
const menuStyles = StyleSheet.create({
  trigger: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6FA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    width: 140,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#ECEEF4',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F7',
  },
  menuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
});

// ─── Estilos de la tarjeta de inversión ───
const investStyles = StyleSheet.create({
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F7',
  },
  lastEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 6,
  },
  lastEntryText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  registerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#F9FAFB',
  },
  sourceChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sourceDesc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  sourceDescText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});

// ─── Estilos del modal de ajuste (bottom-sheet) ───
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
