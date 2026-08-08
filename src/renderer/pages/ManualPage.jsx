import { theme } from '../styles/theme';

export default function ManualPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: theme.font.size2xl, fontWeight: 700, color: theme.colors.text, margin: 0 }}>Manual del Cliente</h1>
        <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop: 2 }}>Guía de uso de Next Byte</p>
      </div>
      <div style={{
        background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg, overflow: 'hidden', height: '75vh',
      }}>
        <iframe src="./manual.html" title="Manual del Cliente" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
      </div>
    </div>
  );
}