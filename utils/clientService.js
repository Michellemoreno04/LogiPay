import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import {
  addToOutbox,
  deleteClientDB,
  deleteTransactionDB,
  getClientById,
  getClients,
  getTransactionsByClient,
  insertClient,
  insertTransaction,
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
  // Generar IDs usando referencias de Firestore (sin escribir nada todavía)
  const clientsRef = collection(db, 'users', uid, 'clients');
  const clientId = doc(clientsRef).id;

  const balance = transactionType === 'payment' ? parsedBalance : -parsedBalance;
  const now = Date.now();

  // 1. Guardar cliente en SQLite
  await insertClient(uid, {
    id: clientId,
    name,
    phone,
    email,
    balance,
    createdAt: now,
  });

  // 2. Encolar creación en Firebase (outbox)
  await addToOutbox(`users/${uid}/clients`, clientId, {
    name,
    phone,
    email,
    balance,
    createdAt: 'SERVER_TIMESTAMP',
  }, 'set');

  let initialTxId = null;

  // 3. Si hay saldo inicial, crear la transacción
  if (parsedBalance > 0) {
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    initialTxId = doc(txRef).id;
    const date = formatServiceDate(new Date());

    // Guardar transacción en SQLite
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

    // Actualizar totales del usuario en SQLite
    const initialDebtChange = transactionType === 'payment' ? -parsedBalance : parsedBalance;
    await updateUserDataField(uid, 'totalDebt', initialDebtChange);

    // Encolar transacción en outbox
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

    // Encolar actualización de totales
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
  // 1. Actualizar en SQLite
  await updateClient(uid, clientId, { name, phone, email });

  // 2. Encolar en outbox
  await addToOutbox(`users/${uid}/clients`, clientId, { name, phone, email }, 'update');
};


// ─── Transacciones ───────────────────────────────────────────────────────────

/**
 * Agrega una nueva transacción:
 * 1. Guarda en SQLite
 * 2. Encola en outbox para Firebase
 */
export const addTransaction = async ({ uid, clientId, type, amount, title, description }) => {
  const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
  const txId = doc(txRef).id;

  const balanceChange = type === 'payment' ? amount : -amount;
  const debtChange = type === 'payment' ? -amount : amount;
  const now = Date.now();
  const date = formatServiceDate(new Date());

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

  // 2. Actualizar balance del cliente en SQLite
  const client = await getClientById(uid, clientId);
  if (client) {
    await updateClient(uid, clientId, {
      balance: (client.balance || 0) + balanceChange,
    });
  }

  // 3. Actualizar totales del usuario en SQLite
  await updateUserDataField(uid, 'totalDebt', debtChange);

  // 4. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type, amount, title, description, createdAt: 'SERVER_TIMESTAMP' },
    'set'
  );
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${balanceChange}` }, 'update');
  await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtChange}` }, 'update');

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
 * 2. Encola en outbox para Firebase
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
  const oldBalanceChange = oldType === 'payment' ? -oldAmount : oldAmount;
  const newBalanceChange = newType === 'payment' ? newAmount : -newAmount;
  const netBalanceChange = oldBalanceChange + newBalanceChange;

  const oldDebtDiff = oldType === 'debt' ? oldAmount : -oldAmount;
  const newDebtDiff = newType === 'debt' ? newAmount : -newAmount;
  const debtDiff = newDebtDiff - oldDebtDiff;

  // 1. Actualizar transacción en SQLite
  await updateTransaction(uid, txId, {
    type: newType,
    amount: newAmount,
    title: newTitle || '',
    description: newDescription || '',
  });

  // 2. Actualizar balance del cliente en SQLite
  if (netBalanceChange !== 0) {
    const client = await getClientById(uid, clientId);
    if (client) {
      await updateClient(uid, clientId, {
        balance: (client.balance || 0) + netBalanceChange,
      });
    }
  }

  // 3. Actualizar totales del usuario en SQLite
  if (debtDiff !== 0) await updateUserDataField(uid, 'totalDebt', debtDiff);

  // 4. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type: newType, amount: newAmount, title: newTitle, description: newDescription },
    'update'
  );
  if (netBalanceChange !== 0) {
    await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${netBalanceChange}` }, 'update');
  }
  if (debtDiff !== 0) {
    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtDiff}` }, 'update');
  }

  return { netBalanceChange, debtDiff };
};


/**
 * Elimina una transacción:
 * 1. Elimina de SQLite
 * 2. Encola en outbox para Firebase
 */
export const deleteTransaction = async ({ uid, clientId, txId, type, amount }) => {
  const balanceChange = type === 'payment' ? -amount : amount;
  const debtDiff = type === 'payment' ? amount : -amount;

  // 1. Eliminar transacción de SQLite
  await deleteTransactionDB(uid, txId);

  // 2. Actualizar balance del cliente en SQLite
  const client = await getClientById(uid, clientId);
  if (client) {
    await updateClient(uid, clientId, {
      balance: (client.balance || 0) + balanceChange,
    });
  }

  // 3. Actualizar totales del usuario en SQLite
  await updateUserDataField(uid, 'totalDebt', debtDiff);

  // 4. Encolar en outbox
  await addToOutbox(`users/${uid}/clients/${clientId}/transactions`, txId, null, 'delete');
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${balanceChange}` }, 'update');
  await addToOutbox('users', uid, { totalDebt: `INCREMENT_${debtDiff}` }, 'update');

  return { balanceChange, debtDiff };
};


/**
 * Elimina un cliente y todas sus transacciones:
 * 1. Elimina de SQLite
 * 2. Encola en outbox para Firebase
 */
export const deleteClient = async ({ uid, clientId, transactions }) => {
  let totalDebtReverted = 0;

  // Calcular totales a revertir y encolar eliminación de cada transacción
  for (const tx of transactions) {
    if (tx.type === 'debt') totalDebtReverted += tx.amount;
    else if (tx.type === 'payment') totalDebtReverted -= tx.amount;
    addToOutbox(`users/${uid}/clients/${clientId}/transactions`, tx.id, null, 'delete');
  }

  // Revertir totales globales del usuario en SQLite
  if (totalDebtReverted !== 0) await updateUserDataField(uid, 'totalDebt', -totalDebtReverted);

  // Eliminar cliente y sus transacciones de SQLite (la función borra en cascada)
  await deleteClientDB(uid, clientId);

  // Encolar en outbox
  if (totalDebtReverted !== 0) {
    await addToOutbox('users', uid, {
      totalDebt: `INCREMENT_${-totalDebtReverted}`,
    }, 'update');
  }
  await addToOutbox(`users/${uid}/clients`, clientId, null, 'delete');

  return { totalDebtReverted };
};
