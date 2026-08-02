import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, card, cardBody, btn } from '../styles/theme';
import { $clp } from '../utils/format';

const quickActions = [
  { label: 'Nueva Venta', icon: '🛒', color: theme.colors.primary, path: '/pos' },
  { label: 'Productos', icon: '📦', color: theme.colors.info, path: '/productos' },
  { label: 'Mis Ventas', icon: '🧾', color: theme.colors.warning, path: '/historial' },
  { label: 'Corte de Caja', icon: '💰', color: theme.colors.danger, path: '/caja' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [todaySummary, setTodaySummary] = useState(null);
  const [weekSummary, setWeekSummary] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cashStatus, setCashStatus] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [topProducts, setTopProducts] = useState([]);
  const [profitData, setProfitData] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];

    window.nexbit.getSalesSummary({ desde: today }).then(setTodaySummary);
    window.nexbit.getSalesSummary({ desde: weekAgo }).then(setWeekSummary);
    window.nexbit.getSalesSummary({ desde: monthAgo }).then(setMonthSummary);
    window.nexbit.getStockAlerts().then(setAlerts);
    window.nexbit.getCashRegisterStatus().then(setCashStatus);
    window.nexbit.getUserPermissions().then(setPermissions);
    window.nexbit.getTopProducts({ desde: today }).then(setTopProducts);
    window.nexbit.getProfitReport({}).then(setProfitData);
  }, []);

  const MetricCard = ({ label, value, sub, color, icon }) => (
    <div style={{ ...card, padding: '20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <span style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:'1.2rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize:'1.75rem', fontWeight:700, color: color || theme.colors.text, lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginTop:4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Panel Principal</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Resumen del negocio</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:24 }}>
        {quickActions.map(a => (
          <div key={a.path} onClick={() => navigate(a.path)} style={{ ...card, padding:'16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, borderLeft:`3px solid ${a.color}`, transition:'all 0.15s' }}>
            <span style={{ fontSize:'1.5rem' }}>{a.icon}</span>
            <span style={{ fontWeight:600, fontSize: theme.font.sizeBase, color: theme.colors.text }}>{a.label}</span>
          </div>
        ))}
      </div>

      {permissions.ver_reportes && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:24 }}>
            <MetricCard label="Ventas Hoy" value={$clp(todaySummary?.monto_total)} sub={`${todaySummary?.total_ventas || 0} tickets`} color={theme.colors.primary} icon="📊" />
            <MetricCard label="Ventas Semana" value={$clp(weekSummary?.monto_total)} sub={`${weekSummary?.total_ventas || 0} tickets`} color={theme.colors.info} icon="📈" />
            <MetricCard label="Ventas Mes" value={$clp(monthSummary?.monto_total)} sub={`${monthSummary?.total_ventas || 0} tickets`} color={theme.colors.warning} icon="📅" />
            <MetricCard label="Ganancia Est." value={$clp(profitData?.summary?.ganancia)} sub={`Margen: ${profitData?.summary?.ingresos ? ((profitData.summary.ganancia / profitData.summary.ingresos) * 100).toFixed(1) : 0}%`} color={theme.colors.primary} icon="💰" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16 }}>
            <div style={card}>
              <div style={{ ...cardBody }}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Productos Más Vendidos Hoy</h3>
                {topProducts.length === 0 ? (
                  <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Sin ventas hoy</p>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <tbody>
                      {topProducts.slice(0, 6).map((p, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                          <td style={{ padding:'8px 0', fontSize: theme.font.sizeSm }}>
                            <span style={{ color: theme.colors.textMuted, marginRight:8 }}>{i + 1}.</span>
                            {p.nombre_producto}
                          </td>
                          <td style={{ padding:'8px 0', fontSize: theme.font.sizeSm, textAlign:'right', fontWeight:600 }}>x{p.cantidad}</td>
                          <td style={{ padding:'8px 0', fontSize: theme.font.sizeSm, textAlign:'right', color: theme.colors.primary }}>${ $clp(p.total) }</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={card}>
              <div style={{ ...cardBody }}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Estado de Caja</h3>
                {cashStatus ? (
                  <>
                    <div style={{ fontSize:'1.5rem', fontWeight:700, color: theme.colors.primary, marginBottom:4 }}>🔓 Abierta</div>
                    <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:2 }}>Fondo: {$clp(cashStatus.monto_inicial)}</div>
                    <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>Ventas: {$clp(cashStatus.monto_ventas)}</div>
                    <div style={{ marginTop:12, fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.text }}>Esperado: {$clp(cashStatus.monto_inicial + cashStatus.monto_ventas)}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:'1.5rem', fontWeight:700, color: theme.colors.textMuted, marginBottom:4 }}>🔒 Cerrada</div>
                    <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Abrir caja en Corte de Caja</p>
                  </>
                )}
              </div>
            </div>

            <div style={card}>
              <div style={{ ...cardBody }}>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Alertas de Stock</h3>
                {alerts.length === 0 ? (
                  <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>✓ Todo en orden</p>
                ) : (
                  <div style={{ fontSize:'2rem', fontWeight:700, color: theme.colors.danger, marginBottom:4 }}>{alerts.length}</div>
                )}
                {alerts.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    {alerts.slice(0, 4).map(p => (
                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, padding:'3px 0' }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{p.nombre}</span>
                        <span style={{ color: theme.colors.danger, fontWeight:600 }}>{p.stock} / {p.stock_minimo}</span>
                      </div>
                    ))}
                    {alerts.length > 4 && <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginTop:4 }}>+{alerts.length - 4} más</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!permissions.ver_reportes && (
        <div style={{ ...card, padding:'40px', textAlign:'center' }}>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Bienvenido a Nexbit. Usa el menú lateral para navegar.</p>
        </div>
      )}
    </div>
  );
}
