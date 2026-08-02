import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle, table as t, badge } from '../styles/theme';
import { $clp } from '../utils/format';

export default function DevolucionesPage() {
  const [returns, setReturns] = useState([]);
  const [saleSearch, setSaleSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [message, setMessage] = useState('');
  const [viewReturn, setViewReturn] = useState(null);

  useEffect(() => { window.nexbit.getReturns({}).then(setReturns); }, []);

  const handleSaleSearch = async () => {
    if (!saleSearch) return;
    try {
      const sale = await window.nexbit.getSale(parseInt(saleSearch));
      if (!sale) { setMessage('Venta no encontrada'); return; }
      if (sale.anulada) { setMessage('La venta está anulada'); return; }
      setSelectedSale(sale);
      setReturnItems(sale.items?.map(i => ({ ...i, devolver: i.cantidad })) || []);
      setMessage('');
    } catch (e) {
      setMessage('Error: ' + e.message);
    }
  };

  const toggleReturnItem = (idx) => {
    const updated = [...returnItems];
    updated[idx] = { ...updated[idx], devolver: updated[idx].devolver > 0 ? 0 : updated[idx].cantidad };
    setReturnItems(updated);
  };

  const setReturnQty = (idx, qty) => {
    const updated = [...returnItems];
    updated[idx] = { ...updated[idx], devolver: Math.min(Math.max(0, parseFloat(qty) || 0), updated[idx].cantidad) };
    setReturnItems(updated);
  };

  const totalDevolver = returnItems.reduce((s, i) => s + (i.devolver * i.precio_unitario), 0);

  const processReturn = async () => {
    if (totalDevolver <= 0) return;
    const items = returnItems.filter(i => i.devolver > 0).map(i => ({
      producto_id: i.producto_id,
      nombre_producto: i.nombre_producto,
      cantidad: i.devolver,
      precio_unitario: i.precio_unitario,
      subtotal: i.devolver * i.precio_unitario,
    }));
    try {
      const result = await window.nexbit.createReturn({ venta_id: selectedSale?.id, items, motivo });
      setMessage(`Devolución #${result.id} procesada — $${$clp(result.total)}`);
      setSelectedSale(null); setReturnItems([]); setSaleSearch(''); setMotivo('');
      window.nexbit.getReturns({}).then(setReturns);
    } catch (e) {
      setMessage('Error: ' + e.message);
    }
  };

  const viewReturnDetail = async (id) => {
    const dev = await window.nexbit.getReturn(id);
    setViewReturn(dev);
  };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Devoluciones</h1>
        <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Gestión de devoluciones y reembolsos</p>
      </div>

      {message && (
        <div style={{
          background: message.startsWith('Error') ? theme.colors.dangerLight : theme.colors.primaryLight,
          color: message.startsWith('Error') ? theme.colors.danger : theme.colors.primaryDark,
          padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16, fontSize: theme.font.sizeSm
        }}>{message}</div>
      )}

      {!selectedSale ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={card}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Nueva Devolución</h3>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Buscar venta por ID</label>
            <div style={{ display:'flex', gap:8 }}>
              <input type="number" style={{ ...inputStyle.base, flex:1 }} placeholder="ID de venta..." value={saleSearch} onChange={e => setSaleSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaleSearch(); }} />
              <button style={{ ...btn.base, ...btn.primary }} onClick={handleSaleSearch}>Buscar</button>
            </div>
          </div>

          <div style={t.wrapper}>
            <h3 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Historial de Devoluciones</h3>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr><th style={t.th}>#</th><th style={t.th}>Fecha</th><th style={t.th}>Total</th><th style={t.th}>Venta</th><th style={t.th}></th></tr></thead>
              <tbody>
                {returns.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                    <td style={t.td}>{d.id}</td>
                    <td style={t.td}>{d.fecha}</td>
                    <td style={{ ...t.td, fontWeight:600, color: theme.colors.danger }}>-${$clp(d.total)}</td>
                    <td style={t.td}>{d.venta_id ? `#${d.venta_id}` : '-'}</td>
                    <td style={t.td}><button style={{ ...btn.base, ...btn.secondary, fontSize: theme.font.sizeXs }} onClick={() => viewReturnDetail(d.id)}>Ver</button></td>
                  </tr>
                ))}
                {returns.length === 0 && <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color: theme.colors.textMuted }}>Sin devoluciones registradas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', gap:16 }}>
          <div style={{ flex:1.5, ...card, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>Venta #{selectedSale.id}</h3>
              <button style={{ ...btn.base, ...btn.ghost }} onClick={() => { setSelectedSale(null); setReturnItems([]); }}>✕ Cancelar</button>
            </div>
            <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:16 }}>
              {selectedSale.fecha} — {selectedSale.cliente_nombre || 'Mostrador'} — {selectedSale.nombre_usuario}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr style={{ background: theme.colors.surfaceHover }}>
                <th style={t.th}>Producto</th><th style={t.th}>Vendido</th><th style={t.th}>P/U</th><th style={t.th}>Devolver</th><th style={t.th}></th>
              </tr></thead>
              <tbody>
                {returnItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${theme.colors.border}`, background: item.devolver > 0 ? theme.colors.primaryLight : 'transparent' }}>
                    <td style={t.td}>{item.nombre_producto}</td>
                    <td style={t.td}>{item.cantidad}</td>
                    <td style={t.td}>${$clp(item.precio_unitario)}</td>
                    <td style={t.td}>
                      <input type="number" min="0" max={item.cantidad} style={{ ...inputStyle.base, width:70, padding:'4px 6px' }} value={item.devolver} onChange={e => setReturnQty(idx, e.target.value)} />
                    </td>
                    <td style={t.td}>
                      <button style={{ ...btn.base, padding:'3px 8px', fontSize: theme.font.sizeXs, ...(item.devolver > 0 ? btn.primary : btn.secondary) }} onClick={() => toggleReturnItem(idx)}>
                        {item.devolver > 0 ? '✓' : 'Devolver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex:1, ...card, padding:20 }}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Procesar Devolución</h3>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:4 }}>Items a devolver: {returnItems.filter(i => i.devolver > 0).length}</div>
              <div style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.danger }}>-${$clp(totalDevolver)}</div>
            </div>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Motivo (opcional)</label>
            <textarea style={{ ...inputStyle.base, width:'100%', minHeight:60, marginBottom:16 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de la devolución..." />
            <button style={{ ...btn.base, background: theme.colors.danger, color:'#fff', padding:'10px 24px', width:'100%', opacity: totalDevolver <= 0 ? 0.5 : 1 }} disabled={totalDevolver <= 0} onClick={processReturn}>
              Procesar Devolución
            </button>
          </div>
        </div>
      )}

      {viewReturn && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={() => setViewReturn(null)}>
          <div style={{ ...card, width:500, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>Devolución #{viewReturn.id}</h3>
              <button onClick={() => setViewReturn(null)} style={btn.icon}>✕</button>
            </div>
            <div style={{ padding:20, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Fecha:</strong> {viewReturn.fecha}</p>
              {viewReturn.venta_id && <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Venta original:</strong> #{viewReturn.venta_id}</p>}
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Usuario:</strong> {viewReturn.nombre_usuario}</p>
              {viewReturn.motivo && <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Motivo:</strong> {viewReturn.motivo}</p>}
              <p style={{ fontSize:'1.1rem', fontWeight:700, color: theme.colors.danger, marginBottom:12 }}>Total devuelto: -${$clp(viewReturn.total)}</p>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Productos devueltos</h4>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                <thead><tr style={{ background: theme.colors.surfaceHover }}><th style={t.th}>Producto</th><th style={t.th}>Cant</th><th style={t.th}>P/U</th><th style={t.th}>Total</th></tr></thead>
                <tbody>
                  {(viewReturn.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={t.td}>{item.nombre_producto}</td><td style={t.td}>{item.cantidad}</td>
                      <td style={t.td}>${$clp(item.precio_unitario)}</td><td style={{ ...t.td, fontWeight:600 }}>${$clp(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}