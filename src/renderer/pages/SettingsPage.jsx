import React, { useEffect, useState } from 'react';
import { theme, card, btn, input as inputStyle, table as t } from '../styles/theme';
import { $clp } from '../utils/format';

export default function SettingsPage() {
  const [scaleConfig, setScaleConfig] = useState({ port: 'COM1', protocol: 'rs232' });
  const [license, setLicense] = useState(null);
  const [saved, setSaved] = useState(false);
  const [siiConfig, setSiiConfig] = useState({ enabled: false, proveedor: 'tango', api_key: '', rut_empresa: '', razon_social: '', giro: '', direccion_sii: '', comuna: '', resolvedor: 'sii', printer: '', auto_print: true });
  const [printerConfig, setPrinterConfig] = useState({ enabled: true, printer: '', auto_print: true });
  const [siiSaved, setSiiSaved] = useState(false);
  const [printerSaved, setPrinterSaved] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [boletas, setBoletas] = useState([]);
  const [showBoletas, setShowBoletas] = useState(false);
  const [licCode, setLicCode] = useState('');
  const [licMsg, setLicMsg] = useState('');
  const [licErr, setLicErr] = useState('');
  const [licLoading, setLicLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupErr, setBackupErr] = useState('');
  const version = license?.plan || 'basic';
  const isPremium = version === 'pro' || version === 'multi';

  useEffect(() => {
    window.nexbit.getScaleConfig().then(setScaleConfig);
    window.nexbit.getLicenseStatus().then(l => setLicense(l || { activated: false }));
    window.nexbit.getSiiConfig().then(setSiiConfig);
    window.nexbit.getPrinterConfig().then(setPrinterConfig);
    window.nexbit.getPrinters().then(setPrinters);
  }, []);

  const loadBoletas = () => {
    window.nexbit.getBoletasEmitidas().then(setBoletas);
  };

  useEffect(() => {
    if (isPremium) loadBoletas();
  }, [version]);

  const handleSave = async () => {
    await window.nexbit.configureScale(scaleConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize: theme.font.size2xl, fontWeight:700, color: theme.colors.text, margin:0 }}>Configuración</h1>
        <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop:2 }}>Ajustes del sistema</p>
      </div>

      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Licencia del Sistema</h3>
        {license?.activated ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12 }}>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Plan</label>
              <div style={{ fontSize: theme.font.sizeBase, fontWeight:700, color: ['pro','multi'].includes(license.plan) ? theme.colors.primary : theme.colors.text }}>
                {license.plan === 'multi' ? '🖥️ Multi-Cajas' : license.plan === 'pro' ? '⭐ Pro' : '📦 Básica'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Cliente</label>
              <div style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>{license.cliente}</div>
            </div>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Licencia N°</label>
              <div style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>{license.lic}</div>
            </div>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Límites</label>
              <div style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>{license.max_cajas} cajas · {license.max_usuarios} usuarios</div>
            </div>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Vigencia</label>
              <div style={{ fontSize: theme.font.sizeBase, fontWeight:600, color: theme.colors.text }}>
                {license.expira ? `Hasta ${license.expira}` : 'De por vida'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: theme.colors.danger, fontSize: theme.font.sizeSm }}>
            Sin licencia activada. Contacta a tu proveedor.
          </div>
        )}

        <div style={{ borderTop: `1px solid ${theme.colors.border}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={licCode}
              onChange={e => { setLicCode(e.target.value); setLicMsg(''); setLicErr(''); }}
              style={{ ...inputStyle.base, flex: 1, fontFamily: 'monospace', fontSize: theme.font.sizeXs }}
              placeholder="Pega aquí un código de licencia para actualizar el plan (renovación, upgrade, etc.)"
              spellCheck={false}
            />
            <button
              disabled={licLoading || !licCode.trim()}
              onClick={async () => {
                setLicLoading(true); setLicMsg(''); setLicErr('');
                try {
                  const st = await window.nexbit.activateLicense(licCode.trim());
                  setLicense(st);
                  setLicMsg(`Licencia ${st.lic} activada: ${st.plan === 'multi' ? 'Multi-Cajas' : st.plan === 'pro' ? 'Pro' : 'Básica'}${st.expira ? ` hasta ${st.expira}` : ' de por vida'}`);
                  setLicCode('');
                } catch (e2) {
                  setLicErr(e2.message || 'No se pudo activar la licencia');
                } finally {
                  setLicLoading(false);
                }
              }}
              style={{ ...btn.base, ...btn.primary, whiteSpace: 'nowrap' }}
            >
              {licLoading ? 'Aplicando...' : 'Aplicar licencia'}
            </button>
          </div>
          {licMsg && <div style={{ color: theme.colors.primary, fontSize: theme.font.sizeXs }}>{licMsg}</div>}
          {licErr && <div style={{ color: theme.colors.danger, fontSize: theme.font.sizeXs }}>{licErr}</div>}
        </div>
      </div>

      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Báscula Electrónica</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          <div>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Puerto</label>
            <select value={scaleConfig.port} onChange={e => setScaleConfig({...scaleConfig, port: e.target.value})} style={inputStyle.base}>
              {['COM1','COM2','COM3','COM4','USB'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Protocolo</label>
            <select value={scaleConfig.protocol} onChange={e => setScaleConfig({...scaleConfig, protocol: e.target.value})} style={inputStyle.base}>
              <option value="rs232">RS-232</option>
              <option value="usb_hid">USB HID</option>
            </select>
          </div>
        </div>
        <button onClick={handleSave} style={{ ...btn.base, ...btn.primary, marginTop:16 }}>
          {saved ? '✓ Guardado' : 'Guardar Configuración'}
        </button>
      </div>

      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>
          Impresora
          {printerConfig.enabled && <span style={{ fontSize:'0.6rem', background: theme.colors.primary, color:'#fff', padding:'2px 8px', borderRadius:10, marginLeft:8, verticalAlign:'middle' }}>ACTIVA</span>}
        </h3>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize: theme.font.sizeSm, color: theme.colors.text }}>
            <input type="checkbox" checked={printerConfig.enabled} onChange={e => setPrinterConfig({...printerConfig, enabled: e.target.checked})} style={{ width:18, height:18, accentColor: theme.colors.primary }} />
            Habilitar impresora
          </label>
        </div>
        {printerConfig.enabled && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
            <div>
              <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Impresora</label>
              <select value={printerConfig.printer} onChange={e => setPrinterConfig({...printerConfig, printer: e.target.value})} style={inputStyle.base}>
                <option value="">Seleccionar impresora...</option>
                {printers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'end', paddingBottom:4 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize: theme.font.sizeSm, color: theme.colors.text }}>
                <input type="checkbox" checked={printerConfig.auto_print} onChange={e => setPrinterConfig({...printerConfig, auto_print: e.target.checked})} style={{ width:16, height:16, accentColor: theme.colors.primary }} />
                Imprimir ticket al cobrar
              </label>
            </div>
            <div style={{ display:'flex', alignItems:'end' }}>
              <button onClick={async () => { await window.nexbit.printTicket({ test: true, printer: printerConfig.printer }); }} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'6px 14px', fontSize: theme.font.sizeXs }} disabled={!printerConfig.printer}>
                Probar impresión
              </button>
            </div>
          </div>
        )}
        <button onClick={async () => { await window.nexbit.setPrinterConfig(printerConfig); setPrinterSaved(true); setTimeout(() => setPrinterSaved(false), 2000); }} style={{ ...btn.base, ...btn.primary, marginTop:16 }}>
          {printerSaved ? '✓ Guardado' : 'Guardar Configuración Impresora'}
        </button>
      </div>

      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>
          SII / Facturación Electrónica
          <span style={{ fontSize:'0.6rem', background: theme.colors.primary, color:'#fff', padding:'2px 8px', borderRadius:10, marginLeft:8, verticalAlign:'middle' }}>PRO</span>
        </h3>
        {!isPremium && (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px 14px', background: theme.colors.primaryLight, borderRadius: theme.radius.md }}>
            <span style={{ fontSize:'1.2rem' }}>⭐</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.primary }}>Exclusivo del plan Pro</div>
              <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary }}>Mejora a Pro para emitir boletas electrónicas e integrarte con el SII.</div>
            </div>
          </div>
        )}
        <div style={!isPremium ? { opacity: 0.45, pointerEvents: 'none', userSelect: 'none' } : undefined}>
          <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize: theme.font.sizeSm, color: theme.colors.text }}>
              <input type="checkbox" checked={siiConfig.enabled} onChange={e => setSiiConfig({...siiConfig, enabled: e.target.checked})} style={{ width:18, height:18, accentColor: theme.colors.primary }} />
              Habilitar integración con SII
            </label>
          </div>
          {siiConfig.enabled && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Proveedor DTE</label>
                  <select value={siiConfig.proveedor} onChange={e => setSiiConfig({...siiConfig, proveedor: e.target.value})} style={inputStyle.base}>
                    <option value="tango">Tango Factura</option>
                    <option value="f32">F32 / eFactura</option>
                    <option value="simple">Simple.cl</option>
                    <option value="siigo">Siigo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>API Key / Token</label>
                  <input type="password" value={siiConfig.api_key} onChange={e => setSiiConfig({...siiConfig, api_key: e.target.value})} style={inputStyle.base} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Resolvedor</label>
                  <select value={siiConfig.resolvedor} onChange={e => setSiiConfig({...siiConfig, resolvedor: e.target.value})} style={inputStyle.base}>
                    <option value="sii">SII (Producción)</option>
                    <option value="sii_maullin">SII Maullín (Certificación)</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>RUT Empresa</label>
                  <input value={siiConfig.rut_empresa} onChange={e => setSiiConfig({...siiConfig, rut_empresa: e.target.value})} style={inputStyle.base} placeholder="76.123.456-7" />
                </div>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Razón Social</label>
                  <input value={siiConfig.razon_social} onChange={e => setSiiConfig({...siiConfig, razon_social: e.target.value})} style={inputStyle.base} placeholder="Nombre empresa" />
                </div>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Giro</label>
                  <input value={siiConfig.giro} onChange={e => setSiiConfig({...siiConfig, giro: e.target.value})} style={inputStyle.base} placeholder="Venta al por menor" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Dirección (SII)</label>
                  <input value={siiConfig.direccion_sii} onChange={e => setSiiConfig({...siiConfig, direccion_sii: e.target.value})} style={inputStyle.base} placeholder="Dirección comercial" />
                </div>
                <div>
                  <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Comuna</label>
                  <input value={siiConfig.comuna} onChange={e => setSiiConfig({...siiConfig, comuna: e.target.value})} style={inputStyle.base} placeholder="Santiago" />
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${theme.colors.border}`, paddingTop:16, marginTop:4, marginBottom:12 }}>
                <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:12, color: theme.colors.text }}>Impresora de Boletas</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                  <div>
                    <label style={{ fontSize: theme.font.sizeXs, color: theme.colors.textMuted, marginBottom:4, display:'block' }}>Impresora</label>
                    <select value={siiConfig.printer} onChange={e => setSiiConfig({...siiConfig, printer: e.target.value})} style={inputStyle.base}>
                      <option value="">Seleccionar impresora...</option>
                      {printers.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', alignItems:'end', paddingBottom:4 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize: theme.font.sizeSm, color: theme.colors.text }}>
                      <input type="checkbox" checked={siiConfig.auto_print} onChange={e => setSiiConfig({...siiConfig, auto_print: e.target.checked})} style={{ width:16, height:16, accentColor: theme.colors.primary }} />
                      Imprimir automáticamente al cerrar venta
                    </label>
                  </div>
                  <div style={{ display:'flex', alignItems:'end' }}>
                    <button onClick={async () => { await window.nexbit.printTicket({ test: true, printer: siiConfig.printer }); }} style={{ ...btn.base, background: theme.colors.primaryLight, color: theme.colors.primary, padding:'6px 14px', fontSize: theme.font.sizeXs }} disabled={!siiConfig.printer}>
                      Probar impresión
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={async () => { await window.nexbit.setSiiConfig(siiConfig); setSiiSaved(true); setTimeout(() => setSiiSaved(false), 2000); }} style={{ ...btn.base, ...btn.primary }}>
              {siiSaved ? '✓ Configuración guardada' : 'Guardar Configuración SII'}
            </button>
            {siiConfig.enabled && (
              <button onClick={() => { setShowBoletas(!showBoletas); if (!showBoletas) loadBoletas(); }} style={{ ...btn.base, ...btn.ghost }}>
                {showBoletas ? 'Ocultar' : 'Ver'} boletas emitidas ({boletas.length})
              </button>
            )}
          </div>
          {siiConfig.enabled && showBoletas && (
            <div style={{ marginTop:16 }}>
              <h4 style={{ fontSize: theme.font.sizeSm, fontWeight:600, marginBottom:8, color: theme.colors.text }}>Registro de boletas emitidas</h4>
              <div style={t.wrapper}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: theme.font.sizeXs }}>
                  <thead><tr>
                    <th style={t.th}>Folio</th><th style={t.th}>Tipo</th><th style={t.th}>Total</th><th style={t.th}>RUT</th><th style={t.th}>Razón Social</th><th style={t.th}>Fecha</th>
                  </tr></thead>
                  <tbody>
                    {boletas.map(b => (
                      <tr key={b.id} style={{ borderBottom:`1px solid ${theme.colors.border}` }}>
                        <td style={t.td}>{b.folio}</td>
                        <td style={t.td}>{b.tipo_dte === '33' ? 'Factura' : 'Boleta'}</td>
                        <td style={t.td}>${$clp(b.total)}</td>
                        <td style={{ ...t.td, fontSize:'0.6rem' }}>{b.rut_cliente || '-'}</td>
                        <td style={t.td}>{b.razon_social_cliente || '-'}</td>
                        <td style={{ ...t.td, fontSize:'0.6rem' }}>{b.created_at ? new Date(b.created_at).toLocaleString('es-CL') : '-'}</td>
                      </tr>
                    ))}
                    {boletas.length === 0 && (
                      <tr><td colSpan={6} style={{ padding:12, textAlign:'center', color: theme.colors.textMuted }}>No hay boletas emitidas aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {siiConfig.enabled && (
            <p style={{ marginTop:12, fontSize: theme.font.sizeXs, color: theme.colors.textMuted, fontStyle:'italic' }}>
              La integración se activará al cerrar una venta. Si el proveedor responde correctamente, se generará el DTE y se imprimirá la boleta automáticamente.
            </p>
          )}
        </div>
      </div>

      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>
          Respaldo de Base de Datos
          <span style={{ fontSize:'0.6rem', background: theme.colors.primary, color:'#fff', padding:'2px 8px', borderRadius:10, marginLeft:8, verticalAlign:'middle' }}>PRO</span>
        </h3>
        {!isPremium && (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px 14px', background: theme.colors.primaryLight, borderRadius: theme.radius.md }}>
            <span style={{ fontSize:'1.2rem' }}>⭐</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize: theme.font.sizeSm, fontWeight:600, color: theme.colors.primary }}>Exclusivo del plan Pro</div>
              <div style={{ fontSize: theme.font.sizeXs, color: theme.colors.textSecondary }}>Mejora a Pro para respaldar tu base de datos fácilmente.</div>
            </div>
          </div>
        )}
        <div style={!isPremium ? { opacity: 0.45, pointerEvents: 'none', userSelect: 'none' } : undefined}>
          <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginBottom:12 }}>
            Crea una copia de seguridad de toda tu información (productos, ventas, clientes) en la carpeta o disco que elijas. Se recomienda respaldar a diario, preferentemente una vez al día al cierre.
          </p>
          <button
            disabled={backingUp}
            onClick={async () => {
              setBackingUp(true); setBackupMsg(''); setBackupErr('');
              try {
                const r = await window.nexbit.backupDatabase();
                if (r.canceled) return;
                setBackupMsg(`Respaldo creado correctamente en: ${r.path}`);
              } catch (e2) {
                setBackupErr(e2.message || 'No se pudo crear el respaldo');
              } finally {
                setBackingUp(false);
              }
            }}
            style={{ ...btn.base, ...btn.primary }}
          >
            {backingUp ? 'Respaldando...' : '💾 Respaldar base de datos'}
          </button>
          {backupMsg && <div style={{ color: theme.colors.primary, fontSize: theme.font.sizeXs, marginTop:8 }}>{backupMsg}</div>}
          {backupErr && <div style={{ color: theme.colors.danger, fontSize: theme.font.sizeXs, marginTop:8 }}>{backupErr}</div>}
        </div>
      </div>

      <div style={{ ...card, padding:20 }}>
        <h3 style={{ fontSize: theme.font.sizeBase, fontWeight:600, marginBottom:16, color: theme.colors.text }}>Información del Sistema</h3>
        <div style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>
          <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Nombre:</strong> Next Byte</p>
          <p style={{ marginBottom:4 }}><strong style={{ color: theme.colors.text }}>Versión:</strong> 1.0.0</p>
          <p><strong style={{ color: theme.colors.text }}>Plataforma:</strong> Windows Desktop (Electron)</p>
        </div>
      </div>
    </div>
  );
}
