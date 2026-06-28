import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = async () => {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('logipay.db');

  // ── Tabla de clientes (fuente de verdad principal) ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
  `);

  // ── Tabla de transacciones (fuente de verdad principal) ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      clientId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      date TEXT DEFAULT '',
      createdAt INTEGER NOT NULL
    );
  `);

  // ── Tabla de datos del usuario / negocio ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_data (
      uid TEXT PRIMARY KEY,
      businessName TEXT DEFAULT '',
      businessType TEXT DEFAULT 'commercial',
      totalPayment REAL DEFAULT 0,
      totalDebt REAL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );
  `);

  // ── Caché genérica (legacy, se mantiene para compatibilidad) ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  // ── Outbox para sincronización con Firebase ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      docId TEXT,
      data TEXT,
      operation TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER NOT NULL
    );
  `);

  return db;
};

// ─── Helpers de caché genérica (legacy) ───────────────────────────────────────

export const getCache = async (key) => {
  try {
    const database = await initDB();
    const result = await database.getFirstAsync('SELECT * FROM cache WHERE key = ?', [key]);
    if (result) return JSON.parse(result.value);
    return null;
  } catch (error) {
    console.error('Error in getCache:', error);
    return null;
  }
};

export const setCache = async (key, value) => {
  try {
    const database = await initDB();
    const jsonValue = JSON.stringify(value);
    const now = Date.now();
    await database.runAsync(
      'INSERT OR REPLACE INTO cache (key, value, updatedAt) VALUES (?, ?, ?)',
      [key, jsonValue, now]
    );
  } catch (error) {
    console.error('Error in setCache:', error);
  }
};

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

export const insertClient = async (uid, client) => {
  try {
    const database = await initDB();
    await database.runAsync(
      `INSERT OR REPLACE INTO clients (id, uid, name, phone, email, balance, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        client.id,
        uid,
        client.name,
        client.phone || '',
        client.email || '',
        client.balance ?? 0,
        client.createdAt ?? Date.now(),
      ]
    );
  } catch (error) {
    console.error('Error in insertClient:', error);
    throw error;
  }
};

export const updateClient = async (uid, clientId, changes) => {
  try {
    const database = await initDB();
    const fields = Object.keys(changes)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(changes), uid, clientId];
    await database.runAsync(
      `UPDATE clients SET ${fields} WHERE uid = ? AND id = ?`,
      values
    );
  } catch (error) {
    console.error('Error in updateClient:', error);
    throw error;
  }
};

export const deleteClientDB = async (uid, clientId) => {
  try {
    const database = await initDB();
    await database.runAsync('DELETE FROM clients WHERE uid = ? AND id = ?', [uid, clientId]);
    await database.runAsync('DELETE FROM transactions WHERE uid = ? AND clientId = ?', [uid, clientId]);
  } catch (error) {
    console.error('Error in deleteClientDB:', error);
    throw error;
  }
};

export const getClients = async (uid) => {
  try {
    const database = await initDB();
    return await database.getAllAsync(
      'SELECT * FROM clients WHERE uid = ? ORDER BY createdAt DESC',
      [uid]
    );
  } catch (error) {
    console.error('Error in getClients:', error);
    return [];
  }
};

export const getClientById = async (uid, clientId) => {
  try {
    const database = await initDB();
    return await database.getFirstAsync(
      'SELECT * FROM clients WHERE uid = ? AND id = ?',
      [uid, clientId]
    );
  } catch (error) {
    console.error('Error in getClientById:', error);
    return null;
  }
};

// ─── TRANSACCIONES ────────────────────────────────────────────────────────────

export const insertTransaction = async (uid, tx) => {
  try {
    const database = await initDB();
    await database.runAsync(
      `INSERT OR REPLACE INTO transactions (id, uid, clientId, type, amount, title, description, date, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        uid,
        tx.clientId,
        tx.type,
        tx.amount,
        tx.title || '',
        tx.description || '',
        tx.date || '',
        tx.createdAt ?? Date.now(),
      ]
    );
  } catch (error) {
    console.error('Error in insertTransaction:', error);
    throw error;
  }
};

export const updateTransaction = async (uid, txId, changes) => {
  try {
    const database = await initDB();
    const fields = Object.keys(changes)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(changes), uid, txId];
    await database.runAsync(
      `UPDATE transactions SET ${fields} WHERE uid = ? AND id = ?`,
      values
    );
  } catch (error) {
    console.error('Error in updateTransaction:', error);
    throw error;
  }
};

export const deleteTransactionDB = async (uid, txId) => {
  try {
    const database = await initDB();
    await database.runAsync('DELETE FROM transactions WHERE uid = ? AND id = ?', [uid, txId]);
  } catch (error) {
    console.error('Error in deleteTransactionDB:', error);
    throw error;
  }
};

export const getTransactionsByClient = async (uid, clientId) => {
  try {
    const database = await initDB();
    return await database.getAllAsync(
      'SELECT * FROM transactions WHERE uid = ? AND clientId = ? ORDER BY createdAt DESC',
      [uid, clientId]
    );
  } catch (error) {
    console.error('Error in getTransactionsByClient:', error);
    return [];
  }
};

export const getAllTransactions = async (uid, limit = 200) => {
  try {
    const database = await initDB();
    return await database.getAllAsync(
      'SELECT * FROM transactions WHERE uid = ? ORDER BY createdAt DESC LIMIT ?',
      [uid, limit]
    );
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    return [];
  }
};

