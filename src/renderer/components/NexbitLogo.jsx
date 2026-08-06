import React from 'react';

export default function NexbitLogo({ size = 28, style }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, ...style }}>
      <span style={{ color: 'var(--text)' }}>NEXT</span>
      <span style={{ color: '#FF4B00' }}>BYTE</span>
    </span>
  );
}
