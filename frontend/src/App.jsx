import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Checador from './pages/Checador';
import QRGenerator from './pages/QRGenerator';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Registros from './pages/Registros';
import Reportes from './pages/Reportes';
import Analisis from './pages/Analisis';
import Nomina from './pages/Nomina';
import Ausencias from './pages/Ausencias';
import Seguridad from './pages/Seguridad';
import Login from './pages/Login';
import PortalEmpleado from './pages/PortalEmpleado';
import Configuracion from './pages/Configuracion';
import Evaluaciones from './pages/Evaluaciones';
import Capacitacion from './pages/Capacitacion';
import Auditoria from './pages/Auditoria';
import DocumentosAdmin from './pages/DocumentosAdmin';
import EvaluacionesContrato from './pages/EvaluacionesContrato';
import Organigrama from './pages/Organigrama';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // previene llamadas innecesarias al cambiar de pestaña
      retry: 1, // solo reintenta 1 vez en caso de fallo
      staleTime: 5 * 60 * 1000, // la data se considera fresca por 5 minutos
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <Router>
        <Toaster richColors position="top-right" expand={true} />
        <Routes>
          {/* Ruta Raíz: El Checador ahora requiere estar autenticado */}
          <Route path="/" element={
            <PrivateRoute requiredRoles={['empleado', 'admin_area', 'admin_rh']}>
              <Checador />
            </PrivateRoute>
          } />
          
          {/* El Login es ahora el portal de entrada unificado */}
          <Route path="/login" element={<Login />} />

          {/* Portal del Empleado */}
          <Route path="/empleado/portal" element={
            <PrivateRoute requiredRoles={['empleado', 'admin_area', 'admin_rh']}>
              <PortalEmpleado />
            </PrivateRoute>
          } />
          
          {/* Panel Administrativo (Redirecciones manejadas por rol) */}
          <Route path="/admin/dashboard"   element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Dashboard /></PrivateRoute>} />
          <Route path="/admin/usuarios"    element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Usuarios /></PrivateRoute>} />
          <Route path="/admin/registros"   element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Registros /></PrivateRoute>} />
          <Route path="/admin/analisis"    element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Analisis /></PrivateRoute>} />
          <Route path="/admin/ausencias"   element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Ausencias /></PrivateRoute>} />
          <Route path="/admin/seguridad"   element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Seguridad /></PrivateRoute>} />
          <Route path="/admin/reportes"    element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Reportes /></PrivateRoute>} />
          <Route path="/admin/nomina"      element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Nomina /></PrivateRoute>} />
          <Route path="/admin/qr"          element={<PrivateRoute requiredRoles={['admin_rh']}><QRGenerator /></PrivateRoute>} />
          <Route path="/admin/evaluaciones"         element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Evaluaciones /></PrivateRoute>} />
          <Route path="/admin/capacitacion"         element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><Capacitacion /></PrivateRoute>} />
          <Route path="/admin/evaluaciones-contrato" element={<PrivateRoute requiredRoles={['admin_rh', 'admin_area']}><EvaluacionesContrato /></PrivateRoute>} />
          <Route path="/admin/configuracion" element={<PrivateRoute requiredRoles={['admin_rh']}><Configuracion /></PrivateRoute>} />
          <Route path="/admin/auditoria"     element={<PrivateRoute requiredRoles={['admin_rh']}><Auditoria /></PrivateRoute>} />
          <Route path="/admin/documentos"    element={<PrivateRoute requiredRoles={['admin_rh']}><DocumentosAdmin /></PrivateRoute>} />
          <Route path="/admin/organigrama"   element={<PrivateRoute requiredRoles={['admin_rh']}><Organigrama /></PrivateRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
