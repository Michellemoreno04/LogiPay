import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import {
  addToOutbox,
  deleteProductDB,
  deleteSaleDB,
  getClientById,
  getProductById,
  insertProduct,
  insertSale,
  insertTransaction,
  updateClient,
  updateProduct,
  updateUserDataField,
  getTransactionsByClient,
  deleteTransactionDB,
  getSalesByProduct
} from './database';


const formatSaleDate = (date) => {
  const dateStr = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} a las ${timeStr}`;
};

// ─── Productos ────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo producto:
 * 1. Guarda en SQLite
 * 2. Encola en outbox para Firebase
 */
export const createProduct = async ({ uid, name, price, description, stock }) => {
  const productsRef = collection(db, 'users', uid, 'products');
  const productId = doc(productsRef).id;
  const now = Date.now();

  await insertProduct(uid, {
    id: productId,
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
    createdAt: now,
  });

  await addToOutbox(`users/${uid}/products`, productId, {
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
    createdAt: 'SERVER_TIMESTAMP',
  }, 'set');

  return { productId };
};

/**
 * Edita un producto existente.
 */
export const editProduct = async ({ uid, productId, name, price, description, stock }) => {
  const changes = {
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
  };

  await updateProduct(uid, productId, changes);
  await addToOutbox(`users/${uid}/products`, productId, changes, 'update');
};

/**
 * Elimina un producto y todas sus ventas.
 */
export const deleteProduct = async ({ uid, productId }) => {
  // Revertir deudas de todas las ventas asociadas
  const sales = await getSalesByProduct(uid, productId);
  for (const sale of sales) {
    if (sale.clientId && sale.totalAmount) {
      const txs = await getTransactionsByClient(uid, sale.clientId);
      const tx = txs.find(t => t.type === 'debt' && t.amount === sale.totalAmount);
      if (tx) {
        const client = await getClientById(uid, sale.clientId);
        if (client) {
          await updateClient(uid, sale.clientId, { balance: (client.balance || 0) + sale.totalAmount });
          await addToOutbox(`users/${uid}/clients`, sale.clientId, { balance: `INCREMENT_${sale.totalAmount}` }, 'update');
        }
        await updateUserDataField(uid, 'totalDebt', -sale.totalAmount);
        await addToOutbox('users', uid, { totalDebt: `INCREMENT_${-sale.totalAmount}` }, 'update');
        await deleteTransactionDB(uid, tx.id);
        await addToOutbox(`users/${uid}/clients/${sale.clientId}/transactions`, tx.id, null, 'delete');
      }
    }
  }

  await deleteProductDB(uid, productId);
  await addToOutbox(`users/${uid}/products`, productId, null, 'delete');
};

// ─── Ventas ───────────────────────────────────────────────────────────────────

/**
 * Registra una venta:
 * 1. Guarda la venta en SQLite
 * 2. Crea una transacción de deuda (debt) para el cliente en SQLite
 * 3. Actualiza el balance del cliente y el totalDebt del usuario
 * 4. Actualiza el stock del producto si aplica
 * 5. Encola todo en outbox para Firebase
 */
export const recordSale = async ({ uid, productId, productName, clientId, clientName, quantity, unitPrice }) => {
  const salesRef = collection(db, 'users', uid, 'products', productId, 'sales');
  const saleId = doc(salesRef).id;

  const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
  const txId = doc(txRef).id;

  const now = Date.now();
  const parsedQty = parseFloat(quantity) || 1;
  const parsedPrice = parseFloat(unitPrice) || 0;
  const totalAmount = parsedQty * parsedPrice;
  const date = formatSaleDate(new Date());

  // 1. Guardar venta en SQLite
  await insertSale(uid, {
    id: saleId,
    productId,
    clientId,
    clientName,
    quantity: parsedQty,
    unitPrice: parsedPrice,
    totalAmount,
    date,
    createdAt: now,
  });

  // 2. Crear transacción de deuda para el cliente en SQLite
  //    (mismo flujo que addTransaction en clientService.js)
  const txTitle = `Compra: ${productName || 'Producto'}`;
  await insertTransaction(uid, {
    id: txId,
    clientId,
    type: 'debt',
    amount: totalAmount,
    title: txTitle,
    description: txTitle,
    date,
    createdAt: now,
  });

  // 3. Actualizar balance del cliente en SQLite (deuda = balance negativo)
  const client = await getClientById(uid, clientId);
  if (client) {
    await updateClient(uid, clientId, {
      balance: (client.balance || 0) - totalAmount,
    });
  }

  // 4. Actualizar totalDebt del usuario en SQLite
  await updateUserDataField(uid, 'totalDebt', totalAmount);

  // 5. Actualizar stock si el producto lo maneja (stock >= 0)
  const product = await getProductById(uid, productId);
  let newStock = -1;
  if (product && product.stock >= 0) {
    newStock = Math.max(0, product.stock - parsedQty);
    await updateProduct(uid, productId, { stock: newStock });
    await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
  }

  // 6. Encolar venta en outbox
  await addToOutbox(
    `users/${uid}/products/${productId}/sales`,
    saleId,
    {
      clientId,
      clientName,
      quantity: parsedQty,
      unitPrice: parsedPrice,
      totalAmount,
      date,
      createdAt: 'SERVER_TIMESTAMP',
    },
    'set'
  );

  // 7. Encolar transacción de deuda en outbox
  await addToOutbox(
    `users/${uid}/clients/${clientId}/transactions`,
    txId,
    { type: 'debt', amount: totalAmount, title: txTitle, description: txTitle, createdAt: 'SERVER_TIMESTAMP' },
    'set'
  );

  // 8. Encolar actualización de balance del cliente en outbox
  await addToOutbox(
    `users/${uid}/clients`,
    clientId,
    { balance: `INCREMENT_${-totalAmount}` },
    'update'
  );

  // 9. Encolar actualización de totalDebt del usuario en outbox
  await addToOutbox('users', uid, { totalDebt: `INCREMENT_${totalAmount}` }, 'update');

  return {
    saleId,
    txId,
    totalAmount,
    date,
    newStock,
  };
};

/**
 * Elimina una venta y revierte la deuda del cliente y el stock.
 */

export const deleteSale = async ({ uid, productId, saleId, quantity, clientId, totalAmount }) => {
  await deleteSaleDB(uid, saleId);

  // Revertir stock si aplica
  const product = await getProductById(uid, productId);
  if (product && product.stock >= 0) {
    const newStock = product.stock + (parseFloat(quantity) || 0);
    await updateProduct(uid, productId, { stock: newStock });
    await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
  }

  // Revertir deuda del cliente y totalDebt
  if (clientId && totalAmount) {
    const txs = await getTransactionsByClient(uid, clientId);
    const tx = txs.find(t => t.type === 'debt' && t.amount === totalAmount);
    if (tx) {
      const client = await getClientById(uid, clientId);
      if (client) {
        await updateClient(uid, clientId, { balance: (client.balance || 0) + totalAmount });
        await addToOutbox(`users/${uid}/clients`, clientId, { balance: `INCREMENT_${totalAmount}` }, 'update');
      }
      await updateUserDataField(uid, 'totalDebt', -totalAmount);
      await addToOutbox('users', uid, { totalDebt: `INCREMENT_${-totalAmount}` }, 'update');
      await deleteTransactionDB(uid, tx.id);
      await addToOutbox(`users/${uid}/clients/${clientId}/transactions`, tx.id, null, 'delete');
    }
  }

  await addToOutbox(`users/${uid}/products/${productId}/sales`, saleId, null, 'delete');
};
