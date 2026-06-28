/**
 * bootstrapSync.js
 *
 * Sincronización inicial desde Firebase → SQLite.
 * Se ejecuta UNA SOLA VEZ cuando el usuario abre la app con el nuevo sistema
 * y la base de datos local está vacía (no hay clientes en SQLite).
 *
 * Esto recupera todos los clientes y transacciones del usuario desde Firebase
 * y los guarda en SQLite para que la app funcione offline desde ese momento.
 */

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db as firestore } from '../firebaseConfig/config';
import { getClients, insertClient, insertTransaction, saveUserData } from './database';

const formatDate = (createdAt) => {
  if (!createdAt) return '';
  try {
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const dateStr = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateStr} a las ${timeStr}`;
  } catch {
    return '';
  }
};

/**
 * Descarga todos los datos del usuario desde Firebase y los guarda en SQLite.
 * Solo actúa si la tabla `clients` está vacía para ese usuario.
 *
 * @param {string} uid - UID del usuario autenticado
 * @param {object} [userData] - Datos del usuario (businessName, businessType, etc.)
 * @returns {Promise<boolean>} - true si se sincronizó, false si ya había datos
 */
export const bootstrapFromFirebase = async (uid, userData = null) => {
  if (!uid) return false;

  try {
    // Verificar si SQLite ya tiene clientes → si hay, no hacer nada
    const existing = await getClients(uid);
    if (existing.length > 0) {
      return false;
    }

    console.log('[Bootstrap] SQLite vacío, descargando datos desde Firebase...');

    // Guardar datos del usuario si los tenemos
    if (userData) {
      await saveUserData(uid, userData);
    }

    // Obtener todos los clientes del usuario desde Firebase
    const clientsSnap = await getDocs(
      collection(firestore, 'users', uid, 'clients')
    );

    if (clientsSnap.empty) {
      console.log('[Bootstrap] No hay clientes en Firebase aún.');
      return false;
    }

    console.log(`[Bootstrap] Descargando ${clientsSnap.docs.length} clientes...`);

    for (const clientDoc of clientsSnap.docs) {
      const clientData = clientDoc.data();
      const createdAt = clientData.createdAt?.toMillis?.() || Date.now();

      // Guardar cliente en SQLite
      await insertClient(uid, {
        id: clientDoc.id,
        name: clientData.name || 'Sin nombre',
        phone: clientData.phone || '',
        email: clientData.email || '',
        balance: clientData.balance ?? 0,
        createdAt,
      });

      // Obtener todas las transacciones de este cliente desde Firebase
      let txSnap;
      try {
        txSnap = await getDocs(
          query(
            collection(firestore, 'users', uid, 'clients', clientDoc.id, 'transactions'),
            orderBy('createdAt', 'desc')
          )
        );
      } catch (e) {
        console.warn('[Bootstrap] Error descargando txs de cliente', clientDoc.id, e.code);
        continue;
      }

      for (const txDoc of txSnap.docs) {
        const txData = txDoc.data();
        const txCreatedAt = txData.createdAt?.toMillis?.() || Date.now();

        await insertTransaction(uid, {
          id: txDoc.id,
          clientId: clientDoc.id,
          type: txData.type || 'debt',
          amount: txData.amount ?? 0,
          title: txData.title || txData.description || '',
          description: txData.description || '',
          date: txData.createdAt ? formatDate(txData.createdAt) : '',
          createdAt: txCreatedAt,
        });
      }
    }

    console.log('[Bootstrap] ✅ Sincronización inicial completada!');
    return true;
  } catch (error) {
    // Si no hay internet, el error es esperado; la app seguirá vacía hasta que haya conexión
    console.warn('[Bootstrap] Error (probablemente sin internet):', error.code || error.message);
    return false;
  }
};
