import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { theme, card, btn, input as inputStyle, table } from '../styles/theme';
import { $clp } from '../utils/format';

export default function PosPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [paymentMode, setPaymentMode] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('porcentaje');
  const [message, setMessage] = useState('');
  const [permissions, setPermissions] = useState({});
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [noCajaSeleccionada, setNoCajaSeleccionada] = useState(false);
  const [weightPrompt, setWeightPrompt] = useState(null);
  const [promoted, setPromoted] = useState([]);
  const [combos, setCombos] = useState([]);
  const [closeCajaModal, setCloseCajaModal] = useState(false);
  const [closeAmount, setCloseAmount] = useState('');
  const [closeSalesData, setCloseSalesData] = useState(null);
  const [closeModalError, setCloseModalError] = useState('');
  const [expandEfectivo, setExpandEfectivo] = useState(false);
  const [expandCredito, setExpandCredito] = useState(false);
  const [splitEfectivo, setSplitEfectivo] = useState('');
  const [splitCredito, setSplitCredito] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const inputRef = useRef(null);
  const weightUnits = ['kg','kilo','kilogramo','litro','l','lt'];
  const isWeightUnit = (u) => weightUnits.includes((u||'').toLowerCase());

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { window.nexbit.getUserPermissions().then(setPermissions); }, []);
  useEffect(() => {
    window.nexbit.getCurrentSession().then(session => {
      if (!session) { setCajaAbierta(false); setNoCajaSeleccionada(true); return; }
      setNoCajaSeleccionada(false);
      window.nexbit.getCashRegisterStatus({ caja_id: session.caja_id }).then(s => setCajaAbierta(!!s));
    });
  }, []);
  useEffect(() => { window.nexbit.getPromoted().then(setPromoted); }, []);
  useEffect(() => { window.nexbit.getGrupos().then(setCombos); }, []);

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);
  const combo = useMemo(() => {
    let best = null;
    for (const g of combos) {
      if (!g.activo || !g.items?.length) continue;
      let n = Infinity, unitRegular = 0, ok = true;
      for (const it of g.items) {
        const cart = items.find(i => i.producto_id === it.producto_id);
        if (!cart || cart.cantidad < it.cantidad) { ok = false; break; }
        n = Math.min(n, Math.floor(cart.cantidad / it.cantidad));
        unitRegular += it.cantidad * cart.precio_unitario;
      }
      if (!ok || n < 1) continue;
      const disc = n * (unitRegular - g.precio);
      if (disc > 0 && (!best || disc > best.disc)) best = { nombre: g.nombre, disc, unidades: n };
    }
    return best;
  }, [items, combos]);
  const discountAmount = discountType === 'porcentaje' ? total * (parseFloat(discount) || 0) / 100 : parseFloat(discount) || 0;
  const grandTotal = Math.max(0, total - discountAmount - couponDiscount - (combo?.disc || 0));
  const change = cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const handleSearch = useCallback(async (q) => {
    setSearch(q);
    if (q.length >= 2) {
      const prods = await window.nexbit.searchProducts(q);
      const ql = q.toLowerCase();
      const grupoMatches = combos
        .filter(g => g.activo && g.nombre?.toLowerCase().includes(ql))
        .map(g => ({ _tipo: 'grupo', id: g.id, nombre: g.nombre, precio: g.precio, items: g.items }));
      setSearchResults([...grupoMatches, ...prods]);
    } else setSearchResults([]);
  }, [combos]);

  const getDiscountedPrice = useCallback(async (productId, qty, originalPrice) => {
    try {
      const dc = await window.nexbit.getDescuentoPorProducto(productId);
      if (dc && dc.reglas?.length) {
        const sorted = [...dc.reglas].sort((a, b) => b.cantidad_desde - a.cantidad_desde);
        for (const r of sorted) { if (qty >= r.cantidad_desde) return dc.tipo === 'porcentaje' ? originalPrice * (1 - r.precio_unitario / 100) : r.precio_unitario; }
      }
    } catch (e) { /* ignore */ }
    return null;
  }, []);

  const addProduct = useCallback(async (product, weight) => {
    if (product.stock <= 0) return;
    const qty = weight || 1;
    let precio = product.precio_venta;
    const discounted = await getDiscountedPrice(product.id, qty, product.precio_venta);
    if (discounted !== null) precio = discounted;
    const exists = items.findIndex(it => it.producto_id === product.id);
    if (exists >= 0 && !weight) {
      const updated = [...items];
      const newQty = updated[exists].cantidad + 1;
      const newPrice = (await getDiscountedPrice(product.id, newQty, product.precio_venta)) || product.precio_venta;
      updated[exists] = { ...updated[exists], cantidad: newQty, precio_unitario: newPrice, subtotal: newQty * newPrice };
      setItems(updated);
    } else {
      setItems([...items, { producto_id: product.id, nombre_producto: product.nombre, cantidad: qty, precio_unitario: precio, descuento: 0, subtotal: qty * precio, unidad_medida: product.unidad_medida }]);
    }
    setSearch(''); setSearchResults([]); inputRef.current?.focus();
  }, [items, getDiscountedPrice]);

  const addCombo = useCallback((grupo) => {
    const next = [...items];
    for (const it of grupo.items || []) {
      if (!it.producto_id) continue;
      const idx = next.findIndex(x => x.producto_id === it.producto_id);
      if (idx >= 0) {
        const qty = next[idx].cantidad + it.cantidad;
        next[idx] = { ...next[idx], cantidad: qty, subtotal: qty * next[idx].precio_unitario };
      } else {
        next.push({ producto_id: it.producto_id, nombre_producto: it.nombre_producto || 'Producto', cantidad: it.cantidad, precio_unitario: it.precio_venta || 0, descuento: 0, subtotal: (it.cantidad || 0) * (it.precio_venta || 0), unidad_medida: it.unidad_medida || 'pieza' });
      }
    }
    setItems(next);
    setSearch(''); setSearchResults([]); inputRef.current?.focus();
  }, [items]);

  const handleBarcode = useCallback(async (e) => {
    if (e.key === 'Enter' && search) {
      e.preventDefault();
      const prods = await window.nexbit.searchProducts(search);
      if (prods.length === 1) {
        if (prods[0]._tipo === 'grupo') addCombo(prods[0]);
        else if (isWeightUnit(prods[0].unidad_medida)) setWeightPrompt({ product: prods[0], qty: '1' });
        else addProduct(prods[0]);
      }
    }
  }, [search, addProduct, addCombo]);

  const handleClientSearch = useCallback(async (q) => {
    setClientSearch(q);
    if (q.length >= 2) {
      const results = await window.nexbit.searchClients(q);
      setClientResults(results);
    } else setClientResults([]);
  }, []);

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const finishSale = async (formaPago, pagosOverride) => {
    if (items.length === 0) return;
    if (!cajaAbierta && noCajaSeleccionada) { setMessage('Error: No seleccionó una caja al iniciar sesión.'); return; }
    if (!cajaAbierta) { setMessage('Error: La caja está cerrada. Ábrala en Corte Caja primero.'); return; }
    try {
      const pagos = pagosOverride || [{ tipo: formaPago, monto: grandTotal }];
      const data = { items, forma_pago: formaPago, pagos, descuento: discountAmount, cupon_descuento: couponDiscount, combo_descuento: combo?.disc || 0, cliente_id: selectedClient?.id || null };
      const result = await window.nexbit.createSale(data);
      const pagoStr = pagos.map(p => `${p.tipo === 'efectivo' ? '💰' : p.tipo === 'credito' ? '📋' : '💳'} ${p.tipo}: $${$clp(p.monto)}`).join(' | ');
      await window.nexbit.printTicket({ id: result.id, fecha: new Date().toLocaleString(), usuario: 'Cajero', items, total: grandTotal, descuento: discountAmount + couponDiscount + (combo?.disc || 0), forma_pago: result.forma_pago, pagos, cupon: couponCode || undefined });
      setMessage(`Venta #${result.id} completada — $${ $clp(grandTotal) } (${pagoStr})`);
      setTimeout(() => setMessage(''), 4000);
      setItems([]); setDiscount(''); setDiscountType('porcentaje'); setCashReceived(''); setPaymentMode(null); setSelectedClient(null); setSplitEfectivo(''); setSplitCredito(''); setCouponCode(''); setCouponDiscount(0); setCouponError('');
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  return (
    <div>
      {cajaAbierta === false && noCajaSeleccionada && (
        <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'10px 16px', borderRadius: theme.radius.md, textAlign:'center', marginBottom:16, fontSize: theme.font.sizeSm, fontWeight:600 }}>
          ⚠ No seleccionó una caja al iniciar sesión — cierre sesión y seleccione una caja para realizar ventas
        </div>
      )}
      {cajaAbierta === false && !noCajaSeleccionada && (
        <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'10px 16px', borderRadius: theme.radius.md, textAlign:'center', marginBottom:16, fontSize: theme.font.sizeSm, fontWeight:600 }}>
          ⚠ Caja cerrada — debe abrir caja en Corte Caja para realizar ventas
        </div>
      )}
      {cajaAbierta && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
          <button onClick={async () => {
            const allSales = await window.nexbit.getSales({});
            const today = new Date().toISOString().split('T')[0];
            const cajaSales = allSales.filter(s => !s.anulada && s.fecha && s.fecha.startsWith(today));
            let efectivo = [], credito = [];
            let totalEfectivo = 0, totalCredito = 0;
            for (const s of cajaSales) {
              if (s.forma_pago === 'mixto') {
                try { const pagos = JSON.parse(s.detalle_pago || '[]'); for (const p of pagos) { if (p.tipo === 'efectivo') { efectivo.push(s); totalEfectivo += p.monto; } else if (p.tipo === 'credito') { credito.push(s); totalCredito += p.monto; } } } catch (e) { efectivo.push(s); totalEfectivo += s.total; }
              } else if (s.forma_pago === 'efectivo') { efectivo.push(s); totalEfectivo += s.total; }
              else if (s.forma_pago === 'credito') { credito.push(s); totalCredito += s.total; }
              else { efectivo.push(s); totalEfectivo += s.total; }
            }
            setCloseSalesData({ total: cajaSales.length, efectivo, credito, totalEfectivo, totalCredito });
            setCloseCajaModal(true);
          }} style={{ ...btn.base, background: theme.colors.warning, color:'#fff', padding:'8px 16px', fontSize: theme.font.sizeXs }}>
            🔒 Cerrar Caja
          </button>
        </div>
      )}
      {message && <div style={{ background: theme.colors.primary, color:'#fff', padding:'10px 16px', borderRadius: theme.radius.md, textAlign:'center', marginBottom:16, fontSize: theme.font.sizeSm }}>{message}</div>}
      <div style={{ display:'flex', gap:20, height:'calc(100vh - 140px)' }}>
        <div style={{ flex:2, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <div style={{ flex:1, position:'relative' }}>
              <input ref={inputRef} style={{ ...inputStyle.base, padding:'12px 16px', fontSize: theme.font.sizeLg }} placeholder="Código de barras o nombre..." value={search} onChange={e => handleSearch(e.target.value)} onKeyDown={handleBarcode} autoFocus disabled={!cajaAbierta || noCajaSeleccionada} />
              {searchResults.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, boxShadow: theme.shadow.lg, zIndex:10, maxHeight:240, overflow:'auto', marginTop:4 }}>
                  {searchResults.map(p => {
                    const esCombo = p._tipo === 'grupo';
                    return (
                      <div key={(esCombo ? 'g' : 'p') + p.id} onClick={() => esCombo ? addCombo(p) : (isWeightUnit(p.unidad_medida) ? setWeightPrompt({ product: p, qty: '1' }) : addProduct(p))} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm, transition:'background 0.1s', background: esCombo ? theme.colors.infoLight : undefined }}>
                        <span style={esCombo ? { color: theme.colors.info, fontWeight:600 } : undefined}>{esCombo && '🤝 '}{p.nombre}</span>
                        <span style={{ color: esCombo ? theme.colors.info : theme.colors.primary, fontWeight:600 }}>${ $clp(esCombo ? p.precio : p.precio_venta) }</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button style={{ ...btn.base, ...btn.secondary, padding:'12px 16px' }} onClick={() => window.nexbit.readScale().then(s => setMessage(s.connected ? `Peso: ${s.weight}kg` : 'Báscula no disponible')).catch(() => setMessage('Error báscula'))}>⚖️ Pesar</button>
          </div>

          {weightPrompt && (
            <div style={{ ...card, padding:16, marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:4, color: theme.colors.text }}>{weightPrompt.product.nombre}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" step="0.001" min="0.001" autoFocus style={{ ...inputStyle.base, width:100, padding:'6px 8px' }} value={weightPrompt.qty} onChange={e => setWeightPrompt(p => ({ ...p, qty: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { const w = parseFloat(weightPrompt.qty); if (w > 0) { addProduct(weightPrompt.product, w); setWeightPrompt(null); } } }} />
                  <span style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary }}>{weightPrompt.product.unidad_medida} × ${$clp(weightPrompt.product.precio_venta)}/{weightPrompt.product.unidad_medida}</span>
                  <span style={{ fontWeight:700, color: theme.colors.primary }}>= ${$clp(parseFloat(weightPrompt.qty||0) * weightPrompt.product.precio_venta)}</span>
                </div>
              </div>
              <button style={{ ...btn.base, ...btn.primary, padding:'6px 14px' }} onClick={() => { const w = parseFloat(weightPrompt.qty); if (w > 0) { addProduct(weightPrompt.product, w); setWeightPrompt(null); } }}>Agregar</button>
              <button style={{ ...btn.base, ...btn.ghost, padding:'6px 10px', fontSize:'0.8rem' }} onClick={() => setWeightPrompt(null)}>✕</button>
            </div>
          )}
          <div style={{ marginBottom:12 }}>
            <input style={{ ...inputStyle.base, padding:'8px 12px' }} placeholder="Cliente (opcional)..." value={clientSearch} onChange={e => handleClientSearch(e.target.value)} />
            {clientResults.length > 0 && (
              <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, marginTop:4, maxHeight:120, overflow:'auto', boxShadow: theme.shadow.md }}>
                {clientResults.map(c => (
                  <div key={c.id} onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(c.nombre); }} style={{ padding:'6px 12px', cursor:'pointer', fontSize: theme.font.sizeSm, borderBottom: `1px solid ${theme.colors.border}` }}>{c.nombre} — {c.telefono}</div>
                ))}
              </div>
            )}
            {selectedClient && <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.primary, marginTop:4 }}>Cliente: {selectedClient.nombre}</div>}
          </div>

          {promoted.some(p => p.stock > 0) && (
            <div style={{ marginBottom:8, display:'flex', gap:4, flexWrap:'wrap' }}>
              {promoted.filter(p => p.stock > 0).map(p => (
                <button key={p.id} onClick={() => addProduct({ ...p, precio_venta: p.precio_promo })} style={{ ...btn.base, padding:'4px 10px', fontSize:'0.75rem', background: theme.colors.warningLight, color: theme.colors.warning, border:`1px solid ${theme.colors.warning}` }}>
                  🏷️ {p.nombre} <strong>${$clp(p.precio_promo)}</strong> <span style={{ textDecoration:'line-through', fontSize:'0.65rem', opacity:0.7 }}>${$clp(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}

          {combos.some(g => g.activo) && (
            <div style={{ marginBottom:8, display:'flex', gap:4, flexWrap:'wrap' }}>
              {combos.filter(g => g.activo).map(g => (
                <button key={g.id} onClick={() => addCombo(g)} style={{ ...btn.base, padding:'4px 10px', fontSize:'0.75rem', background: theme.colors.infoLight, color: theme.colors.info, border:`1px solid ${theme.colors.info}` }}>
                  🤝 {g.nombre} <strong>${$clp(g.precio)}</strong>
                </button>
              ))}
            </div>
          )}

          <div style={{ flex:1, ...card, padding:'12px', overflow:'auto' }}>
            {items.length === 0 ? (
              <div style={{ textAlign:'center', color: theme.colors.textMuted, marginTop:40, fontSize: theme.font.sizeSm }}>Escanee productos para comenzar la venta</div>
            ) : (
              items.map((item, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                  <div style={{ flex:1 }}><span style={{ fontWeight:600, color: theme.colors.text }}>{item.nombre_producto}</span> × {isWeightUnit(item.unidad_medida) ? `${parseFloat(item.cantidad).toFixed(3)} ${item.unidad_medida}` : item.cantidad}</div>
                  <div style={{ textAlign:'right', marginRight:12, color: theme.colors.textSecondary }}>${ $clp(item.precio_unitario) } <span style={{ color: theme.colors.textMuted }}>=</span> <strong style={{ color: theme.colors.text }}>${ $clp(item.subtotal) }</strong></div>
                  <button onClick={() => removeItem(idx)} style={btn.icon}>✕</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex:1, ...card, padding:20, display:'flex', flexDirection:'column' }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Resumen</h3>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>
              <span>Subtotal ({items.length} items)</span><span style={{ fontWeight:600, color: theme.colors.text }}>${ $clp(total) }</span>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Descuento</label>
              <div style={{ display:'flex', gap:4 }}>
                <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={{ ...inputStyle.base, padding:'6px', width:'auto' }}>
                  <option value="porcentaje">%</option>
                  <option value="monto">$</option>
                </select>
                <input style={{ ...inputStyle.base, padding:'6px 8px' }} type="number" min="0" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Cupón</label>
              <div style={{ display:'flex', gap:4 }}>
                <input style={{ ...inputStyle.base, padding:'6px 8px', flex:1 }} placeholder="Código..." value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }} />                <button style={{ ...btn.base, ...btn.primary, padding:'6px 12px', fontSize:'0.75rem' }} disabled={!couponCode} onClick={async () => {
                  try {
                    const cupon = await window.nexbit.usarCupon(couponCode);
                    if (!cupon) { setCouponError('Cupón no válido'); return; }
                    if (cupon.min_compra > total) { setCouponError(`Mínimo $${$clp(cupon.min_compra)} de compra`); return; }
                    let baseTotal = total - discountAmount;
                    if (cupon.tipo_aplicacion === 'producto' && cupon.producto_id) {
                      baseTotal = items.filter(i => i.id === cupon.producto_id).reduce((s, i) => s + (i.precio_venta || i.precio) * i.cantidad, 0);
                    } else if (cupon.tipo_aplicacion === 'categoria' && cupon.categoria_id) {
                      baseTotal = items.filter(i => i.categoria_id === cupon.categoria_id).reduce((s, i) => s + (i.precio_venta || i.precio) * i.cantidad, 0);
                    } else if (cupon.tipo_aplicacion === 'productos' && cupon.productos_ids?.length) {
                      baseTotal = items.filter(i => cupon.productos_ids.includes(i.id)).reduce((s, i) => s + (i.precio_venta || i.precio) * i.cantidad, 0);
                    }
                    const desc = cupon.tipo === 'porcentaje' ? baseTotal * cupon.valor / 100 : Math.min(cupon.valor, baseTotal);
                    setCouponDiscount(desc);
                    setCouponError('');
                  } catch (e) { setCouponError(e.message); }
                }}>Aplicar</button>
                {couponDiscount > 0 && <button style={{ ...btn.base, ...btn.ghost, padding:'6px 8px', fontSize:'0.75rem', color: theme.colors.danger }} onClick={() => { setCouponCode(''); setCouponDiscount(0); setCouponError(''); }}>✕</button>}
              </div>
              {couponError && <p style={{ fontSize:'0.75rem', color: theme.colors.danger, marginTop:2 }}>{couponError}</p>}
              {couponDiscount > 0 && <p style={{ fontSize:'0.75rem', color: theme.colors.primary, marginTop:2 }}>Cupón aplicado: -${$clp(couponDiscount)}</p>}
            </div>
            {combo && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize: theme.font.sizeSm, color: theme.colors.success, fontWeight:600 }}>
                <span>🤝 Combo {combo.nombre} ×{combo.unidades}</span><span>-${ $clp(combo.disc) }</span>
              </div>
            )}
            <div style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.primary, borderTop: `2px solid ${theme.colors.primary}`, paddingTop:12, display:'flex', justifyContent:'space-between' }}>
              <span>Total</span><span>${ $clp(grandTotal) }</span>
            </div>
          </div>

          {!paymentMode ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              <button style={{ ...btn.base, ...btn.primary, padding:'12px', justifyContent:'center', opacity: !cajaAbierta ? 0.5 : 1 }} disabled={!cajaAbierta} onClick={() => setPaymentMode('efectivo')}>💰 Efectivo</button>
              <button style={{ ...btn.base, padding:'12px', justifyContent:'center', background: theme.colors.info, color:'#fff', opacity: !cajaAbierta ? 0.5 : 1 }} disabled={!cajaAbierta} onClick={() => finishSale('tarjeta')}>💳 Tarjeta</button>
              {permissions.cobrar_deudas && <button style={{ ...btn.base, padding:'12px', justifyContent:'center', background: theme.colors.warning, color:'#fff', opacity: !cajaAbierta || !selectedClient ? 0.5 : 1 }} disabled={!cajaAbierta || !selectedClient} onClick={() => finishSale('credito')}>📋 Crédito</button>}
              {permissions.cobrar_deudas && selectedClient && <button style={{ ...btn.base, padding:'12px', justifyContent:'center', background: theme.colors.primaryLight, color: theme.colors.primary, opacity: !cajaAbierta ? 0.5 : 1 }} disabled={!cajaAbierta} onClick={() => { setPaymentMode('mixto'); setSplitEfectivo(String(grandTotal)); setSplitCredito('0'); }}>🔀 Efectivo + Crédito</button>}
            </div>
          ) : paymentMode === 'efectivo' ? (
            <div style={{ marginTop:12 }}>
              <label style={{ fontSize: theme.font.sizeSm, marginBottom:6, display:'block', color: theme.colors.textSecondary }}>Monto recibido</label>
              <input autoFocus style={{ ...inputStyle.base, padding:'12px', fontSize: theme.font.sizeLg }} type="number" min="0" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && parseFloat(cashReceived) >= grandTotal) finishSale('efectivo'); }} />
              {cashReceived && (
                <div style={{ marginTop:12, textAlign:'center' }}>
                  <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>Cambio: <strong style={{ fontSize:'1.2rem', color: change >= 0 ? theme.colors.primary : theme.colors.danger }}>${ $clp(change) }</strong></p>
                  <button style={{ ...btn.base, ...btn.primary, padding:'12px', justifyContent:'center', width:'100%', marginTop:8 }} onClick={() => finishSale('efectivo')} disabled={parseFloat(cashReceived) < grandTotal}>Cobrar ${ $clp(grandTotal) }</button>
                  <button style={{ ...btn.base, ...btn.ghost, padding:'12px', justifyContent:'center', width:'100%', marginTop:4 }} onClick={() => { setPaymentMode(null); setCashReceived(''); }}>Cancelar</button>
                </div>
              )}
            </div>
          ) : paymentMode === 'mixto' ? (
            <div style={{ marginTop:12 }}>
              <p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, marginBottom:8 }}>Distribuya el total (<strong>${$clp(grandTotal)}</strong>) entre efectivo y crédito:</p>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.6rem', color: theme.colors.textMuted, display:'block', marginBottom:2 }}>💰 Efectivo</label>
                  <input autoFocus style={{ ...inputStyle.base, padding:'10px', fontSize: theme.font.sizeBase }} type="number" min="0" placeholder="0" value={splitEfectivo} onChange={e => { const v = e.target.value; setSplitEfectivo(v); setSplitCredito(String(Math.max(0, grandTotal - (parseFloat(v) || 0)))); }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.6rem', color: theme.colors.textMuted, display:'block', marginBottom:2 }}>📋 Crédito</label>
                  <input style={{ ...inputStyle.base, padding:'10px', fontSize: theme.font.sizeBase }} type="number" min="0" placeholder="0" value={splitCredito} onChange={e => { const v = e.target.value; setSplitCredito(v); setSplitEfectivo(String(Math.max(0, grandTotal - (parseFloat(v) || 0)))); }} />
                </div>
              </div>
              <div style={{ fontSize:'0.6rem', color: theme.colors.textMuted, marginBottom:8 }}>
                Total distribuido: <strong>${$clp((parseFloat(splitEfectivo)||0) + (parseFloat(splitCredito)||0))}</strong> / ${$clp(grandTotal)}
              </div>
              <button style={{ ...btn.base, ...btn.primary, padding:'12px', justifyContent:'center', width:'100%', opacity: (parseFloat(splitEfectivo)||0) + (parseFloat(splitCredito)||0) !== grandTotal ? 0.5 : 1 }} disabled={(parseFloat(splitEfectivo)||0) + (parseFloat(splitCredito)||0) !== grandTotal} onClick={() => finishSale('mixto', [{ tipo: 'efectivo', monto: parseFloat(splitEfectivo) || 0 }, { tipo: 'credito', monto: parseFloat(splitCredito) || 0 }])}>
                Cobrar ${ $clp(grandTotal) }
              </button>
              <button style={{ ...btn.base, ...btn.ghost, padding:'12px', justifyContent:'center', width:'100%', marginTop:4 }} onClick={() => { setPaymentMode(null); setSplitEfectivo(''); setSplitCredito(''); }}>Cancelar</button>
            </div>
          ) : null}
        </div>
      </div>

      {closeCajaModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:2000,
        }} onClick={() => { setCloseCajaModal(false); setCloseSalesData(null); setCloseAmount(''); setCloseModalError(''); }}>
          <div style={{ ...card, padding:24, width:520, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Cierre de Caja</h3>

            {closeModalError && (
              <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'8px 12px', borderRadius: theme.radius.sm, marginBottom:12, fontSize: theme.font.sizeXs }}>{closeModalError}</div>
            )}

            {closeSalesData && (
              <div style={{ marginBottom:16 }}>
                <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.text, marginBottom:8 }}>
                  Ventas del día ({closeSalesData.total} tickets)
                </h4>
                <div>
                  <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, marginBottom:4, cursor:'pointer', userSelect:'none' }} onClick={() => setExpandEfectivo(!expandEfectivo)}>
                    <strong style={{ color: theme.colors.primary }}>{expandEfectivo ? '▼' : '▶'} 💵 Efectivo:</strong> {closeSalesData.efectivo.length} ventas — <strong>${$clp(closeSalesData.totalEfectivo)}</strong>
                  </div>
                  {expandEfectivo && closeSalesData.efectivo.length > 0 && (
                    <div style={{ maxHeight:150, overflow:'auto', marginBottom:8, border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                      {closeSalesData.efectivo.map(s => (
                        <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:'0.65rem', borderBottom:`1px solid ${theme.colors.border}` }}>
                          <span>#{s.id} — {new Date(s.fecha).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>
                          <span style={{ fontWeight:600 }}>${$clp(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, marginBottom:4, cursor:'pointer', userSelect:'none' }} onClick={() => setExpandCredito(!expandCredito)}>
                    <strong style={{ color: theme.colors.warning }}>{expandCredito ? '▼' : '▶'} 📋 Crédito:</strong> {closeSalesData.credito.length} ventas — <strong>${$clp(closeSalesData.totalCredito)}</strong>
                  </div>
                  {expandCredito && closeSalesData.credito.length > 0 && (
                    <div style={{ maxHeight:150, overflow:'auto', marginBottom:8, border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                      {closeSalesData.credito.map(s => (
                        <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:'0.65rem', borderBottom:`1px solid ${theme.colors.border}` }}>
                          <span>#{s.id} — {new Date(s.fecha).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>
                          <span style={{ fontWeight:600 }}>${$clp(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ borderTop:`1px solid ${theme.colors.border}`, paddingTop:8, marginTop:8, fontWeight:700, color: theme.colors.text }}>
                  Total ventas: ${$clp(closeSalesData.totalEfectivo + closeSalesData.totalCredito)}
                </div>
              </div>
            )}

            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:12 }}>
              Ingrese solo el <strong>monto en efectivo</strong> real que hay en la caja para cerrar.
            </p>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Monto final en efectivo</label>
              <input type="number" value={closeAmount} onChange={e => setCloseAmount(e.target.value)} style={inputStyle.base} placeholder="0" autoFocus />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setCloseCajaModal(false); setCloseSalesData(null); setCloseAmount(''); setCloseModalError(''); }} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  const montoFinal = parseFloat(closeAmount);
                  if (isNaN(montoFinal) || montoFinal < 0) return;
                  setCloseModalError('');
                  const session = await window.nexbit.getCurrentSession();
                  if (session) {
                    const status = await window.nexbit.getCashRegisterStatus({ caja_id: session.caja_id });
                    if (status) {
                      const movs = await window.nexbit.getInventoryMovements({});
                      const reporte = {
                        fecha_cierre: new Date().toISOString(),
                        monto_inicial: status.monto_inicial,
                        monto_final: montoFinal,
                        monto_ventas: status.monto_ventas,
                        ventas_efectivo: { cantidad: closeSalesData.efectivo.length, total: closeSalesData.totalEfectivo },
                        ventas_credito: { cantidad: closeSalesData.credito.length, total: closeSalesData.totalCredito },
                        total_ventas: closeSalesData.total,
                      };
                      await window.nexbit.closeCashRegister({ id: status.id, monto_final: montoFinal, observaciones: 'Cierre desde POS', reporte_json: reporte });
                      await window.nexbit.printTicket({
                        title: '📋 CIERRE DE CAJA',
                        lines: [
                          `Fecha: ${new Date().toLocaleString('es-CL')}`,
                          `Fondo inicial: $${$clp(status.monto_inicial)}`,
                          `Monto final: $${$clp(montoFinal)}`,
                          `Ventas efectivo: ${closeSalesData.efectivo.length} — $${$clp(closeSalesData.totalEfectivo)}`,
                          `Ventas crédito: ${closeSalesData.credito.length} — $${$clp(closeSalesData.totalCredito)}`,
                          `Total ventas: ${closeSalesData.total} — $${$clp(closeSalesData.totalEfectivo + closeSalesData.totalCredito)}`,
                          `Movimientos: ${movs.filter(m => m.tipo === 'entrada').length} entradas`,
                          '',
                          '--- FIN CIERRE ---',
                        ],
                      });
                    }
                  }
                  window.nexbit.getCurrentSession().then(s => setCajaAbierta(!!s?.activa));
                  setMessage('✅ Caja cerrada correctamente');
                  setCloseCajaModal(false);
                  setCloseSalesData(null);
                  setCloseAmount('');
                  setCloseModalError('');
                } catch (e) { setCloseModalError('Error: ' + e.message); }
              }} style={{ ...btn.base, background: theme.colors.danger, color:'#fff' }} disabled={!closeAmount}>Cerrar Caja</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
