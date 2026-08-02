import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle } from '../styles/theme';
import { $clp } from '../utils/format';

const TABS = [
  { key: 'cupones', label: '🎫 Cupones' },
  { key: 'volumen', label: '📦 Descuento por Cantidad' },
  { key: 'promociones', label: '🏷️ Productos en Promoción' },
  { key: 'grupos', label: '🤝 Productos Agrupados' },
];

export default function PromotionsPage() {
  const [tab, setTab] = useState('cupones');
  const [cupones, setCupones] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [promos, setPromos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [products, setProducts] = useState([]);
  const [cuponForm, setCuponForm] = useState(null);
  const [dcForm, setDcForm] = useState(null);
  const [promoForm, setPromoForm] = useState(null);
  const [grupoForm, setGrupoForm] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [categories, setCategories] = useState([]);

  const load = () => {
    window.nexbit.getCupones().then(setCupones).catch(e => console.error('cupones', e));
    window.nexbit.getDescuentosCantidad().then(setDescuentos).catch(e => console.error('descuentos', e));
    window.nexbit.getPromoted().then(setPromos).catch(e => console.error('promos', e));
    window.nexbit.getGrupos().then(setGrupos).catch(e => console.error('grupos', e));
    window.nexbit.getProducts({}).then(setProducts).catch(e => console.error('products', e));
    window.nexbit.getCategories().then(setCategories).catch(e => console.error('categories', e));
  };

  useEffect(() => { load(); }, []);

  const prodFiltered = products.filter(p =>
    !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo_barras?.includes(busqueda)
  );

  const saveCupon = async () => {
    if (!cuponForm.codigo) return;
    if (cuponForm.id) await window.nexbit.updateCupon(cuponForm);
    else await window.nexbit.createCupon(cuponForm);
    setCuponForm(null); load();
  };

  const saveDc = async () => {
    if (!dcForm.producto_id || !dcForm.reglas?.length) return;
    if (dcForm.id) await window.nexbit.updateDescuentoCantidad(dcForm);
    else await window.nexbit.createDescuentoCantidad(dcForm);
    setDcForm(null); load();
  };

  const addRegla = () => {
    setDcForm(f => ({ ...f, reglas: [...(f.reglas || []), { cantidad_desde: 0, precio_unitario: 0 }] }));
  };

  const updRegla = (i, campo, val) => {
    setDcForm(f => {
      const r = [...f.reglas];
      r[i] = { ...r[i], [campo]: f.tipo === 'porcentaje' && campo === 'precio_unitario' ? parseFloat(val) || 0 : parseFloat(val) || 0 };
      return { ...f, reglas: r };
    });
  };

  const savePromo = async () => {
    if (!promoForm.producto_id) { alert('Seleccione un producto'); return; }
    if (!promoForm.precio_promo || promoForm.precio_promo <= 0) { alert('Ingrese un precio de promoción válido'); return; }
    try {
      await window.nexbit.setPromotion({ producto_id: promoForm.producto_id, precio_promo: promoForm.precio_promo, activo: promoForm.activo ?? 1 });
      setPromoForm(null); load();
    } catch (e) { alert('Error al guardar promoción: ' + e.message); }
  };

  const saveGrupo = async () => {
    if (!grupoForm.nombre) { alert('Ingrese un nombre para el grupo'); return; }
    const items = (grupoForm.items || []).filter(i => i.producto_id && i.cantidad > 0);
    if (items.length < 2) { alert('Un grupo necesita al menos 2 productos'); return; }
    if (!grupoForm.precio || grupoForm.precio <= 0) { alert('Ingrese un precio de promoción válido'); return; }
    try {
      if (grupoForm.id) await window.nexbit.updateGrupo({ ...grupoForm, items });
      else await window.nexbit.createGrupo({ ...grupoForm, items });
      setGrupoForm(null); load();
    } catch (e) { alert('Error al guardar grupo: ' + e.message); }
  };

  const grupoRegularTotal = (g) => (g.items || []).reduce((s, i) => {
    const precio = i.precio_venta ?? products.find(pr => pr.id === i.producto_id)?.precio_venta ?? 0;
    return s + (i.cantidad || 0) * precio;
  }, 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: theme.font.size2xl, fontWeight: 700, color: theme.colors.text, margin: 0 }}>Promociones y Cupones</h1>
        <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop: 2 }}>Cupones, descuentos por volumen y productos en promoción</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            ...btn.base, padding: '8px 16px', fontSize: theme.font.sizeSm,
            background: tab === t.key ? theme.colors.primary : 'transparent',
            color: tab === t.key ? '#fff' : theme.colors.text,
            border: `1px solid ${tab === t.key ? theme.colors.primary : theme.colors.border}`,
            borderRadius: theme.radius.md, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'cupones' && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...inputStyle.base, padding: '6px 10px', flex: 1 }} placeholder="Buscar cupón..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <button onClick={() => setCuponForm({ codigo: '', tipo: 'porcentaje', valor: 0, min_compra: 0, usos_maximos: 0, tipo_aplicacion: 'todos', producto_id: null, categoria_id: null, productos_ids: null })} style={{ ...btn.base, ...btn.primary, padding: '6px 14px' }}>+ Cupón</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cupones.filter(c => !busqueda || c.codigo?.toLowerCase().includes(busqueda.toLowerCase())).map(c => (
              <div key={c.id} style={{ ...card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${theme.colors.border}` }}>
                <div>
                  <span style={{ fontWeight: 600, color: theme.colors.text, fontSize: theme.font.sizeBase }}>{c.codigo}</span>
                  <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginTop: 2 }}>
                    {c.tipo === 'porcentaje' ? `${c.valor}% desc` : `$${$clp(c.valor)} desc`} · Mín ${$clp(c.min_compra)} · {c.usos_maximos > 0 ? `${c.usos_actuales}/${c.usos_maximos} usos` : 'Ilimitado'}
                    {c.tipo_aplicacion !== 'todos' && ` · ${c.tipo_aplicacion === 'producto' ? 'Prod. específico' : c.tipo_aplicacion === 'categoria' ? 'Por categoría' : 'Prod. seleccionados'}`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: theme.radius.full, background: c.activo ? theme.colors.primaryLight : theme.colors.dangerLight, color: c.activo ? theme.colors.primary : theme.colors.danger }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  <button onClick={() => setCuponForm({ ...c })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding: '4px 10px', fontSize: '0.75rem' }}>✏️</button>
                  <button onClick={async () => { if (confirm('Eliminar cupón?')) { await window.nexbit.deleteCupon(c.id); load(); } }} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding: '4px 10px', fontSize: '0.75rem' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {cuponForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setCuponForm(null)}>
              <div style={{ ...card, padding: 24, width: 460, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight: 600, color: theme.colors.text, marginBottom: 16 }}>{cuponForm.id ? 'Editar' : 'Nuevo'} Cupón</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Código</label><input style={inputStyle.base} value={cuponForm.codigo} onChange={e => setCuponForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Tipo</label>
                      <select style={inputStyle.base} value={cuponForm.tipo} onChange={e => setCuponForm(f => ({ ...f, tipo: e.target.value }))}>
                        <option value="porcentaje">Porcentaje</option><option value="monto">Monto fijo</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Valor</label>
                      <input type="number" style={inputStyle.base} value={cuponForm.valor} onChange={e => setCuponForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Aplica a</label>
                    <select style={inputStyle.base} value={cuponForm.tipo_aplicacion || 'todos'} onChange={e => setCuponForm(f => ({ ...f, tipo_aplicacion: e.target.value, producto_id: null, categoria_id: null, productos_ids: null }))}>
                      <option value="todos">Todos los productos</option>
                      <option value="producto">Producto específico</option>
                      <option value="categoria">Categoría</option>
                      <option value="productos">Seleccionar productos</option>
                    </select>
                  </div>
                  {cuponForm.tipo_aplicacion === 'producto' && (
                    <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Producto</label>
                      <select style={inputStyle.base} value={cuponForm.producto_id || ''} onChange={e => setCuponForm(f => ({ ...f, producto_id: parseInt(e.target.value) || null }))}>
                        <option value="">Seleccionar...</option>
                        {products.filter(p => p.activo !== 0).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  {cuponForm.tipo_aplicacion === 'categoria' && (
                    <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Categoría</label>
                      <select style={inputStyle.base} value={cuponForm.categoria_id || ''} onChange={e => setCuponForm(f => ({ ...f, categoria_id: parseInt(e.target.value) || null }))}>
                        <option value="">Seleccionar...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  {cuponForm.tipo_aplicacion === 'productos' && (
                    <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Productos (ctrl+clic para múltiples)</label>
                      <select multiple style={{ ...inputStyle.base, height: 120, overflow: 'auto' }} value={cuponForm.productos_ids || []} onChange={e => setCuponForm(f => ({ ...f, productos_ids: Array.from(e.target.selectedOptions, o => parseInt(o.value)) }))}>
                        {products.filter(p => p.activo !== 0).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Mín compra</label><input type="number" style={inputStyle.base} value={cuponForm.min_compra} onChange={e => setCuponForm(f => ({ ...f, min_compra: parseFloat(e.target.value) || 0 }))} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Usos máx</label><input type="number" style={inputStyle.base} value={cuponForm.usos_maximos} onChange={e => setCuponForm(f => ({ ...f, usos_maximos: parseInt(e.target.value) || 0 }))} /></div>
                  </div>
                  {cuponForm.id && (
                    <div><label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Activo</label>
                      <select style={inputStyle.base} value={cuponForm.activo ? 1 : 0} onChange={e => setCuponForm(f => ({ ...f, activo: parseInt(e.target.value) }))}>
                        <option value={1}>Sí</option><option value={0}>No</option>
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={() => setCuponForm(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
                  <button onClick={saveCupon} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'volumen' && (
        <div>
          <div style={{ marginBottom: 12 }}><button onClick={() => setDcForm({ producto_id: null, reglas: [{ cantidad_desde: 1, precio_unitario: 0 }], activo: 1 })} style={{ ...btn.base, ...btn.primary, padding: '6px 14px' }}>+ Descuento por Cantidad</button></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {descuentos.map(d => (
              <div key={d.id} style={{ ...card, padding: '12px 16px', border: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: theme.colors.text, fontSize: theme.font.sizeBase }}>{d.producto_nombre || `Producto #${d.producto_id}`}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDcForm({ ...d, reglas: d.reglas || [] })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding: '4px 10px', fontSize: '0.75rem' }}>✏️</button>
                    <button onClick={async () => { if (confirm('Eliminar descuento?')) { await window.nexbit.deleteDescuentoCantidad(d.id); load(); } }} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding: '4px 10px', fontSize: '0.75rem' }}>🗑️</button>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: theme.colors.textMuted }}>
                  {(d.reglas || []).sort((a, b) => a.cantidad_desde - b.cantidad_desde).map((r, i) => (
                    <span key={i}>{i > 0 && ' → '}{r.cantidad_desde}+ uds: <strong style={{ color: theme.colors.primary }}>{d.tipo === 'porcentaje' ? `${r.precio_unitario}% desc` : `$${$clp(r.precio_unitario)}/ud`}</strong></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {dcForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDcForm(null)}>
              <div style={{ ...card, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight: 600, color: theme.colors.text, marginBottom: 16 }}>{dcForm.id ? 'Editar' : 'Nuevo'} Descuento por Cantidad</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Producto</label>
                  <select style={inputStyle.base} value={dcForm.producto_id || ''} onChange={e => setDcForm(f => ({ ...f, producto_id: parseInt(e.target.value) }))}>
                    <option value="">Seleccionar producto...</option>
                    {products.filter(p => p.activo !== 0).map(p => <option key={p.id} value={p.id}>{p.nombre} — ${$clp(p.precio_venta)}/ud</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Tipo de descuento</label>
                  <select style={inputStyle.base} value={dcForm.tipo || 'precio_fijo'} onChange={e => setDcForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="precio_fijo">Precio fijo por unidad</option>
                    <option value="porcentaje">Porcentaje de descuento</option>
                  </select>
                </div>
                <p style={{ fontSize: '0.75rem', color: theme.colors.textMuted, marginBottom: 8 }}>
                  {dcForm.tipo === 'porcentaje' ? 'Reglas (cantidad → % descuento por unidad):' : 'Reglas (cantidad → nuevo precio unitario):'}
                </p>
                {(dcForm.reglas || []).sort((a, b) => a.cantidad_desde - b.cantidad_desde).map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, minWidth: 24 }}>#{i + 1}</span>
                    <div><span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>Desde</span><input type="number" style={{ ...inputStyle.base, padding: '4px 8px', width: 70 }} value={r.cantidad_desde} onChange={e => updRegla(i, 'cantidad_desde', e.target.value)} /></div>
                    <span style={{ color: theme.colors.textMuted }}>uds →</span>
                    <div><span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>{dcForm.tipo === 'porcentaje' ? '% Desc' : 'Precio'}</span><input type="number" style={{ ...inputStyle.base, padding: '4px 8px', width: 90 }} value={r.precio_unitario} onChange={e => updRegla(i, 'precio_unitario', e.target.value)} /></div>
                    <button onClick={() => setDcForm(f => ({ ...f, reglas: f.reglas.filter((_, j) => j !== i) }))} style={{ ...btn.base, color: theme.colors.danger, padding: '2px 6px', fontSize: '0.75rem' }}>✕</button>
                  </div>
                ))}
                <button onClick={addRegla} style={{ ...btn.base, ...btn.ghost, padding: '4px 12px', fontSize: '0.75rem', marginBottom: 12 }}>+ Agregar regla</button>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => setDcForm(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
                  <button onClick={saveDc} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'promociones' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setPromoForm({ producto_id: null, precio_promo: 0, activo: 1 })} style={{ ...btn.base, ...btn.primary, padding: '6px 14px' }}>+ Promocionar Producto</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {promos.map(p => {
              const desc = p.precio_venta > p.precio_promo ? Math.round((1 - p.precio_promo / p.precio_venta) * 100) : 0;
              return (
                <div key={p.id} style={{ ...card, padding: '12px 16px', border: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: theme.colors.text, fontSize: theme.font.sizeBase }}>{p.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginTop: 2 }}>
                        Normal: <span style={{ textDecoration: 'line-through' }}>${$clp(p.precio_venta)}</span> → <strong style={{ color: theme.colors.primary }}>${$clp(p.precio_promo)}</strong>
                        {desc > 0 && <span style={{ color: theme.colors.success, marginLeft: 6 }}>(-{desc}%)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: theme.radius.full, background: theme.colors.primaryLight, color: theme.colors.primary }}>Activo</span>
                      <button onClick={() => setPromoForm({ producto_id: p.id, nombre: p.nombre, precio_promo: p.precio_promo, activo: 1 })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding: '4px 10px', fontSize: '0.75rem' }}>✏️</button>
                      <button onClick={async () => { if (confirm('Quitar promoción?')) { await window.nexbit.setPromotion({ producto_id: p.id, precio_promo: null, activo: 0 }); load(); } }} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding: '4px 10px', fontSize: '0.75rem' }}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {promos.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: theme.colors.textMuted, textAlign: 'center', padding: 20 }}>No hay productos en promoción</p>
            )}
          </div>
          {promoForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setPromoForm(null)}>
              <div style={{ ...card, padding: 24, width: 460, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight: 600, color: theme.colors.text, marginBottom: 16 }}>{promoForm.id ? 'Editar' : 'Nueva'} Promoción</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Producto</label>
                  <select style={inputStyle.base} value={promoForm.producto_id || ''} onChange={e => {
                    const pid = parseInt(e.target.value);
                    const p = products.find(pr => pr.id === pid);
                    setPromoForm(f => ({ ...f, producto_id: pid || null, nombre: p?.nombre || '', precio_promo: p?.precio_venta || 0 }));
                  }}>
                    <option value="">Seleccionar producto...</option>
                    {products.filter(pr => pr.activo !== 0).map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.nombre} — ${$clp(pr.precio_venta)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Precio de promoción</label>
                  <input type="number" style={inputStyle.base} value={promoForm.precio_promo} onChange={e => setPromoForm(f => ({ ...f, precio_promo: parseFloat(e.target.value) || 0 }))} />
                </div>
                {promoForm.producto_id && promoForm.precio_promo > 0 && (() => {
                  const p = products.find(pr => pr.id === promoForm.producto_id);
                  if (!p) return null;
                  const desc = p.precio_venta > promoForm.precio_promo ? Math.round((1 - promoForm.precio_promo / p.precio_venta) * 100) : 0;
                  return (
                    <div style={{ fontSize: '0.75rem', color: theme.colors.textMuted, marginBottom: 12, padding: '8px 10px', background: theme.colors.surfaceHover, borderRadius: theme.radius.sm }}>
                      Precio normal: <strong>${$clp(p.precio_venta)}</strong> · Precio promoción: <strong style={{ color: theme.colors.primary }}>${$clp(promoForm.precio_promo)}</strong>
                      {desc > 0 && <span style={{ color: theme.colors.success, marginLeft: 4 }}>(-{desc}%)</span>}
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => setPromoForm(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
                  <button onClick={savePromo} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'grupos' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setGrupoForm({ nombre: '', items: [{ producto_id: null, cantidad: 1 }, { producto_id: null, cantidad: 1 }], precio: 0, activo: 1 })} style={{ ...btn.base, ...btn.primary, padding: '6px 14px' }}>+ Crear Grupo</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grupos.map(g => {
              const regular = grupoRegularTotal(g);
              const desc = regular > g.precio ? Math.round((1 - g.precio / regular) * 100) : 0;
              return (
                <div key={g.id} style={{ ...card, padding: '12px 16px', border: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: theme.colors.text, fontSize: theme.font.sizeBase }}>{g.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginTop: 2 }}>
                        {g.items.map((i, idx) => <span key={idx}>{idx > 0 && ' + '}{i.cantidad}× {i.nombre_producto}</span>)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginTop: 2 }}>
                        Normal: <span style={{ textDecoration: 'line-through' }}>${$clp(regular)}</span> → <strong style={{ color: theme.colors.primary }}>${$clp(g.precio)}</strong>
                        {desc > 0 && <span style={{ color: theme.colors.success, marginLeft: 6 }}>(-{desc}%)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: theme.radius.full, background: g.activo ? theme.colors.primaryLight : theme.colors.dangerLight, color: g.activo ? theme.colors.primary : theme.colors.danger }}>{g.activo ? 'Activo' : 'Inactivo'}</span>
                      <button onClick={() => setGrupoForm({ ...g, items: g.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })) })} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding: '4px 10px', fontSize: '0.75rem' }}>✏️</button>
                      <button onClick={async () => { if (confirm('Eliminar grupo?')) { await window.nexbit.deleteGrupo(g.id); load(); } }} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding: '4px 10px', fontSize: '0.75rem' }}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {grupos.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: theme.colors.textMuted, textAlign: 'center', padding: 20 }}>No hay grupos. Cree un grupo para ofrecer descuentos al comprar productos juntos.</p>
            )}
          </div>
          {grupoForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setGrupoForm(null)}>
              <div style={{ ...card, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight: 600, color: theme.colors.text, marginBottom: 16 }}>{grupoForm.id ? 'Editar' : 'Nuevo'} Grupo</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Nombre del grupo</label>
                  <input style={inputStyle.base} value={grupoForm.nombre} onChange={e => setGrupoForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Aceite + Harina" />
                </div>
                <p style={{ fontSize: '0.75rem', color: theme.colors.textMuted, marginBottom: 8 }}>Productos incluidos:</p>
                {(grupoForm.items || []).map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted, minWidth: 24 }}>#{i + 1}</span>
                    <select style={{ ...inputStyle.base, flex: 1 }} value={it.producto_id || ''} onChange={e => setGrupoForm(f => {
                      const items = [...f.items];
                      const pid = parseInt(e.target.value);
                      items[i] = { ...items[i], producto_id: pid || null };
                      return { ...f, items };
                    })}>
                      <option value="">Seleccionar producto...</option>
                      {products.filter(p => p.activo !== 0).map(p => <option key={p.id} value={p.id}>{p.nombre} — ${$clp(p.precio_venta)}</option>)}
                    </select>
                    <div><span style={{ fontSize: '0.65rem', color: theme.colors.textMuted }}>Cant.</span><input type="number" min="0.001" step="0.001" style={{ ...inputStyle.base, padding: '4px 8px', width: 70 }} value={it.cantidad} onChange={e => setGrupoForm(f => {
                      const items = [...f.items];
                      items[i] = { ...items[i], cantidad: parseFloat(e.target.value) || 0 };
                      return { ...f, items };
                    })} /></div>
                    <button onClick={() => setGrupoForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} style={{ ...btn.base, color: theme.colors.danger, padding: '2px 6px', fontSize: '0.75rem' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setGrupoForm(f => ({ ...f, items: [...(f.items || []), { producto_id: null, cantidad: 1 }] }))} style={{ ...btn.base, ...btn.ghost, padding: '4px 12px', fontSize: '0.75rem', marginBottom: 12 }}>+ Agregar producto</button>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Precio del grupo (promoción)</label>
                  <input type="number" style={inputStyle.base} value={grupoForm.precio} onChange={e => setGrupoForm(f => ({ ...f, precio: parseFloat(e.target.value) || 0 }))} />
                </div>
                {(() => {
                  const regular = grupoRegularTotal(grupoForm);
                  const desc = regular > grupoForm.precio ? Math.round((1 - grupoForm.precio / regular) * 100) : 0;
                  return regular > 0 && (
                    <div style={{ fontSize: '0.75rem', color: theme.colors.textMuted, marginBottom: 12, padding: '8px 10px', background: theme.colors.surfaceHover, borderRadius: theme.radius.sm }}>
                      Precio normal: <strong>${$clp(regular)}</strong> · Precio grupo: <strong style={{ color: theme.colors.primary }}>${$clp(grupoForm.precio)}</strong>
                      {desc > 0 && <span style={{ color: theme.colors.success, marginLeft: 4 }}>(-{desc}%)</span>}
                    </div>
                  );
                })()}
                {grupoForm.id && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '0.75rem', color: theme.colors.textMuted, display: 'block', marginBottom: 2 }}>Activo</label>
                    <select style={inputStyle.base} value={grupoForm.activo ? 1 : 0} onChange={e => setGrupoForm(f => ({ ...f, activo: parseInt(e.target.value) }))}>
                      <option value={1}>Sí</option><option value={0}>No</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => setGrupoForm(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
                  <button onClick={saveGrupo} style={{ ...btn.base, ...btn.primary }}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}