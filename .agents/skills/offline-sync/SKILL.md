---
name: offline-sync
description: >-
  Use this skill when adding, modifying, or debugging offline-first data entities,
  SQLite schema migrations, outbox synchronization queue, or Firestore sync flows in LogiPay.
---

# Offline-First & Sync Engine Workflow (LogiPay)

LogiPay opera bajo un modelo **Offline-First estricto**. Los datos se leen y persisten de inmediato en SQLite (`expo-sqlite`), y las mutaciones se encolan en una tabla `outbox` para sincronizarse en segundo plano con Firebase Firestore mediante `utils/syncEngine.js`.

---

## 1. Regla de Flujo de Datos

```
[UI / Pantalla] ──(1. Lectura)──> [SQLite / LocalDataContext]
        │
   (2. Mutación)
        ▼
   [utils/*Service.js]
     ├──> (A) Escribe en SQLite (inmediato, síncrono para el usuario)
     └──> (B) addToOutbox(...) (encola operación en tabla 'outbox')
                 │
                 ▼
         [utils/syncEngine.js] ──(3. Background)──> [Firebase Firestore]
```

---

## 2. Agregar o Modificar Tablas en SQLite (`utils/database.js`)

Cuando agregues una tabla o columna nueva:

1. **Definir la tabla en `initDB()`**:
   Usa `CREATE TABLE IF NOT EXISTS` con campos consistentes (`id`, `uid`, timestamps numéricos en milisegundos).

2. **Crear migración de columnas**:
   Si se agrega una columna a una tabla existente, verifica si ya existe con `PRAGMA table_info(nombre_tabla)`.
   Ejemplo:
   ```javascript
   const tableInfo = await database.getAllAsync("PRAGMA table_info(products)");
   const hasColumn = tableInfo.some(col => col.name === 'nuevaColumna');
   if (!hasColumn) {
     await database.execAsync("ALTER TABLE products ADD COLUMN nuevaColumna TEXT DEFAULT '';");
   }
   ```

---

## 3. Encolar Mutaciones en Outbox (`addToOutbox`)

Toda operación que deba reflejarse en Firestore debe usar `addToOutbox`:

```javascript
import { addToOutbox } from './database';

// 1. Inserción o actualización completa (set con merge)
await addToOutbox(
  `users/${uid}/products`,  // Colección en Firestore
  productId,                // ID del documento
  {
    name,
    price,
    stock,
    createdAt: 'SERVER_TIMESTAMP' // Token reemplazado por serverTimestamp() en syncEngine
  },
  'set'                     // 'set' | 'update' | 'add' | 'delete'
);

// 2. Operaciones atómicas de balance o inventario
await addToOutbox(
  `users/${uid}`,
  'stats',
  {
    totalRevenue: 'INCREMENT_150.50' // Token reemplazado por increment(150.50)
  },
  'update'
);
```

---

## 4. Ejecución del Motor de Sincronización (`utils/syncEngine.js`)

- Al terminar de encolar una o varias operaciones, invoca la sincronización en background:
  ```javascript
  import { syncOutbox } from './syncEngine';
  syncOutbox().catch(err => console.warn('[Sync] Background sync error:', err));
  ```
- `syncOutbox()` comprueba la conectividad (`expo-network`). Si no hay conexión o falla la red, el registro permanece en estado `pending` en la tabla `outbox` para el próximo intento automático.

---

## 5. Actualización Reactiva de la UI (`context/LocalDataContext.jsx`)

Para que la UI refleje cambios sin esperar re-lecturas lentas:
1. Actualiza el estado reactivo en `LocalDataContext` o expón un método helper (`reloadProducts()`, `reloadClients()`).
2. Mantén los listeners de `onSnapshot` en segundo plano para capturar cambios remotos si otro dispositivo modifica datos del usuario.
