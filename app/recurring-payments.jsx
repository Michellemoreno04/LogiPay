import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { useLocalData } from '../context/LocalDataContext';
import { addTransaction } from '../utils/clientService';
import { getAllClientTransactions } from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const formatCurrency = (value) =>
  Math.abs(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Sub-modal para registrar pago de cuota ───
function RegisterPaymentModal({
  visible,
  onClose,
  clients,
  targetMember,
  targetYear,
  targetMonth,
  onSave,
  isSubmitting,
}) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isChangingMember, setIsChangingMember] = useState(false);

  useEffect(() => {
    if (visible) {
      if (targetMember) {
        setSelectedClientId(targetMember.id);
        setIsChangingMember(false);
      } else {
        setSelectedClientId('');
        setIsChangingMember(false);
      }
      setAmount('');
      setTitle(`Cuota de ${MONTH_NAMES[targetMonth]} ${targetYear}`);
      setMemberSearch('');
    }
  }, [visible, targetMember, targetYear, targetMonth]);

  const selectedMember = selectedClientId
    ? (clients || []).find((c) => c.id === selectedClientId)
    : null;

  const filteredClients = useMemo(() => {
    if (!memberSearch.trim()) return clients || [];
    return (clients || []).filter(
      (c) =>
        (c.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (c.phone || '').includes(memberSearch)
    );
  }, [clients, memberSearch]);

  const handleConfirm = () => {
    if (!selectedClientId) {
      Alert.alert('Selecciona un miembro', 'Por favor selecciona el miembro que realiza el pago.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto inválido', 'Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    onSave({
      clientId: selectedClientId,
      amount: parsedAmount,
      title: title.trim() || `Cuota de ${MONTH_NAMES[targetMonth]} ${targetYear}`,
      targetYear,
      targetMonth,
    });
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
                <View style={modalStyles.handle} />

                <View style={modalStyles.header}>
                  <LinearGradient
                    colors={['#16A34A', '#22C55E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={modalStyles.headerIcon}
                  >
                    <Ionicons name="card-outline" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={modalStyles.headerTitle}>Registrar Pago de Cuota</Text>
                    <Text style={modalStyles.headerSubtitle}>
                      {MONTH_NAMES[targetMonth]} {targetYear}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                </View>

                {/* Selección de Miembro */}
                <Text style={modalStyles.inputLabel}>Miembro que paga *</Text>
                {selectedMember && !isChangingMember ? (
                  <View style={modalStyles.selectedMemberCard}>
                    <View style={modalStyles.memberAvatar}>
                      <Text style={modalStyles.memberAvatarText}>
                        {(selectedMember.name || 'M')[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={modalStyles.memberName}>{selectedMember.name}</Text>
                      {selectedMember.phone ? (
                        <Text style={modalStyles.memberPhone}>{selectedMember.phone}</Text>
                      ) : null}
                    </View>
                    {clients && clients.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setIsChangingMember(true)}
                        style={modalStyles.changeMemberBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={modalStyles.changeMemberText}>Cambiar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={modalStyles.memberPickerBox}>
                    <TextInput
                      style={modalStyles.memberPickerSearch}
                      placeholder="Buscar miembro..."
                      placeholderTextColor="#9CA3AF"
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                    />
                    <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                      {filteredClients.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => {
                            setSelectedClientId(c.id);
                            setIsChangingMember(false);
                          }}
                          style={[
                            modalStyles.memberPickerItem,
                            selectedClientId === c.id && modalStyles.memberPickerItemActive,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              modalStyles.memberPickerItemText,
                              selectedClientId === c.id && modalStyles.memberPickerItemTextActive,
                            ]}
                          >
                            {c.name}
                          </Text>
                          {selectedClientId === c.id && (
                            <Ionicons name="checkmark" size={16} color="#2563EB" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Monto */}
                <Text style={[modalStyles.inputLabel, { marginTop: 14 }]}>Monto a pagar *</Text>
                <View style={modalStyles.inputWrapper}>
                  <Text style={[modalStyles.currency, { color: '#16A34A' }]}>$</Text>
                  <TextInput
                    style={modalStyles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                  />
                </View>

                {/* Concepto */}
                <Text style={modalStyles.inputLabel}>Concepto o descripción</Text>
                <View style={modalStyles.conceptInputWrapper}>
                  <TextInput
                    style={modalStyles.conceptInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej. Cuota mensual de socio"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Botones */}
                <View style={modalStyles.btnRow}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={modalStyles.cancelBtn}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Text style={modalStyles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isSubmitting}
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#16A34A', '#22C55E']}
                      style={modalStyles.saveBtn}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={modalStyles.saveText}>Confirmar Pago</Text>
                        </>
                      )}
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

// ─── Pantalla Principal de Pagos Recurrentes ───
export default function RecurringPaymentsScreen() {
  const { user } = useAuth();
  const { clients, loadingClients } = useLocalData();

  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  // 'month' | 'all'
  const [historyScope, setHistoryScope] = useState('month');

  // Sub-modal para registrar pago
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Cargar transacciones
  const loadTxs = async () => {
    if (!user) return;
    try {
      const txs = await getAllClientTransactions(user.uid);
      setTransactions(txs || []);
    } catch (err) {
      console.error('Error loading org transactions:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    loadTxs();
    const sub = DeviceEventEmitter.addListener('local-db-changed', loadTxs);
    return () => {
      sub.remove();
    };
  }, [user]);

  // Mapa de clientes para nombres en historial
  const clientsMap = useMemo(() => {
    const map = {};
    (clients || []).forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [clients]);

  // Historial de todos los pagos ordenados descendente
  const allPayments = useMemo(() => {
    return (transactions || [])
      .filter((tx) => tx.type === 'recurring_payment')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [transactions]);

  // Año más antiguo con actividad de pagos registrada
  const earliestYear = useMemo(() => {
    let earliest = currentYear;
    (transactions || []).forEach((tx) => {
      if (tx.type === 'recurring_payment' && tx.createdAt) {
        const y = new Date(tx.createdAt).getFullYear();
        if (!isNaN(y) && y < earliest) earliest = y;
      }
    });
    return earliest;
  }, [transactions, currentYear]);

  // Años con registros disponibles (desde el más antiguo hasta el actual)
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= earliestYear; y--) {
      years.push(y);
    }
    return years;
  }, [earliestYear, currentYear]);

  // Pagos del año seleccionado
  const paymentsInSelectedYear = useMemo(() => {
    return allPayments.filter((tx) => {
      const d = new Date(tx.createdAt);
      return d.getFullYear() === selectedYear;
    });
  }, [allPayments, selectedYear]);

  // Pagos del mes y año seleccionados
  const paymentsInSelectedMonth = useMemo(() => {
    return paymentsInSelectedYear.filter((tx) => {
      const d = new Date(tx.createdAt);
      return d.getMonth() === selectedMonth;
    });
  }, [paymentsInSelectedYear, selectedMonth]);

  // Total recaudado en el mes seleccionado
  const totalRecaudadoMonth = useMemo(() => {
    return paymentsInSelectedMonth.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );
  }, [paymentsInSelectedMonth]);

  // Total recaudado en el año seleccionado
  const totalRecaudadoYear = useMemo(() => {
    return paymentsInSelectedYear.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );
  }, [paymentsInSelectedYear]);

  // Navegación de año (limitada al rango con actividad)
  const handlePrevYear = () => {
    setSelectedYear((prev) => Math.max(prev - 1, earliestYear));
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => Math.min(prev + 1, currentYear));
  };

  // Selección única de mes (mediante las pastillas de mes)
  const handleSelectSpecificMonth = (monthIndex) => {
    setSelectedMonth(monthIndex);
  };

  const handleGoToToday = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setHistoryScope('month');
  };

  // Guardar pago
  const handleSavePayment = async ({ clientId, amount, title, targetYear, targetMonth }) => {
    if (!user) return;
    setIsSubmittingPay(true);
    try {
      const isCurrent = targetYear === currentYear && targetMonth === currentMonth;
      const createdAt = isCurrent
        ? Date.now()
        : new Date(targetYear, targetMonth, 15, 12, 0).getTime();

      await addTransaction({
        uid: user.uid,
        clientId,
        type: 'recurring_payment',
        amount,
        title: title || `Cuota de ${MONTH_NAMES[targetMonth]} ${targetYear}`,
        description: `Pago recurrente ${MONTH_NAMES[targetMonth]} ${targetYear}`,
        createdAt,
      });

      DeviceEventEmitter.emit('local-db-changed');
      syncOutbox().catch(console.error);

      setShowRegisterModal(false);
      Alert.alert('¡Pago registrado!', `Se ha registrado el pago de $${formatCurrency(amount)} con éxito.`);
      loadTxs();
    } catch (error) {
      console.error('Error registrando pago:', error);
      Alert.alert('Error', 'No se pudo guardar el pago. Inténtalo de nuevo.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const isCurrentSelection = selectedYear === currentYear && selectedMonth === currentMonth;

  // Formato de fecha para historial
  const formatHistoryDate = (timestamp, dateStr) => {
    if (!timestamp) return dateStr || '';
    const d = new Date(timestamp);
    const day = d.getDate();
    const monthName = MONTH_SHORT[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${monthName} ${year}, ${hours}:${minutes} ${ampm}`;
  };

  // Pagos a mostrar según el filtro de alcance seleccionado
  const displayedPayments = useMemo(() => {
    if (historyScope === 'all') return allPayments;
    return paymentsInSelectedMonth;
  }, [historyScope, allPayments, paymentsInSelectedMonth]);

  const isLoading = loadingClients || loadingTx;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ─── Encabezado de la Pantalla ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1F4B" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Pagos Recurrentes</Text>
          <Text style={styles.headerSubtitle}>Control y registro de cuotas mensuales</Text>
        </View>
        <View style={styles.headerIconBadge}>
          <Ionicons name="repeat-outline" size={20} color="#2563EB" />
        </View>
      </View>

      {isLoading && transactions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Cargando información de pagos...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 1. BOTÓN REGISTRAR PAGO (ARRIBA)                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TouchableOpacity
            onPress={() => setShowRegisterModal(true)}
            style={styles.actionBanner}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#1A1F4B', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBannerGradient}
            >
              <View style={styles.actionBannerIcon}>
                <Ionicons name="add-circle" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionBannerTitle}>
                  Registrar Pago de {MONTH_NAMES[selectedMonth]}
                </Text>
                <Text style={styles.actionBannerSub}>
                  Selecciona el miembro y registra su aporte
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" opacity={0.8} />
            </LinearGradient>
          </TouchableOpacity>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 2. SELECTOR DE AÑO Y MES (EN MEDIO)                            */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWrap}>
                <Ionicons name="calendar-outline" size={16} color="#1A1F4B" style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeading}>
                  Fecha a Consultar
                </Text>
              </View>
              {!isCurrentSelection && (
                <TouchableOpacity
                  onPress={handleGoToToday}
                  style={styles.todayBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="today-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={[styles.todayBtnText, { color: '#2563EB' }]}>Ir a fecha actual</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ─── SELECTOR DE AÑO ─── */}
            <View style={styles.yearSelectorBar}>
              <TouchableOpacity
                onPress={handlePrevYear}
                style={styles.yearNavBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={18} color="#1A1F4B" />
              </TouchableOpacity>

              <View style={styles.yearDisplay}>
                <Text style={styles.yearText}>Año {selectedYear}</Text>
                {selectedYear === currentYear && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Actual</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleNextYear}
                style={styles.yearNavBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={18} color="#1A1F4B" />
              </TouchableOpacity>
            </View>

            {/* Pills de años — solo si hay más de 1 año con actividad */}
            {availableYears.length > 1 && (
              <View style={styles.quickYearsRow}>
                <Text style={styles.quickYearsLabel}>Año:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {availableYears.map((yr) => (
                    <TouchableOpacity
                      key={yr}
                      onPress={() => setSelectedYear(yr)}
                      style={[
                        styles.yearQuickPill,
                        selectedYear === yr && styles.yearQuickPillActive,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.yearQuickPillText,
                          selectedYear === yr && styles.yearQuickPillTextActive,
                        ]}
                      >
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── NAVEGACIÓN ENTRE MESES ─── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthPillsRow}
              style={{ marginTop: 6, marginBottom: 12 }}
            >
              {MONTH_SHORT.map((mShort, idx) => {
                const isSelected = selectedMonth === idx;
                const isThisCurrent = selectedYear === currentYear && currentMonth === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSelectSpecificMonth(idx)}
                    style={[
                      styles.monthPill,
                      isSelected && styles.monthPillActive,
                      isThisCurrent && !isSelected && styles.monthPillCurrent,
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.monthPillText,
                        isSelected && styles.monthPillTextActive,
                        isThisCurrent && !isSelected && styles.monthPillTextCurrent,
                      ]}
                    >
                      {mShort}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Resumen del mes seleccionado */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>
                Total recaudado · {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Text>
              <Text style={[styles.summaryCardValue, { color: '#16A34A', fontSize: 22 }]} numberOfLines={1}>
                ${formatCurrency(totalRecaudadoMonth)}
              </Text>
              <Text style={styles.summaryCardSub}>
                {paymentsInSelectedMonth.length} {paymentsInSelectedMonth.length === 1 ? 'aporte' : 'aportes'} registrados este mes
              </Text>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3. HISTORIAL DE PAGOS (ABAJO)                                  */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWrap}>
                <Ionicons name="time-outline" size={16} color="#1A1F4B" style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeading}>
                  Historial de Pagos
                </Text>
              </View>
            </View>

            {/* Filtros de alcance del historial — solo mes y todos */}
            <View style={styles.historyScopeRow}>
              <TouchableOpacity
                onPress={() => setHistoryScope('month')}
                style={[
                  styles.historyScopeBtn,
                  historyScope === 'month' && styles.historyScopeBtnActive,
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.historyScopeText,
                    historyScope === 'month' && styles.historyScopeTextActive,
                  ]}
                >
                  {MONTH_SHORT[selectedMonth]} {selectedYear} ({paymentsInSelectedMonth.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setHistoryScope('all')}
                style={[
                  styles.historyScopeBtn,
                  historyScope === 'all' && styles.historyScopeBtnActive,
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.historyScopeText,
                    historyScope === 'all' && styles.historyScopeTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
            </View>

            {displayedPayments.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="receipt-outline" size={36} color="#C7C7CC" />
                <Text style={styles.emptyHistoryText}>
                  {historyScope === 'month'
                    ? `No hay pagos en ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`
                    : 'No hay pagos registrados aún.'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowRegisterModal(true)}
                  style={{ marginTop: 10, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#EFF6FF', borderRadius: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>
                    + Registrar pago para esta fecha
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.historyList}>
                {displayedPayments.map((item) => {
                  const client = clientsMap[item.clientId];
                  const displayName = client?.name || item.title || 'Miembro';
                  return (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyAvatar}>
                        <Text style={styles.historyAvatarText}>
                          {displayName[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.historyName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={styles.historyDate}>
                          {formatHistoryDate(item.createdAt, item.date)}
                        </Text>
                        {item.title ? (
                          <Text style={styles.historyTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.historyAmountBadge}>
                        <Text style={styles.historyAmountText}>
                          +${formatCurrency(item.amount)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Sub-modal para registrar pago */}
      <RegisterPaymentModal
        visible={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        clients={clients || []}
        targetYear={selectedYear}
        targetMonth={selectedMonth}
        onSave={handleSavePayment}
        isSubmitting={isSubmittingPay}
      />
    </SafeAreaView>
  );
}

// ─── Estilos de la Pantalla ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1F4B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Banner para registrar pago
  actionBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionBannerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 2,
  },

  // Secciones
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1F4B',
    letterSpacing: 0.2,
  },

  // Historial de pagos anteriores
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  historyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  historyAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  historyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F1629',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  historyTitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    fontStyle: 'italic',
  },
  historyAmountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  historyAmountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },

  // Selector de Año
  yearSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F1629',
  },
  currentBadge: {
    marginLeft: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  quickYearsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  quickYearsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  yearQuickPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearQuickPillActive: {
    backgroundColor: '#1A1F4B',
    borderColor: '#1A1F4B',
  },
  yearQuickPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  yearQuickPillTextActive: {
    color: '#FFFFFF',
  },

  // Tira horizontal de meses
  monthPillsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  monthPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  monthPillCurrent: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  monthPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  monthPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthPillTextCurrent: {
    color: '#2563EB',
    fontWeight: '700',
  },

  // Resumen (card única de total mensual)
  summaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryCardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#15803D',
  },
  summaryCardSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4ADE80',
    marginTop: 3,
    textAlign: 'center',
  },

  // Filtros de alcance del historial
  historyScopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  historyScopeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyScopeBtnActive: {
    backgroundColor: '#1A1F4B',
    borderColor: '#1A1F4B',
  },
  historyScopeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  historyScopeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

// ─── Estilos del sub-modal de registro ───
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A1F4B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F1629',
  },
  memberPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  changeMemberBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeMemberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  memberPickerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  memberPickerSearch: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F1629',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  memberPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  memberPickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  memberPickerItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  memberPickerItemTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderColor: '#22C55E55',
    gap: 8,
  },
  currency: {
    fontSize: 28,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1F4B',
    padding: 0,
  },
  conceptInputWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  conceptInput: {
    fontSize: 14,
    color: '#0F1629',
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
