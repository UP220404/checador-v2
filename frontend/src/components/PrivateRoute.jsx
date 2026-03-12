/**
 * PrivateRoute — Protección de rutas basada en rol real del backend.
 *
 * Lee el rol desde AuthContext (obtenido del servidor), NO desde sessionStorage.
 * Esto impide que alguien eleve su rol desde la consola del navegador (F12).
 */
import { Navigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';

function PrivateRoute({ children, requiredRoles = [ROLES.ADMIN_RH, ROLES.ADMIN_AREA] }) {
  const { user, userRole, loading } = useAuth();

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

  // Rol insuficiente → portal de empleado
  if (!requiredRoles.includes(userRole)) {
    return <Navigate to="/empleado/portal" replace />;
  }

  return children;
}

export default PrivateRoute;
