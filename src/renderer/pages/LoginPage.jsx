import React, { useState } from 'react';
import { theme, input as inputStyle } from '../styles/theme';
import NexbitLogo from '../components/NexbitLogo';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await window.nexbit.login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
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
        <button type="submit" style={{
          width:'100%', padding:'11px', background: '#FF4B00', color:'#fff',
          border:'none', borderRadius: theme.radius.md, fontSize: theme.font.sizeBase,
          cursor:'pointer', fontWeight:600, transition:'opacity 0.15s',
        }}>Iniciar Sesión</button>
        <p style={{ textAlign:'center', marginTop:16, fontSize: theme.font.sizeXs, color: theme.colors.textMuted }}>
          Demo: admin / admin123
        </p>
      </form>
    </div>
  );
}
