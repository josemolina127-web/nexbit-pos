import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle, table as t } from '../styles/theme';
import { $clp } from '../utils/format';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', direccion: '' });
  const [msg, setMsg] = useState('');
  const [expandedProv, setExpandedProv] = useState(null);
  const [provProducts, setProvProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [provProdForm, setProvProdForm] = useState({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', unidad_medida: 'pieza' });
  const [editingProvProd, setEditingProvProd] = useState(null);

  const loadAll = () => {
    window.nexbit.getProviders().then(setProviders);
    window.nexbit.getProducts({}).then(setProducts);
    window.nexbit.getCategories().then(setCategories);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;
    if (editing) await window.nexbit.updateProvider(editing, form);
    else await window.nexbit.createProvider(form);
    setShowForm(false); setEditing(null);
    setForm({ nombre: '', telefono: '', email: '', direccion: '' });
    loadAll();
    setMsg(editing ? '✓ Proveedor actualizado' : '✓ Proveedor creado');
    setTimeout(() => setMsg(''), 2500);
  };

  const handleDelete = async (id, nombre) => {
    await window.nexbit.deleteProvider(id);
    loadAll();
    if (expandedProv === id) setExpandedProv(null);
    setMsg('✓ Proveedor eliminado');
    setTimeout(() => setMsg(''), 2500);
  };

  const toggleProviderProducts = (id) => {
    if (expandedProv === id) { setExpandedProv(null); return; }
    setExpandedProv(id);
    setProvProducts(products.filter(p => p.proveedor_id === id));
    setEditingProvProd(null);
    setProvProdForm({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', unidad_medida: 'pieza' });
  };

  const addProvProduct = async () => {
    if (!provProdForm.nombre) return;
    await window.nexbit.createProduct({ nombre: provProdForm.nombre, codigo_barras: provProdForm.codigo_barras, categoria_id: provProdForm.categoria_id ? parseInt(provProdForm.categoria_id) : null, precio_venta: parseFloat(provProdForm.precio_venta) || 0, precio_costo: parseFloat(provProdForm.precio_costo) || 0, stock: parseFloat(provProdForm.stock) || 0, unidad_medida: provProdForm.unidad_medida, proveedor_id: expandedProv, activo: 1 });
    setProvProdForm({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', unidad_medida: 'pieza' });
    const all = await window.nexbit.getProducts({ activo: 1 });
    setProducts(all);
    setProvProducts(all.filter(p => p.proveedor_id === expandedProv));
  };

  const saveProvProduct = async (product) => {
    await window.nexbit.updateProduct(product.id, { nombre: product.nombre, codigo_barras: product.codigo_barras, categoria_id: product.categoria_id ? parseInt(product.categoria_id) : null, precio_venta: parseFloat(product.precio_venta) || 0, precio_costo: parseFloat(product.precio_costo) || 0, stock: parseFloat(product.stock) || product.stock, unidad_medida: product.unidad_medida || 'pieza', proveedor_id: expandedProv });
    setEditingProvProd(null);
    const all = await window.nexbit.getProducts({ activo: 1 });
    setProducts(all);
    setProvProducts(all.filter(p => p.proveedor_id === expandedProv));
  };

  const deleteProvProduct = async (id) => {
    await window.nexbit.deleteProduct(id);
    const all = await window.nexbit.getProducts({ activo: 1 });
    setProducts(all);
    setProvProducts(all.filter(p => p.proveedor_id === expandedProv));
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Proveedores</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>{providers.length} proveedores registrados</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ nombre:'', telefono:'', email:'', direccion:'' }); setShowForm(true); }} style={{ ...btn.base, ...btn.primary }}>+ Nuevo proveedor</button>
      </div>

      {msg && (
        <div style={{
          background: msg.startsWith('✓') ? theme.colors.primaryLight : theme.colors.dangerLight,
          color: msg.startsWith('✓') ? theme.colors.primaryDark : theme.colors.danger,
          padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16,
          fontSize: theme.font.sizeSm,
        }}>{msg}</div>
      )}

      {showForm && (
        <div style={{ ...card, padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Teléfono</label><input value={form.telefono} onChange={e => setForm({...form, telefono:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Email</label><input value={form.email} onChange={e => setForm({...form, email:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Dirección</label><input value={form.direccion} onChange={e => setForm({...form, direccion:e.target.value})} style={inputStyle.base} /></div>
          </div>
          <div style={{ marginTop:16, display:'flex', gap:8 }}>
            <button style={{ ...btn.base, ...btn.primary }} onClick={handleSubmit}>{editing ? 'Guardar' : 'Crear'}</button>
            <button style={{ ...btn.base, ...btn.ghost }} onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={t.wrapper}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
          <thead><tr>
            <th style={t.th}>Nombre</th><th style={t.th}>Teléfono</th><th style={t.th}>Email</th>
            <th style={t.th}>Dirección</th><th style={t.th}>Productos</th><th style={t.th}>Acciones</th>
          </tr></thead>
          <tbody>
            {providers.map(prov => (
              <React.Fragment key={prov.id}>
                <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, cursor:'pointer' }} onClick={() => toggleProviderProducts(prov.id)}>
                  <td style={{ ...t.td, fontWeight:600 }}>{prov.nombre}</td>
                  <td style={t.td}>{prov.telefono || '-'}</td>
                  <td style={t.td}>{prov.email || '-'}</td>
                  <td style={t.td}>{prov.direccion || '-'}</td>
                  <td style={t.td}>{products.filter(pr => pr.proveedor_id === prov.id).length}</td>
                  <td style={t.td} onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'4px 10px', fontSize: theme.font.sizeXs }}
                        onClick={() => { setEditing(prov.id); setForm({ nombre:prov.nombre, telefono:prov.telefono||'', email:prov.email||'', direccion:prov.direccion||'' }); setShowForm(true); }}>Editar</button>
                      <button style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'4px 10px', fontSize: theme.font.sizeXs }}
                        onClick={() => handleDelete(prov.id, prov.nombre)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
                {expandedProv === prov.id && (
                  <tr>
                    <td colSpan={6} style={{ padding:0 }}>
                      <div style={{ ...card, margin:8, padding:16, background: theme.colors.surfaceHover }}>
                        <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>
                          Productos de {prov.nombre}
                          <span style={{ fontWeight:400, color: theme.colors.textMuted, marginLeft:8, fontSize:'0.7rem' }}>({provProducts.length})</span>
                        </h4>
                        <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'end', flexWrap:'wrap' }}>
                          <div style={{ flex:'1 1 130px', minWidth:110 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Nuevo producto</label>
                            <input value={provProdForm.nombre} onChange={e => setProvProdForm({...provProdForm, nombre: e.target.value})} style={inputStyle.base} placeholder="Nombre" />
                          </div>
                          <div style={{ flex:'1 1 90px', minWidth:70 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Código barras</label>
                            <input value={provProdForm.codigo_barras} onChange={e => setProvProdForm({...provProdForm, codigo_barras: e.target.value})} style={inputStyle.base} placeholder="Opcional" />
                          </div>
                          <div style={{ flex:'1 1 100px', minWidth:80 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Categoría</label>
                            <select value={provProdForm.categoria_id} onChange={e => setProvProdForm({...provProdForm, categoria_id: e.target.value})} style={inputStyle.base}>
                              <option value="">Sin categoría</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                          </div>
                          <div style={{ flex:'1 1 60px', minWidth:50 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>P. venta</label>
                            <input type="number" value={provProdForm.precio_venta} onChange={e => setProvProdForm({...provProdForm, precio_venta: e.target.value})} style={inputStyle.base} />
                          </div>
                          <div style={{ flex:'1 1 60px', minWidth:50 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>P. costo</label>
                            <input type="number" value={provProdForm.precio_costo} onChange={e => setProvProdForm({...provProdForm, precio_costo: e.target.value})} style={inputStyle.base} />
                          </div>
                          <div style={{ flex:'0 1 60px', minWidth:50 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Unidad</label>
                            <select value={provProdForm.unidad_medida} onChange={e => setProvProdForm({...provProdForm, unidad_medida: e.target.value})} style={inputStyle.base}>
                              <option value="pieza">Unidad</option><option value="kg">Kg</option><option value="litro">Litro</option>
                            </select>
                          </div>
                          <div style={{ flex:'0 1 50px', minWidth:40 }}>
                            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Stock</label>
                            <input type="number" value={provProdForm.stock} onChange={e => setProvProdForm({...provProdForm, stock: e.target.value})} style={inputStyle.base} />
                          </div>
                          <button onClick={addProvProduct} style={{ ...btn.base, ...btn.primary, padding:'8px 14px', whiteSpace:'nowrap', marginBottom:2 }}>+ Agregar</button>
                        </div>
                        <div style={t.wrapper}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                            <thead><tr><th style={t.th}>Producto</th><th style={t.th}>Código</th><th style={t.th}>Categoría</th><th style={t.th}>P. venta</th><th style={t.th}>P. costo</th><th style={t.th}>Unidad</th><th style={t.th}>Stock</th><th style={t.th}></th></tr></thead>
                            <tbody>
                              {provProducts.map(p => (
                                <tr key={p.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                                  {editingProvProd?.id === p.id ? (
                                    <>
                                      <td style={t.td}><input value={editingProvProd.nombre} onChange={e => setEditingProvProd({...editingProvProd, nombre: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem' }} /></td>
                                      <td style={t.td}><input value={editingProvProd.codigo_barras} onChange={e => setEditingProvProd({...editingProvProd, codigo_barras: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:80 }} /></td>
                                      <td style={t.td}>
                                        <select value={editingProvProd.categoria_id} onChange={e => setEditingProvProd({...editingProvProd, categoria_id: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:80 }}>
                                          <option value="">Sin cat.</option>
                                          {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                      </td>
                                      <td style={t.td}><input type="number" value={editingProvProd.precio_venta} onChange={e => setEditingProvProd({...editingProvProd, precio_venta: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:60 }} /></td>
                                      <td style={t.td}><input type="number" value={editingProvProd.precio_costo} onChange={e => setEditingProvProd({...editingProvProd, precio_costo: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:60 }} /></td>
                                      <td style={t.td}>
                                        <select value={editingProvProd.unidad_medida} onChange={e => setEditingProvProd({...editingProvProd, unidad_medida: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem' }}>
                                          <option value="pieza">Unidad</option><option value="kg">Kg</option><option value="litro">Litro</option>
                                        </select>
                                      </td>
                                      <td style={t.td}><input type="number" value={editingProvProd.stock} onChange={e => setEditingProvProd({...editingProvProd, stock: e.target.value})} style={{ ...inputStyle.base, padding:'3px 6px', fontSize:'0.7rem', width:50 }} /></td>
                                      <td style={t.td}>
                                        <button onClick={() => saveProvProduct(editingProvProd)} style={{ ...btn.base, background: theme.colors.primary, color:'#fff', padding:'2px 6px', fontSize:'0.6rem', marginRight:2 }}>✓</button>
                                        <button onClick={() => setEditingProvProd(null)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 6px', fontSize:'0.6rem' }}>✕</button>
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
                                        <button onClick={() => setEditingProvProd({ id: p.id, nombre: p.nombre, codigo_barras: p.codigo_barras || '', categoria_id: p.categoria_id || '', precio_venta: p.precio_venta, precio_costo: p.precio_costo, stock: p.stock, unidad_medida: p.unidad_medida || 'pieza' })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'2px 5px', fontSize:'0.6rem', marginRight:2 }}>Editar</button>
                                        <button onClick={() => deleteProvProduct(p.id)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 5px', fontSize:'0.6rem' }}>Eliminar</button>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                              {provProducts.length === 0 && (
                                <tr><td colSpan={8} style={{ padding:16, textAlign:'center', color: theme.colors.textMuted }}>Sin productos para este proveedor</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
