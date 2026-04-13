/**
 * PrivateRoute — Protección de rutas basada en rol real del backend.
 *
 * Lee el rol desde AuthContext (obtenido del servidor), NO desde sessionStorage.
 * Esto impide que alguien eleve su rol desde la consola del navegador (F12).
 */
import { Navigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';

function PrivateRoute({ children, requiredRoles = [ROLES.ADMIN_RH, ROLES.ADMIN_AREA], requiredDepartment = null }) {
  const { user, userRole, userDepartamento, loading } = useAuth();

  // Mientras el AuthContext verifica la sesión con el backend, mostrar spinner
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8f9fa'
      }}>
        <div className="text-center">
          <div className="spinner-border text-success mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Verificando sesión...</span>
          </div>
          <p className="text-muted fw-semibold">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Sin sesión → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rol o Departamento insuficiente
  const hasRole = userRole && requiredRoles.includes(userRole);
  const hasDept = requiredDepartment && userDepartamento === requiredDepartment;

  if (!hasRole && !hasDept) {
    // Evitar bucles infinitos: Si ya estamos en /empleado/portal o /admin/dashboard, mostramos un error simple
    const isPortal = window.location.pathname.startsWith('/empleado/portal');
    const isAdmin = window.location.pathname.startsWith('/admin/');
    
    if (isPortal || (isAdmin && ['super_admin', 'director', 'admin_rh', 'admin_area'].includes(userRole))) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <h4>⛔ Acceso Denegado: No cuentas con el rol o departamento requerido para este módulo.</h4>
        </div>
      );
    }
    
    // Si tiene perfil de admin y está perdido, al dashboard. Si no, al portal.
    if (['super_admin', 'director', 'admin_rh', 'admin_area'].includes(userRole)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/empleado/portal" replace />;
  }

  return children;
}

export default PrivateRoute;
