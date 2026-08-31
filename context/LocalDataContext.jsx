/**
 * LocalDataContext.jsx
 *
 * Fuente de verdad en memoria para datos locales (offline-first).
 * TODOS los datos se leen desde SQLite. Firebase se usa solo para
 * sincronización en background (a través del syncEngine + onSnapshot).
 */

import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../authContext/authContext';
import { db as firestore } from '../firebaseConfig/config';
import { bootstrapFromFirebase } from '../utils/bootstrapSync';
import {
  getClients,
  getProducts,
  getRecentActivity,
  getRecentSales,
  getSalesSince,
  initDB,
  insertClient,
  insertTransaction,
  migrateFromLegacyCache,
} from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

const LocalDataContext = createContext(null);

export function LocalDataProvider({ children }) {
  const { user } = useAuth();

  const [clients, setClientsState] = useState([]);
  const [recentActivity, setRecentActivityState] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // ─ Productos y Ventas ─
  const [products, setProductsState] = useState([]);
  const [recentSales, setRecentSalesState] = useState([]);
  const [todaySales, setTodaySalesState] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Para compatibilidad con [id].jsx y all-transactions.jsx
  const pendingOpsRef = useRef({
    deletedTxIds: new Set(),
    updatedTxs: {},
    addedTxs: {},
  });

  // ─── Inicializar DB al montar ───
  useEffect(() => {
    initDB().then(() => syncOutbox()).catch(console.error);
  }, []);

  // ─── Cargar clientes desde SQLite + sincronizar desde Firebase ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribe = null;

    const init = async () => {
      // 0a. Migrar datos del caché viejo (JSON blobs) si existen
      const migrated = await migrateFromLegacyCache(user.uid);
      if (migrated) console.log('[LocalData] Datos migrados del caché legacy.');

      // 0b. Si SQLite está vacío, hacer bootstrap inicial desde Firebase
      //     Esto recupera todos los clientes y transacciones del usuario
      const bootstrapped = await bootstrapFromFirebase(user.uid);
      if (bootstrapped) console.log('[LocalData] Bootstrap desde Firebase completado.');

      // 1. Cargar desde SQLite inmediatamente
      const localClients = await getClients(user.uid);
      if (isMounted) {
        setClientsState(localClients);
        setLoadingClients(false);
      }

      // Refrescar actividad reciente despues de posible bootstrap
      if (bootstrapped) {
        const recent = await getRecentActivity(user.uid, 8);
        if (isMounted) {
          setRecentActivityState(recent.map(tx => ({
            ...tx,
            _timestamp: tx.createdAt,
            _date: new Date(tx.createdAt),
          })));
        }
      }

      // 2. Intentar sincronizar outbox pendiente
      syncOutbox().catch(console.error);

      // 3. Escuchar Firebase para sincronización en background
      //    Cuando Firebase trae datos nuevos (ej. otro dispositivo), los guardamos en SQLite.
      try {
        const q = query(collection(firestore, 'users', user.uid, 'clients'));
        unsubscribe = onSnapshot(
          q,
          async (snap) => {
            if (!isMounted) return;
            // Sincronizar cada cliente de Firebase a SQLite
            for (const docSnap of snap.docs) {
              const data = { id: docSnap.id, ...docSnap.data() };
              if (data.createdAt?.toMillis) data.createdAt = data.createdAt.toMillis();
              await insertClient(user.uid, data);

              // También sincronizar transacciones de este cliente
              try {
                const txSnap = await getDocs(
                  query(
                    collection(firestore, 'users', user.uid, 'clients', docSnap.id, 'transactions'),
                    orderBy('createdAt', 'desc')
                  )
                );
                for (const txDoc of txSnap.docs) {
                  const txData = txDoc.data();
                  await insertTransaction(user.uid, {
                    id: txDoc.id,
                    clientId: docSnap.id,
                    type: txData.type || 'debt',
                    amount: txData.amount ?? 0,
                    title: txData.title || txData.description || '',
                    description: txData.description || '',
                    date: txData.createdAt?.toDate
                      ? txData.createdAt.toDate().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '',
                    createdAt: txData.createdAt?.toMillis?.() || Date.now(),
                  });
                }
              } catch (txErr) {
                // Sin internet para transacciones, no es crítico
              }
            }
            // Recargar desde SQLite como fuente de verdad
            const updated = await getClients(user.uid);
            if (isMounted) setClientsState(updated);

            // Refrescar actividad reciente
            const recent = await getRecentActivity(user.uid, 8);
            if (isMounted) {
              setRecentActivityState(recent.map(tx => ({
                ...tx,
                _timestamp: tx.createdAt,
                _date: new Date(tx.createdAt),
              })));
            }
          },
          (err) => {
            console.warn('[LocalData] Firebase clients offline:', err.code);
          }
        );
      } catch (e) {
        console.warn('[LocalData] Firebase clients listener error:', e);
      }
    };

    init();
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // ─── Cargar actividad reciente desde SQLite ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadRecent = async () => {
      const recent = await getRecentActivity(user.uid, 8);
      if (isMounted) {
        setRecentActivityState(
          recent.map((tx) => ({
            ...tx,
            _timestamp: tx.createdAt,
            _date: new Date(tx.createdAt),
          }))
        );
      }
    };

    loadRecent();

    // Escuchar evento de cambio local para refrescar actividad reciente
    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('local-db-changed', loadRecent);

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [user]);

  // ─── Cargar productos y ventas recientes desde SQLite ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadProducts = async () => {
      const prods = await getProducts(user.uid);
      const sales = await getRecentSales(user.uid, 10);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const tSales = await getSalesSince(user.uid, startOfToday);
      if (isMounted) {
        setProductsState(prods);
        setRecentSalesState(sales);
        setTodaySalesState(tSales);
        setLoadingProducts(false);
      }
    };

    loadProducts();

    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('products-db-changed', loadProducts);

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [user]);


  // ─── Helpers de actualización de estado ───

  const updateClientsState = useCallback(async (newClients) => {
    setClientsState(newClients);
  }, []);

  const updateRecentActivity = useCallback(async () => {
    if (!user) return;
    const recent = await getRecentActivity(user.uid, 8);
    setRecentActivityState(
      recent.map((tx) => ({
        ...tx,
        _timestamp: tx.createdAt,
        _date: new Date(tx.createdAt),
      }))
    );
  }, [user]);


  // ─── ACCIONES OPTIMISTAS ───
  // Estas funciones actualizan el estado en memoria de forma inmediata.
  // La escritura real en SQLite ya la hizo clientService.js antes de llamar aquí.

  /**
   * Agrega un cliente localmente (en memoria).
   * SQLite ya fue actualizado por createClient() en clientService.js.
   */
  const addClientOptimistic = useCallback(async ({
    clientId, txId, name, phone, email, balance, transactionType, parsedBalance, balanceDescription,
  }) => {
    const newClient = { id: clientId, name, phone, email, balance, createdAt: Date.now() };
    setClientsState((prev) => [newClient, ...prev]);

    if (parsedBalance > 0) {
      const now = Date.now();
      const newTx = {
        id: txId || `local_${now}`,
        clientId,
        type: transactionType,
        amount: parsedBalance,
        title: balanceDescription || 'Saldo inicial',
        description: balanceDescription || 'Saldo inicial',
        clientName: name,
        _timestamp: now,
        _date: new Date(now),
      };
      pendingOpsRef.current.addedTxs[newTx.id] = newTx;
      setRecentActivityState((prev) => [newTx, ...prev].slice(0, 5));
    }
  }, []);

  /**
   * Edita un cliente localmente (en memoria).
   */
  const editClientOptimistic = useCallback(async ({ clientId, name, phone, email }) => {
    setClientsState((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, name, phone, email } : c)
    );
  }, []);

  /**
   * Agrega una transacción localmente (en memoria).
   */
  const addTransactionOptimistic = useCallback(async ({
    txId, clientId, clientName, type, amount, title, description,
  }) => {
    const now = Date.now();
    const newTx = {
      id: txId,
      type,
      amount,
      title,
      description,
      clientName,
      clientId,
      _timestamp: now,
      _date: new Date(now),
    };

    // Actualizar balance del cliente en memoria
    const balanceChange = type === 'payment' ? amount : -amount;
    setClientsState((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, balance: (c.balance || 0) + balanceChange } : c)
    );

    pendingOpsRef.current.addedTxs[newTx.id] = newTx;
    setRecentActivityState((prev) => [newTx, ...prev].slice(0, 5));

    return newTx;
  }, []);

  /**
   * Edita una transacción localmente (en memoria).
   */
  const editTransactionOptimistic = useCallback(async ({
    txId, clientId, oldType, oldAmount, newType, newAmount, newTitle, newDescription,
  }) => {
    const oldBalanceChange = oldType === 'payment' ? -oldAmount : oldAmount;
    const newBalanceChange = newType === 'payment' ? newAmount : -newAmount;
    const netChange = oldBalanceChange + newBalanceChange;

    setClientsState((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, balance: (c.balance || 0) + netChange } : c)
    );

    const updatedTx = { id: txId, type: newType, amount: newAmount, title: newTitle, description: newDescription };
    pendingOpsRef.current.updatedTxs[txId] = updatedTx;

    setRecentActivityState((prev) =>
      prev.map((tx) => tx.id === txId ? { ...tx, ...updatedTx } : tx)
    );
  }, []);

  /**
   * Elimina una transacción localmente (en memoria).
   */
  const deleteTransactionOptimistic = useCallback(async ({ txId, clientId, type, amount }) => {
    const balanceChange = type === 'payment' ? -amount : amount;
    setClientsState((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, balance: (c.balance || 0) + balanceChange } : c)
    );

    pendingOpsRef.current.deletedTxIds.add(txId);
    setRecentActivityState((prev) => prev.filter((tx) => tx.id !== txId));
  }, []);

  /**
   * Elimina un cliente localmente (en memoria).
   */
  const deleteClientOptimistic = useCallback(async (clientId) => {
    setClientsState((prev) => prev.filter((c) => c.id !== clientId));
    setRecentActivityState((prev) => prev.filter((tx) => tx.clientId !== clientId));
  }, []);

  // ─── ACCIONES OPTIMISTAS – PRODUCTOS ───

  const addProductOptimistic = useCallback(({ productId, name, price, description, stock }) => {
    const newProduct = {
      id: productId,
      name,
      price: parseFloat(price) || 0,
      description: description || '',
      stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
      createdAt: Date.now(),
    };
    setProductsState((prev) => [newProduct, ...prev]);
  }, []);

  const editProductOptimistic = useCallback(({ productId, name, price, description, stock }) => {
    setProductsState((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
            ...p,
            name,
            price: parseFloat(price) || 0,
            description: description || '',
            stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
          }
          : p
      )
    );
  }, []);

  const deleteProductOptimistic = useCallback((productId) => {
    setProductsState((prev) => prev.filter((p) => p.id !== productId));
    setRecentSalesState((prev) => prev.filter((s) => s.productId !== productId));
    setTodaySalesState((prev) => prev.filter((s) => s.productId !== productId));
  }, []);

  const addSaleOptimistic = useCallback(({ saleId, productId, clientId, clientName, quantity, unitPrice, buyPrice, totalAmount, date, newStock, productName }) => {
    const now = Date.now();
    const newSale = {
      id: saleId,
      productId,
      clientId,
      clientName,
      quantity,
      unitPrice,
      buyPrice: buyPrice ?? 0,
      totalAmount,
      date,
      createdAt: now,
    };
    setRecentSalesState((prev) => [newSale, ...prev].slice(0, 10));
    setTodaySalesState((prev) => [newSale, ...prev]);

    // Agregar también a actividad reciente (home screen)
    const activityItem = {
      id: saleId,
      type: 'sale',
      amount: totalAmount,
      clientName,
      clientId,
      description: productName || '',
      productName: productName || '',
      createdAt: now,
      _timestamp: now,
      _date: new Date(now),
      _source: 'sale',
    };
    setRecentActivityState((prev) => [activityItem, ...prev].slice(0, 8));

    // Actualizar stock en memoria
    if (newStock >= 0) {
      setProductsState((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
      );
    }
  }, []);


  const deleteSaleOptimistic = useCallback(({ saleId, productId, quantity }) => {
    setRecentSalesState((prev) => prev.filter((s) => s.id !== saleId));
    setTodaySalesState((prev) => prev.filter((s) => s.id !== saleId));
    // Revertir stock optimistamente
    setProductsState((prev) =>
      prev.map((p) =>
        p.id === productId && p.stock >= 0
          ? { ...p, stock: p.stock + (parseFloat(quantity) || 0) }
          : p
      )
    );
  }, []);


  const value = {
    clients,
    recentActivity,
    loadingClients,
    // Productos y Ventas
    products,
    recentSales,
    todaySales,
    loadingProducts,
    // Acciones optimistas – clientes
    addClientOptimistic,
    editClientOptimistic,
    addTransactionOptimistic,
    editTransactionOptimistic,
    deleteTransactionOptimistic,
    deleteClientOptimistic,
    // Acciones optimistas – productos
    addProductOptimistic,
    editProductOptimistic,
    deleteProductOptimistic,
    addSaleOptimistic,
    deleteSaleOptimistic,
    // Helpers
    updateClients: updateClientsState,
    updateRecentActivity,
    pendingOpsRef,
  };


  return (
    <LocalDataContext.Provider value={value}>
      {children}
    </LocalDataContext.Provider>
  );
}

export function useLocalData() {
  const ctx = useContext(LocalDataContext);
  if (!ctx) throw new Error('useLocalData debe usarse dentro de <LocalDataProvider>');
  return ctx;
}
