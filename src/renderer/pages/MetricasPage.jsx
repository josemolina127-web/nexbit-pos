import React, { useEffect, useState } from 'react';
import { theme, card, btn, table as t } from '../styles/theme';
import { $clp } from '../utils/format';
import { downloadCsv } from '../utils/exportCsv';

const Bar = ({ value, max, color }) => (
  <div style={{ width:'100%', height:6, background: theme.colors.surfaceHover, borderRadius:3, overflow:'hidden' }}>
    <div style={{ width:`${max > 0 ? (value / max) * 100 : 0}%`, height:'100%', background: color || theme.colors.primary, borderRadius:3, transition:'width 0.3s' }} />
  </div>
);

export default function MetricasPage() {
  const [metrics, setMetrics] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    window.nexbit.getCurrentUser().then(setCurrentUser);
    window.nexbit.getCajaMetrics().then(setMetrics);
  }, []);

  const isAdmin = currentUser?.rol === 'admin';
  const filteredCajeros = metrics
    ? metrics.perCajero.filter(u => isAdmin || u.id === currentUser?.id)
    : [];
  const filteredSesiones = metrics
    ? (metrics.sesionesActivas || []).filter(s => isAdmin || s.usuario_id === currentUser?.id)
    : [];

  const exportMetrics = () => {
    if (!metrics) return;
    downloadCsv('metricas_cajas', ['Caja','Estado','Ventas','Ingresos','Sesiones'],
      metrics.perCaja.map(c => [c.nombre, c.abierta ? 'Abierta' : 'Cerrada', c.total_ventas, c.ingresos, c.total_sesiones]));
    if (filteredCajeros.length > 0) {
      downloadCsv('metricas_cajeros', ['Cajero','Usuario','Rol','Ventas','Ticket Prom.','Ingresos','Sesiones'],
        filteredCajeros.map(u => [u.nombre_completo, u.nombre_usuario, u.rol, u.total_ventas, u.ticket_promedio, u.ingresos, u.total_sesiones]));
    }
    if (filteredSesiones.length > 0) {
      downloadCsv('sesiones_activas', ['Cajero','Caja','Inicio'],
        filteredSesiones.map(s => [s.nombre_completo, s.caja_nombre, s.inicio]));
    }
  };

  const maxIngresos = metrics ? Math.max(...metrics.perCaja.map(c => c.ingresos), 1) : 1;
  const maxCajeroIngresos = filteredCajeros.length > 0 ? Math.max(...filteredCajeros.map(u => u.ingresos), 1) : 1;

  return (
    <div>
      <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Métricas</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Rendimiento por caja y cajero</p>
        </div>
        {metrics && <button style={{ ...btn.base, ...btn.secondary }} onClick={exportMetrics}>📥 Exportar CSV</button>}
      </div>

      {!metrics ? (
        <p style={{ color: theme.colors.textMuted }}>Cargando métricas...</p>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div style={{ ...card, padding:20 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>📊 Ingresos por Caja</h3>
              {metrics.perCaja.map(c => (
                <div key={c.id} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize: theme.font.sizeSm, marginBottom:4 }}>
                    <span style={{ color: theme.colors.text }}>{c.nombre}</span>
                    <span style={{ fontWeight:600, color: theme.colors.primary }}>${$clp(c.ingresos)}</span>
                  </div>
                  <Bar value={c.ingresos} max={maxIngresos} color={theme.colors.primary} />
                </div>
              ))}
            </div>
            <div style={{ ...card, padding:20 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>📊 Ingresos por Cajero</h3>
              {filteredCajeros.map(u => (
                <div key={u.id} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize: theme.font.sizeSm, marginBottom:4 }}>
                    <span style={{ color: theme.colors.text }}>{u.nombre_completo}</span>
                    <span style={{ fontWeight:600, color: theme.colors.info }}>${$clp(u.ingresos)}</span>
                  </div>
                  <Bar value={u.ingresos} max={maxCajeroIngresos} color={theme.colors.info} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div style={{ ...card, padding:20 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Métricas por Caja</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                <thead><tr style={{ background: theme.colors.surfaceHover }}>
                  <th style={t.th}>Caja</th><th style={t.th}>Estado</th><th style={t.th}>Ventas</th><th style={t.th}>Ingresos</th><th style={t.th}>Sesiones</th>
                </tr></thead>
                <tbody>
                  {metrics.perCaja.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={t.td}>{c.nombre}</td>
                      <td style={t.td}><span style={{ color: c.abierta ? theme.colors.primary : theme.colors.textMuted }}>{c.abierta ? 'Abierta' : 'Cerrada'}</span></td>
                      <td style={t.td}>{c.total_ventas}</td>
                      <td style={{ ...t.td, fontWeight:600, color: theme.colors.primary }}>${$clp(c.ingresos)}</td>
                      <td style={t.td}>{c.total_sesiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...card, padding:20 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Métricas por Cajero</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                <thead><tr style={{ background: theme.colors.surfaceHover }}>
                  <th style={t.th}>Cajero</th><th style={t.th}>Ventas</th><th style={t.th}>Ticket</th><th style={t.th}>Total</th><th style={t.th}>Sesiones</th>
                </tr></thead>
                <tbody>
                  {filteredCajeros.map(u => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                      <td style={t.td}><strong>{u.nombre_completo}</strong></td>
                      <td style={t.td}>{u.total_ventas}</td>
                      <td style={t.td}>${$clp(u.ticket_promedio)}</td>
                      <td style={{ ...t.td, fontWeight:600, color: theme.colors.info }}>${$clp(u.ingresos)}</td>
                      <td style={t.td}>{u.total_sesiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...card, padding:20 }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Sesiones Activas</h3>
              {filteredSesiones.length === 0 ? (
                <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Sin sesiones activas</p>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
                  <thead><tr style={{ background: theme.colors.surfaceHover }}>
                    <th style={t.th}>Cajero</th><th style={t.th}>Caja</th><th style={t.th}>Inicio</th>
                  </tr></thead>
                  <tbody>
                    {filteredSesiones.map(s => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                        <td style={t.td}>{s.nombre_completo}</td>
                        <td style={t.td}>{s.caja_nombre}</td>
                        <td style={t.td}>{s.inicio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}