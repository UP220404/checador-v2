/**
 * Componente que muestra el banner de departamento para admin_area
 * y proporciona informacion del rol actual
 */

import { useAuth } from '../contexts/AuthContext';

import { ROLES } from '../config/constants';
export { ROLES };

function DepartmentBanner() {
  const { userRole, userDepartamento } = useAuth();

  // Solo mostrar para admin_area
  if (userRole !== ROLES.ADMIN_AREA || !userDepartamento) {
    return null;
  }

  return (
    <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
      <i className="bi bi-building me-3" style={{ fontSize: '1.5rem' }}></i>
      <div>
        <strong>Vista de Departamento:</strong> {userDepartamento}
        <br />
        <small className="text-muted">Solo puedes ver y gestionar empleados de tu departamento</small>
      </div>
    </div>
  );
}

// Hook para obtener datos de rol
export function useRoleData() {
  const { userRole = ROLES.EMPLEADO, userDepartamento = '' } = useAuth();

  const isSuperUser = [ROLES.ADMIN_RH, ROLES.SUPER_ADMIN, ROLES.DIRECTOR].includes(userRole);

  return {
    userRole,
    userDepartamento,
    isAdminRH: isSuperUser,
    isAdminArea: userRole === ROLES.ADMIN_AREA,
    isEmpleado: userRole === ROLES.EMPLEADO,
    canSeeAllData: isSuperUser,
    departmentFilter: userRole === ROLES.ADMIN_AREA ? userDepartamento : null
  };
}

export default DepartmentBanner;
