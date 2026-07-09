import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig/config';
import {
  addToOutbox,
  deleteProductDB,
  deleteSaleDB,
  getProductById,
  insertProduct,
  insertSale,
  updateProduct,
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
  await deleteProductDB(uid, productId);
  await addToOutbox(`users/${uid}/products`, productId, null, 'delete');
};

// ─── Ventas ───────────────────────────────────────────────────────────────────

/**
 * Registra una venta:
 * 1. Guarda en SQLite
 * 2. Actualiza stock del producto si aplica
 * 3. Encola en outbox para Firebase
 */
export const recordSale = async ({ uid, productId, clientId, clientName, quantity, unitPrice }) => {
  const salesRef = collection(db, 'users', uid, 'products', productId, 'sales');
  const saleId = doc(salesRef).id;
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

  // 2. Actualizar stock si el producto lo maneja (stock >= 0)
  const product = await getProductById(uid, productId);
  if (product && product.stock >= 0) {
    const newStock = Math.max(0, product.stock - parsedQty);
    await updateProduct(uid, productId, { stock: newStock });
    await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
  }

  // 3. Encolar venta en outbox
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

  return {
    saleId,
    totalAmount,
    date,
    newStock: product?.stock >= 0 ? Math.max(0, product.stock - parsedQty) : -1,
  };
};

/**
 * Elimina una venta y revierte el stock.
 */
export const deleteSale = async ({ uid, productId, saleId, quantity }) => {
  await deleteSaleDB(uid, saleId);

  // Revertir stock si aplica
  const product = await getProductById(uid, productId);
  if (product && product.stock >= 0) {
    const newStock = product.stock + (parseFloat(quantity) || 0);
    await updateProduct(uid, productId, { stock: newStock });
    await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
  }

  await addToOutbox(`users/${uid}/products/${productId}/sales`, saleId, null, 'delete');
};
