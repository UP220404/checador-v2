/**
 * Componente que muestra el banner de departamento para admin_area
 * y proporciona informacion del rol actual
 */

export const ROLES = {
  EMPLEADO: 'empleado',
  ADMIN_AREA: 'admin_area',
  ADMIN_RH: 'admin_rh'
};

function DepartmentBanner() {
  const userRole = sessionStorage.getItem('userRole') || ROLES.EMPLEADO;
  const userDepartamento = sessionStorage.getItem('userDepartamento') || '';

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
  const userRole = sessionStorage.getItem('userRole') || ROLES.EMPLEADO;
  const userDepartamento = sessionStorage.getItem('userDepartamento') || '';

  return {
    userRole,
    userDepartamento,
    isAdminRH: userRole === ROLES.ADMIN_RH,
    isAdminArea: userRole === ROLES.ADMIN_AREA,
    isEmpleado: userRole === ROLES.EMPLEADO,
    canSeeAllData: userRole === ROLES.ADMIN_RH,
    departmentFilter: userRole === ROLES.ADMIN_AREA ? userDepartamento : null
  };
}

export default DepartmentBanner;
