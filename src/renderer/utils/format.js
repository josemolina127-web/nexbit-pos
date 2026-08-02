export function $clp(n) {
  return Math.round(n || 0).toLocaleString('es-CL');
}

export function $stock(n, unit) {
  const v = Number(n) || 0;
  if (!unit || unit === 'pieza' || unit === 'unidad') return String(Math.round(v));
  return String(Math.round(v * 1000) / 1000);
}
