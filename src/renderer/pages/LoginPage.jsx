import React, { useEffect, useState } from 'react';
import { theme, input as inputStyle } from '../styles/theme';
import NexbitLogo from '../components/NexbitLogo';
import { WHATSAPP_URL_PRO, WHATSAPP_URL_CAJAS } from '../utils/whatsapp';

export default function LoginPage({ onLogin, plan }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [retryIn, setRetryIn] = useState(0);
  const isBasic = !plan || plan === 'demo' || plan === 'basic';

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn(retryIn - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  const fmt = (s) => {
    const mm = String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0');
    const ss = String(Math.max(0, s) % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await window.nexbit.login(username, password);
      onLogin(user);
    } catch (err) {
      const msg = (err && err.message) || '';
      const m = msg.match(/(\d+)\s*(segundos|minutos)/);
      if (/l[ií]mite/.test(msg)) {
        setRetryIn(m ? (m[2] === 'minutos' ? +m[1] * 60 : +m[1]) : 300);
        setError('Has alcanzado el límite de intentos de inicio de sesión permitido.');
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    }
  };

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: theme.colors.surface, padding:44, borderRadius: theme.radius.xl,
        boxShadow: theme.shadow.xl, width:380,
        border: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <NexbitLogo size={32} style={{ display:'inline-block' }} />
          <p style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeSm, marginTop:8 }}>
            Inicia sesión para continuar
          </p>
        </div>
        {error && (
          <div style={{ background: theme.colors.dangerLight, color: theme.colors.danger, padding:'10px 14px', borderRadius: theme.radius.md, marginBottom:16, fontSize: theme.font.sizeSm, textAlign:'center' }}>
            {error}
            {retryIn > 0 && (
              <div style={{ fontWeight:700, marginTop:6, fontSize: theme.font.sizeBase }}>
                Reintento en {fmt(retryIn)}
              </div>
            )}
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', marginBottom:6, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, fontWeight:500 }}>Usuario</label>
          <input autoFocus value={username} onChange={e => setUsername(e.target.value)} style={inputStyle.base} placeholder="Ingresa tu usuario" />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ display:'block', marginBottom:6, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, fontWeight:500 }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle.base} placeholder="Ingresa tu contraseña" />
        </div>
        <button type="submit" disabled={retryIn > 0} style={{
          width:'100%', padding:'11px', background: retryIn > 0 ? theme.colors.border : '#FF4B00', color:'#fff',
          border:'none', borderRadius: theme.radius.md, fontSize: theme.font.sizeBase,
          cursor: retryIn > 0 ? 'not-allowed' : 'pointer', fontWeight:600, transition:'opacity 0.15s',
        }}>Iniciar Sesión</button>
        <p style={{ textAlign:'center', marginTop:16, fontSize: theme.font.sizeXs, color: theme.colors.textMuted }}>
          {isBasic ? (
            <>¿Plan básico?{' '}
              <a href={WHATSAPP_URL_PRO} target="_blank" rel="noreferrer" style={{ color: theme.colors.primary, textDecoration:'none', fontWeight:600 }}>Sube a Pro</a>
            </>
          ) : (
            <>¿Necesitas más cajas?{' '}
              <a href={WHATSAPP_URL_CAJAS} target="_blank" rel="noreferrer" style={{ color: theme.colors.primary, textDecoration:'none', fontWeight:600 }}>Contacta a tu proveedor</a>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
