/**
 * bootstrapSync.js
 *
 * Sincronización inicial desde Firebase → SQLite.
 * Se ejecuta UNA SOLA VEZ cuando el usuario abre la app en un dispositivo nuevo
 * con la base de datos local vacía (no hay clientes ni productos en SQLite).
 *
 * Descarga clientes, transacciones, productos y ventas del usuario desde Firebase
 * y los guarda en SQLite para que la app funcione offline desde ese momento.
 */

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db as firestore } from '../firebaseConfig/config';
import {
  getClients,
  getProducts,
  insertClient,
  insertProduct,
  insertSale,
  insertTransaction,
  saveUserData,
} from './database';

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
 * Solo actúa si tanto `clients` como `products` están vacíos para ese usuario.
 *
 * @param {string} uid - UID del usuario autenticado
 * @param {object} [userData] - Datos del usuario (businessName, businessType, etc.)
 * @returns {Promise<boolean>} - true si se sincronizó, false si ya había datos
 */
export const bootstrapFromFirebase = async (uid, userData = null) => {
  if (!uid) return false;

  try {
    // Verificar si SQLite ya tiene datos (clientes o productos) → si hay, no hacer nada
    const [existingClients, existingProducts] = await Promise.all([
      getClients(uid),
      getProducts(uid),
    ]);

    if (existingClients.length > 0 || existingProducts.length > 0) {
      console.log('[Bootstrap] SQLite ya tiene datos, omitiendo descarga.');
      return false;
    }

    console.log('[Bootstrap] SQLite vacío, descargando datos desde Firebase...');

    // Guardar datos del usuario si los tenemos
    if (userData) {
      await saveUserData(uid, userData);
    }

    // ── Descargar clientes y sus transacciones ──────────────────────────────────
    try {
      const clientsSnap = await getDocs(
        collection(firestore, 'users', uid, 'clients')
      );

      if (!clientsSnap.empty) {
        console.log(`[Bootstrap] Descargando ${clientsSnap.docs.length} clientes...`);

        for (const clientDoc of clientsSnap.docs) {
          const clientData = clientDoc.data();
          const createdAt = clientData.createdAt?.toMillis?.() || Date.now();

          await insertClient(uid, {
            id: clientDoc.id,
            name: clientData.name || 'Sin nombre',
            phone: clientData.phone || '',
            email: clientData.email || '',
            balance: clientData.balance ?? 0,
            createdAt,
          });

          // Descargar transacciones de este cliente
          try {
            const txSnap = await getDocs(
              query(
                collection(firestore, 'users', uid, 'clients', clientDoc.id, 'transactions'),
                orderBy('createdAt', 'desc')
              )
            );

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
          } catch (e) {
            console.warn('[Bootstrap] Error descargando txs de cliente', clientDoc.id, e.code);
          }
        }
      } else {
        console.log('[Bootstrap] No hay clientes en Firebase aún.');
      }
    } catch (e) {
      console.warn('[Bootstrap] Error descargando clientes:', e.code || e.message);
    }

    // ── Descargar productos y sus ventas ────────────────────────────────────────
    try {
      const productsSnap = await getDocs(
        collection(firestore, 'users', uid, 'products')
      );

      if (!productsSnap.empty) {
        console.log(`[Bootstrap] Descargando ${productsSnap.docs.length} productos...`);

        for (const productDoc of productsSnap.docs) {
          const productData = productDoc.data();
          const productCreatedAt = productData.createdAt?.toMillis?.() || Date.now();

          const barcodesArr = Array.isArray(productData.barcodes)
            ? productData.barcodes
            : [];

          await insertProduct(uid, {
            id: productDoc.id,
            name: productData.name || 'Sin nombre',
            price: productData.price ?? 0,
            description: productData.description || '',
            stock: productData.stock ?? -1,
            barcode: productData.barcode || '',
            barcodes: barcodesArr,
            buyPrice: productData.buyPrice ?? null,
            category: productData.category || '',
            photoUri: productData.photoUri || '',
            createdAt: productCreatedAt,
          });

          // Descargar ventas de este producto
          try {
            const salesSnap = await getDocs(
              query(
                collection(firestore, 'users', uid, 'products', productDoc.id, 'sales'),
                orderBy('createdAt', 'desc')
              )
            );

            for (const saleDoc of salesSnap.docs) {
              const saleData = saleDoc.data();
              const saleCreatedAt = saleData.createdAt?.toMillis?.() || Date.now();

              await insertSale(uid, {
                id: saleDoc.id,
                productId: productDoc.id,
                clientId: saleData.clientId || '',
                clientName: saleData.clientName || 'Venta al contado',
                quantity: saleData.quantity ?? 1,
                unitPrice: saleData.unitPrice ?? 0,
                buyPrice: saleData.buyPrice ?? null,
                totalAmount: saleData.totalAmount ?? 0,
                date: saleData.createdAt ? formatDate(saleData.createdAt) : '',
                createdAt: saleCreatedAt,
              });
            }
          } catch (e) {
            console.warn('[Bootstrap] Error descargando ventas del producto', productDoc.id, e.code);
          }
        }
      } else {
        console.log('[Bootstrap] No hay productos en Firebase aún.');
      }
    } catch (e) {
      console.warn('[Bootstrap] Error descargando productos:', e.code || e.message);
    }

    console.log('[Bootstrap] ✅ Sincronización inicial completada!');
    return true;
  } catch (error) {
    // Si no hay internet, el error es esperado; la app seguirá vacía hasta que haya conexión
    console.warn('[Bootstrap] Error (probablemente sin internet):', error.code || error.message);
    return false;
  }
};
