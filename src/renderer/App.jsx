import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { mockApi } from './utils/mockApi';
import LoginPage from './pages/LoginPage';
import ActivationScreen from './pages/ActivationScreen';
import CajaSelectionPage from './pages/CajaSelectionPage';
import Layout from './components/Layout';
import ProGatePage from './components/ProGatePage';
import DashboardPage from './pages/DashboardPage';
import PosPage from './pages/PosPage';
import ProductsPage from './pages/ProductsPage';
import ClientsPage from './pages/ClientsPage';
import ReportsPage from './pages/ReportsPage';
import CajaPage from './pages/CajaPage';
import MetricasPage from './pages/MetricasPage';
import InventoryPage from './pages/InventoryPage';
import ProvidersPage from './pages/ProvidersPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import DevolucionesPage from './pages/DevolucionesPage';
import PromotionsPage from './pages/PromotionsPage';

if (!window.nexbit) {
  window.nexbit = mockApi;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    window.nexbit.getLicenseStatus().then(l => {
      setLicense(l || { activated: false });
      if (l?.activated) {
        return window.nexbit.getCurrentUser().then(u => { if (u) setUser(u); });
      }
    }).catch(() => setLicense({ activated: false })).finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    console.log('handleLogout - user:', user?.id, 'selectedCaja:', selectedCaja?.nombre, 'sesionId:', selectedCaja?.sesionId);
    try {
      // 1) End session by sesion_id (if we have it)
      if (selectedCaja?.sesionId) {
        await window.nexbit.endSession({ sesion_id: selectedCaja.sesionId });
        console.log('endSession OK');
      }
      // 2) Extra safety: end ANY active session for this user
      await window.nexbit.endSessionByUser({ usuario_id: user.id });
      console.log('endSessionByUser OK');
    } catch (e) {
      console.warn('Error ending session:', e);
    }
    setUser(null);
    setSelectedCaja(null);
    try {
      await window.nexbit.logout();
    } catch (e) {
      console.warn('Error en logout:', e);
    }
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#050505', color:'#fff', fontSize:'1.2rem' }}>Cargando Nexbit...</div>;

  if (!license?.activated) return <ActivationScreen onActivated={setLicense} error={license?.error === 'otro_equipo' ? 'Esta licencia está activada en otro equipo.' : license?.error === 'expirada' ? `Tu licencia expiró el ${license.expira}. Ingresa un código de renovación.` : undefined} />;

  if (!user) return <LoginPage onLogin={setUser} />;

  if (!selectedCaja) {
    return <CajaSelectionPage user={user} onSelect={setSelectedCaja} onLogout={handleLogout} canSkip={user?.rol === 'admin'} />;
  }

  const enrichedUser = { ...user, caja_id: selectedCaja?.id || user.caja_id };

  const handleSelectCaja = async (caja, montoInicial) => {
    try {
      if (caja.sesionId) {
        setSelectedCaja({ ...caja, sesionId: caja.sesionId });
      } else {
        await window.nexbit.startSession({ caja_id: caja.id, usuario_id: user.id });
        if (montoInicial > 0) await window.nexbit.openCashRegister({ monto_inicial: montoInicial, caja_id: caja.id });
        setSelectedCaja({ ...caja, sesionId: Date.now() });
      }
    } catch (e) {
      console.warn('Error al seleccionar caja:', e);
    }
  };

  return (
    <HashRouter>
      <Layout user={enrichedUser} plan={license?.plan} onLogout={handleLogout} cajaName={selectedCaja?.nombre} onCajaSelect={handleSelectCaja}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/proveedores" element={<ProvidersPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/metricas" element={<MetricasPage />} />
          <Route path="/usuarios" element={['pro','multi'].includes(license?.plan) ? <UsersPage /> : <ProGatePage feature="Usuarios y permisos" />} />
          <Route path="/auditoria" element={['pro','multi'].includes(license?.plan) ? <AuditPage /> : <ProGatePage feature="Auditoría" />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="/historial" element={<SalesHistoryPage />} />
          <Route path="/devoluciones" element={<DevolucionesPage />} />
          <Route path="/promociones" element={['pro','multi'].includes(license?.plan) ? <PromotionsPage /> : <ProGatePage feature="Promociones y cupones" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
