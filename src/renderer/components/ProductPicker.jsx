import React, { useMemo, useState } from 'react';
import { theme, input as inputStyle } from '../styles/theme';
import { $clp } from '../utils/format';

// Buscador de producto estilo POS: input que filtra y dropdown de resultados.
// multiple=false -> onChange(id|null); multiple=true -> onChange([ids]).
// excludeIds: productos que no deben aparecer (ej. ya asignados).
export default function ProductPicker({ products, value, onChange, multiple = false, excludeIds, placeholder }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const arr = multiple ? (value || []) : (value ? [value] : []);
    return products.filter(p => arr.includes(p.id));
  }, [products, value, multiple]);

  const matches = useMemo(() => {
    const ex = new Set(excludeIds || []);
    const ql = q.trim().toLowerCase();
    return products.filter(p =>
      !ex.has(p.id) &&
      !selected.some(s => s.id === p.id) &&
      (!ql || p.nombre?.toLowerCase().includes(ql) || (p.codigo_barras && p.codigo_barras.includes(ql)))
    ).slice(0, 12);
  }, [products, q, excludeIds, selected]);

  const pick = (id) => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
    } else {
      onChange(id === value ? null : id);
    }
    setQ('');
  };

  return (
    <div style={{ position: 'relative' }}>
      <input style={inputStyle.base} placeholder={placeholder || 'Buscar producto...'} value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {selected.map(p => (
            <span key={p.id} style={{ background: theme.colors.primaryLight, color: theme.colors.primaryDark, padding: '2px 8px', borderRadius: theme.radius.full, fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {p.nombre}
              <span onClick={() => pick(p.id)} style={{ cursor: 'pointer', fontWeight: 700 }}>✕</span>
            </span>
          ))}
        </div>
      )}
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, boxShadow: theme.shadow.lg, zIndex: 50, maxHeight: 200, overflow: 'auto', marginTop: 4 }}>
          {matches.map(p => (
            <div key={p.id} onMouseDown={() => pick(p.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm, background: theme.colors.surface }}>
              <span style={{ color: theme.colors.text }}>{p.nombre}{p.codigo_barras && <span style={{ color: theme.colors.textMuted, marginLeft: 4 }}>· {p.codigo_barras}</span>}</span>
              <span style={{ color: theme.colors.primary, fontWeight: 600 }}>${$clp(p.precio_venta)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
