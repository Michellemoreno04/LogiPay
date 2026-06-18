

import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import { addToOutbox, getCache, setCache } from './database';

const formatServiceDate = (date) => {
  const dateStr = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} a las ${timeStr}`;
};

// ─── Clientes ────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo cliente en el outbox y en caché.
 *
 * @param {object} params
 * @param {string} params.uid            - UID del usuario autenticado
 * @param {string} params.name
 * @param {string} params.phone
 * @param {string} params.email
 * @param {number} params.parsedBalance  - Monto numérico del saldo inicial
 * @param {string} params.transactionType - 'payment' | 'debt'
 * @param {string} params.balanceDescription
 *
 * @returns {{ clientId: string, initialTxId: string|null, balance: number }}
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

  // payment → balance sube (positivo), debt → balance baja (negativo)
  const balance = transactionType === 'payment' ? parsedBalance : -parsedBalance;

  // 1. Encolar creación del cliente
  await addToOutbox(`users/${uid}/clients`, clientId, {
    name,
    phone,
    email,
    balance,
    createdAt: 'SERVER_TIMESTAMP',
  }, 'set');

  let initialTxId = null;

  // 2. Si hay saldo inicial, encolar la transacción y actualizar totales
  if (parsedBalance > 0) {
    // Actualizar total global del usuario
    const totalField = transactionType === 'payment' ? 'totalPayment' : 'totalDebt';
    await addToOutbox('users', uid, {
      [totalField]: `INCREMENT_${parsedBalance}`,
    }, 'update');

    // Generar ID para la transacción inicial
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    initialTxId = doc(txRef).id;

    // Encolar la transacción inicial
    await addToOutbox(
      `users/${uid}/clients/${clientId}/transactions`,
      initialTxId,
      {
        type: transactionType,
        amount: parsedBalance,
        description: balanceDescription || 'Saldo inicial',
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );

    // Guardar transacción en caché
    const initialDate = formatServiceDate(new Date());
    await setCache(`clientTx_${clientId}_${uid}`, [{
      id: initialTxId,
      type: transactionType,
      amount: parsedBalance,
      description: balanceDescription || 'Saldo inicial',
      date: initialDate,
    }]);
  } else {
    await setCache(`clientTx_${clientId}_${uid}`, []);
  }

  // 3. Guardar el cliente en caché individual (para acceso offline rápido)
  await setCache(`client_${clientId}_${uid}`, {
    id: clientId, name, phone, email, balance, createdAt: Date.now(),
  });

  return { clientId, initialTxId, balance };
};

/**
 * Edita un cliente existente en el outbox y en caché.
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.clientId
 * @param {string} params.name
 * @param {string} params.phone
 * @param {string} params.email
 */
export const editClient = async ({ uid, clientId, name, phone, email }) => {
  // 1. Encolar actualización del cliente
  await addToOutbox(`users/${uid}/clients`, clientId, {
    name,
    phone,
    email,
  }, 'update');

  // 2. Actualizar caché de la lista de clientes
  const cachedClients = await getCache(`clients_${uid}`);
  if (cachedClients) {
    await setCache(`clients_${uid}`, cachedClients.map((c) =>
      c.id === clientId ? { ...c, name, phone, email } : c
    ));
  }

  // 3. Guardar el cliente en caché individual
  const cachedClient = await getCache(`client_${clientId}_${uid}`);
  if (cachedClient) {
    await setCache(`client_${clientId}_${uid}`, {
      ...cachedClient,
      name, phone, email
    });
  }
};


// ─── Transacciones ───────────────────────────────────────────────────────────

/**
 * Agrega una nueva transacción a un cliente.
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.clientId
 * @param {string} params.type          - 'payment' | 'debt'
 * @param {number} params.amount
 * @param {string} params.description
 *
 * @returns {{ txId: string, balanceChange: number, totalField: string }}
 */
export const addTransaction = async ({ uid, clientId, type, amount, title, description }) => {
  const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
  const txId = doc(txRef).id;

  const balanceChange = type === 'payment' ? amount : -amount;
  const totalField = type === 'payment' ? 'totalPayment' : 'totalDebt';

  // 1. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type, amount, title, description, createdAt: 'SERVER_TIMESTAMP' },
    'set'
  );
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${balanceChange}` }, 'update');
  await addToOutbox('users', uid, { [totalField]: `INCREMENT_${amount}` }, 'update');

  // 2. Actualizar caché de transacciones
  const newTx = {
    id: txId,
    type,
    amount,
    title,
    description,
    date: formatServiceDate(new Date()),
  };
  const cachedTxs = (await getCache(`clientTx_${clientId}_${uid}`)) || [];
  await setCache(`clientTx_${clientId}_${uid}`, [newTx, ...cachedTxs]);

  // 3. Actualizar caché del cliente
  const cachedClient = await getCache(`client_${clientId}_${uid}`);
  if (cachedClient) {
    await setCache(`client_${clientId}_${uid}`, {
      ...cachedClient,
      balance: (cachedClient.balance || 0) + balanceChange,
    });
  }

  return { txId, balanceChange, totalField, newTx };
};


