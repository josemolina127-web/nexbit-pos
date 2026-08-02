import React from 'react';
import { theme, card, btn } from '../styles/theme';

const proFeatures = [
  { icon: '👥', title: 'Usuarios y permisos', desc: 'Hasta 4 usuarios con roles y permisos personalizados' },
  { icon: '🖥️', title: 'Hasta 4 cajas', desc: 'Múltiples cajas simultáneas para tu negocio' },
  { icon: '🧾', title: 'Facturación electrónica SII', desc: 'Integración con Tango, F32, Simple.cl y más' },
];

export default function ProGatePage({ feature }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 40 }}>
      <div style={{ ...card, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>⭐</div>
        <h2 style={{ fontSize: theme.font.sizeXl, fontWeight: 700, color: theme.colors.text, margin: '0 0 8px' }}>
          Disponible en versión Pro
        </h2>
        <p style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, margin: '0 0 24px' }}>
          {feature
            ? `"${feature}" es parte del plan Pro.`
            : 'Estás usando el plan Básica. Mejora a Pro y desbloquea todas las herramientas.'}
        </p>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {proFeatures.map(f => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              padding: '14px 16px', borderRadius: theme.radius.lg,
              background: theme.colors.surfaceHover, border: `1px solid ${theme.colors.border}`,
            }}>
              <span style={{ fontSize: '1.4rem' }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: theme.colors.text, fontSize: theme.font.sizeBase }}>{f.title}</div>
                <div style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeSm }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.font.sizeXs, margin: 0 }}>
          Contacta a tu proveedor para contratar el plan Pro.
        </p>
      </div>
    </div>
  );
}
