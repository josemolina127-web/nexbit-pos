import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle, table as t, badge } from '../styles/theme';

const ALL_PERMISSIONS = [
  { key: 'realizar_ventas', label: 'Realizar ventas' },
  { key: 'anular_ventas', label: 'Anular ventas' },
  { key: 'aplicar_descuentos', label: 'Aplicar descuentos' },
  { key: 'corte_caja', label: 'Corte de caja' },
  { key: 'gestionar_productos', label: 'Gestionar productos' },
  { key: 'realizar_entradas', label: 'Entradas de inventario' },
  { key: 'ajustar_stock', label: 'Ajustar stock' },
  { key: 'ver_reportes', label: 'Ver reportes' },
  { key: 'gestionar_usuarios', label: 'Gestionar usuarios' },
  { key: 'cobrar_deudas', label: 'Cobrar deudas' },
  { key: 'ver_auditoria', label: 'Ver auditoría' },
  { key: 'realizar_devoluciones', label: 'Realizar devoluciones' },
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nombre_usuario: '', nombre_completo: '', password: '', rol: 'cajero', permisos: {} });

  useEffect(() => { load(); }, []);

  const load = () => window.nexbit.getUsers().then(setUsers);

  const handleSubmit = async () => {
    if (editingId) {
      await window.nexbit.updateUser(editingId, { nombre_completo: form.nombre_completo, rol: form.rol, password: form.password || undefined, permisos: form.permisos });
    } else {
      await window.nexbit.createUser(form);
    }
    setShowForm(false); setEditingId(null); setForm({ nombre_usuario: '', nombre_completo: '', password: '', rol: 'cajero', permisos: {} }); load();
  };

  const defaultPerms = (rol) => {
    const perms = {};
    for (const p of ALL_PERMISSIONS) {
      if (rol === 'admin') perms[p.key] = true;
      else if (rol === 'gerente') perms[p.key] = !['gestionar_usuarios'].includes(p.key);
      else perms[p.key] = ['realizar_ventas'].includes(p.key);
    }
    return perms;
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Usuarios</h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Gestión de usuarios y permisos</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ nombre_usuario: '', nombre_completo: '', password: '', rol: 'cajero', permisos: defaultPerms('cajero') }); setShowForm(true); }} style={{ ...btn.base, ...btn.primary }}>+ Nuevo Usuario</button>
      </div>

      {showForm && (
        <div style={{ ...card, padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Usuario *</label><input disabled={!!editingId} value={form.nombre_usuario} onChange={e => setForm({...form, nombre_usuario: e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Nombre completo *</label><input value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Contraseña {editingId ? '(opcional)' : '*'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={inputStyle.base} /></div>
            <div><label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Rol</label>
              <select value={form.rol} onChange={e => { const newPerms = defaultPerms(e.target.value); setForm({...form, rol: e.target.value, permisos: newPerms }); }} style={inputStyle.base}>
                <option value="admin">Admin</option><option value="gerente">Gerente</option><option value="cajero">Cajero</option>
              </select>
            </div>
          </div>
          <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Permisos</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {ALL_PERMISSIONS.map(p => (
              <label key={p.key} style={{ display:'flex', alignItems:'center', gap:6, fontSize: theme.font.sizeSm, cursor:'pointer', color: theme.colors.textSecondary }}>
                <input type="checkbox" checked={form.permisos[p.key] || false} onChange={e => setForm({...form, permisos: {...form.permisos, [p.key]: e.target.checked }})} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ marginTop:16, display:'flex', gap:8 }}>
            <button onClick={handleSubmit} style={{ ...btn.base, ...btn.primary }}>{editingId ? 'Guardar' : 'Crear'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={t.wrapper}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeSm }}>
          <thead><tr><th style={t.th}>Usuario</th><th style={t.th}>Nombre</th><th style={t.th}>Rol</th><th style={t.th}>Estado</th><th style={t.th}>Acciones</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={{ ...t.td, fontWeight:600 }}>{u.nombre_usuario}</td>
                <td style={t.td}>{u.nombre_completo}</td>
                <td style={t.td}><span style={badge(u.rol === 'admin' ? 'danger' : u.rol === 'gerente' ? 'info' : 'success')}>{u.rol}</span></td>
                <td style={t.td}><span style={{ color: u.activo ? theme.colors.primary : theme.colors.danger, fontWeight:600 }}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td style={t.td}>
                  <button onClick={async () => { const perms = await window.nexbit.getUserPermissionsByUser(u.id); setEditingId(u.id); setForm({ nombre_usuario: u.nombre_usuario, nombre_completo: u.nombre_completo, password: '', rol: u.rol, permisos: perms }); setShowForm(true); }} style={{ ...btn.base, background: theme.colors.infoLight, color: theme.colors.info, padding:'4px 10px', fontSize: theme.font.sizeXs }}>Editar</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color: theme.colors.textMuted }}>Sin usuarios registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