/**
 * Edita una transacción existente.
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.clientId
 * @param {string} params.txId
 * @param {string} params.oldType
 * @param {number} params.oldAmount
 * @param {string} params.newType
 * @param {number} params.newAmount
 * @param {string} params.newDescription
 *
 * @returns {{ netBalanceChange: number, paymentDiff: number, debtDiff: number }}
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
  // Calcular diferencias de balance
  const oldBalanceChange = oldType === 'payment' ? -oldAmount : oldAmount;
  const newBalanceChange = newType === 'payment' ? newAmount : -newAmount;
  const netBalanceChange = oldBalanceChange + newBalanceChange;

  let paymentDiff = 0;
  let debtDiff = 0;
  if (oldType === 'payment') paymentDiff -= oldAmount;
  else debtDiff -= oldAmount;
  if (newType === 'payment') paymentDiff += newAmount;
  else debtDiff += newAmount;

  // 1. Encolar en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type: newType, amount: newAmount, title: newTitle, description: newDescription },
    'update'
  );
  if (netBalanceChange !== 0) {
    await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${netBalanceChange}` }, 'update');
  }
  const userUpdate = {};
  if (paymentDiff !== 0) userUpdate.totalPayment = `INCREMENT_${paymentDiff}`;
  if (debtDiff !== 0) userUpdate.totalDebt = `INCREMENT_${debtDiff}`;
  if (Object.keys(userUpdate).length > 0) {
    await addToOutbox('users', uid, userUpdate, 'update');
  }

  // 2. Actualizar caché de transacciones
  const cachedTxs = await getCache(`clientTx_${clientId}_${uid}`);
  if (cachedTxs) {
    await setCache(
      `clientTx_${clientId}_${uid}`,
      cachedTxs.map((t) =>
        t.id === txId
          ? { ...t, type: newType, amount: newAmount, title: newTitle, description: newDescription }
          : t
      )
    );
  }

  // 3. Actualizar caché del cliente
  const cachedClient = await getCache(`client_${clientId}_${uid}`);
  if (cachedClient) {
    await setCache(`client_${clientId}_${uid}`, {
      ...cachedClient,
      balance: (cachedClient.balance || 0) + netBalanceChange,
    });
  }

  return { netBalanceChange, paymentDiff, debtDiff };
};


/**
 * Elimina una transacción existente.
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.clientId
 * @param {string} params.txId
 * @param {string} params.type          - 'payment' | 'debt'
 * @param {number} params.amount
 *
 * @returns {{ balanceChange: number, totalField: string }}
 */
export const deleteTransaction = async ({ uid, clientId, txId, type, amount }) => {
  const balanceChange = type === 'payment' ? -amount : amount;
  const totalField = type === 'payment' ? 'totalPayment' : 'totalDebt';

  // 1. Encolar en outbox
  await addToOutbox(`users/${uid}/clients/${clientId}/transactions`, txId, null, 'delete');
  await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${balanceChange}` }, 'update');
  await addToOutbox('users', uid, { [totalField]: `INCREMENT_${-amount}` }, 'update');

  // 2. Actualizar caché de transacciones
  const cachedTxs = await getCache(`clientTx_${clientId}_${uid}`);
  if (cachedTxs) {
    await setCache(`clientTx_${clientId}_${uid}`, cachedTxs.filter((t) => t.id !== txId));
  }

  // 3. Actualizar caché del cliente
  const cachedClient = await getCache(`client_${clientId}_${uid}`);
  if (cachedClient) {
    await setCache(`client_${clientId}_${uid}`, {
      ...cachedClient,
      balance: (cachedClient.balance || 0) + balanceChange,
    });
  }

  return { balanceChange, totalField };
};


/**
 * Elimina un cliente y todas sus transacciones.
 *
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.clientId
 * @param {Array}  params.transactions  - Lista de transacciones actuales del cliente
 *
 * @returns {{ totalPaymentReverted: number, totalDebtReverted: number }}
 */
export const deleteClient = async ({ uid, clientId, transactions }) => {
  let totalPaymentReverted = 0;
  let totalDebtReverted = 0;

  // Encolar eliminación de cada transacción
  transactions.forEach((tx) => {
    if (tx.type === 'payment') totalPaymentReverted += tx.amount;
    else totalDebtReverted += tx.amount;
    addToOutbox(`users/${uid}/clients/${clientId}/transactions`, tx.id, null, 'delete');
  });

  // Revertir totales globales del usuario
  await addToOutbox('users', uid, {
    totalPayment: `INCREMENT_${-totalPaymentReverted}`,
    totalDebt: `INCREMENT_${-totalDebtReverted}`,
  }, 'update');

  // Encolar eliminación del cliente
  await addToOutbox(`users/${uid}/clients`, clientId, null, 'delete');

  // Actualizar caché de la lista de clientes
  const cachedClients = (await getCache(`clients_${uid}`)) || [];
  await setCache(`clients_${uid}`, cachedClients.filter((c) => c.id !== clientId));

  return { totalPaymentReverted, totalDebtReverted };
};
