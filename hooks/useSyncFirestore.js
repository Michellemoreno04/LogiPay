import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { getCache, setCache } from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

export const useSyncFirestore = (queryRef, cacheKey, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = null;
    let isMounted = true;

    const init = async () => {
      // 1. Intentamos leer de la caché primero
      if (cacheKey) {
        const cachedData = await getCache(cacheKey);
        if (cachedData && isMounted) {
          setData(cachedData);
          setLoading(false);
        }
      }

      // 2. Intentamos sincronizar operaciones pendientes si tenemos internet
      syncOutbox();

      // 3. Nos suscribimos a Firestore
      if (queryRef) {
        unsubscribe = onSnapshot(queryRef, (snap) => {
          const newData = [];
          snap.forEach((doc) => {
            const docData = doc.data();
            // Evitamos guardar referencias o funciones en SQLite
            // Convertimos Timestamp a milisegundos si existe
            let normalizedData = { id: doc.id, ...docData };
            if (normalizedData.createdAt && typeof normalizedData.createdAt.toMillis === 'function') {
              normalizedData._timestamp = normalizedData.createdAt.toMillis();
            } else if (normalizedData.createdAt && normalizedData.createdAt.seconds) {
               normalizedData._timestamp = normalizedData.createdAt.seconds * 1000;
            }
            newData.push(normalizedData);
          });
          
          if (isMounted) {
            setData(newData);
            setLoading(false);
            // 4. Guardamos en caché
            if (cacheKey) {
              setCache(cacheKey, newData);
            }
          }
        }, (error) => {
          console.error("Error in onSnapshot for", cacheKey, error);
          if (isMounted) setLoading(false);
        });
      } else {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, dependencies);

  return { data, loading, setData };
};
