import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import {
  addToOutbox,
  deleteClientDB,
  deleteTransactionDB,
  getTransactionsByClient,
  insertClient,
  insertTransaction,
  recalcClientBalance,
  updateClient,
  updateTransaction,
  updateUserDataField,
} from './database';

const formatServiceDate = (date) => {
  const dateStr = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} a las ${timeStr}`;
};

// ─── Clientes ────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo cliente:
 * 1. Guarda en SQLite (fuente de verdad local)
 * 2. Encola en outbox para Firebase
 */
export const createClient = async ({
  uid,
  name,
  phone,
  email,
  parsedBalance,
  transactionType,
  balanceDescription,
}) => {
  const clientsRef = collection(db, 'users', uid, 'clients');
  const clientId = doc(clientsRef).id;

  const balance = transactionType === 'payment' ? parsedBalance : -parsedBalance;
  const now = Date.now();

  await insertClient(uid, {
    id: clientId,
    name,
    phone,
    email,
    balance,
    createdAt: now,
  });

  await addToOutbox(`users/${uid}/clients`, clientId, {
    name,
    phone,
    email,
    balance,
    createdAt: 'SERVER_TIMESTAMP',
  }, 'set');

  let initialTxId = null;

  if (parsedBalance > 0) {
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    initialTxId = doc(txRef).id;
    const date = formatServiceDate(new Date());

    await insertTransaction(uid, {
      id: initialTxId,
      clientId,
      type: transactionType,
      amount: parsedBalance,
      title: balanceDescription || 'Saldo inicial',
      description: balanceDescription || 'Saldo inicial',
      date,
      createdAt: now,
    });

    const initialDebtChange = transactionType === 'payment' ? -parsedBalance : parsedBalance;
    await updateUserDataField(uid, 'totalDebt', initialDebtChange);

    await addToOutbox(
      `users/${uid}/clients/${clientId}/transactions`,
      initialTxId,
      {
        type: transactionType,
        amount: parsedBalance,
        title: balanceDescription || 'Saldo inicial',
        description: balanceDescription || 'Saldo inicial',
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );

    await addToOutbox('users', uid, {
      totalDebt: `INCREMENT_${initialDebtChange}`,
    }, 'update');
  }

  return { clientId, initialTxId, balance };
};

/**
 * Edita un cliente existente en SQLite y encola en outbox.
 */
export const editClient = async ({ uid, clientId, name, phone, email }) => {
  await updateClient(uid, clientId, { name, phone, email });
  await addToOutbox(`users/${uid}/clients`, clientId, { name, phone, email }, 'update');
};


// ─── Transacciones ───────────────────────────────────────────────────────────

/**
 * Agrega una nueva transacción:
 * 1. Guarda en SQLite
 * 2. Recalcula balance desde cero (evita race conditions)
 * 3. Encola en outbox para Firebase
 */
export const addTransaction = async ({ uid, clientId, type, amount, title, description, createdAt }) => {
  const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
  const txId = doc(txRef).id;

  let balanceChange;
  let debtChange;

  if (type === 'recurring_payment') {
    balanceChange = 0;
    debtChange = 0;
  } else if (type === 'debt_payment') {
    balanceChange = amount;
    debtChange = -amount;
  } else if (type === 'payment') {
    balanceChange = amount;
    debtChange = -amount;
  } else {
    // 'debt'
    balanceChange = -amount;
    debtChange = amount;
  }

  const now = createdAt || Date.now();
  const date = formatServiceDate(new Date(now));

  // 1. Guardar transacción en SQLite
  await insertTransaction(uid, {
    id: txId,
    clientId,
    type,
    amount,
    title: title || '',
    description: description || '',
    date,
    createdAt: now,
  });

  // 2. Recalcular balance desde cero — fuente de verdad: suma de transacciones
  const newBalance = await recalcClientBalance(uid, clientId);

  // 3. Actualizar totales del usuario en SQLite
  if (debtChange !== 0) await updateUserDataField(uid, 'totalDebt', debtChange);

  // 4. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type, amount, title, description, createdAt: 'SERVER_TIMESTAMP' },
    'set'
  );
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: newBalance }, 'update');
  if (debtChange !== 0) {
    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtChange}` }, 'update');
  }

  const newTx = {
    id: txId,
    clientId,
    type,
    amount,
    title,
    description,
    date,
    createdAt: now,
  };

  return { txId, balanceChange, debtChange, newTx };
};


/**
 * Edita una transacción existente:
 * 1. Actualiza en SQLite
 * 2. Recalcula balance desde cero
 * 3. Encola en outbox para Firebase
 */
