import { useState, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

function Retardos() {
  const { isAdminArea, userDepartamento } = useRoleData();

  const [filters, setFilters] = useState({
    busqueda: '',
    startDate: '',
    endDate: ''
  });

  const { data: retardosData = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['retardsSummary', filters.startDate, filters.endDate],
    queryFn: async () => {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const response = await api.getRetardsSummary(params);
      return response.data?.data || [];
    }
  });

  const retardos = useMemo(() => retardosData, [retardosData]);

  const filteredRetardos = useMemo(() => {
    if (!filters.busqueda) return retardos;
    return retardos.filter(r =>
      r.nombre?.toLowerCase().includes(filters.busqueda.toLowerCase()) ||
      r.email?.toLowerCase().includes(filters.busqueda.toLowerCase())
    );
  }, [retardos, filters.busqueda]);

  const totalRetardosGeneral = useMemo(() =>
    filteredRetardos.reduce((sum, r) => sum + r.totalRetardos, 0),
    [filteredRetardos]
  );

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const limpiarFiltros = () => {
    setFilters({ busqueda: '', startDate: '', endDate: '' });
  };

  const exportarCSV = () => {
    const headers = ['Nombre', 'Email', 'Departamento', 'Total Retardos'];
    const csvContent = [
      headers.join(','),
      ...filteredRetardos.map(r => [
        r.nombre || '',
        r.email || '',
        r.departamento || '',
        r.totalRetardos
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retardos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getRetardosBadgeColor = (total) => {
    if (total === 0) return 'success';
    if (total <= 3) return 'warning';
    return 'danger';
  };

  return (
    <AdminLayout>
      <div style={{ padding: '0 1rem' }}>
        <div className="section-header">
          <h2>
            <i className="bi bi-clock-history me-2"></i>
            Retardos por Empleado
          </h2>
          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-outline-success" onClick={exportarCSV}>
              <i className="bi bi-file-earmark-excel me-2"></i>
              Exportar CSV
            </button>
            <button className="btn btn-outline-secondary" onClick={() => refetch()}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Actualizar
            </button>
          </div>
        </div>

        <DepartmentBanner />

        {/* Filtros */}
        <div className="filter-bar mb-3 p-3 rounded-3 shadow-sm" style={{ background: '#f8f9fa' }}>
          <div className="row g-2 mb-2">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o email..."
                value={filters.busqueda}
                onChange={(e) => handleFilterChange('busqueda', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                title="Fecha inicio"
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                title="Fecha fin"
              />
            </div>
            <div className="col-md-1">
              <button className="btn btn-outline-secondary w-100" onClick={limpiarFiltros} title="Limpiar filtros">
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </div>
          <div className="text-muted small">
            <i className="bi bi-info-circle me-1"></i>
            {isAdminArea ? `Departamento: ${userDepartamento}` : 'Todos los departamentos'} — {filteredRetardos.length} empleados | Total retardos: {totalRetardosGeneral}
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="row mb-3 g-3">
          <div className="col-md-3">
            <div className="card p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-danger d-flex align-items-center justify-content-center me-3" style={{ width: 48, height: 48 }}>
                  <i className="bi bi-exclamation-triangle text-white"></i>
                </div>
                <div>
                  <div className="text-muted small">Total Retardos</div>
                  <h4 className="mb-0">{totalRetardosGeneral}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-warning d-flex align-items-center justify-content-center me-3" style={{ width: 48, height: 48 }}>
                  <i className="bi bi-people text-white"></i>
                </div>
                <div>
                  <div className="text-muted small">Empleados con Retardos</div>
                  <h4 className="mb-0">{filteredRetardos.length}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-info d-flex align-items-center justify-content-center me-3" style={{ width: 48, height: 48 }}>
                  <i className="bi bi-calculator text-white"></i>
                </div>
                <div>
                  <div className="text-muted small">Promedio por Empleado</div>
                  <h4 className="mb-0">
                    {filteredRetardos.length > 0
                      ? (totalRetardosGeneral / filteredRetardos.length).toFixed(1)
                      : '0'}
                  </h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-success d-flex align-items-center justify-content-center me-3" style={{ width: 48, height: 48 }}>
                  <i className="bi bi-check-circle text-white"></i>
                </div>
                <div>
                  <div className="text-muted small">Máximo Retardos</div>
                  <h4 className="mb-0">
                    {filteredRetardos.length > 0
                      ? Math.max(...filteredRetardos.map(r => r.totalRetardos))
                      : '0'}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive rounded-3 shadow-sm">
            <table className="table table-hover align-middle">
              <thead className="table-success">
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Departamento</th>
                  <th className="text-center">Total Retardos</th>
                  <th className="text-center">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filteredRetardos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      <i className="bi bi-inbox display-4"></i>
                      <p className="mt-2">No hay retardos registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredRetardos.map((item, index) => (
                    <tr key={item.uid}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.nombre}</strong>
                      </td>
                      <td className="text-muted">{item.email}</td>
                      <td>
                        <span className="badge bg-secondary">{item.departamento || 'Sin depto'}</span>
                      </td>
                      <td className="text-center">
                        <span className={`badge bg-${getRetardosBadgeColor(item.totalRetardos)} fs-6`}>
                          {item.totalRetardos}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="text-muted small">
                          {item.retardos.length > 0
                            ? `Último: ${item.retardos[item.retardos.length - 1].fecha}`
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Retardos;
