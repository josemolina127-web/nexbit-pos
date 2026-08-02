import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Nexbit Error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#fff', minHeight: '100vh' }}>
          <h1 style={{ color: '#e74c3c' }}>Error al cargar Nexbit</h1>
          <p style={{ color: '#aaa' }}>{this.state.error.message}</p>
          <pre style={{ background: '#333', padding: 16, borderRadius: 8, marginTop: 16, fontSize: '0.8rem', overflow: 'auto', maxHeight: '60vh' }}>
            {this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 24px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '1rem' }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
