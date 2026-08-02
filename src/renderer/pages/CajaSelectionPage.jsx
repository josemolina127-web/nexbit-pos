import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle } from '../styles/theme';
import { $clp } from '../utils/format';
import NexbitLogo from '../components/NexbitLogo';

export default function CajaSelectionPage({ user, onSelect, onLogout, canSkip }) {
  const [step, setStep] = useState('select'); // select | oldDayClose | openCaja | done
  const [available, setAvailable] = useState([]);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [closeAmount, setCloseAmount] = useState('');
  const [closeObs, setCloseObs] = useState('');
  const [lastCierre, setLastCierre] = useState(null);

  const refreshAvailable = () => {
    window.nexbit.getAvailableCajas().then(setAvailable);
  };

  useEffect(() => {
    window.nexbit.getAvailableCajas().then(setAvailable);
  }, []);

  useEffect(() => {
    if (step === 'select') refreshAvailable();
  }, [step]);

  const todayLocal = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };
  const isOldDay = (fecha) => {
    if (!fecha) return false;
    return fecha.substring(0, 10) < todayLocal();
  };

  const handleSelect = async (caja) => {
    setSelectedCaja(caja);
    setError('');
    const st = await window.nexbit.getCajaStatus(caja.id);
    setStatus(st);
    if (st && isOldDay(st.fecha_apertura)) {
      setStep('oldDayClose');
    } else if (!st) {
      window.nexbit.getCashRegisterHistory({ caja_id: caja.id }).then(h => setLastCierre(h[0] || null));
      setStep('openCaja');
    } else {
      await doStartSession(caja);
    }
  };

  const doStartSession = async (caja) => {
    setError('');
    try {
      const result = await window.nexbit.startSession({ caja_id: caja.id, usuario_id: user.id });
      onSelect({ ...caja, sesionId: result.id });
    } catch (e) {
      setError(e.message);
      setStep('select');
    }
  };

  const handleOldDayClose = async () => {
    if (!closeAmount) return;
    setError('');
    try {
      await window.nexbit.closeCashRegister({ id: status.id, monto_final: parseFloat(closeAmount), observaciones: closeObs || 'Cierre forzado día anterior' });
      setStatus(null);
      const history = await window.nexbit.getCashRegisterHistory({ caja_id: selectedCaja.id });
      setLastCierre(history[0] || null);
      setStep('openCaja');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleOpenCaja = async () => {
    if (!initialAmount) return;
    if (lastCierre && parseFloat(initialAmount) !== lastCierre.monto_final) {
      setError(`El monto inicial debe coincidir con el último cierre ($${$clp(lastCierre.monto_final)})`);
      return;
    }
    setError('');
    try {
      await window.nexbit.openCashRegister({ monto_inicial: parseFloat(initialAmount), caja_id: selectedCaja.id });
      await doStartSession(selectedCaja);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background: 'var(--bg)', padding:20 }}>
      <div style={{ maxWidth:480, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <NexbitLogo size={36} style={{ marginBottom:12 }} />
          <h1 style={{ fontSize: theme.font.sizeXl, fontWeight:700, color: theme.colors.text, margin:0 }}>
            {step === 'select' ? 'Seleccionar Caja' : selectedCaja?.nombre}
          </h1>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:4 }}>
            {user.nombre_completo} — {user.rol}
          </p>
        </div>

        {error && (
          <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16, fontSize: theme.font.sizeSm, textAlign:'center' }}>{error}</div>
        )}

        {step === 'select' && (
          <div style={{ marginBottom:12, display:'flex', gap:8 }}>
            <button onClick={onLogout} style={{ ...btn.base, ...btn.ghost, padding:'6px 12px', fontSize: theme.font.sizeSm }}>← Volver</button>
            <button onClick={refreshAvailable} style={{ ...btn.base, ...btn.ghost, padding:'6px 12px', fontSize: theme.font.sizeSm }}>🔄 Refrescar</button>
            {canSkip && <button onClick={() => onSelect({ id: null, nombre: 'Sin caja' })} style={{ ...btn.base, ...btn.ghost, padding:'6px 12px', fontSize: theme.font.sizeSm, color: theme.colors.primary, marginLeft:'auto' }}>Omitir selección</button>}
          </div>
        )}
        {step === 'select' && (
          available.length === 0 ? (
            <div style={{ ...card, padding:32, textAlign:'center' }}>
              <p style={{ fontSize:'1.5rem', marginBottom:8 }}>🔒</p>
              <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textMuted, marginBottom:16 }}>No hay cajas disponibles en este momento.</p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <button onClick={onLogout} style={{ ...btn.base, ...btn.ghost, padding:'8px 20px' }}>← Volver al login</button>
                {canSkip && <button onClick={() => onSelect({ id: null, nombre: 'Sin caja' })} style={{ ...btn.base, ...btn.primary, padding:'8px 20px' }}>Continuar sin caja →</button>}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {available.map(c => (
                <button key={c.id} onClick={() => handleSelect(c)} style={{ ...card, padding:20, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', border: `1px solid ${theme.colors.border}`, background: 'var(--surface)', transition:'all 0.15s' }}>
                  <div>
                    <div style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>{c.nombre}</div>
                  </div>
                  <span style={{ fontSize:'1.5rem', color: theme.colors.primary }}>→</span>
                </button>
              ))}
            </div>
          )
        )}

        {step === 'oldDayClose' && (
          <div style={{ ...card, padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <span style={{ fontSize:'1.3rem' }}>⚠️</span>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.danger, margin:0 }}>Caja abierta desde ayer</h3>
            </div>
            <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:16 }}>
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Abierta:</strong> {status.fecha_apertura}</p>
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Fondo inicial:</strong> ${$clp(status.monto_inicial)}</p>
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Ventas acumuladas:</strong> ${$clp(status.monto_ventas)}</p>
              <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Último usuario:</strong> {status.nombre_completo || status.nombre_usuario || '—'}</p>
            </div>
            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.danger, marginBottom:12, fontWeight:500 }}>Debe cerrar la caja del día anterior antes de continuar.</p>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Monto final real</label>
            <input type="number" style={{ ...inputStyle.base, padding:'10px', fontSize: theme.font.sizeLg, marginBottom:8 }} value={closeAmount} onChange={e => setCloseAmount(e.target.value)} placeholder="0.00" />
            <input style={{ ...inputStyle.base, padding:'10px', marginBottom:16 }} value={closeObs} onChange={e => setCloseObs(e.target.value)} placeholder="Observaciones (opcional)" />
            <button style={{ ...btn.base, background: theme.colors.danger, color:'#fff', padding:'10px 24px', width:'100%' }} onClick={handleOldDayClose}>Cerrar Caja Anterior</button>
            <button style={{ ...btn.base, ...btn.ghost, padding:'10px 24px', width:'100%', marginTop:8 }} onClick={() => setStep('select')}>Cancelar</button>
          </div>
        )}

        {step === 'openCaja' && (
          <div style={{ ...card, padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <span style={{ fontSize:'1.3rem' }}>🔓</span>
              <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text, margin:0 }}>Abrir {selectedCaja?.nombre}</h3>
            </div>
            <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:12 }}>La caja está cerrada. Ingrese el monto inicial para abrirla.</p>
            {lastCierre && (
              <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:12, padding:'8px 10px', background: theme.colors.surfaceHover, borderRadius: theme.radius.md }}>
                Último cierre: <strong style={{ color: theme.colors.primary }}>${$clp(lastCierre.monto_final)}</strong>
                {lastCierre.fecha_cierre && <span> — {new Date(lastCierre.fecha_cierre).toLocaleString('es-CL')}</span>}
              </div>
            )}
            {lastCierre && initialAmount && parseFloat(initialAmount) !== lastCierre.monto_final && (
              <div style={{ fontSize:'0.65rem', color: theme.colors.danger, marginBottom:8, padding:'6px 8px', background: theme.colors.dangerLight, borderRadius: theme.radius.sm }}>
                ⚠ El monto inicial debe coincidir con el último cierre (${$clp(lastCierre.monto_final)})
              </div>
            )}
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, display:'block', marginBottom:4 }}>Monto inicial</label>
            <input type="number" autoFocus style={{ ...inputStyle.base, padding:'10px', fontSize: theme.font.sizeLg, marginBottom:16 }} value={initialAmount} onChange={e => setInitialAmount(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleOpenCaja()} />
            <button style={{ ...btn.base, ...btn.primary, padding:'10px 24px', width:'100%', opacity: (lastCierre && initialAmount && parseFloat(initialAmount) !== lastCierre.monto_final) ? 0.5 : 1 }} onClick={handleOpenCaja} disabled={lastCierre && initialAmount && parseFloat(initialAmount) !== lastCierre.monto_final}>Abrir Caja y Continuar</button>
            <button style={{ ...btn.base, ...btn.ghost, padding:'10px 24px', width:'100%', marginTop:8 }} onClick={() => setStep('select')}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}