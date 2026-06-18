/**
 * LocalDataContext.jsx
 *
 * Fuente de verdad en memoria para datos locales (offline-first).
 * Los screens leen de aquí y escriben aquí de forma OPTIMISTA (inmediata).
 * Firebase actualiza este store cuando hay conexión.
 */

import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../authContext/authContext';
import { db } from '../firebaseConfig/config';
import { getCache, initDB, setCache } from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

const LocalDataContext = createContext(null);

export function LocalDataProvider({ children }) {
  const { user } = useAuth();

  const [clients, setClientsState] = useState([]);
  const [recentActivity, setRecentActivityState] = useState([]);
  const [allTransactions, setAllTransactionsState] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Referencia interna para calcular merges sin re-renders
  const txByClientRef = useRef({});
  const allTxByClientRef = useRef({});
  const pendingOpsRef = useRef({
    deletedTxIds: new Set(),
    updatedTxs: {},
    addedTxs: {}
  });

  // ─── Inicializar DB al montar ───
  useEffect(() => {
    initDB().then(() => syncOutbox()).catch(console.error);
  }, []);

  // ─── Helpers para actualizar el estado y caché juntos ───
  const updateClients = useCallback(async (newClients) => {
    setClientsState(newClients);
    if (user) await setCache(`clients_${user.uid}`, newClients);
  }, [user]);

  const updateRecentActivity = useCallback(async (newActivity) => {
    setRecentActivityState(newActivity);
    if (user) await setCache(`recentTx_${user.uid}`, newActivity);
  }, [user]);

  // ─── Escuchar clientes de Firebase + cargar desde caché ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribe = null;

    const init = async () => {
      syncOutbox();
      const cached = await getCache(`clients_${user.uid}`);
      if (cached && isMounted) {
        setClientsState(cached);
        setLoadingClients(false);
      }

      const q = query(collection(db, 'users', user.uid, 'clients'));
      unsubscribe = onSnapshot(q, (snap) => {
        const data = [];
        snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        if (isMounted) {
          setClientsState(data);
          setLoadingClients(false);
          setCache(`clients_${user.uid}`, data);
        }
      }, (err) => {
        console.error('Error clients snapshot:', err);
        if (isMounted) setLoadingClients(false);
      });
    };

    init();
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // ─── Escuchar transacciones recientes + cargar desde caché ───
  useEffect(() => {
    if (!user) return;
    if (clients.length === 0) {
      setRecentActivityState([]);
      return;
    }
    let isMounted = true;
    const unsubscribes = [];
    txByClientRef.current = {};

    const init = async () => {
      const cachedTxs = await getCache(`recentTx_${user.uid}`);
      if (cachedTxs && isMounted) {
        setRecentActivityState(cachedTxs.map(tx => ({ ...tx, _date: tx._timestamp ? new Date(tx._timestamp) : null })));
      }

      const merge = () => {
        let merged = Object.values(txByClientRef.current).flat();

        // 1. Remove deleted
        merged = merged.filter(tx => !pendingOpsRef.current.deletedTxIds.has(tx.id));
        // 2. Apply updates
        merged = merged.map(tx => pendingOpsRef.current.updatedTxs[tx.id] || tx);
        // 3. Apply adds
        const existingIds = new Set(merged.map(tx => tx.id));
        Object.values(pendingOpsRef.current.addedTxs).forEach(tx => {
          if (!existingIds.has(tx.id)) {
            merged.push(tx);
          }
        });

        merged.sort((a, b) => b._timestamp - a._timestamp);
        const top5 = merged.slice(0, 5);
        if (isMounted) {
          setRecentActivityState(top5.map(tx => ({ ...tx, _date: new Date(tx._timestamp) })));
          setCache(`recentTx_${user.uid}`, top5);
        }
      };

      clients.forEach((client) => {
        const txQ = query(
          collection(db, 'users', user.uid, 'clients', client.id, 'transactions'),
          orderBy('createdAt', 'desc'), limit(5)
        );
        const unsub = onSnapshot(txQ, (snap) => {
          const txs = [];
          snap.forEach((doc) => {
            const data = doc.data();
            txs.push({ id: doc.id, ...data, clientName: client.name || 'Sin nombre', clientId: client.id, _timestamp: data.createdAt?.toMillis?.() || 0 });
          });
          txByClientRef.current[client.id] = txs;
          merge();
        }, (err) => console.error('Error tx snapshot:', client.id, err));
        unsubscribes.push(unsub);
      });

      // Transacciones globales (ajustes)
      const globalQ = query(collection(db, 'users', user.uid, 'transactions'), orderBy('createdAt', 'desc'), limit(5));
      const globalUnsub = onSnapshot(globalQ, (snap) => {
        const txs = [];
        snap.forEach((doc) => {
          const data = doc.data();
          txs.push({ id: doc.id, ...data, clientName: 'Ajuste de Total', clientId: 'global', _timestamp: data.createdAt?.toMillis?.() || 0 });
        });
        txByClientRef.current['global'] = txs;
        merge();
      }, (err) => console.error('Error global tx snapshot:', err));
      unsubscribes.push(globalUnsub);
    };

    init();
    return () => {
      isMounted = false;
      unsubscribes.forEach(fn => fn());
    };
  }, [user, clients]);

  // ─── ACCIONES OPTIMISTAS ───

  /**
   * Agrega un cliente localmente (sin esperar a Firebase).
   */
  const addClientOptimistic = useCallback(async ({ clientId, txId, name, phone, email, balance, transactionType, parsedBalance, balanceDescription }) => {
    const newClient = { id: clientId, name, phone, email, balance, createdAt: Date.now() };
    const updated = [...clients, newClient];
    await updateClients(updated);

    if (parsedBalance > 0) {
      const newTx = {
        id: txId || `local_${Date.now()}`,
        type: transactionType,
        amount: parsedBalance,
        description: balanceDescription || 'Saldo inicial',
        clientName: name,
        clientId,
        _timestamp: Date.now(),
        _date: new Date(),
      };

      pendingOpsRef.current.addedTxs[newTx.id] = newTx;
      const updatedActivity = [newTx, ...recentActivity].slice(0, 5);
      await updateRecentActivity(updatedActivity);

      if (user) {
        const cachedAllTx = await getCache(`allTx_${user.uid}`) || [];
        cachedAllTx.unshift(newTx);
        await setCache(`allTx_${user.uid}`, cachedAllTx);
      }
    }
  }, [clients, recentActivity, updateClients, updateRecentActivity]);

  /**
   * Edita un cliente localmente.
   */
  const editClientOptimistic = useCallback(async ({ clientId, name, phone, email }) => {
    const updatedClients = clients.map((c) => 
      c.id === clientId ? { ...c, name, phone, email } : c
    );
    await updateClients(updatedClients);
  }, [clients, updateClients]);

  /**
   * Agrega una transacción de cliente localmente.
   */
  const addTransactionOptimistic = useCallback(async ({ txId, clientId, clientName, type, amount, description }) => {
    const newTx = {
      id: txId,
      type,
      amount,
      description,
      clientName,
      clientId,
      _timestamp: Date.now(),
      _date: new Date(),
      date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }),
      createdAt: null,
    };

    // Actualizar balance del cliente en la lista local
    const balanceChange = type === 'payment' ? amount : -amount;
    const updatedClients = clients.map(c => c.id === clientId ? { ...c, balance: (c.balance || 0) + balanceChange } : c);
    await updateClients(updatedClients);

    pendingOpsRef.current.addedTxs[newTx.id] = newTx;

    // Agregar a actividad reciente
    const updatedActivity = [newTx, ...recentActivity].slice(0, 5);
    await updateRecentActivity(updatedActivity);

    if (user) {
      const cachedAllTx = await getCache(`allTx_${user.uid}`) || [];
      cachedAllTx.unshift(newTx);
      await setCache(`allTx_${user.uid}`, cachedAllTx);
    }

    return newTx;
  }, [clients, recentActivity, updateClients, updateRecentActivity]);

  /**
   * Edita una transacción localmente.
   */
  const editTransactionOptimistic = useCallback(async ({ txId, clientId, oldType, oldAmount, newType, newAmount, newDescription }) => {
    const oldBalanceChange = oldType === 'payment' ? -oldAmount : oldAmount;
    const newBalanceChange = newType === 'payment' ? newAmount : -newAmount;
    const netChange = oldBalanceChange + newBalanceChange;

    const updatedClients = clients.map(c => c.id === clientId ? { ...c, balance: (c.balance || 0) + netChange } : c);
    await updateClients(updatedClients);

    const updatedTx = { id: txId, type: newType, amount: newAmount, description: newDescription };
    pendingOpsRef.current.updatedTxs[txId] = updatedTx;

    const updatedActivity = recentActivity.map(tx => tx.id === txId ? { ...tx, ...updatedTx } : tx);
    await updateRecentActivity(updatedActivity);

    if (user) {
      const cachedAllTx = await getCache(`allTx_${user.uid}`) || [];
      const updatedAllTx = cachedAllTx.map(tx => tx.id === txId ? { ...tx, ...updatedTx } : tx);
      await setCache(`allTx_${user.uid}`, updatedAllTx);
    }
  }, [clients, updateClients]);

  /**
   * Elimina una transacción localmente.
   */
  const deleteTransactionOptimistic = useCallback(async ({ txId, clientId, type, amount }) => {
    const balanceChange = type === 'payment' ? -amount : amount;
    const updatedClients = clients.map(c => c.id === clientId ? { ...c, balance: (c.balance || 0) + balanceChange } : c);
    await updateClients(updatedClients);

    pendingOpsRef.current.deletedTxIds.add(txId);

    const updatedActivity = recentActivity.filter(tx => tx.id !== txId);
    await updateRecentActivity(updatedActivity);

    if (user) {
      const cachedAllTx = await getCache(`allTx_${user.uid}`) || [];
      const updatedAllTx = cachedAllTx.filter(tx => tx.id !== txId);
      await setCache(`allTx_${user.uid}`, updatedAllTx);
    }
  }, [clients, recentActivity, updateClients, updateRecentActivity]);

  /**
   * Elimina un cliente localmente.
   */
  const deleteClientOptimistic = useCallback(async (clientId) => {
    const updatedClients = clients.filter(c => c.id !== clientId);
    await updateClients(updatedClients);

    // Marcar todas sus txs como eliminadas
    recentActivity.forEach(tx => {
      if (tx.clientId === clientId) pendingOpsRef.current.deletedTxIds.add(tx.id);
    });

    const updatedActivity = recentActivity.filter(tx => tx.clientId !== clientId);
    await updateRecentActivity(updatedActivity);

    if (user) {
      const cachedAllTx = await getCache(`allTx_${user.uid}`) || [];
      const updatedAllTx = cachedAllTx.filter(tx => tx.clientId !== clientId);
      await setCache(`allTx_${user.uid}`, updatedAllTx);
    }
  }, [clients, recentActivity, updateClients, updateRecentActivity]);

  const value = {
    clients,
    recentActivity,
    loadingClients,
    // Acciones optimistas
    addClientOptimistic,
    editClientOptimistic,
    addTransactionOptimistic,
    editTransactionOptimistic,
    deleteTransactionOptimistic,
    deleteClientOptimistic,
    // Para leer/guardar en caché directamente si se necesita
    updateClients,
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
