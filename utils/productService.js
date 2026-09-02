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
export const createProduct = async ({ uid, name, price, description, stock, barcode, buyPrice, category, photoUri }) => {
  const productsRef = collection(db, 'users', uid, 'products');
  const productId = doc(productsRef).id;
  const now = Date.now();
  // Si hay un barcode principal, lo incluimos también en el array barcodes
  const barcodesArr = barcode ? [barcode] : [];

  await insertProduct(uid, {
    id: productId,
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
    barcode: barcode || '',
    barcodes: barcodesArr,
    buyPrice: parseFloat(buyPrice) || 0,
    category: category || '',
    photoUri: photoUri || '',
    createdAt: now,
  });

  await addToOutbox(`users/${uid}/products`, productId, {
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
    barcode: barcode || '',
    barcodes: barcodesArr,
    buyPrice: parseFloat(buyPrice) || 0,
    category: category || '',
    photoUri: photoUri || '',
    createdAt: 'SERVER_TIMESTAMP',
  }, 'set');

  return { productId };
};

/**
 * Edita un producto existente.
 */
export const editProduct = async ({ uid, productId, name, price, description, stock, barcode, barcodes, buyPrice, category, photoUri }) => {
  // Normalizar barcodes: puede venir como array o JSON string
  let barcodesArr = [];
  if (Array.isArray(barcodes)) {
    barcodesArr = barcodes;
  } else if (typeof barcodes === 'string') {
    try { barcodesArr = JSON.parse(barcodes); } catch { barcodesArr = []; }
  }
  const barcodesJson = JSON.stringify(barcodesArr);

  const changes = {
    name,
    price: parseFloat(price) || 0,
    description: description || '',
    stock: stock !== '' && stock !== null && stock !== undefined ? parseFloat(stock) : -1,
    barcode: barcode || '',
    barcodes: barcodesJson,
    buyPrice: parseFloat(buyPrice) || 0,
    category: category || '',
    photoUri: photoUri || '',
  };

  await updateProduct(uid, productId, changes);
  await addToOutbox(`users/${uid}/products`, productId, { ...changes, barcodes: barcodesArr }, 'update');
};

/**
 * Vincula un barcode adicional a un producto existente sin reemplazar el barcode principal.
 * Ambos códigos quedarán asociados al mismo producto.
 */
