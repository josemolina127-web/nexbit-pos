import React, { useEffect, useState, useCallback } from 'react';
import { theme, card, cardBody, btn, badge, input as inputStyle, table as t } from '../styles/theme';
import { exportInventoryMovements } from '../utils/exportCsv';
import { $clp } from '../utils/format';

function dateRange(filter, monthRef) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  if (filter === 'day') {
    const desde = `${y}-${m}-${d} 00:00:00`;
    const hasta = `${y}-${m}-${d} 23:59:59`;
    return { desde, hasta };
  }
  if (filter === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    const s = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')} 00:00:00`;
    return { desde: s, hasta: `${y}-${m}-${d} 23:59:59` };
  }
  if (filter === 'month') {
    const my = parseInt(monthRef.slice(0, 4));
    const mm = monthRef.slice(5, 7);
    const lastDay = new Date(my, parseInt(mm), 0).getDate();
    return { desde: `${my}-${mm}-01 00:00:00`, hasta: `${my}-${mm}-${String(lastDay).padStart(2, '0')} 23:59:59` };
  }
  return {};
}

export default function InventoryPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState('alerts');
  const [dateFilter, setDateFilter] = useState('day');
  const now = new Date();
  const [monthRef, setMonthRef] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [dashboard, setDashboard] = useState(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [receiveDoc, setReceiveDoc] = useState({ proveedor_id: '', fecha: new Date().toISOString().split('T')[0], referencia: '' });
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveNewItem, setReceiveNewItem] = useState({ producto_id: '', cantidad: 1, precio_costo: '' });
  const [receiveSearch, setReceiveSearch] = useState('');
  const [receiveSearchResults, setReceiveSearchResults] = useState([]);
  const [selectedReceiveProduct, setSelectedReceiveProduct] = useState(null);
  const [providers, setProviders] = useState([]);
  const [expandProviderProducts, setExpandProviderProducts] = useState(false);
  const [providerProducts, setProviderProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providerProductForm, setProviderProductForm] = useState({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', unidad_medida: 'pieza' });
  const [editingProviderProduct, setEditingProviderProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ producto_id: '', nuevo_stock: 0, motivo: '' });
  const [editDialog, setEditDialog] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [receiveDocs, setReceiveDocs] = useState([]);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [editDocRef, setEditDocRef] = useState(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  const [editingDocItem, setEditingDocItem] = useState(null);

  const fetchMovements = useCallback((filter, mRef) => {
    window.nexbit.getInventoryMovements(dateRange(filter, mRef)).then(setMovements);
  }, []);

  useEffect(() => {
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    window.nexbit.getStockAlerts().then(setAlerts);
    window.nexbit.getProviders().then(setProviders).catch(() => {});
    window.nexbit.getCategories().then(setCategories).catch(() => {});
    window.nexbit.getCurrentUser().then(u => { if (u) setCurrentUserName(u.nombre_completo || u.nombre_usuario); }).catch(() => {});
    window.nexbit.getReceiveDocuments().then(setReceiveDocs).catch(() => {});
    fetchMovements(dateFilter, monthRef);
  }, [dateFilter, monthRef, fetchMovements]);

  const otherMovements = movements.filter(m => m.tipo !== 'entrada');

  const buildLocalDashboard = useCallback(() => {
    const catMap = {};
    products.forEach(p => {
      const cat = p.categoria_nombre || 'Sin categoría';
      if (!catMap[cat]) catMap[cat] = { nombre: cat, valor: 0, productos: 0 };
      catMap[cat].valor += p.stock * p.precio_costo;
      catMap[cat].productos += 1;
    });
    setDashboard({
      totalProductos: { cnt: products.length, total_items: products.reduce((s, p) => s + p.stock, 0), valor_total: products.reduce((s, p) => s + p.stock * p.precio_costo, 0) },
      alertasCount: alerts.length,
      categorias: Object.values(catMap).sort((a, b) => b.valor - a.valor),
      topProducts: [],
      sinMovimiento: [],
    });
  }, [products, alerts]);

  const loadDashboard = useCallback(() => {
    const range = dateFilter === 'all' ? {} : dateRange(dateFilter, monthRef);
    window.nexbit.getInventoryDashboard(range).then(setDashboard).catch(() => buildLocalDashboard());
  }, [dateFilter, monthRef, buildLocalDashboard]);

  useEffect(() => {
    if (tab === 'resumen') loadDashboard();
  }, [tab, loadDashboard]);

  const handleEditMovement = (m) => setEditDialog({ id: m.id, cantidad: m.cantidad, referencia: m.referencia || '' });

  const confirmEditMovement = async () => {
    if (!editDialog) return;
    await window.nexbit.updateMovement({ id: editDialog.id, cantidad: parseFloat(editDialog.cantidad), referencia: editDialog.referencia });
    setEditDialog(null);
    fetchMovements(dateFilter, monthRef);
  };

  const handleDeleteMovement = (id) => setConfirmDelete(id);

  const confirmDeleteMovement = async () => {
    if (!confirmDelete) return;
    await window.nexbit.deleteMovement(confirmDelete);
    setConfirmDelete(null);
    fetchMovements(dateFilter, monthRef);
  };

  const handleSaveDocItem = async () => {
    if (!editingDocItem) return;
    await window.nexbit.updateReceiveDocumentItem(editingDocItem.docId, editingDocItem.producto_id, { cantidad: parseFloat(editingDocItem.cantidad) || 1, precio_costo: parseFloat(editingDocItem.precio_costo) || 0 });
    setEditingDocItem(null);
    window.nexbit.getReceiveDocuments().then(setReceiveDocs);
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    fetchMovements(dateFilter, monthRef);
  };

  const handleDeleteDocItem = async (docId, productId) => {
    await window.nexbit.deleteReceiveDocumentItem(docId, productId);
    window.nexbit.getReceiveDocuments().then(setReceiveDocs);
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    fetchMovements(dateFilter, monthRef);
  };

  const handleEditDocument = async () => {
    if (!editDocRef) return;
    await window.nexbit.updateReceiveDocument(editDocRef.id, { referencia: editDocRef.referencia });
    setEditDocRef(null);
    window.nexbit.getReceiveDocuments().then(setReceiveDocs);
    fetchMovements(dateFilter, monthRef);
  };

  const handleDeleteDocumentConfirm = async () => {
    if (!confirmDeleteDoc) return;
    await window.nexbit.deleteReceiveDocument(confirmDeleteDoc);
    setConfirmDeleteDoc(null);
    window.nexbit.getReceiveDocuments().then(setReceiveDocs);
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    fetchMovements(dateFilter, monthRef);
  };

  const handleReceiveSearch = useCallback(async (q) => {
    setReceiveSearch(q);
    setSelectedReceiveProduct(null);
    if (q.length >= 2) {
      let results = await window.nexbit.searchProducts(q);
      if (receiveDoc.proveedor_id) results = results.filter(p => p.proveedor_id === parseInt(receiveDoc.proveedor_id));
      setReceiveSearchResults(results);
    } else setReceiveSearchResults([]);
  }, [receiveDoc.proveedor_id]);

  const selectReceiveProduct = (product) => {
    setSelectedReceiveProduct(product);
    setReceiveSearch(product.nombre);
    setReceiveSearchResults([]);
    setReceiveNewItem(prev => ({ ...prev, precio_costo: product.precio_costo || '' }));
  };

  const addReceiveItem = () => {
    if (!selectedReceiveProduct || receiveNewItem.cantidad <= 0) return;
    setReceiveItems([...receiveItems, { producto_id: selectedReceiveProduct.id, cantidad: parseFloat(receiveNewItem.cantidad), precio_costo: receiveNewItem.precio_costo ? parseFloat(receiveNewItem.precio_costo) : undefined }]);
    setSelectedReceiveProduct(null);
    setReceiveSearch('');
    setReceiveNewItem({ producto_id: '', cantidad: 1, precio_costo: '' });
  };

  const removeReceiveItem = (idx) => setReceiveItems(receiveItems.filter((_, i) => i !== idx));

  const handleReceive = async () => {
    if (receiveItems.length === 0) return;
    await window.nexbit.receiveInventory({ items: receiveItems, referencia: receiveDoc.referencia, proveedor_id: receiveDoc.proveedor_id ? parseInt(receiveDoc.proveedor_id) : null, fecha: receiveDoc.fecha, nombre_usuario: currentUserName });
    setReceiveDoc({ proveedor_id: '', fecha: new Date().toISOString().split('T')[0], referencia: '' });
    setReceiveItems([]);
    setReceiveNewItem({ producto_id: '', cantidad: 1, precio_costo: '' });
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    window.nexbit.getReceiveDocuments().then(setReceiveDocs);
    fetchMovements(dateFilter, monthRef);
  };

  const handleAdjust = async () => {
    if (!adjustForm.producto_id || adjustForm.nuevo_stock < 0) return;
    await window.nexbit.adjustStock({ producto_id: parseInt(adjustForm.producto_id), nuevo_stock: parseFloat(adjustForm.nuevo_stock), motivo: adjustForm.motivo });
    setAdjustForm({ producto_id: '', nuevo_stock: 0, motivo: '' });
    window.nexbit.getProducts({ activo: 1 }).then(setProducts);
    fetchMovements(dateFilter, monthRef);
  };

  const loadProviderProducts = useCallback(async (proveedorId) => {
    if (!proveedorId) { setProviderProducts([]); return; }
    const all = await window.nexbit.getProducts({ activo: 1 });
    setProviderProducts(all.filter(p => p.proveedor_id === parseInt(proveedorId)));
  }, []);

  const handleProviderChange = (id) => {
    setReceiveDoc({ ...receiveDoc, proveedor_id: id });
    setExpandProviderProducts(false);
    if (id) loadProviderProducts(id);
  };

  const addProviderProduct = async () => {
    if (!providerProductForm.nombre || !receiveDoc.proveedor_id) return;
    await window.nexbit.createProduct({ nombre: providerProductForm.nombre, codigo_barras: providerProductForm.codigo_barras, categoria_id: providerProductForm.categoria_id ? parseInt(providerProductForm.categoria_id) : null, precio_venta: parseFloat(providerProductForm.precio_venta) || 0, precio_costo: parseFloat(providerProductForm.precio_costo) || 0, stock: parseFloat(providerProductForm.stock) || 0, unidad_medida: providerProductForm.unidad_medida, proveedor_id: parseInt(receiveDoc.proveedor_id), activo: 1 });
    setProviderProductForm({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', unidad_medida: 'pieza' });
    loadProviderProducts(receiveDoc.proveedor_id);
  };

  const saveProviderProduct = async (product) => {
    await window.nexbit.updateProduct(product.id, { nombre: product.nombre, codigo_barras: product.codigo_barras, categoria_id: product.categoria_id ? parseInt(product.categoria_id) : null, precio_venta: parseFloat(product.precio_venta) || 0, precio_costo: parseFloat(product.precio_costo) || 0, stock: parseFloat(product.stock) || product.stock, unidad_medida: product.unidad_medida || 'pieza', proveedor_id: parseInt(receiveDoc.proveedor_id) });
    setEditingProviderProduct(null);
    loadProviderProducts(receiveDoc.proveedor_id);
  };

  const tabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'alerts', label: `Alertas (${alerts.length})` },
    { key: 'receive', label: 'Entrada' },
    { key: 'adjust', label: 'Ajuste' },
    { key: 'movements', label: 'Movimientos' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Inventario</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Control de existencias</p>
        </div>
        {tab === 'movements' && (
          <button onClick={() => exportInventoryMovements(movements)} style={{ ...btn.base, ...btn.secondary }}>📥 Exportar CSV</button>
        )}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:0, borderBottom: `1px solid ${theme.colors.border}`, paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            ...btn.base, background:'transparent', borderRadius:0,
            color: tab === t.key ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: tab === t.key ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            padding:'8px 16px 8px',
          }}>{t.label}</button>
        ))}
      </div>



      {tab === 'resumen' && dashboard && (
        <div>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
            {[
              { label: 'Productos', value: dashboard.totalProductos.cnt, sub: `${dashboard.totalProductos.total_items} unidades`, color: theme.colors.primary },
              { label: 'Valor inventario', value: `$${$clp(dashboard.totalProductos.valor_total)}`, sub: 'Precio costo total', color: theme.colors.success },
              { label: 'Alertas de stock', value: dashboard.alertasCount, sub: 'Productos bajo mínimo', color: dashboard.alertasCount > 0 ? theme.colors.danger : theme.colors.success },
              { label: 'Categorías', value: dashboard.categorias.length, sub: 'Con productos', color: theme.colors.info },
            ].map((item, i) => (
              <div key={i} style={{ ...card, padding:16, textAlign:'center' }}>
                <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, marginBottom:4 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight:700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginTop:2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Value by category */}
            <div style={{ ...card, padding:16 }}>
              <h4 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Valor por Categoría</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {dashboard.categorias.map((cat, i) => {
                  const maxVal = Math.max(...dashboard.categorias.map(c => c.valor));
                  const pct = maxVal > 0 ? (cat.valor / maxVal) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize: theme.font.sizeSm, marginBottom:2 }}>
                        <span style={{ color: theme.colors.text }}>{cat.nombre}</span>
                        <span style={{ color: theme.colors.textSecondary }}>${$clp(cat.valor)}</span>
                      </div>
                      <div style={{ height:8, background: theme.colors.border, borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: theme.colors.primary, borderRadius:4, transition:'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top products */}
            <div style={{ ...card, padding:16 }}>
              <h4 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Top Productos (mes actual)</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {dashboard.topProducts.map((p, i) => {
                  const maxV = Math.max(...dashboard.topProducts.map(x => x.total_vendido));
                  const pct = maxV > 0 ? (p.total_vendido / maxV) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize: theme.font.sizeSm, marginBottom:2 }}>
                        <span style={{ color: theme.colors.text }}>{p.nombre}</span>
                        <span style={{ color: theme.colors.textSecondary }}>{p.total_vendido} uds — ${$clp(p.total_ingresos)}</span>
                      </div>
                      <div style={{ height:8, background: theme.colors.border, borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: theme.colors.success, borderRadius:4, transition:'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
                {dashboard.topProducts.length === 0 && (
                  <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, textAlign:'center', padding:20 }}>Sin ventas este mes</div>
                )}
              </div>
            </div>
          </div>

          {/* Products without movement */}
          <div style={{ ...card, padding:16, marginTop:16 }}>
            <h4 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Productos sin movimiento (+30 días)</h4>
            {dashboard.sinMovimiento.length === 0 ? (
              <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, textAlign:'center', padding:20 }}>✓ Todos los productos tienen movimiento reciente</div>
            ) : (
              <div style={t.wrapper}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                  <thead><tr><th style={t.th}>Producto</th><th style={t.th}>Stock</th><th style={t.th}>Valor</th><th style={t.th}>Último movimiento</th></tr></thead>
                  <tbody>
                    {dashboard.sinMovimiento.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                        <td style={{ ...t.td, fontWeight:600 }}>{p.nombre}</td>
                        <td style={t.td}>{p.stock}</td>
                        <td style={t.td}>$${$clp(p.stock * p.precio_costo)}</td>
                        <td style={t.td}>{p.ultimo_movimiento || 'Nunca'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div>
          {alerts.length === 0 ? (
            <div style={{ ...card, padding:40, textAlign:'center', color: theme.colors.textMuted, fontSize: theme.font.sizeSm }}>
              ✓ No hay productos con stock bajo
            </div>
          ) : (
            <div style={t.wrapper}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                <thead><tr><th style={t.th}>Nombre</th><th style={t.th}>Stock</th><th style={t.th}>Mínimo</th><th style={t.th}>Diferencia</th><th style={t.th}>Categoría</th></tr></thead>
                <tbody>
                  {alerts.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={{ ...t.td, fontWeight:600 }}>{p.nombre}</td>
                      <td style={{ ...t.td, fontWeight:600, color: theme.colors.danger }}>{p.stock}</td>
                      <td style={t.td}>{p.stock_minimo}</td>
                      <td style={t.td}><span style={{ color: theme.colors.danger }}>{p.stock - p.stock_minimo}</span></td>
                      <td style={t.td}>{p.categoria_nombre || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'receive' && (
        <div>
          <style>{`.orange-date::-webkit-calendar-picker-indicator { filter: invert(42%) sepia(93%) saturate(1841%) hue-rotate(355deg) brightness(104%) contrast(106%); cursor:pointer; }`}</style>
          <div style={{ ...card, padding:20, marginBottom:16 }}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Documento de Recepción</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
              <div>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Proveedor</label>
                <div style={{ display:'flex', gap:4 }}>
                  <select value={receiveDoc.proveedor_id} onChange={e => handleProviderChange(e.target.value)} style={{ ...inputStyle.base, flex:1 }}>
                    <option value="">Seleccionar proveedor...</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {receiveDoc.proveedor_id && (
                    <button onClick={() => setExpandProviderProducts(!expandProviderProducts)} style={{ ...btn.base, ...btn.secondary, padding:'6px 10px', fontSize:'0.7rem', whiteSpace:'nowrap' }}>
                      {expandProviderProducts ? '✕' : '📦'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Fecha</label>
                <input type="date" className="orange-date" value={receiveDoc.fecha} onChange={e => setReceiveDoc({...receiveDoc, fecha: e.target.value})} style={{ ...inputStyle.base, colorScheme:'dark', cursor:'pointer' }} />
              </div>
              <div>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>N° Factura / Guía *</label>
                <input value={receiveDoc.referencia} onChange={e => setReceiveDoc({...receiveDoc, referencia: e.target.value})} style={inputStyle.base} placeholder="Ej: FAC-001, Guía #123" />
              </div>
              <div>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Recepcionado por</label>
                <input value={currentUserName} disabled style={{ ...inputStyle.base, opacity:0.7, cursor:'default' }} />
              </div>
            </div>

            {expandProviderProducts && receiveDoc.proveedor_id && (
              <div style={{ marginTop:16, borderTop: `1px solid ${theme.colors.border}`, paddingTop:16 }}>
                <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>
                  Productos de {providers.find(p => p.id === parseInt(receiveDoc.proveedor_id))?.nombre || 'proveedor'}
                </h4>
                <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'end', flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 140px', minWidth:120 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Nuevo producto</label>
                    <input value={providerProductForm.nombre} onChange={e => setProviderProductForm({...providerProductForm, nombre: e.target.value})} style={inputStyle.base} placeholder="Nombre" />
                  </div>
                  <div style={{ flex:'1 1 100px', minWidth:80 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Código barras</label>
                    <input value={providerProductForm.codigo_barras} onChange={e => setProviderProductForm({...providerProductForm, codigo_barras: e.target.value})} style={inputStyle.base} placeholder="Opcional" />
                  </div>
                  <div style={{ flex:'1 1 100px', minWidth:80 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Categoría</label>
                    <select value={providerProductForm.categoria_id} onChange={e => setProviderProductForm({...providerProductForm, categoria_id: e.target.value})} style={inputStyle.base}>
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:'1 1 70px', minWidth:60 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>P. venta</label>
                    <input type="number" value={providerProductForm.precio_venta} onChange={e => setProviderProductForm({...providerProductForm, precio_venta: e.target.value})} style={inputStyle.base} />
                  </div>
                  <div style={{ flex:'1 1 70px', minWidth:60 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>P. costo</label>
                    <input type="number" value={providerProductForm.precio_costo} onChange={e => setProviderProductForm({...providerProductForm, precio_costo: e.target.value})} style={inputStyle.base} />
                  </div>
                  <div style={{ flex:'0 1 70px', minWidth:60 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Unidad</label>
                    <select value={providerProductForm.unidad_medida} onChange={e => setProviderProductForm({...providerProductForm, unidad_medida: e.target.value})} style={inputStyle.base}>
                      <option value="pieza">Unidad</option>
                      <option value="kg">Kg</option>
                      <option value="litro">Litro</option>
                    </select>
                  </div>
                  <div style={{ flex:'0 1 60px', minWidth:50 }}>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Stock</label>
                    <input type="number" value={providerProductForm.stock} onChange={e => setProviderProductForm({...providerProductForm, stock: e.target.value})} style={inputStyle.base} />
                  </div>
                  <button onClick={addProviderProduct} style={{ ...btn.base, ...btn.primary, padding:'8px 14px', whiteSpace:'nowrap', marginBottom:2 }}>+ Agregar</button>
                </div>
                <div style={t.wrapper}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                    <thead><tr><th style={t.th}>Producto</th><th style={t.th}>Código</th><th style={t.th}>Categoría</th><th style={t.th}>P. venta</th><th style={t.th}>P. costo</th><th style={t.th}>Unidad</th><th style={t.th}>Stock</th><th style={t.th}></th></tr></thead>
                    <tbody>
                      {providerProducts.map(p => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                          {editingProviderProduct?.id === p.id ? (
                            <>
                              <td style={t.td}><input value={editingProviderProduct.nombre} onChange={e => setEditingProviderProduct({...editingProviderProduct, nombre: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem' }} /></td>
                              <td style={t.td}><input value={editingProviderProduct.codigo_barras} onChange={e => setEditingProviderProduct({...editingProviderProduct, codigo_barras: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:80 }} /></td>
                              <td style={t.td}>
                                <select value={editingProviderProduct.categoria_id} onChange={e => setEditingProviderProduct({...editingProviderProduct, categoria_id: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:80 }}>
                                  <option value="">Sin cat.</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                              </td>
                              <td style={t.td}><input type="number" value={editingProviderProduct.precio_venta} onChange={e => setEditingProviderProduct({...editingProviderProduct, precio_venta: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:60 }} /></td>
                              <td style={t.td}><input type="number" value={editingProviderProduct.precio_costo} onChange={e => setEditingProviderProduct({...editingProviderProduct, precio_costo: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:60 }} /></td>
                              <td style={t.td}>
                                <select value={editingProviderProduct.unidad_medida} onChange={e => setEditingProviderProduct({...editingProviderProduct, unidad_medida: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem' }}>
                                  <option value="pieza">Unidad</option><option value="kg">Kg</option><option value="litro">Litro</option>
                                </select>
                              </td>
                              <td style={t.td}><input type="number" value={editingProviderProduct.stock} onChange={e => setEditingProviderProduct({...editingProviderProduct, stock: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:50 }} /></td>
                              <td style={t.td}>
                                <button onClick={() => saveProviderProduct(editingProviderProduct)} style={{ ...btn.base, background: theme.colors.primary, color:'#fff', padding:'2px 6px', fontSize:'0.6rem', marginRight:2 }}>✓</button>
                                <button onClick={() => setEditingProviderProduct(null)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 6px', fontSize:'0.6rem' }}>✕</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...t.td, fontWeight:600 }}>{p.nombre}</td>
                              <td style={{ ...t.td, fontSize:'0.65rem', color: theme.colors.textMuted }}>{p.codigo_barras || '-'}</td>
                              <td style={t.td}>{p.categoria_nombre || '-'}</td>
                              <td style={t.td}>${$clp(p.precio_venta)}</td>
                              <td style={t.td}>${$clp(p.precio_costo)}</td>
                              <td style={t.td}>{p.unidad_medida === 'kg' ? 'Kg' : p.unidad_medida === 'litro' ? 'Litro' : 'Unidad'}</td>
                              <td style={t.td}>{p.stock}</td>
                              <td style={t.td}>
                                <button onClick={() => setEditingProviderProduct({ id: p.id, nombre: p.nombre, codigo_barras: p.codigo_barras || '', categoria_id: p.categoria_id || '', precio_venta: p.precio_venta, precio_costo: p.precio_costo, stock: p.stock, unidad_medida: p.unidad_medida || 'pieza' })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'2px 5px', fontSize:'0.6rem', marginRight:2 }}>Editar</button>
                                <button onClick={async () => { await window.nexbit.deleteProduct(p.id); loadProviderProducts(receiveDoc.proveedor_id); }} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 5px', fontSize:'0.6rem' }}>Eliminar</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {providerProducts.length === 0 && (
                        <tr><td colSpan={8} style={{ padding:16, textAlign:'center', color: theme.colors.textMuted }}>Sin productos para este proveedor</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...card, padding:20, marginBottom:16 }}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Productos</h3>
            <div style={{ display:'flex', gap:8, alignItems:'end', marginBottom:16 }}>
              <div style={{ flex:2, position:'relative' }}>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Producto</label>
                <input value={receiveSearch} onChange={e => handleReceiveSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && receiveSearchResults.length === 1) selectReceiveProduct(receiveSearchResults[0]); }} style={{ ...inputStyle.base, width:'100%' }} placeholder="Código de barras o nombre..." />
                {receiveSearchResults.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, boxShadow: theme.shadow.lg, zIndex:10, maxHeight:200, overflow:'auto', marginTop:2 }}>
                    {receiveSearchResults.map(p => (
                      <div key={p.id} onClick={() => selectReceiveProduct(p)} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', cursor:'pointer', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                        <span><span style={{ fontWeight:600 }}>{p.nombre}</span> {p.codigo_barras ? <span style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeXs }}>({p.codigo_barras})</span> : ''}</span>
                        <span style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeXs }}>Stock: {p.stock}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedReceiveProduct && (
                  <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.primary, marginTop:2 }}>
                    {selectedReceiveProduct.nombre} — Stock: {selectedReceiveProduct.stock}
                  </div>
                )}
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Cantidad</label>
                <input type="number" min="0.001" step="0.001" value={receiveNewItem.cantidad} onChange={e => setReceiveNewItem({...receiveNewItem, cantidad: e.target.value})} style={inputStyle.base} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Costo unitario</label>
                <input type="number" min="0" value={receiveNewItem.precio_costo} onChange={e => setReceiveNewItem({...receiveNewItem, precio_costo: e.target.value})} style={inputStyle.base} placeholder="Opcional" />
              </div>
              <button onClick={addReceiveItem} style={{ ...btn.base, ...btn.primary, padding:'8px 16px', whiteSpace:'nowrap' }}>+ Agregar</button>
            </div>

            {receiveItems.length > 0 && (
              <div style={t.wrapper}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                  <thead><tr><th style={t.th}>Producto</th><th style={t.th}>Cantidad</th><th style={t.th}>Costo U.</th><th style={t.th}></th></tr></thead>
                  <tbody>
                    {receiveItems.map((item, idx) => {
                      const prod = products.find(p => p.id === item.producto_id);
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                          <td style={{ ...t.td, fontWeight:600 }}>{prod?.nombre || `ID ${item.producto_id}`}</td>
                          <td style={t.td}>{item.cantidad}</td>
                          <td style={t.td}>{item.precio_costo ? `$${$clp(item.precio_costo)}` : '-'}</td>
                          <td style={t.td}><button onClick={() => removeReceiveItem(idx)} style={{ ...btn.base, background:'transparent', color: theme.colors.danger, padding:'2px 6px', fontSize:'0.7rem' }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            {receiveItems.length > 0 && (
              <span style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, alignSelf:'center' }}>{receiveItems.length} producto(s)</span>
            )}
            <button onClick={handleReceive} disabled={receiveItems.length === 0} style={{ ...btn.base, ...btn.primary, padding:'10px 24px', opacity: receiveItems.length === 0 ? 0.5 : 1 }}>
              Registrar Entrada
            </button>
          </div>
        </div>
      )}

      {tab === 'adjust' && (
        <div style={{ ...card, padding:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Ajuste de Stock</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Producto</label>
              <select value={adjustForm.producto_id} onChange={e => setAdjustForm({...adjustForm, producto_id:e.target.value})} style={inputStyle.base}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Nuevo stock</label><input type="number" value={adjustForm.nuevo_stock} onChange={e => setAdjustForm({...adjustForm, nuevo_stock:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Motivo</label><input value={adjustForm.motivo} onChange={e => setAdjustForm({...adjustForm, motivo:e.target.value})} style={inputStyle.base} /></div>
          </div>
          <button onClick={handleAdjust} style={{ ...btn.base, background: theme.colors.warning, color:'#fff', marginTop:16 }}>Realizar Ajuste</button>
        </div>
      )}

      {tab === 'movements' && (
        <div>
          {receiveDocs.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>
                Documentos de Entrada ({receiveDocs.length})
              </h4>
              <div style={t.wrapper}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                  <thead><tr>
                    <th style={{ ...t.th, width:30 }}></th>
                    <th style={t.th}>N° Documento</th><th style={t.th}>Proveedor</th><th style={t.th}>Productos</th><th style={t.th}>Fecha</th><th style={t.th}>Usuario</th><th style={t.th}>Acciones</th>
                  </tr></thead>
                  <tbody>
                    {receiveDocs.map(doc => (
                      <React.Fragment key={doc.id}>
                        <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, cursor:'pointer', background: expandedDoc === doc.id ? theme.colors.surfaceHover : 'transparent' }}
                            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}>
                          <td style={t.td}>{expandedDoc === doc.id ? '▼' : '▶'}</td>
                          <td style={{ ...t.td, fontWeight:700, color: theme.colors.primary }}>#{doc.referencia}</td>
                          <td style={t.td}>{doc.proveedor_nombre || '—'}</td>
                          <td style={t.td}><span style={badge('success')}>{doc.total_items} productos</span></td>
                          <td style={t.td}>{doc.created_at}</td>
                          <td style={t.td}>{doc.usuario || '-'}</td>
                          <td style={t.td} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setEditDocRef({ id: doc.id, referencia: doc.referencia })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'3px 8px', fontSize:'0.6rem', marginRight:4 }}>Editar</button>
                            <button onClick={() => setConfirmDeleteDoc(doc.id)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'3px 8px', fontSize:'0.6rem' }}>Eliminar</button>
                          </td>
                        </tr>
                        {expandedDoc === doc.id && (doc.items || []).map((item, idx) => (
                          <tr key={`${doc.id}-${idx}`} style={{ background: theme.colors.surfaceHover }}>
                            {editingDocItem?.docId === doc.id && editingDocItem?.producto_id === item.producto_id ? (
                              <>
                                <td style={t.td}></td>
                                <td style={{ ...t.td, paddingLeft:28, fontStyle:'italic', color: theme.colors.textSecondary }}>↳ {item.producto_nombre}</td>
                                <td style={t.td}></td>
                                <td style={t.td}><input type="number" value={editingDocItem.cantidad} onChange={e => setEditingDocItem({...editingDocItem, cantidad: e.target.value})} style={{ ...inputStyle.base, padding:'2px 4px', fontSize:'0.65rem', width:55 }} /></td>
                                <td style={t.td}><input type="number" value={editingDocItem.precio_costo} onChange={e => setEditingDocItem({...editingDocItem, precio_costo: e.target.value})} style={{ ...inputStyle.base, padding:'2px 4px', fontSize:'0.65rem', width:60 }} /></td>
                                <td style={t.td}>
                                  <button onClick={handleSaveDocItem} style={{ ...btn.base, background: theme.colors.primary, color:'#fff', padding:'2px 6px', fontSize:'0.6rem', marginRight:2 }}>✓</button>
                                  <button onClick={() => setEditingDocItem(null)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 6px', fontSize:'0.6rem' }}>✕</button>
                                </td>
                                <td style={t.td}></td>
                              </>
                            ) : (
                              <>
                                <td style={t.td}></td>
                                <td style={{ ...t.td, paddingLeft:28, fontStyle:'italic', color: theme.colors.textSecondary }}>↳ {item.producto_nombre}</td>
                                <td style={t.td}></td>
                                <td style={{ ...t.td, fontWeight:600, color: theme.colors.primary }}>+{item.cantidad}</td>
                                <td style={t.td}>{item.precio_costo ? `$${$clp(item.precio_costo)} c/u` : '-'}</td>
                                <td style={t.td}>
                                  <button onClick={() => setEditingDocItem({ docId: doc.id, producto_id: item.producto_id, cantidad: item.cantidad, precio_costo: item.precio_costo || '' })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'2px 5px', fontSize:'0.6rem', marginRight:2 }}>Editar</button>
                                  <button onClick={() => handleDeleteDocItem(doc.id, item.producto_id)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 5px', fontSize:'0.6rem' }}>Eliminar</button>
                                </td>
                                <td style={t.td}></td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>
            Otros movimientos (ventas, ajustes...)
          </h4>
          <div style={t.wrapper}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr><th style={t.th}>Fecha</th><th style={t.th}>Producto</th><th style={t.th}>Tipo</th><th style={t.th}>Cantidad</th><th style={t.th}>Stock Anterior</th><th style={t.th}>Stock Nuevo</th><th style={t.th}>Referencia</th><th style={t.th}>Usuario</th><th style={t.th}>Acciones</th></tr></thead>
              <tbody>
                {otherMovements.map(m => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                    <td style={t.td}>{m.created_at}</td>
                    <td style={{ ...t.td, fontWeight:600 }}>{m.producto_nombre}</td>
                    <td style={t.td}><span style={badge(m.tipo === 'entrada' ? 'success' : m.tipo === 'venta' ? 'info' : m.tipo === 'ajuste' ? 'warning' : 'danger')}>{m.tipo}</span></td>
                    <td style={{ ...t.td, fontWeight:600, color: m.cantidad > 0 ? theme.colors.primary : theme.colors.danger }}>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                    <td style={t.td}>{m.stock_anterior}</td>
                    <td style={t.td}>{m.stock_nuevo}</td>
                    <td style={t.td}>{m.referencia || '-'}</td>
                    <td style={t.td}>{m.nombre_usuario || '-'}</td>
                    <td style={t.td}>
                      <button onClick={() => handleEditMovement(m)} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'3px 8px', fontSize:'0.65rem', marginRight:4 }}>Editar</button>
                      <button onClick={() => handleDeleteMovement(m.id)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'3px 8px', fontSize:'0.65rem' }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {otherMovements.length === 0 && (
                  <tr><td colSpan={9} style={{ padding:16, textAlign:'center', color: theme.colors.textMuted }}>No hay movimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editDialog && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setEditDialog(null)}>
          <div style={{ ...card, padding:20, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Editar Movimiento</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Cantidad</label>
              <input type="number" value={editDialog.cantidad} onChange={e => setEditDialog({...editDialog, cantidad: e.target.value})} style={inputStyle.base} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Referencia</label>
              <input value={editDialog.referencia} onChange={e => setEditDialog({...editDialog, referencia: e.target.value})} style={inputStyle.base} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setEditDialog(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={confirmEditMovement} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...card, padding:20, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Eliminar Movimiento</h3>
            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:16 }}>Se revertirá el stock del producto. ¿Continuar?</p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={confirmDeleteMovement} style={{ ...btn.base, background: theme.colors.danger, color:'#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {editDocRef && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setEditDocRef(null)}>
          <div style={{ ...card, padding:20, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Editar Documento</h3>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>N° Factura / Guía</label>
              <input value={editDocRef.referencia} onChange={e => setEditDocRef({...editDocRef, referencia: e.target.value})} style={inputStyle.base} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setEditDocRef(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={handleEditDocument} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDoc && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setConfirmDeleteDoc(null)}>
          <div style={{ ...card, padding:20, width:400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Eliminar Documento</h3>
            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:16 }}>
              Se revertirá el stock de todos los productos de este documento. ¿Continuar?
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDeleteDoc(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={handleDeleteDocumentConfirm} style={{ ...btn.base, background: theme.colors.danger, color:'#fff' }}>Eliminar documento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
