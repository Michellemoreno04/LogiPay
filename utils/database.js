import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = async () => {



  if (!db) {
    db = await SQLite.openDatabaseAsync('logipay.db');

    // Create cache table
    // key: unique identifier (e.g., 'clients', 'transactions_client123')
    // value: JSON string of data
    // updatedAt: timestamp
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    // Create outbox table for pending offline writes
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
  }
  return db;
};

export const getCache = async (key) => {
  try {
    const database = await initDB();
    const result = await database.getFirstAsync('SELECT * FROM cache WHERE key = ?', [key]);

    if (result) {
      return JSON.parse(result.value);
    }
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
    return await database.getAllAsync("SELECT * FROM outbox WHERE status = 'pending' ORDER BY createdAt ASC");
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