export const addBarcodeToProduct = async ({ uid, productId, newBarcode }) => {
  const product = await getProductById(uid, productId);
  if (!product) throw new Error('Producto no encontrado');

  // Parsear el array actual de barcodes
  let barcodesArr = [];
  try { barcodesArr = JSON.parse(product.barcodes || '[]'); } catch { barcodesArr = []; }

  // Asegurarse de que el barcode principal esté en el array
  if (product.barcode && !barcodesArr.includes(product.barcode)) {
    barcodesArr.unshift(product.barcode);
  }

  // Agregar el nuevo barcode si no existe ya
  if (newBarcode && !barcodesArr.includes(newBarcode)) {
    barcodesArr.push(newBarcode);
  }

  const barcodesJson = JSON.stringify(barcodesArr);
  await updateProduct(uid, productId, { barcodes: barcodesJson });
  await addToOutbox(`users/${uid}/products`, productId, { barcodes: barcodesArr }, 'update');

  return { barcodes: barcodesArr };
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

  const hasClient = Boolean(clientId);
  const effectiveClientId = clientId || '';
  const effectiveClientName = clientName || (hasClient ? '' : 'Venta al contado');

  let txId = null;
  if (hasClient) {
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    txId = doc(txRef).id;
  }

  const now = Date.now();
  const parsedQty = parseFloat(quantity) || 1;
  const parsedPrice = parseFloat(unitPrice) || 0;
  const totalAmount = parsedQty * parsedPrice;
  const date = formatSaleDate(new Date());

  // Leer el precio de compra del producto para calcular ganancia
  const productForBuyPrice = await getProductById(uid, productId);
  const parsedBuyPrice = parseFloat(productForBuyPrice?.buyPrice) || 0;

  // 1. Guardar venta en SQLite
  await insertSale(uid, {
    id: saleId,
    productId,
    clientId: effectiveClientId,
    clientName: effectiveClientName,
    quantity: parsedQty,
    unitPrice: parsedPrice,
    buyPrice: parsedBuyPrice,
    totalAmount,
    date,
    createdAt: now,
  });

  // Actualizar stock si el producto lo maneja (stock >= 0)
  const product = await getProductById(uid, productId);
  let newStock = -1;
  if (product && product.stock >= 0) {
    newStock = Math.max(0, product.stock - parsedQty);
    await updateProduct(uid, productId, { stock: newStock });
    await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
  }

  // Encolar venta en outbox
  await addToOutbox(
    `users/${uid}/products/${productId}/sales`,
    saleId,
    {
      clientId: effectiveClientId,
      clientName: effectiveClientName,
      quantity: parsedQty,
      unitPrice: parsedPrice,
      buyPrice: parsedBuyPrice,
      totalAmount,
      date,
      createdAt: 'SERVER_TIMESTAMP',
    },
    'set'
  );

  // 2. Crear transacción / factura en SQLite y encolar en outbox
  const txTitle = `Compra: ${productName || 'Producto'}`;
  const txDescription = JSON.stringify({
    isInvoice: true,
    items: [{
      productId,
      productName: productName || 'Producto',
      quantity: parsedQty,
      unitPrice: parsedPrice,
      totalAmount,
    }],
    totalAmount,
  });

  if (hasClient) {
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    txId = doc(txRef).id;

    await insertTransaction(uid, {
      id: txId,
      clientId,
      type: 'debt',
      amount: totalAmount,
      title: txTitle,
      description: txDescription,
      date,
      createdAt: now,
    });

    const client = await getClientById(uid, clientId);
    if (client) {
      await updateClient(uid, clientId, {
        balance: (client.balance || 0) - totalAmount,
      });
    }

    await updateUserDataField(uid, 'totalDebt', totalAmount);

    await addToOutbox(
      `users/${uid}/clients/${clientId}/transactions`,
      txId,
      { type: 'debt', amount: totalAmount, title: txTitle, description: txDescription, createdAt: 'SERVER_TIMESTAMP' },
      'set'
    );

    await addToOutbox(
      `users/${uid}/clients`,
      clientId,
      { balance: `INCREMENT_${-totalAmount}` },
      'update'
    );

    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${totalAmount}` }, 'update');
  } else {
    // Venta al contado: 1 única transacción / factura
    const txRef = collection(db, 'users', uid, 'transactions');
    txId = doc(txRef).id;

    await insertTransaction(uid, {
      id: txId,
      clientId: '',
      type: 'sale',
      amount: totalAmount,
      title: txTitle,
      description: txDescription,
      date,
      createdAt: now,
    });

    await addToOutbox(
      `users/${uid}/transactions`,
      txId,
      {
        type: 'sale',
        amount: totalAmount,
        title: txTitle,
        description: txDescription,
        clientId: '',
        clientName: 'Venta al contado',
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );
  }

  return {
    saleId,
    txId,
    totalAmount,
    buyPrice: parsedBuyPrice,
    date,
    newStock,
  };
};

/**
 * Registra una orden de venta de múltiples productos:
 * 1. Guarda la venta individual de cada producto en SQLite y actualiza stock.
 * 2. Si hay cliente, crea 1 ÚNICA transacción de deuda tipo Factura para el cliente.
 * 3. Actualiza el balance del cliente de forma atómica en SQLite.
 * 4. Actualiza totalDebt del usuario en SQLite.
 * 5. Encola todo en outbox.
 */
export const recordSaleOrder = async ({ uid, clientId, clientName, items }) => {
  if (!items || items.length === 0) return null;

  const hasClient = Boolean(clientId);
  const effectiveClientId = clientId || '';
  const effectiveClientName = clientName || (hasClient ? '' : 'Venta al contado');
  const now = Date.now();
  const date = formatSaleDate(new Date());

  let totalOrderAmount = 0;
  const processedItems = [];
  const salesResults = [];

  for (const item of items) {
    const productId = item.productId || item.product?.id;
    const productName = item.productName || item.product?.name || 'Producto';
    const quantity = parseFloat(item.quantity) || 1;
    const unitPrice = parseFloat(item.unitPrice || item.product?.price) || 0;
    const lineTotal = quantity * unitPrice;
    totalOrderAmount += lineTotal;

    const salesRef = collection(db, 'users', uid, 'products', productId, 'sales');
    const saleId = doc(salesRef).id;

    const productForBuyPrice = await getProductById(uid, productId);
    const parsedBuyPrice = parseFloat(productForBuyPrice?.buyPrice) || 0;

    await insertSale(uid, {
      id: saleId,
      productId,
      clientId: effectiveClientId,
      clientName: effectiveClientName,
      quantity,
      unitPrice,
      buyPrice: parsedBuyPrice,
      totalAmount: lineTotal,
      date,
      createdAt: now,
    });

    let newStock = -1;
    if (productForBuyPrice && productForBuyPrice.stock >= 0) {
      newStock = Math.max(0, productForBuyPrice.stock - quantity);
      await updateProduct(uid, productId, { stock: newStock });
      await addToOutbox(`users/${uid}/products`, productId, { stock: newStock }, 'update');
    }

    await addToOutbox(
      `users/${uid}/products/${productId}/sales`,
      saleId,
      {
        clientId: effectiveClientId,
        clientName: effectiveClientName,
        quantity,
        unitPrice,
        buyPrice: parsedBuyPrice,
        totalAmount: lineTotal,
        date,
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );

    processedItems.push({
      productId,
      productName,
      quantity,
      unitPrice,
      totalAmount: lineTotal,
    });

    salesResults.push({
      saleId,
      productId,
      productName,
      quantity,
      unitPrice,
      buyPrice: parsedBuyPrice,
      totalAmount: lineTotal,
      newStock,
      date,
    });
  }

  let txId = null;
  const txTitle = `Factura de compra (${processedItems.length} producto${processedItems.length > 1 ? 's' : ''})`;
  const txDescription = JSON.stringify({
    isInvoice: true,
    items: processedItems,
    totalAmount: totalOrderAmount,
  });

  if (hasClient) {
    const txRef = collection(db, 'users', uid, 'clients', clientId, 'transactions');
    txId = doc(txRef).id;

    await insertTransaction(uid, {
      id: txId,
      clientId,
      type: 'debt',
      amount: totalOrderAmount,
      title: txTitle,
      description: txDescription,
      date,
      createdAt: now,
    });

    const client = await getClientById(uid, clientId);
    if (client) {
      await updateClient(uid, clientId, {
        balance: (client.balance || 0) - totalOrderAmount,
      });
    }

    await updateUserDataField(uid, 'totalDebt', totalOrderAmount);

    await addToOutbox(
      `users/${uid}/clients/${clientId}/transactions`,
      txId,
      {
        type: 'debt',
        amount: totalOrderAmount,
        title: txTitle,
        description: txDescription,
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );

    await addToOutbox(
      `users/${uid}/clients`,
      clientId,
      { balance: `INCREMENT_${-totalOrderAmount}` },
      'update'
    );

    await addToOutbox('users', uid, { totalDebt: `INCREMENT_${totalOrderAmount}` }, 'update');
  } else {
    // Venta al contado: 1 única transacción / factura para la orden
    const txRef = collection(db, 'users', uid, 'transactions');
    txId = doc(txRef).id;

    await insertTransaction(uid, {
      id: txId,
      clientId: '',
      type: 'sale',
      amount: totalOrderAmount,
      title: txTitle,
      description: txDescription,
      date,
      createdAt: now,
    });

    await addToOutbox(
      `users/${uid}/transactions`,
      txId,
      {
        type: 'sale',
        amount: totalOrderAmount,
        title: txTitle,
        description: txDescription,
        clientId: '',
        clientName: 'Venta al contado',
        createdAt: 'SERVER_TIMESTAMP',
      },
      'set'
    );
  }

  return {
    txId,
    totalOrderAmount,
    date,
    salesResults,
    items: processedItems,
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
