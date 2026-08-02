import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { theme, card, btn, input as inputStyle, badge, useTheme } from '../styles/theme';
import { $clp } from '../utils/format';
import NexbitLogo from './NexbitLogo';

const S = ({ children }) => (
  <svg viewBox="0 0 20 20" style={{ width:18, height:18, display:'block', flexShrink:0, fill:'none', stroke:'currentColor', strokeWidth:1.5, strokeLinecap:'round', strokeLinejoin:'round' }}>{children}</svg>
);

const icons = {
  inicio: <S><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></S>,
  pos: <S><circle cx="13" cy="17" r="1.5"/><path d="M2 3h2l2 8h9l1-4H6"/></S>,
  historial: <S><path d="M4 2v16l3-2 3 2 3-2 3 2V2Z"/><path d="M7 7h6M7 10h6"/></S>,
  devoluciones: <S><path d="M5 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1"/><path d="M10 6v5"/><path d="M7 9l3 3 3-3"/></S>,
  productos: <S><path d="M3 6l7-4 7 4v8l-7 4-7-4Z"/><path d="M3 6l7 4 7-4"/><path d="M10 10v8"/></S>,
  inventario: <S><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 10h6M7 13h4"/></S>,
  proveedores: <S><path d="M2 6h16v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6z"/><path d="M6 3l4-2 4 2"/><circle cx="7" cy="12" r="1.5"/><circle cx="13" cy="12" r="1.5"/></S>,
  clientes: <S><circle cx="10" cy="7" r="3"/><path d="M4 18v-1a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1"/></S>,
  reportes: <S><path d="M4 12h4v6H4z"/><path d="M10 9h4v9h-4z"/><path d="M16 6h4v12h-4z"/></S>,
  caja: <S><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M10 16V8M7 11l3-3 3 3"/></S>,
  usuarios: <S><circle cx="9" cy="6" r="2.5"/><path d="M3 17v-1a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1"/></S>,
  auditoria: <S><path d="M12 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6Z"/><path d="M10 9h3M10 12h3M7 9h.01M7 12h.01"/></S>,
  configuracion: <S><circle cx="10" cy="10" r="2.5"/><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.7 4.3l-1.4 1.4M5.7 14.3L4.3 15.7M15.7 15.7l-1.4-1.4M5.7 5.7L4.3 4.3"/></S>,
  metricas: <S><circle cx="10" cy="3" r="2"/><path d="M3 17v-4h4v4zM9 17V9h4v8zM15 17V5h4v12z"/></S>,
};

const menuItems = [
  { path: '/', label: 'Inicio', icon: icons.inicio, perm: null },
  { path: '/pos', label: 'POS', icon: icons.pos, perm: 'realizar_ventas' },
  { path: '/historial', label: 'Mis Ventas', icon: icons.historial, perm: null },
  { path: '/devoluciones', label: 'Devoluciones', icon: icons.devoluciones, perm: 'realizar_devoluciones' },
  { path: '/productos', label: 'Productos', icon: icons.productos, perm: 'gestionar_productos' },
  { path: '/inventario', label: 'Inventario', icon: icons.inventario, perm: 'realizar_entradas' },
  { path: '/proveedores', label: 'Proveedores', icon: icons.proveedores, perm: 'gestionar_productos' },
  { path: '/clientes', label: 'Clientes', icon: icons.clientes, perm: null },
  { path: '/reportes', label: 'Reportes', icon: icons.reportes, perm: 'ver_reportes' },
  { path: '/caja', label: 'Corte Caja', icon: icons.caja, perm: 'corte_caja' },
  { path: '/metricas', label: 'Métricas', icon: icons.metricas, perm: 'corte_caja' },
  { path: '/usuarios', label: 'Usuarios', icon: icons.usuarios, perm: 'gestionar_usuarios' },
  { path: '/auditoria', label: 'Auditoría', icon: icons.auditoria, perm: 'ver_auditoria' },
  { path: '/promociones', label: 'Promociones y Cupones', icon: icons.metricas, perm: 'gestionar_productos' },
  { path: '/configuracion', label: 'Config', icon: icons.configuracion, perm: null },
];

