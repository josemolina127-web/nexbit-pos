import React, { useState } from 'react';
import { theme, input as inputStyle, btn } from '../src/renderer/styles/theme';
import { WHATSAPP_URL } from '../src/renderer/utils/whatsapp';

// Instalador estilo WordPress: licencia -> BD -> admin -> usuarios (opcional) -> cajas -> POS
export default function InstallerWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [licCode, setLicCode] = useState('');
  const [licInfo, setLicInfo] = useState(null);

  const [db, setDb] = useState({ host: 'localhost', name: '', user: '', pass: '' });
  const [admin, setAdmin] = useState({ usuario: '', nombre: '', password: '' });
  const [users, setUsers] = useState([{ nombre: '', usuario: '', password: '', rol: 'cajero' }]);
  const [cajas, setCajas] = useState(['Caja Principal']);

  const stepTitles = ['Licencia', 'Base de datos', 'Usuario admin', 'Más usuarios (opcional)', 'Cajas (POS)', '¡Listo!'];
  const fail = (e) => { setError(e?.error || e?.message || String(e)); setBusy(false); };

  const run = async (fn) => { setError(''); setMsg(''); setBusy(true); try { await fn(); setBusy(false); } catch (e) { fail(e); } };

  const checkLicense = () => run(async () => {
    const info = await window.nexbit.installCheckLicense(licCode.trim());
    setLicInfo(info);
    setMsg(`Licencia válida. Plan ${info.plan} · ${info.max_cajas} cajas · ${info.max_usuarios} usuarios.`);
    setStep(1);
  });

  const applyDb = () => run(async () => {
    if (!db.host || !db.name || !db.user) throw { message: 'Completa host, nombre y usuario de la base de datos' };
    await window.nexbit.installTestDb(db);
    await window.nexbit.installApplyDb(db);
    await window.nexbit.installSaveLicense(licCode.trim());
    setMsg('Conexión exitosa. Estructura creada y licencia guardada.');
    setStep(2);
  });

  const createAdmin = () => run(async () => {
    if (!admin.usuario || !admin.password) throw { message: 'Ingresa usuario y contraseña del admin' };
    await window.nexbit.installCreateAdmin(admin);
    setStep(3);
  });

  const saveUsers = () => run(async () => {
    const validos = users.filter((u) => u.usuario.trim());
    if (validos.length) await window.nexbit.installCreateUsers(validos);
    setStep(4);
  });

  const createCajas = () => run(async () => {
    if (!cajas.map((c) => c.trim()).filter(Boolean).length) throw { message: 'Crea al menos una caja' };
    await window.nexbit.installCreateCajas(cajas);
    setStep(5);
  });

  const finish = async () => {
    await onDone({ usuario: admin.usuario, password: admin.password });
  };

  const input = { ...inputStyle.base, width: '100%', marginBottom: 12 };
  const cardMain = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#050505', color: '#fff', fontFamily: theme.font.sans, padding: 24,
  };
  const card = { background: '#101014', border: '1px solid #26262b', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520 };

  return (
    <div style={cardMain}>
      <div style={card}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Next Byte — Instalación</div>
          <div style={{ fontSize: 12, color: '#8a8a93', marginTop: 4 }}>Paso {step + 1} de {stepTitles.length}: {stepTitles[step]}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {stepTitles.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? theme.colors.primary : '#2a2a2e' }} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Ingresa el código de licencia que recibiste por correo. Es obligatorio para continuar.
            </div>
            <input value={licCode} onChange={(e) => setLicCode(e.target.value)} placeholder="multi:4:10:CLIENTE:xxxxxx" style={{ ...input, fontFamily: 'monospace' }} />
            <button style={{ ...btn.base, ...btn.primary, width: '100%' }} disabled={busy || !licCode.trim()} onClick={checkLicense}>{busy ? 'Verificando...' : 'Validar licencia'}</button>
            <div style={{ fontSize: 12, color: '#8a8a93', marginTop: 14, textAlign: 'center' }}>
              ¿No tienes licencia?{' '}
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" style={{ color: theme.colors.primary, textDecoration: 'none', fontWeight: 600 }}>
                Contacta a tu proveedor
              </a>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Datos de tu base de datos MySQL (la creas en el panel de tu hosting, igual que WordPress). La estructura se crea automáticamente.
            </div>
            <input value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} placeholder="Servidor MySQL (ej: localhost)" style={input} />
            <input value={db.name} onChange={(e) => setDb({ ...db, name: e.target.value })} placeholder="Nombre de la base de datos" style={input} />
            <input value={db.user} onChange={(e) => setDb({ ...db, user: e.target.value })} placeholder="Usuario MySQL" style={input} />
            <input type="password" value={db.pass} onChange={(e) => setDb({ ...db, pass: e.target.value })} placeholder="Contraseña MySQL" style={input} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn.base, ...btn.ghost, flex: 1 }} disabled={busy} onClick={() => setStep(0)}>Atrás</button>
              <button style={{ ...btn.base, ...btn.primary, flex: 1 }} disabled={busy} onClick={applyDb}>{busy ? 'Conectando...' : 'Conectar y crear estructura'}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Crea el usuario administrador del sistema. Es obligatorio.
            </div>
            <input value={admin.usuario} onChange={(e) => setAdmin({ ...admin, usuario: e.target.value })} placeholder="Usuario (ej: admin)" style={input} />
            <input value={admin.nombre} onChange={(e) => setAdmin({ ...admin, nombre: e.target.value })} placeholder="Nombre completo" style={input} />
            <input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} placeholder="Contraseña" style={input} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn.base, ...btn.ghost, flex: 1 }} disabled={busy} onClick={() => setStep(1)}>Atrás</button>
              <button style={{ ...btn.base, ...btn.primary, flex: 1 }} disabled={busy} onClick={createAdmin}>{busy ? 'Creando...' : 'Crear admin'}</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Opcional: agrega otros usuarios (cajeros o gerentes). Puedes omitirlo y crearlos después desde Configuración → Usuarios.
            </div>
            {users.map((u, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={u.usuario} onChange={(e) => { const x = [...users]; x[i].usuario = e.target.value; setUsers(x); }} placeholder="Usuario" style={{ ...inputStyle.base, flex: 1 }} />
                <input type="password" value={u.password} onChange={(e) => { const x = [...users]; x[i].password = e.target.value; setUsers(x); }} placeholder="Contraseña" style={{ ...inputStyle.base, flex: 1 }} />
                <select value={u.rol} onChange={(e) => { const x = [...users]; x[i].rol = e.target.value; setUsers(x); }} style={{ ...inputStyle.base, width: 110 }}>
                  <option value="cajero">Cajero</option><option value="gerente">Gerente</option>
                </select>
              </div>
            ))}
            <button style={{ ...btn.base, ...btn.ghost, marginBottom: 12 }} onClick={() => setUsers([...users, { nombre: '', usuario: '', password: '', rol: 'cajero' }])}>+ Agregar usuario</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn.base, ...btn.ghost, flex: 1 }} disabled={busy} onClick={() => setStep(2)}>Atrás</button>
              <button style={{ ...btn.base, ...btn.primary, flex: 1 }} disabled={busy} onClick={saveUsers}>{busy ? 'Guardando...' : 'Continuar'}</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Crea las cajas físicas de tu negocio. La primera es obligatoria; las demás opcionales. Deja vacío un campo para no crear esa caja.
            </div>
            {cajas.map((c, i) => (
              <input key={i} value={c} onChange={(e) => { const x = [...cajas]; x[i] = e.target.value; setCajas(x); }} placeholder={`Caja ${i + 1}`} style={input} />
            ))}
            <button style={{ ...btn.base, ...btn.ghost, marginBottom: 12 }} onClick={() => setCajas([...cajas, ''])}>+ Agregar caja</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn.base, ...btn.ghost, flex: 1 }} disabled={busy} onClick={() => setStep(3)}>Atrás</button>
              <button style={{ ...btn.base, ...btn.primary, flex: 1 }} disabled={busy} onClick={createCajas}>{busy ? 'Creando...' : 'Crear cajas'}</button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div style={{ fontSize: 14, color: '#b9b9c2', marginBottom: 16 }}>
              Instalación completada. Entra al sistema con el usuario admin que creaste.
            </div>
            {msg && <div style={{ fontSize: 12, color: '#7ee787', marginBottom: 12 }}>{msg}</div>}
            <button style={{ ...btn.base, ...btn.primary, width: '100%' }} onClick={finish}>Entrar al POS →</button>
          </>
        )}

        {error && <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 12, background: 'rgba(255,107,107,0.08)', padding: '8px 10px', borderRadius: 8 }}>{error}</div>}
        {msg && step < 5 && <div style={{ fontSize: 12, color: '#7ee787', marginTop: 12 }}>{msg}</div>}
      </div>
    </div>
  );
}