export const getRecentTransactions = async (uid, limit = 5) => {
  try {
    const database = await initDB();
    return await database.getAllAsync(
      'SELECT t.*, c.name as clientName FROM transactions t LEFT JOIN clients c ON t.clientId = c.id WHERE t.uid = ? ORDER BY t.createdAt DESC LIMIT ?',
      [uid, limit]
    );
  } catch (error) {
    console.error('Error in getRecentTransactions:', error);
    return [];
  }
};

// ─── DATOS DE USUARIO ─────────────────────────────────────────────────────────

export const saveUserData = async (uid, data) => {
  try {
    const database = await initDB();
    await database.runAsync(
      `INSERT OR REPLACE INTO user_data
       (uid, businessName, businessType, totalPayment, totalDebt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uid,
        data.businessName || '',
        data.businessType || 'commercial',
        data.totalPayment ?? 0,
        data.totalDebt ?? 0,
        Date.now(),
      ]
    );
  } catch (error) {
    console.error('Error in saveUserData:', error);
  }
};

export const getUserData = async (uid) => {
  try {
    const database = await initDB();
    return await database.getFirstAsync('SELECT * FROM user_data WHERE uid = ?', [uid]);
  } catch (error) {
    console.error('Error in getUserData:', error);
    return null;
  }
};

export const updateUserDataField = async (uid, field, increment) => {
  try {
    const database = await initDB();
    await database.runAsync(
      `UPDATE user_data SET ${field} = ${field} + ?, updatedAt = ? WHERE uid = ?`,
      [increment, Date.now(), uid]
    );
  } catch (error) {
    console.error('Error in updateUserDataField:', error);
  }
};

// ─── OUTBOX (sin cambios) ─────────────────────────────────────────────────────

export const addToOutbox = async (collection, docId, data, operation) => {
  try {
    const database = await initDB();
    const jsonValue = data ? JSON.stringify(data) : null;
    const now = Date.now();
    await database.runAsync(
      'INSERT INTO outbox (collection, docId, data, operation, createdAt) VALUES (?, ?, ?, ?, ?)',
      [collection, docId, jsonValue, operation, now]
    );
  } catch (error) {
    console.error('Error in addToOutbox:', error);
  }
};

export const getPendingOutbox = async () => {
  try {
    const database = await initDB();
    return await database.getAllAsync(
      "SELECT * FROM outbox WHERE status = 'pending' ORDER BY createdAt ASC"
    );
  } catch (error) {
    console.error('Error in getPendingOutbox:', error);
    return [];
  }
};

export const updateOutboxStatus = async (id, status) => {
  try {
    const database = await initDB();
    await database.runAsync('UPDATE outbox SET status = ? WHERE id = ?', [status, id]);
  } catch (error) {
    console.error('Error in updateOutboxStatus:', error);
  }
};

export const deleteFromOutbox = async (id) => {
  try {
    const database = await initDB();
    await database.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error in deleteFromOutbox:', error);
  }
};

// ─── MIGRACIÓN: Caché antigua → Tablas estructuradas ─────────────────────────
//
// Se ejecuta una sola vez cuando el usuario abre la app después de la
// actualización. Lee los datos del caché JSON (tabla `cache`) y los inserta
// en las nuevas tablas `clients` y `transactions`.
//
export const migrateFromLegacyCache = async (uid) => {
  if (!uid) return false;
  try {
    const database = await initDB();

    // Verificar si ya hay datos en la nueva tabla (migración ya realizada)
    const existing = await database.getFirstAsync(
      'SELECT COUNT(*) as count FROM clients WHERE uid = ?',
      [uid]
    );
    if (existing?.count > 0) {
      return false; // Ya migrado, no hacer nada
    }

    // Leer lista de clientes desde el caché viejo
    const cachedClientsRow = await database.getFirstAsync(
      'SELECT value FROM cache WHERE key = ?',
      [`clients_${uid}`]
    );
    if (!cachedClientsRow) return false;

    const cachedClients = JSON.parse(cachedClientsRow.value);
    if (!Array.isArray(cachedClients) || cachedClients.length === 0) return false;

    console.log(`[Migration] Migrando ${cachedClients.length} clientes desde caché...`);

    for (const client of cachedClients) {
      if (!client?.id) continue;

      // Insertar cliente en la nueva tabla
      await database.runAsync(
        `INSERT OR IGNORE INTO clients (id, uid, name, phone, email, balance, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          client.id,
          uid,
          client.name || 'Sin nombre',
          client.phone || '',
          client.email || '',
          client.balance ?? 0,
          client.createdAt || Date.now(),
        ]
      );

      // Leer transacciones de este cliente desde el caché viejo
      const cachedTxRow = await database.getFirstAsync(
        'SELECT value FROM cache WHERE key = ?',
        [`clientTx_${client.id}_${uid}`]
      );
      if (!cachedTxRow) continue;

      const cachedTxs = JSON.parse(cachedTxRow.value);
      if (!Array.isArray(cachedTxs)) continue;

      for (const tx of cachedTxs) {
        if (!tx?.id) continue;
        // Calcular createdAt: puede venir como _timestamp, createdAt numérico,
        // o no existir (usamos Date.now() como fallback)
        const createdAt =
          tx._timestamp ||
          (typeof tx.createdAt === 'number' ? tx.createdAt : null) ||
          Date.now();

        await database.runAsync(
          `INSERT OR IGNORE INTO transactions
           (id, uid, clientId, type, amount, title, description, date, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id,
            uid,
            client.id,
            tx.type || 'debt',
            tx.amount ?? 0,
            tx.title || tx.description || '',
            tx.description || '',
            tx.date || '',
            createdAt,
          ]
        );
      }
    }

    console.log('[Migration] ¡Migración completada exitosamente!');
    return true;
  } catch (error) {
    console.error('[Migration] Error en migración:', error);
    return false;
  }
};