export const editTransaction = async ({
  uid,
  clientId,
  txId,
  oldType,
  oldAmount,
  newType,
  newAmount,
  newTitle,
  newDescription,
}) => {
  const isPay = (t) => t === 'payment' || t === 'debt_payment';
  const isRec = (t) => t === 'recurring_payment';

  const oldDebtDiff = isRec(oldType) ? 0 : oldType === 'debt' ? oldAmount : -oldAmount;
  const newDebtDiff = isRec(newType) ? 0 : newType === 'debt' ? newAmount : -newAmount;
  const debtDiff = newDebtDiff - oldDebtDiff;

  // Calcular netBalanceChange para compatibilidad con llamadores
  const oldBalanceChange = isRec(oldType) ? 0 : isPay(oldType) ? -oldAmount : oldAmount;
  const newBalanceChange = isRec(newType) ? 0 : isPay(newType) ? newAmount : -newAmount;
  const netBalanceChange = oldBalanceChange + newBalanceChange;

  // 1. Actualizar transacción en SQLite
  await updateTransaction(uid, txId, {
    type: newType,
    amount: newAmount,
    title: newTitle || '',
    description: newDescription || '',
  });

  // 2. Recalcular balance desde cero
  const newBalance = await recalcClientBalance(uid, clientId);

  // 3. Actualizar totales del usuario en SQLite
  if (debtDiff !== 0) await updateUserDataField(uid, 'totalDebt', debtDiff);

  // 4. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type: newType, amount: newAmount, title: newTitle, description: newDescription },
    'update'
  );
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: newBalance }, 'update');
  if (debtDiff !== 0) {
    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtDiff}` }, 'update');
  }

  return { netBalanceChange, debtDiff };
};


/**
 * Elimina una transacción:
 * 1. Elimina de SQLite
 * 2. Recalcula balance desde cero
 * 3. Encola en outbox para Firebase
 */
export const deleteTransaction = async ({ uid, clientId, txId, type, amount }) => {
  const isPay = type === 'payment' || type === 'debt_payment';
  const isRec = type === 'recurring_payment';

  const balanceChange = isRec ? 0 : isPay ? -amount : amount;
  const debtDiff = isRec ? 0 : isPay ? amount : -amount;

  // 1. Eliminar transacción de SQLite
  await deleteTransactionDB(uid, txId);

  // 2. Recalcular balance desde cero
  const newBalance = await recalcClientBalance(uid, clientId);

  // 3. Actualizar totales del usuario en SQLite
  if (debtDiff !== 0) await updateUserDataField(uid, 'totalDebt', debtDiff);

  // 4. Encolar en outbox
  await addToOutbox(`users/${uid}/clients/${clientId}/transactions`, txId, null, 'delete');
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: newBalance }, 'update');
  if (debtDiff !== 0) {
    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtDiff}` }, 'update');
  }

  return { balanceChange, debtDiff };
};


/**
 * Resetea el historial de un cliente:
 * Elimina TODAS sus transacciones, pone el balance en $0.
 * El cliente se mantiene en la lista.
 */
export const resetClientHistory = async ({ uid, clientId, transactions }) => {
  let totalDebtReverted = 0;

  for (const tx of transactions) {
    // Calcular cuánto de deuda acumulada revierte esta transacción
    if (tx.type === 'debt') totalDebtReverted += tx.amount;
    else if (tx.type === 'payment' || tx.type === 'debt_payment') totalDebtReverted -= tx.amount;

    // Eliminar cada transacción de SQLite
    await deleteTransactionDB(uid, tx.id);

    // Encolar eliminación en Firebase
    await addToOutbox(
      `users/${uid}/clients/${clientId}/transactions`,
      tx.id,
      null,
      'delete'
    );
  }

  // Recalcular balance (debe quedar en 0 tras borrar todo)
  const newBalance = await recalcClientBalance(uid, clientId);

  // Revertir totales globales del usuario en SQLite
  if (totalDebtReverted !== 0) {
    await updateUserDataField(uid, 'totalDebt', -totalDebtReverted);
  }

  // Sincronizar balance=0 a Firebase
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: newBalance }, 'update');
  if (totalDebtReverted !== 0) {
    await addToOutbox('users', uid, {
      totalDebt: `INCREMENT_${-totalDebtReverted}`,
    }, 'update');
  }

  return { totalDebtReverted, newBalance };
};


/**
 * Elimina un cliente y todas sus transacciones:
 * 1. Elimina de SQLite
 * 2. Encola en outbox para Firebase
 */
export const deleteClient = async ({ uid, clientId, transactions }) => {
  let totalDebtReverted = 0;

  for (const tx of transactions) {
    if (tx.type === 'debt') totalDebtReverted += tx.amount;
    else if (tx.type === 'payment' || tx.type === 'debt_payment') totalDebtReverted -= tx.amount;
    addToOutbox(`users/${uid}/clients/${clientId}/transactions`, tx.id, null, 'delete');
  }

  if (totalDebtReverted !== 0) await updateUserDataField(uid, 'totalDebt', -totalDebtReverted);

  await deleteClientDB(uid, clientId);

  if (totalDebtReverted !== 0) {
    await addToOutbox('users', uid, {
      totalDebt: `INCREMENT_${-totalDebtReverted}`,
    }, 'update');
  }
  await addToOutbox(`users/${uid}/clients`, clientId, null, 'delete');

  return { totalDebtReverted };
};
