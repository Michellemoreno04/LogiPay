import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { router } from 'expo-router';
import ShareTransactionCard from '../ShareTransactionCard';

// ─── Helpers de formato ──────────────────────────────────────────────────────

const formatNumber = (value) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return value;
  if (parts[0] === '') return cleaned;
  parts[0] = new Intl.NumberFormat('en-US').format(Number(parts[0]));
  return parts.join('.');
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export default function ClientDetailsModals({
  modalVisible,
  closeModal,
  optionsVisible,
  setOptionsVisible,
  detailsModalVisible,
  closeDetailsModal,
  transactionOptionsVisible,
  setTransactionOptionsVisible,
  client,
  selectedTransaction,
  selectedTxForOptions,
  txMenuPosition,
  transactionType,
  setTransactionType,
  amount,
  setAmount,
  title,
  setTitle,
  description,
  setDescription,
  editingTransactionId,
  saving,
  deleting,
  handleSaveTransaction,
  handleDeleteClient,
  handleDeleteTransaction,
  openEditModal,
}) {
  // ─── Estado del modal de compartir ───────────────────────────────────────
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingTx, setSharingTx] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRef = useRef(null);

  const openShareModal = (transaction) => {
    setSharingTx(transaction);
    setTransactionOptionsVisible(false);
    // Pequeño delay para que el menú cierre antes de abrir el modal
    setTimeout(() => setShareModalVisible(true), 150);
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const uri = await cardRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir comprobante de transacción',
        });
      }
    } catch (e) {
      console.error('[ClientDetailsModals] Error al compartir:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      {/* ── Modal: agregar / editar transacción ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: Platform.OS === 'ios' ? 60 : 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContainer}>
              {/* Header del modal */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <TouchableOpacity onPress={closeModal}>
                    <Text style={styles.modalCancel}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {editingTransactionId ? 'Editar Transacción' : (transactionType === 'payment' ? 'Abonar Pago' : 'Agregar Deuda')}
                </Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }} />
              </View>

              {/* Chip con nombre del cliente */}
              <View style={styles.clientChip}>
                <Ionicons name="person-circle-outline" size={20} color="#4C669F" />
                <Text style={styles.clientChipText}>{client?.name}</Text>
              </View>

              {/* Selector de tipo */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, transactionType === 'payment' && styles.typeButtonActivePayment]}
                  onPress={() => setTransactionType('payment')}
                >
                  <Ionicons name="arrow-down-circle" size={22} color={transactionType === 'payment' ? 'white' : '#34C759'} />
                  <Text style={[styles.typeButtonText, transactionType === 'payment' && styles.typeButtonTextActive]}>Pago</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, transactionType === 'debt' && styles.typeButtonActiveDebt]}
                  onPress={() => setTransactionType('debt')}
                >
                  <Ionicons name="arrow-up-circle" size={22} color={transactionType === 'debt' ? 'white' : '#FF3B30'} />
                  <Text style={[styles.typeButtonText, transactionType === 'debt' && styles.typeButtonTextActive]}>Deuda</Text>
                </TouchableOpacity>
              </View>

              {/* Monto */}
              <Text style={styles.inputLabel}>Monto *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#C7C7CC"
                  value={amount}
                  onChangeText={(text) => setAmount(formatNumber(text))}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              {/* Título */}
              <Text style={styles.inputLabel}>Título *</Text>
              <TextInput
                style={styles.titleInput}
                placeholder={transactionType === 'payment' ? 'Ej. Abono a cuenta...' : 'Ej. Préstamo de material...'}
                placeholderTextColor="#C7C7CC"
                value={title}
                onChangeText={setTitle}
              />

              {/* Descripción */}
              <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Detalles adicionales..."
                placeholderTextColor="#C7C7CC"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Botón guardar */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!amount || !title.trim() || saving) && styles.saveButtonDisabled,
                  transactionType === 'payment' ? styles.savePaymentTheme : styles.saveDebtTheme,
                ]}
                onPress={handleSaveTransaction}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.saveButtonText}>Guardar Transacción</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: opciones del cliente ── */}
      <Modal
        visible={optionsVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          <View style={styles.optionsContent}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsVisible(false);
                router.push({
                  pathname: '/add-user',
                  params: {
                    clientId: client?.id,
                    name: client?.name,
                    phone: client?.phone || '',
                    email: client?.email || '',
                  },
                });
              }}
            >
              <Ionicons name="create-outline" size={22} color="#4C669F" />
              <Text style={styles.optionText}>Editar cliente</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionItem} onPress={handleDeleteClient}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Eliminar cliente</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Detalles de la transacción ── */}
      <Modal
        visible={detailsModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeDetailsModal}
      >
        <TouchableOpacity style={styles.detailsOverlay} activeOpacity={1} onPress={closeDetailsModal}>
          <TouchableOpacity activeOpacity={1} style={styles.detailsModalContent}>
            {selectedTransaction && (
              <>
                {/* Header con icono y título */}
                <View style={styles.detailsHeader}>
                  <View style={[styles.iconBg, {
                    backgroundColor: selectedTransaction.type === 'payment' ? '#E8F9EE' : '#FDECEA',
                    marginRight: 12,
                    width: 48, height: 48, borderRadius: 24,
                  }]}>
                    <Ionicons
                      name={selectedTransaction.type === 'payment' ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={30}
                      color={selectedTransaction.type === 'payment' ? '#34C759' : '#FF3B30'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailsTitle}>{selectedTransaction.title || selectedTransaction.description}</Text>
                    <Text style={styles.detailsDate}>{selectedTransaction.date}</Text>
                  </View>
                </View>

                {/* Nombre del cliente */}
                <View style={styles.detailsClientRow}>
                  <Ionicons name="person-circle-outline" size={18} color="#4C669F" />
                  <Text style={styles.detailsClientName}>{client?.name || 'Cliente'}</Text>
                </View>

                {/* Monto */}
                <View style={styles.detailsBody}>
                  <Text style={styles.detailsLabel}>Monto</Text>
                  <Text style={[styles.detailsAmount, selectedTransaction.type === 'payment' ? styles.positiveBalance : styles.negativeBalance]}>
                    {selectedTransaction.type === 'payment' ? '+' : '-'}${formatCurrency(selectedTransaction.amount)}
                  </Text>

                  {/* Descripción (solo si existe y es diferente al título) */}
                  {selectedTransaction.description && selectedTransaction.description !== selectedTransaction.title && (
                    <>
                      <Text style={[styles.detailsLabel, { marginTop: 16 }]}>Descripción</Text>
                      <Text style={styles.detailsDescriptionText}>{selectedTransaction.description}</Text>
                    </>
                  )}
                </View>

                {/* Acciones: Editar | Cerrar */}
                <View style={styles.detailsActions}>
                  <TouchableOpacity
                    style={[styles.detailsActionBtn, styles.detailsEditBtn]}
                    onPress={() => { closeDetailsModal(); openEditModal(selectedTransaction); }}
                  >
                    <Ionicons name="create-outline" size={18} color="#4C669F" />
                    <Text style={[styles.detailsActionText, { color: '#4C669F' }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailsActionBtn, styles.detailsCloseButton]}
                    onPress={closeDetailsModal}
                  >
                    <Text style={styles.detailsCloseText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Opciones de transacción ── */}
      <Modal
        visible={transactionOptionsVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setTransactionOptionsVisible(false)}
      >
        <TouchableOpacity style={styles.txOptionsOverlay} activeOpacity={1} onPress={() => setTransactionOptionsVisible(false)}>
          <View
            style={[
              styles.txOptionsContent,
              {
                top: (() => {
                  const { height: screenHeight } = Dimensions.get('window');
                  const menuHeight = 150;
                  let calculatedTop = txMenuPosition.y + menuHeight > screenHeight - 40
                    ? txMenuPosition.y - menuHeight - 10
                    : txMenuPosition.y + 10;
                  return Math.max(20, calculatedTop);
                })(),
                right: 20,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setTransactionOptionsVisible(false);
                if (selectedTxForOptions) openEditModal(selectedTxForOptions);
              }}
            >
              <Ionicons name="create-outline" size={22} color="#4C669F" />
              <Text style={styles.optionText}>Editar Transacción</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => openShareModal(selectedTxForOptions)}
            >
              <Ionicons name="share-outline" size={22} color="#4C669F" />
              <Text style={styles.optionText}>Compartir</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setTransactionOptionsVisible(false);
                if (selectedTxForOptions) handleDeleteTransaction(selectedTxForOptions.id);
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Eliminar Transacción</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Compartir transacción (previsualización de tarjeta) ── */}
      <Modal
        visible={shareModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={styles.shareSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            <Text style={styles.shareTitle}>Compartir comprobante</Text>
            <Text style={styles.shareSubtitle}>
              Se generará una imagen lista para enviar
            </Text>

            {/* Previsualización de la tarjeta — renderizada aquí y capturada */}
            <ScrollView
              horizontal
              contentContainerStyle={styles.cardPreviewContainer}
              showsHorizontalScrollIndicator={false}
            >
              <ViewShot
                ref={cardRef}
                options={{ format: 'png', quality: 1 }}
                style={styles.viewShot}
              >
                <ShareTransactionCard
                  transaction={sharingTx}
                  clientName={client?.name}
                />
              </ViewShot>
            </ScrollView>

            {/* Botones */}
            <View style={styles.shareActions}>
              <TouchableOpacity
                style={styles.shareCancelBtn}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={styles.shareCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shareConfirmBtn,
                  sharingTx?.type === 'payment' ? styles.shareConfirmPayment : styles.shareConfirmDebt,
                ]}
                onPress={handleShare}
                disabled={isCapturing}
              >
                {isCapturing
                  ? <ActivityIndicator color="white" size="small" />
                  : (
                    <>
                      <Ionicons name="share-outline" size={20} color="white" />
                      <Text style={styles.shareConfirmText}>Compartir imagen</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Overlay de eliminando ── */}
      {deleting && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.deletingText}>Eliminando cliente...</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  /* ── Modal de transacción ── */
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
    flex: 2,
    textAlign: 'center',
  },
  clientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  clientChipText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#4C669F',
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
  titleInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 20,
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
  savePaymentTheme: {
    backgroundColor: '#34C759',
  },
  saveDebtTheme: {
    backgroundColor: '#FF3B30',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D1D6',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  /* ── Modal de opciones ── */
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 60,
    paddingRight: 20,
  },
  optionsContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  txOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  txOptionsContent: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    width: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  deletingText: {
    color: 'white',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  detailsModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  detailsClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  detailsClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C669F',
    marginLeft: 6,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 15,
    marginBottom: 15,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  detailsDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  detailsBody: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailsAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  detailsDescriptionText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  detailsActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  detailsEditBtn: {
    backgroundColor: '#F0F4FF',
  },
  detailsActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailsCloseButton: {
    backgroundColor: '#F2F2F7',
  },
  detailsCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  negativeBalance: { color: '#FF3B30' },
  positiveBalance: { color: '#34C759' },
  /* ── Modal de compartir ── */
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  shareSheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 4,
  },
  shareSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  cardPreviewContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewShot: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  shareActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shareCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  shareCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  shareConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareConfirmPayment: {
    backgroundColor: '#34C759',
  },
  shareConfirmDebt: {
    backgroundColor: '#FF3B30',
  },
  shareConfirmText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
  },
});
