import React, { useEffect, useState, useRef } from 'react';
import { theme, card, cardBody, btn, badge, input as inputStyle, table as t } from '../styles/theme';
import { exportProducts, downloadCsvTemplate, parseCsvFile } from '../utils/exportCsv';
import { $clp, $stock } from '../utils/format';

export default function ProductsPage({ plan }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterProv, setFilterProv] = useState('');
  const [filterPromo, setFilterPromo] = useState(false);
  const isPro = ['pro', 'multi'].includes(plan);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre:'', codigo_barras:'', precio_venta:0, precio_costo:0, stock:0, stock_minimo:0, categoria_id:'', unidad_medida:'pieza', proveedor_id:'' });
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [catMsg, setCatMsg] = useState('');

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg('');
    try {
      const data = await parseCsvFile(file);
      const result = await window.nexbit.importProducts(data);
      setImportMsg(`✓ ${result.imported} productos importados`);
      load();
    } catch (err) {
      setImportMsg('✗ ' + err.message);
    }
    setImporting(false);
    e.target.value = '';
  };

  const load = () => {
    window.nexbit.getProducts().then(setProducts);
    window.nexbit.getCategories().then(setCategories);
    window.nexbit.getProviders().then(setProviders);
  };
  useEffect(load, []);

  const roundStock = (val, unit) => {
    const n = Number(val) || 0;
    if (!unit || unit === 'pieza' || unit === 'unidad') return Math.round(n);
    return Math.round(n * 1000) / 1000;
  };

  const handleSubmit = async () => {
    if (!form.nombre) return;
    const data = { ...form, stock: roundStock(form.stock, form.unidad_medida) };
    if (editing) await window.nexbit.updateProduct(editing, data);
    else await window.nexbit.createProduct(data);
    setShowForm(false); setEditing(null); setForm({ nombre:'', codigo_barras:'', precio_venta:0, precio_costo:0, stock:0, stock_minimo:0, categoria_id:'', unidad_medida:'pieza', proveedor_id:'' });
    load();
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    if (editingCat) {
      await window.nexbit.updateCategory(editingCat, catName.trim());
      setCatMsg('✓ Categoría actualizada');
    } else {
      await window.nexbit.createCategory(catName.trim());
      setCatMsg('✓ Categoría creada');
    }
    setCatName(''); setEditingCat(null);
    window.nexbit.getCategories().then(setCategories);
    setTimeout(() => setCatMsg(''), 2500);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('¿Eliminar esta categoría? Los productos existentes quedarán sin categoría.')) return;
    await window.nexbit.deleteCategory(id);
    window.nexbit.getCategories().then(setCategories);
  };

  const filtered = products.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase()) && !(p.codigo_barras && p.codigo_barras.includes(search))) return false;
    if (filterCat && p.categoria_id !== Number(filterCat)) return false;
    if (filterProv && p.proveedor_id !== Number(filterProv)) return false;
    if (filterPromo && p.en_promocion !== 1) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Productos</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>{products.length} productos — {categories.length} categorías</p>
        </div>
