import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { useLocalData } from '../context/LocalDataContext';
import { addBarcodeToProduct, recordSale, recordSaleOrder } from '../utils/productService';

export default function QuickScanScreen() {
  const insets = useSafeAreaInsets();
  const { user, userData, updateLocalUserData } = useAuth();
  const { products, clients, addSaleOptimistic, addTransactionOptimistic } = useLocalData();

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [torchOn, setTorchOn] = useState(false);
  // Cámara desactivada por defecto — el usuario la activa manualmente
  const [cameraActive, setCameraActive] = useState(false);
  // Enfoque manual al tocar
  const [focusPoint, setFocusPoint] = useState(null); // { x, y }
  const focusAnim = useRef(new Animated.Value(0)).current;
  // Estado OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const cameraRef = useRef(null);

  // Escaner de códigos nativo de VisionCamera v5
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13','ean-8','upc-a','upc-e','code-128','code-39','code-93','qr','pdf-417','aztec','data-matrix'],
    onCodeScanned: (codes) => {
      codes.forEach((code) => {
        if (code.value) handleBarcodeScanned({ data: code.value });
      });
    },
  });

  // Lista de productos escaneados [{ product, quantity }]
  const [scannedItems, setScannedItems] = useState([]);
  // Lista de códigos no reconocidos [{ barcode, timestamp }]
  const [unknownBarcodes, setUnknownBarcodes] = useState([]);

  // Notificación flotante de 1 segundo ("Producto agregado")
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Producto agregado');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);

  // Modal de agregar producto manual
  const [manualPickerVisible, setManualPickerVisible] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  // Modal de vincular producto a código desconocido
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkingBarcode, setLinkingBarcode] = useState(null); // { id, barcode }
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkingSaving, setLinkingSaving] = useState(false);

  // Modal de revisión de orden / Checkout
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [processingSale, setProcessingSale] = useState(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const lastScanRef = useRef({ code: null, time: 0 });

  // Animación de escáner
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Manejar toque en la cámara para enfocar (nativo real con VisionCamera)
  const handleCameraTouch = useCallback(async (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    setFocusPoint({ x: locationX, y: locationY });

    // Animar el indicador de enfoque
    focusAnim.setValue(0);
    Animated.sequence([
      Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(focusAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setFocusPoint(null));

    // Tap-to-focus real con VisionCamera
    try {
      await cameraRef.current?.focus({ x: locationX, y: locationY });
    } catch (_) { /* Algunos dispositivos no soportan focus manual */ }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
  }, [focusAnim]);

  // Función para mostrar notificación emergente por 1 segundo
  const showToastNotification = (msg = 'Producto agregado') => {
    setToastMessage(msg);
    setToastVisible(true);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
      });
    }, 2000);
  };

  // Reproductor de audio con expo-audio (MP3 local)
  const beepPlayer = useAudioPlayer(require('../assets/images/audios/beep-producto_registered.mp3'));

  // Reproducir sonido + respuesta háptica al agregar producto
  const playAddProductSound = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Vibration.vibrate(100);
    }

    try {
      beepPlayer.seekTo(0);
      beepPlayer.play();
    } catch (e) {
      // Ignorar si el audio no está disponible
    }
  };

  // Manejador de escaneo continuo — declarado antes del OCR handler para poder referenciarlo
  const handleBarcodeScanned = useCallback(({ data }) => {
    const now = Date.now();
    // Evitar lecturas duplicadas en menos de 0.8s para el mismo código de barras en la cámara
    if (lastScanRef.current.code === data && now - lastScanRef.current.time < 800) {
      return;
    }
    lastScanRef.current = { code: data, time: now };

    const cleanCode = String(data).trim();
    // Buscar el producto por barcode principal O por el array de barcodes vinculados
    const matchedProduct = products.find(
      (p) => {
        if (p.barcode && String(p.barcode).trim() === cleanCode) return true;
        try {
          const extraBarcodes = JSON.parse(p.barcodes || '[]');
          return Array.isArray(extraBarcodes) && extraBarcodes.includes(cleanCode);
        } catch { return false; }
      }
    );

    if (matchedProduct) {
      // Verificar si el producto ya existe ANTES de llamar a setState,
      // así podemos reproducir el sonido de forma confiable (sin depender
      // de variables mutadas dentro del callback asíncrono del setter).
      setScannedItems((prev) => {
        const existingIdx = prev.findIndex((item) => item.product.id === matchedProduct.id);
        if (existingIdx >= 0) {
          // El producto ya fue escaneado antes: NO volver a agregarlo ni incrementar cantidad
          return prev;
        }
        // Programar sonido/toast después del render (fuera del setter)
        setTimeout(() => {
          playAddProductSound();
          showToastNotification('Producto agregado');
        }, 0);
        return [{ product: matchedProduct, quantity: 1 }, ...prev];
      });
    } else {
      // Si el código no está guardado, agregar a la lista de desconocidos si no existe ya
      setUnknownBarcodes((prev) => {
        if (prev.some((item) => item.barcode === cleanCode)) return prev;
        return [{ barcode: cleanCode, id: `unk_${now}` }, ...prev];
      });
    }
  }, [products, playAddProductSound, showToastNotification]);

  // ─── OCR: captura foto y extrae números con Google Cloud Vision ───
  const handleOcrCapture = useCallback(async () => {
    if (!cameraRef.current || ocrLoading) return;
    setOcrLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // VisionCamera v5: takePhoto() en lugar de takePictureAsync()
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });

      // Leer el archivo como base64
      const base64 = await fetch(`file://${photo.path}`)
        .then((r) => r.blob())
        .then(
          (blob) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result?.split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
        );
      const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${FIREBASE_API_KEY}`;

      const body = {
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: 'TEXT_DETECTION', maxResults: 10 },
              { type: 'BARCODE_DETECTION', maxResults: 5 },
            ],
          },
        ],
      };

      const res = await fetch(visionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      const annotations = json?.responses?.[0];

      // 1. Intentar primero con detección de barcode nativa de Vision API
      const visionBarcodes = annotations?.barcodeAnnotations || [];
      if (visionBarcodes.length > 0) {
        visionBarcodes.forEach((bc) => {
          if (bc.rawValue) handleBarcodeScanned({ data: bc.rawValue });
        });
        showToastNotification('✓ Código detectado por OCR');
        return;
      }

      // 2. Fallback: extraer números de la detección de texto
      const textAnnotations = annotations?.textAnnotations || [];
      const fullText = textAnnotations?.[0]?.description || '';

      // Buscar secuencias numéricas que parezcan códigos de barras (8-14 dígitos)
      const numberMatches = fullText
        .replace(/\s+/g, ' ')
        .match(/\b\d{8,14}\b/g);

      if (numberMatches && numberMatches.length > 0) {
        let found = false;
        for (const num of numberMatches) {
          const cleanCode = num.trim();
          const matchedProduct = products.find((p) => {
            if (p.barcode && String(p.barcode).trim() === cleanCode) return true;
            try {
              const extraBarcodes = JSON.parse(p.barcodes || '[]');
              return Array.isArray(extraBarcodes) && extraBarcodes.includes(cleanCode);
            } catch { return false; }
          });
          if (matchedProduct) {
            handleBarcodeScanned({ data: cleanCode });
            showToastNotification('✓ Número leído por OCR');
            found = true;
            break;
          }
        }
        if (!found) {
          const longestNum = numberMatches.sort((a, b) => b.length - a.length)[0];
          handleBarcodeScanned({ data: longestNum });
          showToastNotification(`OCR: ${longestNum}`);
        }
      } else {
        showToastNotification('No se detectó ningún número');
      }
    } catch (e) {
      console.warn('Error OCR:', e);
      showToastNotification('Error al procesar la imagen');
    } finally {
      setOcrLoading(false);
    }
  }, [ocrLoading, products, handleBarcodeScanned, showToastNotification]);

  // Modificar cantidad
  const handleUpdateQuantity = (productId, delta) => {
    setScannedItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Eliminar item
  const handleRemoveItem = (productId) => {
    setScannedItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Agregar producto manualmente desde el picker
  const handleManualAddProduct = (product) => {
    setScannedItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        // Si ya existe, incrementar cantidad
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + 1 };
        return updated;
      }
      return [{ product, quantity: 1 }, ...prev];
    });
    playAddProductSound();
    showToastNotification(`${product.name} agregado`);
  };

  // Productos filtrados para el picker manual
  const filteredManualProducts = products.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
      (p.barcode || '').includes(manualSearchQuery)
  );

  // Eliminar código desconocido de la lista
  const handleRemoveUnknown = (barcodeId) => {
    setUnknownBarcodes((prev) => prev.filter((item) => item.id !== barcodeId));
  };

  // Redirigir a crear producto con ese código
  const handleAddProduct = (barcode) => {
    router.push({
      pathname: '/add-product',
      params: { barcode },
    });
  };

  // Abrir modal de vinculación para un barcode desconocido
  const handleLinkProduct = (unknownItem) => {
    setLinkingBarcode(unknownItem);
    setLinkSearchQuery('');
    setLinkModalVisible(true);
  };

  // Productos filtrados para el picker de vinculación
  const filteredLinkProducts = products.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
      (p.barcode || '').includes(linkSearchQuery)
  );

  // Vincular: agrega el barcode escaneado al array de barcodes del producto
  // SIN reemplazar el barcode principal. Ambos códigos apuntan al mismo producto.
  const handleConfirmLink = async (product) => {
    if (!user || !linkingBarcode || linkingSaving) return;
    setLinkingSaving(true);
    try {
      await addBarcodeToProduct({
        uid: user.uid,
        productId: product.id,
        newBarcode: linkingBarcode.barcode,
      });
      // Remover el item desconocido y agregar el producto a la lista de venta
      setUnknownBarcodes((prev) => prev.filter((item) => item.id !== linkingBarcode.id));
      setScannedItems((prev) => {
        const existing = prev.find((s) => s.product.id === product.id);
        if (existing) {
          return prev.map((s) =>
            s.product.id === product.id ? { ...s, quantity: s.quantity + 1 } : s
          );
        }
        return [...prev, { product, quantity: 1 }];
      });
      DeviceEventEmitter.emit('products-db-changed');
      showToastNotification('Producto vinculado ✓');
      setLinkModalVisible(false);
      setLinkingBarcode(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo vincular el producto. Intenta de nuevo.');
      console.error(e);
    } finally {
      setLinkingSaving(false);
    }
  };

  // Cálculos de resumen
  const totalArticlesCount = scannedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalSaleAmount = scannedItems.reduce(
    (sum, item) => sum + item.quantity * (parseFloat(item.product.price) || 0),
    0
  );

  // Filtrar clientes para el modal de orden
  const filteredClients = clients.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      (c.phone || '').includes(clientSearchQuery)
  );

  // Procesar y confirmar la venta
  const handleConfirmOrder = async () => {
    if (!user || scannedItems.length === 0) return;
    setProcessingSale(true);
    try {
      const targetClientId = selectedClient ? selectedClient.id : '';
      const targetClientName = selectedClient ? selectedClient.name : 'Venta al contado';

      const itemsToRecord = scannedItems.map((item) => ({
        productId: item.product.id,
        productName: item.product.name || '',
        quantity: item.quantity,
        unitPrice: item.product.price || 0,
      }));

      const orderResult = await recordSaleOrder({
        uid: user.uid,
        clientId: targetClientId,
        clientName: targetClientName,
        items: itemsToRecord,
      });

      if (orderResult?.salesResults) {
        for (const sRes of orderResult.salesResults) {
          addSaleOptimistic({
            saleId: sRes.saleId,
            productId: sRes.productId,
            clientId: targetClientId,
            clientName: targetClientName,
            quantity: sRes.quantity,
            unitPrice: sRes.unitPrice,
            buyPrice: sRes.buyPrice,
            totalAmount: sRes.totalAmount,
            date: sRes.date,
            newStock: sRes.newStock,
            productName: sRes.productName,
          });
        }
      }

      if (orderResult?.txId) {
        const txTitle = `Factura de compra (${scannedItems.length} producto${scannedItems.length > 1 ? 's' : ''})`;
        const txDescription = JSON.stringify({
          isInvoice: true,
          items: orderResult.items,
          totalAmount: orderResult.totalOrderAmount,
        });

        addTransactionOptimistic({
          txId: orderResult.txId,
          clientId: targetClientId,
          clientName: targetClientName,
          type: targetClientId ? 'debt' : 'sale',
          amount: orderResult.totalOrderAmount,
          title: txTitle,
          description: txDescription,
        });

        if (targetClientId && updateLocalUserData) {
          updateLocalUserData({
            totalDebt: (userData?.totalDebt || 0) + orderResult.totalOrderAmount,
          });
        }
      }

      DeviceEventEmitter.emit('products-db-changed');
      DeviceEventEmitter.emit('local-db-changed');

      const clientText = selectedClient ? ` a ${selectedClient.name}` : '';
      Alert.alert(
        '¡Venta completada!',
        `Se registró la venta de ${totalArticlesCount} artículo(s)${clientText} por $${totalSaleAmount.toFixed(2)}.`,
        [
          {
            text: 'Aceptar',
            onPress: () => {
              setReviewModalVisible(false);
              setScannedItems([]);
              setUnknownBarcodes([]);
              setSelectedClient(null);
              router.back();
            },
          },
        ]
      );
    } catch (e) {
      console.error('Error al procesar orden rápida:', e);
      Alert.alert('Error', 'No se pudo completar la venta. Intenta de nuevo.');
    } finally {
      setProcessingSale(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── Top Header ─── */}
      <LinearGradient
        colors={['#1A1F4B', '#2D3A8C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Escáner de productos</Text>

        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* ─── Scanner Area (Top) ─── */}
      <View style={styles.scannerViewport}>
        {!cameraActive ? (
          /* ── Pantalla de inicio: la cámara NO está activa aún ── */
          <View style={styles.cameraInactiveBox}>
            {/* Botón manual - izquierda */}
            <TouchableOpacity
              style={styles.cameraInactiveManualBtn}
              onPress={() => setManualPickerVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={styles.cameraInactiveManualBtnText}>Productos</Text>
            </TouchableOpacity>

            <View style={styles.cameraInactiveIconWrap}>
              <Ionicons name="camera" size={36} color="#fff" />
            </View>
            <Text style={styles.cameraInactiveTitle}>Cámara desactivada</Text>
            <Text style={styles.cameraInactiveSub}>
              Presiona el botón para iniciar el escáner
            </Text>
            <TouchableOpacity
              style={styles.cameraActivateBtn}
              onPress={async () => {
                if (!hasPermission) await requestPermission();
                setCameraActive(true);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#2D3A8C', '#1A1F4B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cameraActivateBtnGradient}
              >
                <Ionicons name="scan" size={20} color="#fff" />
                <Text style={styles.cameraActivateBtnText}>Activar cámara</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : !device ? (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={44} color="#6C6C70" />
            <Text style={styles.permissionText}>No se encontró cámara trasera</Text>
          </View>
        ) : !hasPermission ? (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={44} color="#6C6C70" />
            <Text style={styles.permissionText}>Se requiere acceso a la cámara</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Conceder Permiso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableWithoutFeedback onPress={handleCameraTouch}>
            <View style={StyleSheet.absoluteFillObject}>
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                device={device}
                isActive={cameraActive}
                torch={torchOn ? 'on' : 'off'}
                codeScanner={codeScanner}
                enableZoomGesture
              />
              {/* Indicador visual de punto de enfoque */}
              {focusPoint && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.focusRing,
                    {
                      left: focusPoint.x - 35,
                      top: focusPoint.y - 35,
                      opacity: focusAnim,
                      transform: [
                        {
                          scale: focusAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.4, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        )}

        {/* Overlay del escáner (solo visible cuando la cámara está activa) */}
        {cameraActive && (
          <View style={styles.scanOverlay} pointerEvents="box-none">
            {/* Botón manual a la IZQUIERDA */}
            <TouchableOpacity
              style={styles.scannerManualBtn}
              onPress={() => setManualPickerVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="list" size={16} color="#fff" />
            </TouchableOpacity>

            {/* Botón para encender/apagar el flash */}
            <TouchableOpacity
              style={[styles.scannerTorchBtn, torchOn && styles.scannerTorchBtnActive]}
              onPress={() => setTorchOn(!torchOn)}
              activeOpacity={0.75}
            >
              <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={16} color={torchOn ? '#FFD60A' : '#fff'} />
            </TouchableOpacity>

            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 130],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>

            {/* Hint inferior */}
            <Text style={styles.scanHintText}>Enfoca el código de barras continuamente</Text>
          </View>
        )}
      </View>

      {/* ─── Scanned Items List (Middle) ─── */}
      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Productos Escaneados</Text>
          {scannedItems.length > 0 && (
            <TouchableOpacity onPress={() => setScannedItems([])}>
              <Text style={styles.clearListText}>Vaciar lista</Text>
            </TouchableOpacity>
          )}
        </View>

        {scannedItems.length === 0 && unknownBarcodes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barcode-outline" size={48} color="#C0C0C8" />
            <Text style={styles.emptyStateTitle}>Aún no has escaneado ningún producto</Text>
            <Text style={styles.emptyStateSub}>Apunta con la cámara a los códigos de barras para ir sumando productos a la venta.</Text>
          </View>
        ) : (
          <FlatList
            data={[...unknownBarcodes.map((u) => ({ ...u, _isUnknown: true })), ...scannedItems]}
            keyExtractor={(item) => (item._isUnknown ? item.id : item.product.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              // Render de producto NO encontrado con botón de agregar
              if (item._isUnknown) {
                return (
                  <View>
                    <View style={styles.unknownCard}>
                      <View style={styles.unknownLeft}>
                        <View style={styles.unknownIconBg}>
                          <Ionicons name="alert-circle-outline" size={22} color="#FF9500" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.unknownTitle} numberOfLines={1}>
                            Producto no encontrado
                          </Text>
                          <Text style={styles.unknownBarcode}>Código: {item.barcode}</Text>
                        </View>
                      </View>
                      <View style={styles.unknownRight}>
                        <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.addProductBtn}
                            onPress={() => handleAddProduct(item.barcode)}
                          >
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={styles.addProductBtnText}>Agregar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleLinkProduct(item)}
                          >
                            <Text style={{ color: '#007AFF', fontSize: 11, fontStyle: 'italic', textDecorationLine: 'underline', opacity: 0.85 }}>vincular a existente</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={styles.closeUnknownBtn}
                          onPress={() => handleRemoveUnknown(item.id)}
                        >
                          <Ionicons name="close" size={18} color="#8E8E93" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }

              // Render de producto conocido escaneado
              const prod = item.product;
              const subtotal = item.quantity * (parseFloat(prod.price) || 0);

              return (
                <View style={styles.itemCard}>
                  <View style={styles.itemAvatar}>
                    <Ionicons name="cube" size={22} color="#4C669F" />
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      ${parseFloat(prod.price || 0).toFixed(2)} c/u
                    </Text>
                  </View>

                  {/* Cantidad +/- */}
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(prod.id, -1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={16} color="#4C669F" />
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(prod.id, 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={16} color="#4C669F" />
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal y Eliminar */}
                  <View style={styles.itemRight}>
                    <Text style={styles.itemSubtotal}>${subtotal.toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(prod.id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* ─── Bottom Summary Bar ─── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>ARTÍCULOS</Text>
          <Text style={styles.summaryValue}>{totalArticlesCount} unidad{totalArticlesCount !== 1 ? 'es' : ''}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>TOTAL DE VENTA</Text>
          <Text style={styles.summaryTotal}>${totalSaleAmount.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.reviewBtn, scannedItems.length === 0 && styles.reviewBtnDisabled]}
          onPress={() => {
            if (scannedItems.length > 0) setReviewModalVisible(true);
          }}
          disabled={scannedItems.length === 0}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={scannedItems.length > 0 ? ['#2D8C5A', '#1A4B2F'] : ['#C0C0C8', '#A0A0A8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.reviewBtnGradient}
          >
            <Text style={styles.reviewBtnText}>Revisar orden</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ─── Notification Toast (1 segundo) ─── */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#2D8C5A" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ─── Link Product Modal ─── */}
      <Modal
        visible={linkModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setLinkModalVisible(false); setLinkingBarcode(null); setLinkSearchQuery(''); }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <LinearGradient
              colors={['#1A3A4B', '#2D6A8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="link" size={22} color="#fff" />
                <View>
                  <Text style={styles.modalHeaderTitle}>Vincular Producto</Text>
                  {linkingBarcode && (
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                      Código: {linkingBarcode.barcode}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { setLinkModalVisible(false); setLinkingBarcode(null); setLinkSearchQuery(''); }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.linkInfoBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#2D6A8C" />
                <Text style={styles.linkInfoText}>
                  El código escaneado se agregará como código adicional del producto. El código original no será reemplazado.
                </Text>
              </View>

              <View style={styles.manualSearchWrapper}>
                <Ionicons name="search" size={18} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar producto por nombre..."
                  placeholderTextColor="#C0C0C8"
                  value={linkSearchQuery}
                  onChangeText={setLinkSearchQuery}
                  autoFocus
                />
                {linkSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLinkSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#C0C0C8" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredLinkProducts}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={40} color="#C0C0C8" />
                    <Text style={styles.emptyStateTitle}>Sin productos</Text>
                    <Text style={styles.emptyStateSub}>No se encontraron productos con ese nombre.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.manualProductRow}
                    onPress={() => handleConfirmLink(item)}
                    activeOpacity={0.75}
                    disabled={linkingSaving}
                  >
                    <View style={[styles.manualProductAvatar, { backgroundColor: '#E8F4FB' }]}>
                      <Ionicons name="cube" size={20} color="#2D6A8C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualProductName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.manualProductPrice}>${parseFloat(item.price || 0).toFixed(2)} c/u</Text>
                      {item.barcode ? (
                        <Text style={styles.manualProductBarcode}>Cód. principal: #{item.barcode}</Text>
                      ) : (
                        <Text style={[styles.manualProductBarcode, { color: '#B0B0C8' }]}>Sin código principal</Text>
                      )}
                    </View>
                    <View style={[styles.manualAddBtn, { backgroundColor: '#2D6A8C' }]}>
                      {linkingSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="link" size={16} color="#fff" />
                          <Text style={styles.manualAddBtnText}>Vincular</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Manual Product Picker Modal ─── */}
      <Modal
        visible={manualPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setManualPickerVisible(false); setManualSearchQuery(''); }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Header */}
            <LinearGradient
              colors={['#1A1F4B', '#2D3A8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="list" size={22} color="#fff" />
                <Text style={styles.modalHeaderTitle}>Agregar Producto Manual</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setManualPickerVisible(false); setManualSearchQuery(''); }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              {/* Buscador */}
              <View style={styles.manualSearchWrapper}>
                <Ionicons name="search" size={18} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre o código..."
                  placeholderTextColor="#C0C0C8"
                  value={manualSearchQuery}
                  onChangeText={setManualSearchQuery}
                  autoFocus
                />
                {manualSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setManualSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#C0C0C8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista de productos */}
              <FlatList
                data={filteredManualProducts}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={40} color="#C0C0C8" />
                    <Text style={styles.emptyStateTitle}>Sin productos</Text>
                    <Text style={styles.emptyStateSub}>No se encontraron productos con ese nombre o código.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const alreadyAdded = scannedItems.some((s) => s.product.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.manualProductRow, alreadyAdded && styles.manualProductRowAdded]}
                      onPress={() => handleManualAddProduct(item)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.manualProductAvatar}>
                        <Ionicons name="cube" size={20} color={alreadyAdded ? '#2D8C5A' : '#4C669F'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.manualProductName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.manualProductPrice}>${parseFloat(item.price || 0).toFixed(2)} c/u</Text>
                        {item.barcode ? (
                          <Text style={styles.manualProductBarcode}>#{item.barcode}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.manualAddBtn, alreadyAdded && styles.manualAddBtnAdded]}>
                        <Ionicons
                          name={alreadyAdded ? 'add-circle' : 'add'}
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.manualAddBtnText}>
                          {alreadyAdded ? '+1' : 'Agregar'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Botón Listo para cerrar cuando el usuario termine */}
              <TouchableOpacity
                style={styles.doneModalBtn}
                onPress={() => { setManualPickerVisible(false); setManualSearchQuery(''); }}
                activeOpacity={0.85}
              >
                <Text style={styles.doneModalBtnText}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Order Review & Checkout Modal ─── */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <LinearGradient
              colors={['#1A4B2F', '#2D8C5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="cart" size={22} color="#fff" />
                <Text style={styles.modalHeaderTitle}>Revisar Orden de Venta</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalBody}>
              {/* Seleccionar Cliente (Opcional) */}
              <Text style={styles.fieldLabel}>Cliente (Opcional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[styles.clientSelector, { flex: 1 }]}
                  onPress={() => setShowClientPicker(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-circle-outline" size={22} color="#4C669F" />
                  <Text style={[styles.clientSelectorText, !selectedClient && styles.placeholderText]}>
                    {selectedClient ? selectedClient.name : 'Venta al contado (Sin cliente)'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#8E8E93" />
                </TouchableOpacity>

                {selectedClient && (
                  <TouchableOpacity
                    onPress={() => setSelectedClient(null)}
                    style={{
                      width: 44,
                      height: 50,
                      borderRadius: 14,
                      backgroundColor: '#FFF0F0',
                      borderWidth: 1.5,
                      borderColor: '#FFD6D6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Resumen de items */}
              <Text style={styles.fieldLabel}>Desglose del pedido</Text>
              <View style={styles.orderSummaryBox}>
                <FlatList
                  data={scannedItems}
                  keyExtractor={(item) => item.product.id}
                  style={{ maxHeight: 180 }}
                  renderItem={({ item }) => (
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {item.quantity}x {item.product.name}
                      </Text>
                      <Text style={styles.orderItemSubtotal}>
                        ${(item.quantity * parseFloat(item.product.price || 0)).toFixed(2)}
                      </Text>
                    </View>
                  )}
                />
                <View style={styles.orderSummaryDivider} />
                <View style={styles.orderSummaryTotalRow}>
                  <Text style={styles.orderTotalLabel}>Monto total a cobrar</Text>
                  <Text style={styles.orderTotalValue}>${totalSaleAmount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Botón de Confirmación */}
              <TouchableOpacity
                style={[styles.confirmBtn, (scannedItems.length === 0 || processingSale) && styles.confirmBtnDisabled]}
                onPress={handleConfirmOrder}
                disabled={scannedItems.length === 0 || processingSale}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={!processingSale ? ['#2D8C5A', '#1A4B2F'] : ['#C0C0C8', '#A0A0A8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmBtnGradient}
                >
                  {processingSale ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name={selectedClient ? "person-add" : "checkmark-circle"} size={22} color="#fff" />
                      <Text style={styles.confirmBtnText}>
                        {selectedClient ? 'Agregar Deuda' : 'Confirmar y Registrar Venta'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Picker de cliente desplegable */}
        {showClientPicker && (
          <View style={styles.clientPickerOverlay}>
            <View style={styles.clientPickerModal}>
              <View style={styles.clientPickerHeader}>
                <Text style={styles.clientPickerTitle}>Seleccionar Cliente</Text>
                <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                  <Ionicons name="close" size={24} color="#1A1F4B" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchWrapper}>
                <Ionicons name="search" size={18} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar cliente..."
                  placeholderTextColor="#C0C0C8"
                  value={clientSearchQuery}
                  onChangeText={setClientSearchQuery}
                  autoFocus
                />
              </View>

              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 280 }}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <TouchableOpacity
                    style={[
                      styles.clientOption,
                      !selectedClient && styles.clientOptionSelected,
                      { borderBottomWidth: 1, borderBottomColor: '#F0F2F8' },
                    ]}
                    onPress={() => {
                      setSelectedClient(null);
                      setShowClientPicker(false);
                      setClientSearchQuery('');
                    }}
                  >
                    <View style={[styles.clientAvatar, { backgroundColor: '#E8F5EE' }]}>
                      <Ionicons name="cash-outline" size={18} color="#2D8C5A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clientName, { color: '#2D8C5A', fontWeight: '700' }]}>
                        Venta al contado
                      </Text>
                      <Text style={styles.clientPhone}>Sin cliente asignado</Text>
                    </View>
                    {!selectedClient && (
                      <Ionicons name="checkmark-circle" size={22} color="#2D8C5A" />
                    )}
                  </TouchableOpacity>
                }
                ListEmptyComponent={
                  <Text style={styles.emptyClientsText}>No se encontraron clientes</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.clientOption,
                      selectedClient?.id === item.id && styles.clientOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedClient(item);
                      setShowClientPicker(false);
                      setClientSearchQuery('');
                    }}
                  >
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>
                        {(item.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      {item.phone ? <Text style={styles.clientPhone}>{item.phone}</Text> : null}
                    </View>
                    {selectedClient?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#2D8C5A" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  // Scanner Area
  scannerViewport: {
    height: 210,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  scannerManualBtn: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(44,58,140,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 6,
    zIndex: 20,
  },
  scannerManualText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  scannerTorchBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 6,
    zIndex: 20,
  },
  scannerTorchBtnActive: {
    backgroundColor: 'rgba(255, 214, 10, 0.25)',
    borderColor: '#FFD60A',
  },
  scannerTorchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  scannerTorchTextActive: {
    color: '#FFD60A',
  },

  // Toast Notification
  toastContainer: {
    position: 'absolute',
    bottom: 85,
    alignSelf: 'center',
    backgroundColor: '#1A1F4B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
  },
  permissionText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  permissionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2D8C5A',
    borderRadius: 12,
  },
  permissionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Camera inactive / activate button
  cameraInactiveBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D1A',
    gap: 10,
  },
  cameraInactiveManualBtn: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(44,58,140,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  cameraInactiveManualBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  cameraInactiveIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(45,58,140,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  cameraInactiveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cameraInactiveSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 6,
  },
  cameraActivateBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#2D3A8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraActivateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  cameraActivateBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.2,
  },


  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanFrame: {
    width: 220,
    height: 130,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: '#2D8C5A', borderWidth: 3.5 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#2D8C5A',
    borderRadius: 1,
    shadowColor: '#2D8C5A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  scanHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginTop: 10,
  },
  focusRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD60A',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // List Section
  listSection: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#1A1F4B', letterSpacing: -0.2 },
  clearListText: { fontSize: 13, color: '#FF3B30', fontWeight: '600' },
  listContent: { paddingBottom: 10 },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#1A1F4B', textAlign: 'center' },
  emptyStateSub: { fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 18 },

  // Item Card (Known Product)
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    gap: 10,
  },
  itemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#1A1F4B', marginBottom: 2 },
  itemPrice: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },

  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F8',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 8,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontSize: 14, fontWeight: '800', color: '#1A1F4B', minWidth: 18, textAlign: 'center' },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemSubtotal: { fontSize: 15, fontWeight: '800', color: '#2D8C5A' },

  // Unknown Product Card
  unknownCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1.5,
    borderColor: '#FFE082',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  unknownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  unknownIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownTitle: { fontSize: 14, fontWeight: '700', color: '#8A5A00' },
  unknownBarcode: { fontSize: 11, color: '#B37B00', fontWeight: '600' },
  unknownRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  addProductBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  linkProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D6A8C',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  linkProductBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  linkInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E8F4FB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#B8D8E8',
  },
  linkInfoText: { flex: 1, fontSize: 12, color: '#2D6A8C', fontWeight: '500', lineHeight: 17 },
  closeUnknownBtn: { padding: 4 },

  // Bottom Summary Bar
  bottomBar: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  summaryCol: { justifyContent: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1A1F4B', marginTop: 2 },
  summaryTotal: { fontSize: 18, fontWeight: '800', color: '#2D8C5A', marginTop: 1 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#E0E4F5' },

  reviewBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2D8C5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  reviewBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  reviewBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  reviewBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Modal Review & Checkout
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,12,30,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#F5F7FF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  modalCloseBtn: { padding: 4 },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6068A0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  clientSelectorText: { flex: 1, fontSize: 15, color: '#1A1F4B', fontWeight: '600' },
  placeholderText: { color: '#C0C0C8', fontWeight: '400' },

  orderSummaryBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    marginBottom: 20,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  orderItemName: { fontSize: 14, fontWeight: '600', color: '#1A1F4B', flex: 1, marginRight: 10 },
  orderItemSubtotal: { fontSize: 14, fontWeight: '700', color: '#4C669F' },
  orderSummaryDivider: { height: 1, backgroundColor: '#F0F2F8', marginVertical: 8 },
  orderSummaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  orderTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1A1F4B' },
  orderTotalValue: { fontSize: 20, fontWeight: '800', color: '#2D8C5A' },

  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Client Picker Overlay
  clientPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,30,0.65)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 200,
  },
  clientPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '80%',
    paddingBottom: 16,
  },
  clientPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  clientPickerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1F4B' },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1F4B', fontWeight: '500' },
  emptyClientsText: { textAlign: 'center', color: '#8E8E93', padding: 20, fontSize: 14 },

  // Manual Product Picker
  manualSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
  },
  manualProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
  },
  manualProductRowAdded: {
    borderColor: '#2D8C5A',
    backgroundColor: '#F0FBF5',
  },
  manualProductAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualProductName: { fontSize: 15, fontWeight: '700', color: '#1A1F4B', marginBottom: 2 },
  manualProductPrice: { fontSize: 12, color: '#4C669F', fontWeight: '600' },
  manualProductBarcode: { fontSize: 11, color: '#B0B4C8', fontWeight: '500', marginTop: 1 },
  manualAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4C669F',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  manualAddBtnAdded: {
    backgroundColor: '#2D8C5A',
  },
  manualAddBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  clientOptionSelected: { backgroundColor: '#E8F5EE' },
  clientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { fontSize: 16, fontWeight: '800', color: '#4C669F' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1A1F4B' },
  clientPhone: { fontSize: 12, color: '#8E8E93' },
  doneModalBtn: {
    marginTop: 10,
    backgroundColor: '#1A1F4B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneModalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
