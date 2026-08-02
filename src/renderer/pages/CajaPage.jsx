import React, { useEffect, useState, useCallback } from 'react';
import { theme, card, btn, input as inputStyle } from '../styles/theme';
import { $clp } from '../utils/format';

export default function CajaPage() {
  const [cajas, setCajas] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [initialAmounts, setInitialAmounts] = useState({});
  const [closeData, setCloseData] = useState({});
  const [closeSalesModal, setCloseSalesModal] = useState(null);
  const [closeModalError, setCloseModalError] = useState('');
  const [expandEfectivo, setExpandEfectivo] = useState(false);
  const [expandCredito, setExpandCredito] = useState(false);
  const [newName, setNewName] = useState('');
  const [maxCajas, setMaxCajas] = useState(2);
  const [message, setMessage] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editingCaja, setEditingCaja] = useState(null);
  const [editCajaName, setEditCajaName] = useState('');
  const [deleteCajaConfirm, setDeleteCajaConfirm] = useState(null);
  const [lastClosures, setLastClosures] = useState({});
  const [closeHistory, setCloseHistory] = useState([]);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [historySales, setHistorySales] = useState(null);

  const load = useCallback(async () => {
    const u = await window.nexbit.getCurrentUser();
    setCurrentUser(u);
    const cajasList = await window.nexbit.getCajas();
    setCajas(cajasList);
    const st = {};
    for (const c of cajasList) {
      const s = await window.nexbit.getCajaStatus(c.id);
      st[c.id] = s;
    }
    setStatuses(st);
    window.nexbit.getMaxCajas().then(setMaxCajas);
    window.nexbit.getAllActiveSessions().then(setActiveSessions);
    const closures = {};
    let allHistory = [];
    for (const c of cajasList) {
      const hist = await window.nexbit.getCashRegisterHistory({ caja_id: c.id });
      if (hist.length > 0) closures[c.id] = hist[0];
      allHistory = allHistory.concat(hist);
    }
    allHistory.sort((a, b) => b.id - a.id);
    setLastClosures(closures);
    setCloseHistory(allHistory);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCash = async (cajaId) => {
    const amount = parseFloat(initialAmounts[cajaId] || 0);
    if (!amount) return;
    await window.nexbit.openCashRegister({ monto_inicial: amount, caja_id: cajaId });
    setInitialAmounts(p => ({ ...p, [cajaId]: '' }));
    setMessage(`Caja #${cajaId} abierta con $${$clp(amount)}`);
    setTimeout(() => setMessage(''), 3000);
    load();
  };

  const closeCash = async (cajaId, status) => {
    if (!status) return;
    const data = closeData[cajaId] || { monto_final: 0, observaciones: '' };
    try {
      const allSales = await window.nexbit.getSales({});
      const apertura = status.fecha_apertura || new Date().toISOString().split('T')[0];
      const cajaSales = allSales.filter(s => !s.anulada && s.caja_id === cajaId && s.fecha && s.fecha >= apertura);
      let efectivo = [], credito = [];
      let totalEfectivo = 0, totalCredito = 0;
      for (const s of cajaSales) {
        if (s.forma_pago === 'mixto') {
          try { const pagos = JSON.parse(s.detalle_pago || '[]'); for (const p of pagos) { if (p.tipo === 'efectivo') { efectivo.push(s); totalEfectivo += p.monto; } else if (p.tipo === 'credito') { credito.push(s); totalCredito += p.monto; } } } catch (e) { efectivo.push(s); totalEfectivo += s.total; }
        } else if (s.forma_pago === 'efectivo') { efectivo.push(s); totalEfectivo += s.total; }
        else if (s.forma_pago === 'credito') { credito.push(s); totalCredito += s.total; }
        else { efectivo.push(s); totalEfectivo += s.total; }
      }
      const movs = await window.nexbit.getInventoryMovements({});
      const reporte = {
        fecha_cierre: new Date().toISOString(),
        monto_inicial: status.monto_inicial,
        monto_final: parseFloat(data.monto_final) || 0,
        monto_ventas: status.monto_ventas,
        ventas_efectivo: { cantidad: efectivo.length, total: totalEfectivo },
        ventas_credito: { cantidad: credito.length, total: totalCredito },
        total_ventas: cajaSales.length,
      };
      const result = await window.nexbit.closeCashRegister({ id: status.id, ...data, monto_final: parseFloat(data.monto_final) || 0, reporte_json: reporte });
      await window.nexbit.printTicket({
        title: '📋 CIERRE DE CAJA',
        lines: [
          `Fecha: ${new Date().toLocaleString('es-CL')}`,
          `Fondo inicial: $${$clp(status.monto_inicial)}`,
          `Monto final: $${$clp(parseFloat(data.monto_final) || 0)}`,
          `Ventas efectivo: ${efectivo.length} — $${$clp(totalEfectivo)}`,
          `Ventas crédito: ${credito.length} — $${$clp(totalCredito)}`,
          `Total ventas: ${cajaSales.length} — $${$clp(totalEfectivo + totalCredito)}`,
          `Movimientos: ${movs.filter(m => m.tipo === 'entrada').length} entradas`,
          '',
          '--- FIN CIERRE ---',
        ],
      });
      setMessage(`Corte completado — Esperado: $${$clp(result.total_esperado)} | Diferencia: $${$clp(result.diferencia)}`);
    } catch (e) { setMessage('Error: ' + e.message); throw e; }
    setTimeout(() => setMessage(''), 5000);
    setCloseData(p => ({ ...p, [cajaId]: { monto_final: '', observaciones: '' } }));
    load();
  };

  const createCaja = async () => {
    if (!newName) return;
    try {
      await window.nexbit.createCaja({ nombre: newName });
      setNewName('');
      load();
    } catch (e) { setMessage('Error: ' + e.message); }
  };

  const todayLocal = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };
  const isOldDay = (fecha) => {
    if (!fecha) return false;
    return fecha.substring(0, 10) < todayLocal();
  };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Corte de Caja</h1>
        <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Apertura y cierre de cajas</p>
      </div>

      {message && (
        <div style={{ background: message.startsWith('Error') ? theme.colors.dangerLight : theme.colors.primaryLight, color: message.startsWith('Error') ? theme.colors.danger : theme.colors.primaryDark, padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16, fontSize: theme.font.sizeSm }}>{message}</div>
      )}

      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        {cajas.map(c => {
          const st = statuses[c.id];
          const oldDay = st ? isOldDay(st.fecha_apertura) : false;
          return (
            <div key={c.id} style={{ ...card, padding:20, flex:1, minWidth:260, border: oldDay ? `1px solid ${theme.colors.danger}` : undefined }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'1.2rem' }}>{st && !oldDay ? '🔓' : st && oldDay ? '⚠️' : '🔒'}</span>
                    {editingCaja === c.id ? (
                      <div style={{ display:'flex', gap:4 }}>
                        <input value={editCajaName} onChange={e => setEditCajaName(e.target.value)} style={{ ...inputStyle.base, padding:'4px 8px', fontSize:'0.8rem', width:120 }} />
                        <button onClick={async () => { if (editCajaName.trim()) { await window.nexbit.updateCaja({ id: c.id, nombre: editCajaName }); load(); setEditingCaja(null); } }} style={{ ...btn.base, background: theme.colors.primary, color:'#fff', padding:'2px 8px', fontSize:'0.65rem' }}>✓</button>
                        <button onClick={() => setEditingCaja(null)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 8px', fontSize:'0.65rem' }}>✕</button>
                      </div>
                    ) : (
                      <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: st && !oldDay ? theme.colors.primary : theme.colors.text, margin:0 }}>{c.nombre}</h3>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    {currentUser?.rol === 'admin' && !st && (
                      <>
                        <button onClick={() => { setEditingCaja(c.id); setEditCajaName(c.nombre); }} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'2px 6px', fontSize:'0.6rem' }} title="Editar nombre">✏️</button>
                        <button onClick={() => setDeleteCajaConfirm(c)} style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'2px 6px', fontSize:'0.6rem' }} title="Eliminar caja">🗑️</button>
                      </>
                    )}
                    <span style={{ fontSize: theme.font.sizeXs, padding:'2px 8px', borderRadius: theme.radius.full, fontWeight:500, background: oldDay ? theme.colors.dangerLight : st ? theme.colors.primaryLight : theme.colors.surfaceHover, color: oldDay ? theme.colors.danger : st ? theme.colors.primary : theme.colors.textMuted }}>
                      {oldDay ? 'Día anterior' : st ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                </div>
              {oldDay ? (
                <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.danger }}>
                  <p style={{ marginBottom:4 }}><strong>⚠ Caja abierta desde ayer</strong></p>
                  <p style={{ marginBottom:2, color: theme.colors.textSecondary }}>Abierta: {st.fecha_apertura}</p>
                  <p style={{ marginBottom:12, color: theme.colors.textSecondary }}>Por: {st.nombre_completo || st.nombre_usuario || '—'}</p>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:2 }}>Cierre forzado — monto final</label>
                  <input type="number" style={{ ...inputStyle.base, padding:'6px 10px', marginBottom:6 }} placeholder="Monto final..." value={closeData[c.id]?.monto_final || ''} onChange={e => setCloseData(p => ({ ...p, [c.id]: { ...p[c.id], monto_final: e.target.value } }))} />
                  <button style={{ ...btn.base, background: theme.colors.danger, color:'#fff', padding:'8px 16px', width:'100%' }} onClick={async () => {
                    const allSales = await window.nexbit.getSales({});
                    const cajaSales = allSales.filter(s => !s.anulada && s.caja_id === c.id && s.fecha && s.fecha >= (st.fecha_apertura || ''));
                    let efectivo = [], credito = []; let totalEfectivo = 0, totalCredito = 0;
                    for (const s of cajaSales) {
                      if (s.forma_pago === 'mixto') { try { const pagos = JSON.parse(s.detalle_pago || '[]'); for (const p of pagos) { if (p.tipo === 'efectivo') { efectivo.push(s); totalEfectivo += p.monto; } else if (p.tipo === 'credito') { credito.push(s); totalCredito += p.monto; } } } catch (e) { efectivo.push(s); totalEfectivo += s.total; } }
                      else if (s.forma_pago === 'efectivo') { efectivo.push(s); totalEfectivo += s.total; }
                      else if (s.forma_pago === 'credito') { credito.push(s); totalCredito += s.total; }
                      else { efectivo.push(s); totalEfectivo += s.total; }
                    }
                    setCloseSalesModal({ cajaId: c.id, status: st, salesData: { total: cajaSales.length, efectivo, credito, totalEfectivo, totalCredito } });
                  }}>Cerrar y Forzar Cierre</button>
                </div>
              ) : st ? (
                <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>
                  <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Apertura:</strong> {st.fecha_apertura}</p>
                  <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Fondo:</strong> ${$clp(st.monto_inicial)}</p>
                  <p style={{ marginBottom:12 }}><strong style={{ color: theme.colors.text }}>Ventas:</strong> ${$clp(st.monto_ventas)}</p>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:2 }}>Monto final real</label>
                  <input type="number" style={{ ...inputStyle.base, padding:'6px 10px', marginBottom:6 }} placeholder="0.00" value={closeData[c.id]?.monto_final || ''} onChange={e => setCloseData(p => ({ ...p, [c.id]: { ...p[c.id], monto_final: e.target.value } }))} />
                  <input style={{ ...inputStyle.base, padding:'6px 10px', marginBottom:8 }} placeholder="Observaciones" value={closeData[c.id]?.observaciones || ''} onChange={e => setCloseData(p => ({ ...p, [c.id]: { ...p[c.id], observaciones: e.target.value } }))} />
                  <button style={{ ...btn.base, background: theme.colors.warning, color:'#fff', padding:'8px 16px', width:'100%' }} onClick={async () => {
                    const allSales = await window.nexbit.getSales({});
                    const cajaSales = allSales.filter(s => !s.anulada && s.caja_id === c.id && s.fecha && s.fecha >= (st.fecha_apertura || ''));
                    let efectivo = [], credito = []; let totalEfectivo = 0, totalCredito = 0;
                    for (const s of cajaSales) {
                      if (s.forma_pago === 'mixto') { try { const pagos = JSON.parse(s.detalle_pago || '[]'); for (const p of pagos) { if (p.tipo === 'efectivo') { efectivo.push(s); totalEfectivo += p.monto; } else if (p.tipo === 'credito') { credito.push(s); totalCredito += p.monto; } } } catch (e) { efectivo.push(s); totalEfectivo += s.total; } }
                      else if (s.forma_pago === 'efectivo') { efectivo.push(s); totalEfectivo += s.total; }
                      else if (s.forma_pago === 'credito') { credito.push(s); totalCredito += s.total; }
                      else { efectivo.push(s); totalEfectivo += s.total; }
                    }
                    setCloseSalesModal({ cajaId: c.id, status: st, salesData: { total: cajaSales.length, efectivo, credito, totalEfectivo, totalCredito } });
                  }}>Cerrar Caja</button>
                </div>
              ) : (
                <div>
                  {lastClosures[c.id] && (
                    <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:12, padding:'8px 10px', background: theme.colors.surfaceHover, borderRadius: theme.radius.md }}>
                      <strong style={{ color: theme.colors.text }}>Último cierre</strong><br />
                      Monto final: <strong style={{ color: theme.colors.primary }}>${$clp(lastClosures[c.id].monto_final)}</strong><br />
                      {lastClosures[c.id].fecha_cierre && <span>{new Date(lastClosures[c.id].fecha_cierre).toLocaleString('es-CL')}</span>}
                    </div>
                  )}
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Monto inicial</label>
                  <div style={{ display:'flex', gap:6 }}>
                    <input type="number" style={{ ...inputStyle.base, padding:'6px 10px', flex:1 }} placeholder="0.00" value={initialAmounts[c.id] || ''} onChange={e => setInitialAmounts(p => ({ ...p, [c.id]: e.target.value }))} />
                    <button style={{ ...btn.base, ...btn.primary, padding:'6px 14px' }} onClick={() => openCash(c.id)}>Abrir</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ ...card, padding:20, flex:1, minWidth:260, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderStyle:'dashed' }}>
          {cajas.length < maxCajas ? (
            <><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:8 }}>Nueva Caja ({cajas.length}/{maxCajas})</p>
              <div style={{ display:'flex', gap:6, width:'100%' }}>
                <input style={{ ...inputStyle.base, padding:'6px 10px', flex:1 }} placeholder="Nombre..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCaja()} />
                <button style={{ ...btn.base, ...btn.primary, padding:'6px 14px' }} onClick={createCaja}>+</button>
              </div></>
          ) : <p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted }}>Límite alcanzado ({maxCajas})</p>}
        </div>
      </div>

      {currentUser?.rol === 'admin' && activeSessions.length > 0 && (
        <div style={{ ...card, padding:20, marginTop:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text, margin:'0 0 12px 0' }}>Sesiones Activas</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead>
                <tr style={{ background: theme.colors.surfaceHover }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', color: theme.colors.textMuted, fontWeight:500 }}>Caja</th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color: theme.colors.textMuted, fontWeight:500 }}>Usuario</th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color: theme.colors.textMuted, fontWeight:500 }}>Inicio</th>
                  <th style={{ padding:'8px 12px', textAlign:'center', color: theme.colors.textMuted, fontWeight:500 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map(s => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding:'8px 12px', color: theme.colors.text }}>{s.caja_nombre}</td>
                    <td style={{ padding:'8px 12px', color: theme.colors.text }}>{s.nombre_completo || s.nombre_usuario}</td>
                    <td style={{ padding:'8px 12px', color: theme.colors.textMuted }}>{s.inicio}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>
                      <button onClick={async () => {
                        await window.nexbit.endSession({ sesion_id: s.id });
                        setMessage(`Sesión de ${s.nombre_completo || s.nombre_usuario} cerrada`);
                        setTimeout(() => setMessage(''), 3000);
                        load();
                      }} style={{ ...btn.base, background: theme.colors.danger, color:'#fff', padding:'4px 12px', fontSize: theme.font.sizeXs }}>Cerrar sesión</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {closeHistory.length > 0 && (
        <div style={{ ...card, padding:20, marginTop:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text, margin:'0 0 12px 0' }}>📋 Historial de Cierres</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {closeHistory.slice(0, 15).map(h => {
              const caja = cajas.find(c => c.id === h.caja_id);
              return (
                <div key={h.id} style={{
                  border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow:'hidden',
                }}>
                  <div onClick={() => {
                    if (expandedHistory === h.id) { setExpandedHistory(null); setHistorySales(null); return; }
                    setExpandedHistory(h.id); setHistorySales(null);
                    window.nexbit.getSales({ desde: h.fecha_apertura?.substring(0,10), hasta: (h.fecha_cierre || h.fecha_apertura || '').substring(0,10) + ' 23:59:59', caja_id: h.caja_id }).then(sales => {
                      let efectivo = [], credito = []; let totalEfectivo = 0, totalCredito = 0;
                      for (const s of sales.filter(s => !s.anulada)) {
                        if (s.forma_pago === 'mixto') { try { const pagos = JSON.parse(s.detalle_pago || '[]'); for (const p of pagos) { if (p.tipo === 'efectivo') { efectivo.push(s); totalEfectivo += p.monto; } else if (p.tipo === 'credito') { credito.push(s); totalCredito += p.monto; } } } catch (e) { efectivo.push(s); totalEfectivo += s.total; } }
                        else if (s.forma_pago === 'efectivo') { efectivo.push(s); totalEfectivo += s.total; }
                        else if (s.forma_pago === 'credito') { credito.push(s); totalCredito += s.total; }
                        else { efectivo.push(s); totalEfectivo += s.total; }
                      }
                      setHistorySales({ efectivo, credito, totalEfectivo, totalCredito, count: sales.filter(s => !s.anulada).length });
                    });
                  }} style={{
                    padding:'10px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
                    background: expandedHistory === h.id ? theme.colors.surfaceHover : 'transparent',
                    transition:'background 0.15s',
                  }}>
                    <div>
                      <span style={{ fontWeight:600, color: theme.colors.text, fontSize: theme.font.sizeSm }}>{caja?.nombre || `Caja #${h.caja_id}`}</span>
                      <span style={{ fontSize:'0.6rem', color: theme.colors.textMuted, display:'block', marginTop:2 }}>
                        {h.fecha_cierre ? new Date(h.fecha_cierre).toLocaleString('es-CL') : '—'}
                      </span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700, color: theme.colors.primary, fontSize: theme.font.sizeSm }}>${$clp(h.monto_final || 0)}</div>
                      <div style={{ fontSize:'0.7rem', color: theme.colors.textMuted }}>
                        Inicial: ${$clp(h.monto_inicial)} · Ventas: ${$clp(h.monto_ventas)}
                      </div>
                    </div>
                  </div>
                  {expandedHistory === h.id && (
                    <div style={{ padding:'8px 14px 14px', borderTop:`1px solid ${theme.colors.border}` }}>
                      {h.reporte_json && (
                        <div style={{ fontSize:'0.6rem', color: theme.colors.textMuted, marginBottom:8 }}>
                          <span>💵 Efectivo: {h.reporte_json.ventas_efectivo?.cantidad || 0} ventas — <strong style={{ color: theme.colors.primary }}>${$clp(h.reporte_json.ventas_efectivo?.total || 0)}</strong></span>
                          <span style={{ margin:'0 8px' }}>·</span>
                          <span>📋 Crédito: {h.reporte_json.ventas_credito?.cantidad || 0} ventas — <strong style={{ color: theme.colors.warning }}>${$clp(h.reporte_json.ventas_credito?.total || 0)}</strong></span>
                        </div>
                      )}
                      {historySales === null ? (
                        <p style={{ fontSize:'0.6rem', color: theme.colors.textMuted }}>Cargando ventas...</p>
                      ) : (
                        <div>
                          <p style={{ fontSize:'0.6rem', color: theme.colors.textMuted, marginBottom:6 }}>{historySales.count} ventas en este período</p>
                          <div style={{ fontSize:'0.6rem', color: theme.colors.textSecondary, marginBottom:4 }}>
                            ▶ <strong style={{ color: theme.colors.primary }}>💵 Efectivo:</strong> {historySales.efectivo.length} ventas — ${$clp(historySales.totalEfectivo)}
                          </div>
                          {historySales.efectivo.length > 0 && (
                            <div style={{ maxHeight:100, overflow:'auto', marginBottom:6, border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                              {historySales.efectivo.map(s => (
                                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'1px 0', borderBottom:`1px solid ${theme.colors.border}` }}>
                                  <span>#{s.id} — {new Date(s.fecha).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>
                                  <span style={{ fontWeight:600 }}>${$clp(s.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize:'0.6rem', color: theme.colors.textSecondary, marginBottom:4 }}>
                            ▶ <strong style={{ color: theme.colors.warning }}>📋 Crédito:</strong> {historySales.credito.length} ventas — ${$clp(historySales.totalCredito)}
                          </div>
                          {historySales.credito.length > 0 && (
                            <div style={{ maxHeight:100, overflow:'auto', border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                              {historySales.credito.map(s => (
                                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'1px 0', borderBottom:`1px solid ${theme.colors.border}` }}>
                                  <span>#{s.id} — {new Date(s.fecha).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>
                                  <span style={{ fontWeight:600 }}>${$clp(s.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ borderTop:`1px solid ${theme.colors.border}`, paddingTop:6, marginTop:6, fontWeight:600, color: theme.colors.text, fontSize:'0.65rem' }}>
                            Total: ${$clp(historySales.totalEfectivo + historySales.totalCredito)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closeSalesModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:2000,
        }} onClick={() => { setCloseSalesModal(null); setCloseModalError(''); setCloseData(p => ({ ...p, [closeSalesModal.cajaId]: { monto_final: '', observaciones: '' } })); }}>
          <div style={{ ...card, padding:24, width:520, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>
              Cerrar Caja — {cajas.find(c => c.id === closeSalesModal.cajaId)?.nombre}
            </h3>

            {closeModalError && (
              <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'8px 12px', borderRadius: theme.radius.sm, marginBottom:12, fontSize: theme.font.sizeXs }}>{closeModalError}</div>
            )}

            <div style={{ marginBottom:16 }}>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.text, marginBottom:8 }}>
                Ventas del día ({closeSalesModal.salesData.total} tickets)
              </h4>
              <div>
                <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, marginBottom:4, cursor:'pointer', userSelect:'none' }} onClick={() => setExpandEfectivo(!expandEfectivo)}>
                  <strong style={{ color: theme.colors.primary }}>{expandEfectivo ? '▼' : '▶'} 💵 Efectivo:</strong> {closeSalesModal.salesData.efectivo.length} ventas — <strong>${$clp(closeSalesModal.salesData.totalEfectivo)}</strong>
                </div>
                {expandEfectivo && closeSalesModal.salesData.efectivo.length > 0 && (
                  <div style={{ maxHeight:150, overflow:'auto', marginBottom:8, border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                    {closeSalesModal.salesData.efectivo.map(s => (
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
                  <strong style={{ color: theme.colors.warning }}>{expandCredito ? '▼' : '▶'} 📋 Crédito:</strong> {closeSalesModal.salesData.credito.length} ventas — <strong>${$clp(closeSalesModal.salesData.totalCredito)}</strong>
                </div>
                {expandCredito && closeSalesModal.salesData.credito.length > 0 && (
                  <div style={{ maxHeight:150, overflow:'auto', marginBottom:8, border:`1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, padding:'4px 8px', background: theme.colors.surfaceHover }}>
                    {closeSalesModal.salesData.credito.map(s => (
                      <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:'0.65rem', borderBottom:`1px solid ${theme.colors.border}` }}>
                        <span>#{s.id} — {new Date(s.fecha).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>
                        <span style={{ fontWeight:600 }}>${$clp(s.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ borderTop:`1px solid ${theme.colors.border}`, paddingTop:8, marginTop:8, fontWeight:700, color: theme.colors.text }}>
                Total ventas: ${$clp(closeSalesModal.salesData.totalEfectivo + closeSalesModal.salesData.totalCredito)}
              </div>
            </div>

            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:12 }}>
              Ingrese solo el <strong>monto en efectivo</strong> real que hay en la caja para cerrar.
            </p>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Monto final en efectivo</label>
              <input type="number" style={{ ...inputStyle.base, padding:'6px 10px', marginBottom:6 }} placeholder="0" value={closeData[closeSalesModal.cajaId]?.monto_final || ''} onChange={e => setCloseData(p => ({ ...p, [closeSalesModal.cajaId]: { ...p[closeSalesModal.cajaId], monto_final: e.target.value } }))} />
              <input style={{ ...inputStyle.base, padding:'6px 10px' }} placeholder="Observaciones" value={closeData[closeSalesModal.cajaId]?.observaciones || ''} onChange={e => setCloseData(p => ({ ...p, [closeSalesModal.cajaId]: { ...p[closeSalesModal.cajaId], observaciones: e.target.value } }))} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setCloseSalesModal(null); setCloseModalError(''); setCloseData(p => ({ ...p, [closeSalesModal.cajaId]: { monto_final: '', observaciones: '' } })); }} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={async () => {
                setCloseModalError('');
                try {
                  await closeCash(closeSalesModal.cajaId, closeSalesModal.status);
                  setCloseSalesModal(null);
                } catch (e) { setCloseModalError('Error: ' + e.message); }
              }} style={{ ...btn.base, background: theme.colors.danger, color:'#fff' }} disabled={!closeData[closeSalesModal.cajaId]?.monto_final}>Cerrar Caja</button>
            </div>
          </div>
        </div>
      )}

      {deleteCajaConfirm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:2000,
        }} onClick={() => setDeleteCajaConfirm(null)}>
          <div style={{ ...card, padding:24, width:380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:8, color: theme.colors.text }}>¿Eliminar Caja?</h3>
            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:16 }}>
              Se eliminará la caja <strong>{deleteCajaConfirm.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteCajaConfirm(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  await window.nexbit.deleteCaja(deleteCajaConfirm.id);
                  setMessage(`✓ Caja "${deleteCajaConfirm.nombre}" eliminada`);
                  load();
                } catch (e) { setMessage('Error: ' + e.message); }
                setDeleteCajaConfirm(null);
              }} style={{ ...btn.base, background: theme.colors.danger, color:'#fff' }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}