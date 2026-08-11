import React from 'react';

export default function NexbitLogo({ size = 28, collapsed, style }) {
  if (collapsed) {
    return (
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, ...style }}>
        <span style={{ color: '#fff' }}>N</span>
        <span style={{ color: '#FF4B00' }}>B</span>
      </span>
    );
  }
  return (
    <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, ...style }}>
      <span style={{ color: 'var(--text)' }}>NEXT</span>
      <span style={{ color: '#FF4B00' }}>BYTE</span>
    </span>
  );
}
