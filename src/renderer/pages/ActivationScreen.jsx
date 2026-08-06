import React, { useState } from 'react';
import { theme, input as inputStyle, btn } from '../styles/theme';
import NexbitLogo from '../components/NexbitLogo';

export default function ActivationScreen({ onActivated, error }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error || '');

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!code.trim()) { setErr('Ingresa tu código de licencia'); return; }
    setLoading(true); setErr('');
    try {
      const status = await window.nexbit.activateLicense(code.trim());
      onActivated(status);
    } catch (e2) {
      setErr(e2.message || 'No se pudo activar la licencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <form onSubmit={handleActivate} style={{
        background: theme.colors.surface, padding:44, borderRadius: theme.radius.xl,
        boxShadow: theme.shadow.xl, width:420, border: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{ textAlign:'center', marginBottom:8 }}>
          <NexbitLogo size={32} style={{ display:'inline-block' }} />
          <h1 style={{ fontSize: theme.font.sizeXl, fontWeight:700, margin:'16px 0 4px', color: theme.colors.text }}>Activa tu licencia</h1>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeSm }}>
            Ingresa el código que recibiste al comprar Next Byte
          </p>
        </div>
        {err && (
          <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16, fontSize: theme.font.sizeSm, textAlign:'center' }}>
            {err}
          </div>
        )}
        <div style={{ marginBottom:24 }}>
          <label style={{ display:'block', marginBottom:6, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, fontWeight:500 }}>Código de licencia</label>
          <input autoFocus value={code} onChange={e => setCode(e.target.value)} style={inputStyle.base} placeholder="Pega aquí tu código" spellCheck={false} />
        </div>
        <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, width:'100%', justifyContent:'center', padding:'12px' }}>
          {loading ? 'Activando...' : 'Activar'}
        </button>
        <p style={{ textAlign:'center', color: theme.colors.textMuted, fontSize: theme.font.sizeXs, marginTop:16 }}>
          ¿No tienes licencia? Contacta a tu proveedor.
        </p>
      </form>
    </div>
  );
}
