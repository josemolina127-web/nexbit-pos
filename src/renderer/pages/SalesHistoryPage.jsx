import React, { useEffect, useState, useCallback } from 'react';
import { theme, card, cardBody, btn, badge, input as inputStyle, table as t } from '../styles/theme';
import { exportSales, exportSaleDetail } from '../utils/exportCsv';
import { $clp } from '../utils/format';

function dateRange(filter, monthRef) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  if (filter === 'day') {
    return { desde: `${y}-${m}-${d} 00:00:00`, hasta: `${y}-${m}-${d} 23:59:59` };
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

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ desde: '', hasta: '', usuario_id: '' });
  const [viewMode, setViewMode] = useState('my');
  const [dateFilter, setDateFilter] = useState('all');
  const now2 = new Date();
  const [monthRef, setMonthRef] = useState(`${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`);
  const [voidDialog, setVoidDialog] = useState(null);

  useEffect(() => {
    window.nexbit.getUserPermissions().then(setPermissions);
    window.nexbit.getUsers().catch(() => {}).then(u => { if (u) setUsers(u); });
  }, []);

  const loadSales = useCallback(async () => {
    const range = dateFilter === 'all' ? {} : dateRange(dateFilter, monthRef);
    if (viewMode === 'my') {
      const data = await window.nexbit.getSales({ mis_ventas: true, ...range });
      setSales(data); setSelectedSale(null);
    } else {
      const f = { ...filters, usuario_id: filters.usuario_id || undefined };
      if (range.desde) f.desde = range.desde;
      if (range.hasta) f.hasta = range.hasta;
      const data = await window.nexbit.getSales(f);
      setSales(data); setSelectedSale(null);
    }
  }, [viewMode, filters, dateFilter, monthRef]);

  useEffect(() => { loadSales(); }, [viewMode, dateFilter, monthRef, loadSales]);

  const viewSale = async (id) => {
    const sale = await window.nexbit.getSale(id);
    setSelectedSale(sale);
  };

  const voidSale = (id) => setVoidDialog(id);

  const confirmVoidSale = async () => {
    if (!voidDialog) return;
    await window.nexbit.voidSale(voidDialog.id, voidDialog.motivo);
    setVoidDialog(null);
    loadSales(); setSelectedSale(null);
  };

  const isAnulada = (v) => Number(v.anulada) === 1;
  const totalVentas = sales.reduce((s, v) => s + (isAnulada(v) ? 0 : v.total), 0);
  const totalAnuladas = sales.filter(isAnulada).length;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Historial de Ventas</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Consulta y administración de ventas</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setViewMode('my')} style={{ ...btn.base, background: viewMode === 'my' ? theme.colors.primary : theme.colors.surface, color: viewMode === 'my' ? '#fff' : theme.colors.text, border: viewMode === 'my' ? 'none' : `1px solid ${theme.colors.border}` }}>Mis Ventas</button>
          {permissions.ver_reportes && (
            <button onClick={() => setViewMode('all')} style={{ ...btn.base, background: viewMode === 'all' ? theme.colors.info : theme.colors.surface, color: viewMode === 'all' ? '#fff' : theme.colors.text, border: viewMode === 'all' ? 'none' : `1px solid ${theme.colors.border}` }}>Todas</button>
          )}
          <button onClick={() => exportSales(sales)} style={{ ...btn.base, ...btn.secondary }}>
            📥 Exportar CSV
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        {[
          { key: 'day', label: 'Hoy' },
          { key: 'week', label: 'Semana' },
          { key: 'month', label: 'Mes' },
          { key: 'all', label: 'Todo' },
        ].map(f => (
          <button key={f.key} onClick={() => setDateFilter(f.key)} style={{
            ...btn.base, ...btn.secondary,
            background: dateFilter === f.key ? theme.colors.primary : 'transparent',
            color: dateFilter === f.key ? '#fff' : theme.colors.textSecondary,
            borderColor: dateFilter === f.key ? theme.colors.primary : theme.colors.border,
            fontSize: theme.font.sizeXs, padding: '4px 14px',
          }}>{f.label}</button>
        ))}
        {dateFilter === 'month' && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', gap:4 }}>
              <select value={monthRef.slice(5,7)} onChange={e => setMonthRef(`${monthRef.slice(0,4)}-${e.target.value}`)}
                style={{ ...inputStyle.base, fontSize: theme.font.sizeXs, padding:'4px 8px', cursor:'pointer', width:120 }}>
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((name, i) => (
                  <option key={i+1} value={String(i+1).padStart(2,'0')}>{name}</option>
                ))}
              </select>
              <select value={monthRef.slice(0,4)} onChange={e => setMonthRef(`${e.target.value}-${monthRef.slice(5,7)}`)}
                style={{ ...inputStyle.base, fontSize: theme.font.sizeXs, padding:'4px 8px', cursor:'pointer', width:90 }}>
                {Array.from({length:5}, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
        )}
        {viewMode === 'all' && (
          <>
            <div style={{ width:1, height:24, background: theme.colors.border, margin:'0 4px' }} />
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Usuario</label>
              <select value={filters.usuario_id} onChange={e => setFilters({...filters, usuario_id: e.target.value})} style={{ padding:'6px 10px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.font.sizeSm }}>
                <option value="">Todos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <div style={{ ...card, padding:'16px 20px', flex:1 }}>
          <span style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500 }}>Ventas</span>
          <p style={{ fontSize:'1.5rem', fontWeight:700, color: theme.colors.primary }}>{sales.length - totalAnuladas}</p>
        </div>
        <div style={{ ...card, padding:'16px 20px', flex:1 }}>
          <span style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500 }}>Total vendido</span>
          <p style={{ fontSize:'1.5rem', fontWeight:700, color: theme.colors.info }}>${ $clp(totalVentas) }</p>
        </div>
        <div style={{ ...card, padding:'16px 20px', flex:1 }}>
          <span style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500 }}>Anuladas</span>
          <p style={{ fontSize:'1.5rem', fontWeight:700, color: theme.colors.danger }}>{totalAnuladas}</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selectedSale ? '1fr 1fr' : '1fr', gap:16 }}>
        <div style={t.wrapper}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
            <thead><tr><th style={t.th}>#</th><th style={t.th}>Fecha</th><th style={t.th}>Total</th><th style={t.th}>Pago</th><th style={t.th}>Cliente</th><th style={t.th}>Estado</th><th style={t.th}></th></tr></thead>
            <tbody>
              {sales.map(v => (
                <tr key={v.id} onClick={() => viewSale(v.id)} style={{ cursor:'pointer', background: selectedSale?.id === v.id ? theme.colors.primaryLight : 'transparent', transition:'background 0.1s' }}>
                  <td style={t.td}>{v.id}</td>
                  <td style={t.td}>{v.fecha}</td>
                  <td style={{ ...t.td, fontWeight:600, color: v.anulada ? theme.colors.textMuted : theme.colors.primary }}>${ $clp(v.total) }</td>
                  <td style={t.td}>{v.forma_pago}</td>
                  <td style={t.td}>{v.cliente_nombre || '-'}</td>
                  <td style={t.td}>{isAnulada(v) ? <span style={badge('danger')}>Anulada</span> : <span style={badge('success')}>Completada</span>}</td>
                  <td style={t.td}>
                    {!v.anulada && permissions.anular_ventas && (
                      <button style={{ ...btn.base, background: theme.colors.dangerLight, color: theme.colors.danger, padding:'3px 8px', fontSize: theme.font.sizeXs }} onClick={(e) => { e.stopPropagation(); setVoidDialog({ id: v.id, motivo: '' }); }}>Anular</button>
                    )}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin ventas registradas</td></tr>}
            </tbody>
          </table>
        </div>

        {selectedSale && (
          <div style={{ ...card, padding:20, overflow:'auto', maxHeight:'calc(100vh - 300px)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>Venta #{selectedSale.id}</h3>
              <button onClick={() => exportSaleDetail(selectedSale, selectedSale.items || [])} style={{ ...btn.base, ...btn.secondary, fontSize: theme.font.sizeXs }}>📥 CSV</button>
            </div>
            <div style={{ fontSize: theme.font.sizeSm, marginBottom:16, color: theme.colors.textSecondary }}>
              <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Fecha:</strong> {selectedSale.fecha}</p>
              <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Cajero:</strong> {selectedSale.nombre_usuario}</p>
              <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Cliente:</strong> {selectedSale.cliente_nombre || 'Mostrador'}</p>
              <p style={{ marginBottom:2 }}><strong style={{ color: theme.colors.text }}>Pago:</strong> {selectedSale.forma_pago}</p>
              {isAnulada(selectedSale) && <p><strong style={{ color: theme.colors.danger }}>Anulada:</strong> {selectedSale.motivo_anulacion}</p>}
            </div>
            <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Productos</h4>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr style={{ background: theme.colors.surfaceHover }}><th style={t.th}>Producto</th><th style={t.th}>Cant</th><th style={t.th}>Precio</th><th style={t.th}>Desc</th><th style={t.th}>Total</th></tr></thead>
              <tbody>
                {(selectedSale.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                    <td style={t.td}>{item.nombre_producto}</td>
                    <td style={t.td}>{item.cantidad}</td>
                    <td style={t.td}>${ $clp(item.precio_unitario) }</td>
                    <td style={t.td}>{item.descuento > 0 ? `-$${ $clp(item.descuento) }` : '-'}</td>
                    <td style={{ ...t.td, fontWeight:600 }}>${ $clp(item.subtotal) }</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: `2px solid ${theme.colors.border}`, marginTop:12, paddingTop:12, textAlign:'right', fontSize:'1.1rem', fontWeight:700, color: selectedSale.anulada ? theme.colors.textMuted : theme.colors.primary }}>
              Total: ${ $clp(selectedSale.total) }
              {selectedSale.descuento > 0 && <span style={{ fontSize: theme.font.sizeSm, color: theme.colors.warning, marginLeft:12 }}>(Desc: -${ $clp(selectedSale.descuento) })</span>}
            </div>
          </div>
        )}
      </div>

      {voidDialog && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setVoidDialog(null)}>
          <div style={{ ...card, padding:20, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Anular Venta #{voidDialog.id}</h3>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Motivo</label>
              <input value={voidDialog.motivo} onChange={e => setVoidDialog({...voidDialog, motivo: e.target.value})} style={inputStyle.base} placeholder="Ingrese el motivo..." />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setVoidDialog(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={confirmVoidSale} disabled={!voidDialog.motivo} style={{ ...btn.base, background: theme.colors.danger, color:'#fff', opacity: !voidDialog.motivo ? 0.5 : 1 }}>Anular</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
