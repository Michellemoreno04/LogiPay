import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import * as Network from 'expo-network';
import { db } from '../firebaseConfig/config';
import { getPendingOutbox, updateOutboxStatus, deleteFromOutbox, setCache } from './database';

let isSyncing = false;

export const syncOutbox = async () => {
  if (isSyncing) return;
  
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected || !networkState.isInternetReachable) {
    return;
  }

  isSyncing = true;
  try {
    const pendingItems = await getPendingOutbox();
    if (!pendingItems || pendingItems.length === 0) {
      isSyncing = false;
      return;
    }

    const { serverTimestamp, increment } = require('firebase/firestore');

    // Procesa cada elemento de la cola
    for (const item of pendingItems) {
      await updateOutboxStatus(item.id, 'syncing');
      
      try {
        const data = item.data ? JSON.parse(item.data) : null;
        let docRef;

        // Reemplazar tokens especiales
        if (data) {
          for (const key in data) {
            if (data[key] === 'SERVER_TIMESTAMP') {
              data[key] = serverTimestamp();
            } else if (typeof data[key] === 'string' && data[key].startsWith('INCREMENT_')) {
              const amount = parseFloat(data[key].replace('INCREMENT_', ''));
              data[key] = increment(amount);
            }
          }
        }

        switch (item.operation) {
          case 'set':
            docRef = doc(db, item.collection, item.docId);
            await setDoc(docRef, data);
            break;
          case 'add':
            const colRef = collection(db, item.collection);
            await addDoc(colRef, data);
            break;
          case 'update':
            docRef = doc(db, item.collection, item.docId);
            await updateDoc(docRef, data);
            break;
          case 'delete':
            docRef = doc(db, item.collection, item.docId);
            await deleteDoc(docRef);
            break;
          default:
            console.warn('Unknown operation', item.operation);
        }

        // Se eliminó exitosamente
        await deleteFromOutbox(item.id);
      } catch (err) {
        console.error('Error syncing item:', item.id, err);
        // Volvemos a pending para reintentar luego
        await updateOutboxStatus(item.id, 'pending');
      }
    }
  } catch (error) {
    console.error('Error in sync engine:', error);
  } finally {
    isSyncing = false;
  }
};
