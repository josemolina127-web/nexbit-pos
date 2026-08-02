import React, { useEffect, useState } from 'react';
import { theme, card, cardBody, btn, badge, input as inputStyle, table as t } from '../styles/theme';
import { exportClients } from '../utils/exportCsv';
import { $clp } from '../utils/format';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre:'', telefono:'', correo:'', direccion:'' });
  const [debtView, setDebtView] = useState(null);
  const [payDialog, setPayDialog] = useState(null);

  useEffect(() => { load(); }, []);

  const load = () => window.nexbit.getClients().then(setClients);

  const handleSubmit = async () => {
    await window.nexbit.createClient(form);
    setShowForm(false); setForm({ nombre:'', telefono:'', correo:'', direccion:'' }); load();
  };

  const filtered = clients.filter(c => !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.telefono && c.telefono.includes(search)));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Clientes</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>{clients.length} clientes registrados</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input style={{ ...inputStyle.base, width:240 }} placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => exportClients(clients)} style={{ ...btn.base, ...btn.secondary }}>📥 CSV</button>
          <button onClick={() => { setForm({ nombre:'', telefono:'', correo:'', direccion:'' }); setShowForm(true); }} style={{ ...btn.base, ...btn.primary }}>+ Nuevo</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Nuevo Cliente</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Teléfono</label><input value={form.telefono} onChange={e => setForm({...form, telefono:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Correo</label><input value={form.correo} onChange={e => setForm({...form, correo:e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Dirección</label><input value={form.direccion} onChange={e => setForm({...form, direccion:e.target.value})} style={inputStyle.base} /></div>
          </div>
          <div style={{ marginTop:16, display:'flex', gap:8 }}>
            <button style={{ ...btn.base, ...btn.primary }} onClick={handleSubmit}>Crear</button>
            <button style={{ ...btn.base, ...btn.ghost }} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {debtView ? (
        <div>
          <button style={{ ...btn.base, ...btn.ghost, marginBottom:12 }} onClick={() => setDebtView(null)}>← Volver</button>
          <div style={{ ...card, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>{debtView.client.nombre}</h3>
                <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>Saldo pendiente: <strong style={{ color: theme.colors.warning }}>${ $clp(debtView.client.saldo_pendiente) }</strong></p>
              </div>
              {debtView.client.saldo_pendiente > 0 && (
                <button onClick={() => setPayDialog({ cliente_id: debtView.client.id, monto: debtView.client.saldo_pendiente })} style={{ ...btn.base, background: theme.colors.primary, color:'#fff' }}>Pagar deuda</button>
              )}
            </div>
            <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginTop:16, marginBottom:8, color: theme.colors.text }}>Ventas a crédito</h4>
            {debtView.ventas.map(v => (
              <div key={v.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                <span>#{v.id} — {v.fecha}</span><span style={{ fontWeight:600 }}>${ $clp(v.total) }</span>
              </div>
            ))}
            {debtView.ventas.length === 0 && <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Sin ventas a crédito</p>}
            <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginTop:12, marginBottom:8, color: theme.colors.text }}>Abonos</h4>
            {debtView.abonos.map(a => (
              <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm }}>
                <span>{a.created_at}</span><span style={{ color: theme.colors.primary, fontWeight:600 }}>-${ $clp(a.monto) }</span>
              </div>
            ))}
            {debtView.abonos.length === 0 && <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted }}>Sin abonos registrados</p>}
          </div>
        </div>
      ) : (
        <div style={t.wrapper}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
            <thead><tr><th style={t.th}>Nombre</th><th style={t.th}>Teléfono</th><th style={t.th}>Correo</th><th style={t.th}>Deuda</th><th style={t.th}>Acciones</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                  <td style={{ ...t.td, fontWeight:600 }}>{c.nombre}</td>
                  <td style={t.td}>{c.telefono || '-'}</td>
                  <td style={t.td}>{c.correo || '-'}</td>
                  <td style={{ ...t.td, fontWeight:600, color: c.saldo_pendiente > 0 ? theme.colors.warning : theme.colors.primary }}>${ $clp(c.saldo_pendiente) }</td>
                  <td style={t.td}>
                    <button style={{ ...btn.base, background: theme.colors.infoLight, color: theme.colors.info, padding:'4px 10px', fontSize: theme.font.sizeXs }} onClick={() => window.nexbit.getClientDebt(c.id).then(setDebtView)}>Ver deuda</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin clientes</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {payDialog && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000,
        }} onClick={() => setPayDialog(null)}>
          <div style={{ ...card, padding:20, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Pagar Deuda</h3>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Monto</label>
              <input type="number" value={payDialog.monto} onChange={e => setPayDialog({...payDialog, monto: parseFloat(e.target.value) || 0})} style={inputStyle.base} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setPayDialog(null)} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
              <button onClick={async () => {
                await window.nexbit.registerPayment({ cliente_id: payDialog.cliente_id, monto: payDialog.monto });
                setPayDialog(null);
                window.nexbit.getClientDebt(debtView.client.id).then(setDebtView);
              }} style={{ ...btn.base, ...btn.primary }}>Pagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