<div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <input style={{ ...inputStyle.base, width:200, flexShrink:0 }} placeholder="Buscar nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inputStyle.base, width:180, flexShrink:0 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select style={{ ...inputStyle.base, width:200, flexShrink:0 }} value={filterProv} onChange={e => setFilterProv(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {isPro ? (
          <button
            style={{ ...btn.base, ...(filterPromo ? btn.primary : btn.secondary), flexShrink:0 }}
            onClick={() => setFilterPromo(!filterPromo)}
          >
            🔥 Solo en promoción {filterPromo ? '✓' : ''}
          </button>
        ) : (
          <span style={{
            fontSize: theme.font.sizeXs, fontWeight:700, padding:'4px 8px', borderRadius: theme.radius.full,
            background: theme.colors.primary, color:'#fff', letterSpacing:'0.04em', flexShrink:0, opacity:0.6,
          }}>EN PROMOCIÓN · PRO</span>
        )}
        <span style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, marginLeft:'auto' }}>
          {filtered.length} / {products.length} productos
        </span>
      </div>

      <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => exportProducts(products)} style={{ ...btn.base, ...btn.secondary }}>📥 CSV</button>
          <button onClick={downloadCsvTemplate} style={{ ...btn.base, ...btn.secondary }}>📄 Plantilla</button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ ...btn.base, ...btn.secondary }}>
            {importing ? 'Importando...' : '📤 Importar CSV'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportCsv} style={{ display:'none' }} />
          <button onClick={() => { setShowCatModal(true); setCatName(''); setEditingCat(null); }} style={{ ...btn.base, ...btn.secondary }}>⚙️ Categorías</button>
          <button onClick={() => { setEditing(null); setForm({ nombre:'', codigo_barras:'', precio_venta:0, precio_costo:0, stock:0, stock_minimo:0, categoria_id:'', unidad_medida:'pieza', proveedor_id:'' }); setShowForm(true); }} style={{ ...btn.base, ...btn.primary }}>+ Nuevo</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Código de barras</label><input value={form.codigo_barras} onChange={e => setForm({...form, codigo_barras:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Precio venta *</label><input type="number" value={form.precio_venta} onChange={e => setForm({...form, precio_venta:parseFloat(e.target.value)||0})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Precio costo</label><input type="number" value={form.precio_costo} onChange={e => setForm({...form, precio_costo:parseFloat(e.target.value)||0})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Stock inicial</label><input type="number" step={form.unidad_medida === 'pieza' ? 1 : 0.001} value={form.stock} onChange={e => setForm({...form, stock:roundStock(e.target.value, form.unidad_medida)})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Stock mínimo</label><input type="number" step={form.unidad_medida === 'pieza' ? 1 : 0.001} value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo:roundStock(e.target.value, form.unidad_medida)})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Categoría</label>
              <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id:e.target.value})} style={inputStyle.base}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Proveedor</label>
              <select value={form.proveedor_id} onChange={e => setForm({...form, proveedor_id:e.target.value})} style={inputStyle.base}>
                <option value="">Sin proveedor</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Unidad</label>
              <select value={form.unidad_medida} onChange={e => setForm({...form, unidad_medida:e.target.value})} style={inputStyle.base}>
                <option value="pieza">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="lt">Litro</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop:16, display:'flex', gap:8 }}>
            <button style={{ ...btn.base, ...btn.primary }} onClick={handleSubmit}>{editing ? 'Guardar' : 'Crear'}</button>
            <button style={{ ...btn.base, ...btn.ghost }} onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {showCatModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={() => setShowCatModal(false)}>
          <div style={{ ...card, width:480, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text, margin:0 }}>Gestionar Categorías</h3>
              <button onClick={() => setShowCatModal(false)} style={btn.icon}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <input style={{ ...inputStyle.base, flex:1 }} placeholder={editingCat ? 'Nuevo nombre...' : 'Nombre de la categoría...'} value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(); }} />
                <button style={{ ...btn.base, ...btn.primary }} onClick={handleSaveCategory}>{editingCat ? 'Guardar' : 'Agregar'}</button>
                {editingCat && <button style={{ ...btn.base, ...btn.ghost }} onClick={() => { setEditingCat(null); setCatName(''); }}>Cancelar</button>}
              </div>
              {catMsg && (
                <div style={{
                  background: catMsg.startsWith('✓') ? theme.colors.primaryLight : theme.colors.dangerLight,
                  color: catMsg.startsWith('✓') ? theme.colors.primaryDark : theme.colors.danger,
                  padding:'8px 12px', borderRadius: theme.radius.md, marginBottom:12,
                  fontSize: theme.font.sizeSm,
                }}>{catMsg}</div>
              )}
              <div style={{ maxHeight:300, overflow:'auto' }}>
                {categories.map(c => (
                  <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: `1px solid ${theme.colors.border}` }}>
                    <span style={{ fontSize: theme.font.sizeSm, fontWeight:500, color: theme.colors.text }}>{c.nombre}</span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button style={{ ...btn.base, background: theme.colors.infoLight, color: theme.colors.info, padding:'4px 10px', fontSize: theme.font.sizeXs }} onClick={() => { setEditingCat(c.id); setCatName(c.nombre); }}>Editar</button>
                      <button style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'4px 10px', fontSize: theme.font.sizeXs }} onClick={() => handleDeleteCategory(c.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, textAlign:'center', padding:20 }}>Sin categorías</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {importMsg && (
        <div style={{
          background: importMsg.startsWith('✓') ? theme.colors.primaryLight : theme.colors.dangerLight,
          color: importMsg.startsWith('✓') ? theme.colors.primaryDark : theme.colors.danger,
          padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16,
          fontSize: theme.font.sizeSm,
        }}>{importMsg}</div>
      )}

      <div style={t.wrapper}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
          <thead>
            <tr>
              <th style={t.th}>Código</th><th style={t.th}>Nombre</th><th style={t.th}>Categoría</th>
              <th style={t.th}>Proveedor</th>
              <th style={t.th}>P. Venta</th><th style={t.th}>Costo</th><th style={t.th}>Stock</th>
              <th style={t.th}>Mínimo</th><th style={t.th}>Unidad</th><th style={t.th}>Estado</th><th style={t.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={t.td}>{p.codigo_barras || '-'}</td>
                <td style={{ ...t.td, fontWeight:600 }}>{p.nombre}</td>
                <td style={t.td}>{p.categoria_nombre || '-'}</td>
                <td style={t.td}>{p.proveedor_nombre || '-'}</td>
                <td style={t.td}>${ $clp(p.precio_venta) }</td>
                <td style={t.td}>${ $clp(p.precio_costo) }</td>
                <td style={{ ...t.td, fontWeight:600, color: p.stock <= p.stock_minimo ? theme.colors.danger : theme.colors.primary }}>{$stock(p.stock, p.unidad_medida)}</td>
                <td style={t.td}>{$stock(p.stock_minimo, p.unidad_medida)}</td>
                <td style={t.td}>{p.unidad_medida === 'pieza' ? 'unidad' : p.unidad_medida}</td>
                <td style={t.td}><span style={badge(p.activo ? 'success' : 'danger')}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td style={t.td}>
                  <div style={{ display:'flex', gap:4 }}>
                    <button style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'4px 10px', fontSize: theme.font.sizeXs }} onClick={() => { setEditing(p.id); setForm({ nombre:p.nombre, codigo_barras:p.codigo_barras||'', precio_venta:p.precio_venta, precio_costo:p.precio_costo, stock:p.stock, stock_minimo:p.stock_minimo, categoria_id:p.categoria_id||'', unidad_medida:p.unidad_medida, proveedor_id:p.proveedor_id||'' }); setShowForm(true); }}>Editar</button>
                    <button style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'4px 10px', fontSize: theme.font.sizeXs }} onClick={async () => { if (window.confirm(`¿Eliminar "${p.nombre}"?`)) { await window.nexbit.deleteProduct(p.id); load(); } }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