export default function Layout({ children, user, plan, onLogout, cajaName, onCajaSelect }) {
  const [permissions, setPermissions] = useState({});
  const [showCajaModal, setShowCajaModal] = useState(false);
  const [allCajas, setAllCajas] = useState([]);
  const [selectedCajaForOpen, setSelectedCajaForOpen] = useState(null);
  const [openAmount, setOpenAmount] = useState('');
  const [lastCierre, setLastCierre] = useState(null);
  const [cajaModalStep, setCajaModalStep] = useState('list');
  const { isDark, toggleTheme } = useTheme();
  const isMock = window.nexbit?.__isMock;
  const isAdmin = user?.rol === 'admin';

  const openCajaModal = async () => {
    if (isAdmin) {
      const cajas = await window.nexbit.getAllCajasWithStatus();
      setAllCajas(cajas);
    } else {
      const cajas = await window.nexbit.getAvailableCajas();
      setAllCajas(cajas.map(c => ({ ...c, abierta: false })));
    }
    setCajaModalStep('list');
    setShowCajaModal(true);
  };

  const joinCaja = async (caja) => {
    try {
      const r = await window.nexbit.joinCajaSession({ caja_id: caja.id });
      onCajaSelect({ ...caja, sesionId: r.id });
      setShowCajaModal(false);
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    window.nexbit.getUserPermissions().then(setPermissions);
  }, []);

  const visibleItems = menuItems.filter(item => {
    if (item.path === '/usuarios' && plan !== 'pro') return false;
    if (!item.perm) return true;
    return permissions[item.perm];
  });

  return (
    <div style={{ display:'flex', height:'100vh', background: theme.colors.background, fontFamily: theme.font.sans }}>
      <aside style={{
        width: 220, background: theme.colors.sidebarBg, display:'flex', flexDirection:'column',
        borderRight: `1px solid ${theme.colors.border}`, flexShrink: 0,
        backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
      }}>
        <div style={{ padding:'20px 16px', borderBottom: `1px solid ${theme.colors.border}` }}>
          <NexbitLogo size={22} />
          <div style={{ fontSize:'0.6rem', color: theme.colors.sidebarText, marginTop:4, letterSpacing:'0.05em' }}>PUNTO DE VENTA</div>
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {visibleItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} style={{ textDecoration:'none', color:'inherit' }}>
              {({ isActive }) => (
                <div style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
                  margin:'1px 8px', borderRadius: theme.radius.md,
                  color: isActive ? theme.colors.sidebarActive : theme.colors.sidebarText,
                  background: isActive ? theme.colors.sidebarActiveBg : 'transparent',
                  fontSize: theme.font.sizeBase, fontWeight: isActive ? 500 : 400,
                  transition:'all 0.15s ease',
                }}>
                  <span style={{ width:20, textAlign:'center', color: isActive ? theme.colors.sidebarActive : theme.colors.sidebarText, lineHeight:0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{
          padding:'14px 16px', borderTop: `1px solid ${theme.colors.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.text, fontWeight:500 }}>{user?.nombre_completo}</div>
            <span style={badge(user?.rol === 'admin' ? 'warning' : user?.rol === 'gerente' ? 'info' : 'default')}>
              {user?.rol}
            </span>
            {cajaName === 'Sin caja' ? (
              <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.warning, marginTop:2, cursor:'pointer' }} onClick={openCajaModal}>➕ Seleccionar caja</div>
            ) : cajaName && (
              <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.sidebarActive, marginTop:2 }}>📍 {cajaName}</div>
            )}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={toggleTheme} title={isDark ? 'Modo claro' : 'Modo oscuro'} style={{
              padding:'6px 8px', borderRadius: theme.radius.md, background: theme.colors.surfaceHover,
              border:'none', color: theme.colors.textSecondary, cursor:'pointer', fontSize:'0.85rem',
              transition:'all 0.15s',
            }}>{isDark ? '☀️' : '🌙'}</button>
            <button onClick={onLogout} style={{
              padding:'6px 10px', borderRadius: theme.radius.md, background: theme.colors.surfaceHover,
              border:'none', color: theme.colors.textSecondary, cursor:'pointer', fontSize:'0.75rem',
              transition:'all 0.15s',
            }}>Salir</button>
          </div>
        </div>
      </aside>

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', color: 'var(--text)' }}>
        {cajaName === 'Sin caja' ? (
          <div style={{
            padding:'6px 20px', fontSize:'0.8rem', fontWeight:600,
            background: theme.colors.warningLight, color: theme.colors.warning,
            textAlign:'center', borderBottom: `1px solid ${theme.colors.border}`,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }} onClick={openCajaModal}>
            ⚠ Sin caja seleccionada — haga clic para seleccionar una
          </div>
        ) : cajaName && (
          <div style={{
            padding:'6px 20px', fontSize:'0.9rem', fontWeight:700,
            background: theme.colors.primary, color:'#fff',
            textAlign:'center', letterSpacing:'0.03em',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            📍 {cajaName}
          </div>
        )}
        {isMock && (
          <div style={{
            background: theme.colors.warningLight, color: theme.colors.warning,
            padding:'6px 16px', fontSize:'0.75rem', textAlign:'center',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            Modo desarrollo — datos de prueba. Los cambios no persisten.
          </div>
        )}
        <div style={{ flex:1, overflow:'auto', padding:'24px 28px' }}>
          {children}
        </div>
      </main>

      {showCajaModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000,
        }} onClick={() => setShowCajaModal(false)}>
          <div style={{ ...card, width:420, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom: `1px solid ${theme.colors.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text, margin:0 }}>
                {cajaModalStep === 'open' ? 'Abrir Caja' : 'Seleccionar Caja'}
              </h3>
              <button onClick={() => { setShowCajaModal(false); setCajaModalStep('list'); setSelectedCajaForOpen(null); }} style={btn.icon}>✕</button>
            </div>
            <div style={{ padding:16 }}>
              {cajaModalStep === 'open' && selectedCajaForOpen ? (
                <div>
                  <p style={{ fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.text, marginBottom:12 }}>
                    Abrir <strong>{selectedCajaForOpen.nombre}</strong>
                  </p>
                  {lastCierre && (
                    <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:12, padding:'8px 10px', background: theme.colors.surfaceHover, borderRadius: theme.radius.md }}>
                      Último cierre: <strong style={{ color: theme.colors.primary }}>${$clp(lastCierre.monto_final)}</strong>
                      {lastCierre.fecha_cierre && <span> — {new Date(lastCierre.fecha_cierre).toLocaleString('es-CL')}</span>}
                    </div>
                  )}
                  {lastCierre && openAmount && parseFloat(openAmount) !== lastCierre.monto_final && (
                    <div style={{ fontSize:'0.6rem', color: theme.colors.danger, marginBottom:8, padding:'6px 8px', background: theme.colors.dangerLight, borderRadius: theme.radius.sm }}>
                      ⚠ El monto inicial debe coincidir con el último cierre (${$clp(lastCierre.monto_final)})
                    </div>
                  )}
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Monto inicial</label>
                  <input type="number" value={openAmount} onChange={e => setOpenAmount(e.target.value)} style={inputStyle.base} placeholder="0" autoFocus />
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
                    <button onClick={() => { setCajaModalStep('list'); setSelectedCajaForOpen(null); setOpenAmount(''); setLastCierre(null); }} style={{ ...btn.base, ...btn.ghost }}>Cancelar</button>
                    <button onClick={() => {
                      const amt = parseFloat(openAmount) || 0;
                      if (lastCierre && amt !== lastCierre.monto_final) return;
                      onCajaSelect(selectedCajaForOpen, amt); setShowCajaModal(false); setCajaModalStep('list'); setSelectedCajaForOpen(null); setOpenAmount(''); setLastCierre(null);
                    }} style={{ ...(lastCierre && (parseFloat(openAmount) || 0) !== lastCierre.monto_final ? { ...btn.base, opacity:0.5 } : { ...btn.base, ...btn.primary }) }}>Abrir Caja</button>
                  </div>
                </div>
              ) : allCajas.length === 0 ? (
                <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, textAlign:'center', padding:20 }}>No hay cajas disponibles</p>
              ) : (
                <div>
                  {isAdmin && allCajas.some(c => c.abierta) && (
                    <div style={{ marginBottom:16 }}>
                      <p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Cajas abiertas</p>
                      {allCajas.filter(c => c.abierta).map(c => (
                        <button key={c.id} onClick={() => joinCaja(c)} style={{
                          ...card, padding:'12px 16px', cursor:'pointer', textAlign:'left', border: `1px solid ${theme.colors.primary}`, marginBottom:8,
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          background: 'var(--surface)', transition:'all 0.15s', width:'100%',
                        }}>
                          <div>
                            <span style={{ fontWeight:600, color: theme.colors.text }}>{c.nombre}</span>
                            <div style={{ fontSize:'0.6rem', color: theme.colors.textMuted, marginTop:2 }}>
                              {c.sesiones_count} usuario{c.sesiones_count !== 1 ? 's' : ''} — {c.corte?.monto_ventas ? `$${$clp(c.corte.monto_ventas)} en ventas` : 'Sin ventas'}
                            </div>
                          </div>
                          <span style={{ fontSize:'0.65rem', color: theme.colors.primary, padding:'3px 8px', borderRadius: theme.radius.full, background: theme.colors.primaryLight }}>Unirse</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Cajas cerradas</p>
                    {allCajas.filter(c => !c.abierta).length === 0 ? (
                      <p style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, textAlign:'center', padding:12 }}>No hay cajas cerradas</p>
                    ) : allCajas.filter(c => !c.abierta).map(c => (
                      <button key={c.id} onClick={() => { setSelectedCajaForOpen(c); setCajaModalStep('open'); window.nexbit.getCashRegisterHistory({ caja_id: c.id }).then(h => setLastCierre(h[0] || null)); }} style={{
                        ...card, padding:'12px 16px', cursor:'pointer', textAlign:'left', border: `1px solid ${theme.colors.border}`, marginBottom:8,
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        background: 'var(--surface)', transition:'all 0.15s', width:'100%',
                      }}>
                        <span style={{ fontWeight:600, color: theme.colors.text }}>{c.nombre}</span>
                        <span style={{ fontSize:'1.2rem', color: theme.colors.primary }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
