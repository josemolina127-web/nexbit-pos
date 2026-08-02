import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle, table as t } from '../styles/theme';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ desde: '', hasta: '' });

  useEffect(() => { load(); }, []);

  const load = () => window.nexbit.getAuditLog(filters).then(setLogs);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Auditoría</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Registro de actividades del sistema</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'end' }}>
          <div>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Desde</label>
            <input type="date" value={filters.desde} onChange={e => setFilters({...filters, desde: e.target.value})} style={{ ...inputStyle.base, width:160 }} />
          </div>
          <div>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:2, display:'block' }}>Hasta</label>
            <input type="date" value={filters.hasta} onChange={e => setFilters({...filters, hasta: e.target.value})} style={{ ...inputStyle.base, width:160 }} />
          </div>
          <button style={{ ...btn.base, ...btn.primary }} onClick={load}>Filtrar</button>
        </div>
      </div>

      <div style={{ ...card, overflow:'auto', maxHeight:'calc(100vh - 200px)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
          <thead><tr style={{ background: theme.colors.surfaceHover, position:'sticky', top:0 }}><th style={t.th}>Fecha</th><th style={t.th}>Usuario</th><th style={t.th}>Acción</th><th style={t.th}>Detalle</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={t.td}>{l.created_at}</td>
                <td style={{ ...t.td, fontWeight:600 }}>{l.nombre_usuario || 'Sistema'}</td>
                <td style={t.td}><span style={{ background: theme.colors.infoLight, color: theme.colors.info, padding:'2px 8px', borderRadius: theme.radius.full, fontSize: theme.font.sizeXs }}>{l.accion}</span></td>
                <td style={t.td}>{l.detalle}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin registros de auditoría</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
