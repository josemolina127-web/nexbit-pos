export function downloadCsv(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const val = String(cell ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(','))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSales(sales) {
  downloadCsv('ventas', [
    '#', 'Fecha', 'Total', 'Forma Pago', 'Cliente', 'Cajero', 'Anulada', 'Motivo Anulación'
  ], sales.map(v => [
    v.id, v.fecha, v.total, v.forma_pago, v.cliente_nombre || 'Mostrador',
    v.nombre_usuario, v.anulada ? 'Sí' : 'No', v.motivo_anulacion || ''
  ]));
}

export function exportSaleDetail(sale, items) {
  downloadCsv(`venta_${sale.id}_detalle`, [
    'Producto', 'Cantidad', 'Precio Unitario', 'Descuento', 'Subtotal'
  ], items.map(i => [
    i.nombre_producto, i.cantidad, i.precio_unitario, i.descuento || 0, i.subtotal
  ]));
}

export function exportProducts(products) {
  downloadCsv('productos', [
    'Código Barras', 'Nombre', 'Precio Venta', 'Precio Costo', 'Stock',
    'Stock Mínimo', 'Categoría', 'Unidad', 'Activo'
  ], products.map(p => [
    p.codigo_barras || '', p.nombre, p.precio_venta, p.precio_costo, p.stock,
    p.stock_minimo, p.categoria_nombre || '', p.unidad_medida, p.activo ? 'Sí' : 'No'
  ]));
}

export function exportInventoryMovements(movements) {
  downloadCsv('movimientos_inventario', [
    'Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock Anterior', 'Stock Nuevo',
    'Precio Costo', 'Referencia', 'Usuario'
  ], movements.map(m => [
    m.created_at, m.producto_nombre, m.tipo, m.cantidad, m.stock_anterior,
    m.stock_nuevo, m.precio_costo || '', m.referencia || '', m.nombre_usuario || ''
  ]));
}

export function exportClients(clients) {
  downloadCsv('clientes', [
    'Nombre', 'Teléfono', 'Correo', 'Dirección', 'Saldo Pendiente'
  ], clients.map(c => [
    c.nombre, c.telefono || '', c.correo || '', c.direccion || '', c.saldo_pendiente
  ]));
}

const headerKeyMap = {
  'producto': 'nombre_producto',
  'ventas': 'ventas',
  'costo': 'costo',
  'ganancia': 'ganancia',
};

export function exportReport(data, name, headers) {
  const rows = data.map(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return headers.map(h => {
        let lower = h.replace(/^#\s*/, '').toLowerCase();
        if (headerKeyMap[lower]) return item[headerKeyMap[lower]] ?? '';
        const key = Object.keys(item).find(k => k.toLowerCase() === lower);
        return key ? item[key] ?? '' : '';
      });
    }
    return item;
  });
  downloadCsv(name, headers, rows);
}

export function exportReturns(returns) {
  downloadCsv('devoluciones', [
    '#', 'Fecha', 'Total', 'Venta Original', 'Usuario', 'Motivo'
  ], returns.map(d => [
    d.id, d.fecha, d.total, d.venta_id ? `#${d.venta_id}` : '-',
    d.nombre_usuario || '', d.motivo || ''
  ]));
}

export function downloadCsvTemplate() {
  downloadCsv('plantilla_productos', [
    'codigo_barras', 'nombre', 'precio_venta', 'precio_costo', 'stock',
    'stock_minimo', 'categoria_nombre', 'unidad_medida', 'activo'
  ], [[
    '7501234567890', 'Ejemplo Producto', '25.00', '18.00', '100',
    '10', 'Abarrotes', 'pieza', 'Sí'
  ]]);
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return reject(new Error('El CSV debe tener encabezados + al menos 1 fila'));

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).map(line => {
          const values = [];
          let current = '', inQuotes = false;
          for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
            current += ch;
          }
          values.push(current.trim());

          const row = {};
          headers.forEach((h, i) => { row[h] = values[i] || ''; });
          return row;
        });

        const mapped = rows.map(r => ({
          nombre: r.nombre || r.name || r.nombre_producto || '',
          codigo_barras: r.codigo_barras || r.sku || r.codigo || '',
          precio_venta: parseFloat(r.precio_venta || r['precio normal'] || r.precio || r.price || r.precio_regular || 0),
          precio_costo: parseFloat(r.precio_costo || r.costo || r.cost || 0),
          stock: parseInt(r.stock || r.inventario || r.cantidad || r.quantity || 0),
          stock_minimo: parseInt(r.stock_minimo || r.minimo || r.min_stock || r.minimum || r['cantidad de bajo inventario'] || 0),
          categoria_nombre: r.categoria_nombre || r.categorías || r.categoria || r.category || '',
          unidad_medida: r.unidad_medida || r.unidad || r.unit || 'pieza',
          activo: r['¿está destacado?'] === '1' || r.publicado === '1' || (r.activo || r.active || 'Sí').toLowerCase() === 'sí' || (r.activo || r.active || 'Sí').toLowerCase() === 'si' || (r.activo || r.active || 'Sí').toLowerCase() === 'yes' || (r.activo || r.active || 'Sí') === '1',
        }));

        resolve(mapped);
      } catch (err) {
        reject(new Error('Error al leer el archivo: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}
