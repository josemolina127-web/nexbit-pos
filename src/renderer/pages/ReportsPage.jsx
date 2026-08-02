import React, { useEffect, useState } from 'react';
import { theme, card, cardBody, btn, badge, input as inputStyle, table as t } from '../styles/theme';
import { exportReport } from '../utils/exportCsv';
import { $clp } from '../utils/format';

export default function ReportsPage() {
  const [tab, setTab] = useState('daily');
  const [daily, setDaily] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [topProducts, setTopProducts] = useState([]);
  const [topFilter, setTopFilter] = useState('today');
  const [profit, setProfit] = useState(null);

  useEffect(() => {
    if (tab === 'daily') window.nexbit.getDailyReport(date).then(setDaily);
    if (tab === 'top') {
      const f = topFilter === 'today' ? { desde: new Date().toISOString().split('T')[0] } : topFilter === 'month' ? { desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] } : {};
      window.nexbit.getTopProducts(f).then(setTopProducts);
    }
    if (tab === 'profit') window.nexbit.getProfitReport({}).then(setProfit);
  }, [tab, date, topFilter]);

  const tabs = [
    { key: 'daily', label: 'Reporte Diario' },
    { key: 'top', label: 'Más Vendidos' },
    { key: 'profit', label: 'Ganancias' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Reportes</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Análisis de ventas y rentabilidad</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom: `1px solid ${theme.colors.border}`, paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            ...btn.base, background:'transparent', borderRadius:0,
            color: tab === t.key ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: tab === t.key ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            padding:'8px 16px 8px',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'daily' && (
        <div>
          <div style={{ display:'flex', gap:12, alignItems:'end', marginBottom:16 }}>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle.base, width:200 }} />
            </div>
            <button onClick={() => daily && exportReport(
              [
                { concepto: 'Total Ventas', valor: daily.summary?.monto_total },
                { concepto: 'Tickets', valor: daily.summary?.total_ventas },
                { concepto: 'Descuentos', valor: daily.summary?.descuentos },
                ...(daily.formas_pago || []).map(f => ({ concepto: `Pago ${f.forma_pago}`, valor: f.monto })),
              ],
              `reporte_diario_${date}`,
              ['Concepto', 'Valor']
            )} style={{ ...btn.base, ...btn.secondary }}>📥 CSV</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
            <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Total Ventas</p><p style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.primary }}>${ $clp((daily?.summary?.monto_total || 0)) }</p></div>
            <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Tickets</p><p style={{ fontSize:'1.3rem', fontWeight:700 }}>{daily?.summary?.total_ventas || 0}</p></div>
            <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Descuentos</p><p style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.warning }}>${ $clp((daily?.summary?.descuentos || 0)) }</p></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={card}>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Formas de Pago</h4>
              {daily?.formas_pago?.map(f => (
                <div key={f.forma_pago} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                  <span>{f.forma_pago}</span><span><strong>${ $clp(f.monto) }</strong> ({f.cantidad} tickets)</span>
                </div>
              ))}
            </div>
            <div style={card}>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Top Productos</h4>
              {daily?.top_productos?.map((p, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                  <span>{i+1}. {p.nombre_producto} ×{p.cantidad}</span><span style={{ fontWeight:600 }}>${ $clp(p.total) }</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'top' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:8 }}>
              {['today','month','all'].map(f => (
                <button key={f} onClick={() => setTopFilter(f)} style={{ ...btn.base, background: topFilter === f ? theme.colors.primary : theme.colors.surface, color: topFilter === f ? '#fff' : theme.colors.text, border: topFilter === f ? 'none' : `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeXs }}>
                  {f === 'today' ? 'Hoy' : f === 'month' ? 'Este Mes' : 'Todo'}
                </button>
              ))}
            </div>
            <button onClick={() => exportReport(topProducts, 'top_productos', ['#', 'Producto', 'Cantidad', 'Total'])} style={{ ...btn.base, ...btn.secondary }}>📥 CSV</button>
          </div>
          <div style={t.wrapper}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr><th style={t.th}>#</th><th style={t.th}>Producto</th><th style={t.th}>Cantidad</th><th style={t.th}>Total</th></tr></thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin ventas en este período</td></tr>
                ) : (
                  topProducts.map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={t.td}>{i+1}</td>
                      <td style={{ ...t.td, fontWeight:600 }}>{p.nombre_producto}</td>
                      <td style={t.td}><strong>{p.cantidad}</strong></td>
                      <td style={{ ...t.td, color: theme.colors.primary, fontWeight:600 }}>${ $clp(p.total) }</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'profit' && (
        <div>
          <div style={{ display:'flex', gap:16, marginBottom:20, justifyContent:'space-between', alignItems:'start' }}>
            <div style={{ display:'flex', gap:16 }}>
              <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Ingresos</p><p style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.info }}>${ $clp((profit?.summary?.ingresos || 0)) }</p></div>
              <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Costo</p><p style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.warning }}>${ $clp((profit?.summary?.costo_total || 0)) }</p></div>
              <div style={card}><p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4 }}>Ganancia</p><p style={{ fontSize:'1.3rem', fontWeight:700, color: theme.colors.primary }}>${ $clp((profit?.summary?.ganancia || 0)) }</p></div>
            </div>
            <button onClick={() => exportReport(profit?.productos || [], 'ganancias', ['Producto', 'Ventas', 'Costo', 'Ganancia'])} style={{ ...btn.base, ...btn.secondary }}>📥 CSV</button>
          </div>
          <div style={t.wrapper}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
              <thead><tr><th style={t.th}>Producto</th><th style={t.th}>Ventas</th><th style={t.th}>Costo</th><th style={t.th}>Ganancia</th></tr></thead>
              <tbody>
                {!profit?.productos?.length ? (
                  <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin ventas registradas</td></tr>
                ) : (
                  profit.productos.map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={{ ...t.td, fontWeight:600 }}>{p.nombre_producto}</td>
                      <td style={t.td}>${ $clp(p.ventas) }</td>
                      <td style={t.td}>${ $clp(p.costo) }</td>
                      <td style={{ ...t.td, fontWeight:600, color: p.ganancia >= 0 ? theme.colors.primary : theme.colors.danger }}>${ $clp(p.ganancia) }</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
