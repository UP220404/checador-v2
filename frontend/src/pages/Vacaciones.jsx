import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner from '../components/DepartmentBanner';
import { api } from '../services/api';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularNivel(meses) {
  if (meses === null || meses === undefined) return { label: 'Sin fecha de ingreso', color: '#9ca3af', bg: '#f3f4f6' };
  if (meses < 6)  return { label: `Sin derecho (${meses} mes${meses !== 1 ? 'es' : ''})`,  color: '#dc2626', bg: '#fef2f2' };
  if (meses < 12) return { label: `6 meses – 1 año (${meses} meses)`, color: '#d97706', bg: '#fffbeb' };
  const anios = Math.floor(meses / 12);
  if (anios < 2)  return { label: `1 año (${meses} meses)`,  color: '#2563eb', bg: '#eff6ff' };
  return { label: `${anios} años`, color: '#059669', bg: '#ecfdf5' };
}

function BarraProgreso({ diasDisponibles, diasUsados, diasPendientes }) {
  if (diasDisponibles === 0) return (
    <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, textAlign: 'center' }}>
      Sin derecho a vacaciones
    </div>
  );
  const pctUsados   = Math.min(100, (diasUsados   / diasDisponibles) * 100);
  const pctPend     = Math.min(100 - pctUsados, (diasPendientes / diasDisponibles) * 100);
  const pctRestante = Math.max(0, 100 - pctUsados - pctPend);
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', background: '#e5e7eb', gap: 1 }}>
        {pctUsados   > 0 && <div style={{ width: `${pctUsados}%`,   background: '#ef4444', transition: 'width .5s' }} />}
        {pctPend     > 0 && <div style={{ width: `${pctPend}%`,     background: '#f59e0b', transition: 'width .5s' }} />}
        {pctRestante > 0 && <div style={{ width: `${pctRestante}%`, background: '#22c55e', transition: 'width .5s' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: 4, color: '#6b7280' }}>
        <span><span style={{ color: '#ef4444', fontWeight: 700 }}>●</span> {diasUsados} usados</span>
        {diasPendientes > 0 && <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>●</span> {diasPendientes} pend.</span>}
        <span><span style={{ color: '#22c55e', fontWeight: 700 }}>●</span> {Math.max(0, diasDisponibles - diasUsados - diasPendientes)} libres</span>
      </div>
    </div>
  );
}

// ─── Modal de ajuste manual ───────────────────────────────────────────────────

function ModalAjuste({ empleado, onClose, onSave }) {
  const [diasUsados, setDiasUsados] = useState(empleado.saldo.diasUsados);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSaldoVacaciones(empleado.id, { diasUsados: Number(diasUsados) });
      toast.success(`Saldo ajustado para ${empleado.nombre}`);
      onSave();
      onClose();
    } catch {
      toast.error('Error al guardar el ajuste');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28,
        width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)'
      }}>
        <h5 style={{ marginBottom: 4 }}>
          <i className="bi bi-pencil-square me-2 text-success" />
          Ajustar días usados
        </h5>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 20 }}>
          {empleado.nombre} · {empleado.saldo.diasDisponibles} días disponibles por antigüedad
        </p>

        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Días ya utilizados este periodo</label>
        <input
          type="number"
          className="form-control mt-1 mb-3"
          min={0}
          max={empleado.saldo.diasDisponibles}
          value={diasUsados}
          onChange={e => setDiasUsados(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function Vacaciones() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroDpto, setFiltroDpto] = useState('');
  const [ajusteEmpleado, setAjusteEmpleado] = useState(null);

  const { data: empleados = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['vacaciones-panel'],
    queryFn: async () => {
      const res = await api.getVacacionesPanel();
      return res.data?.data || [];
    },
    staleTime: 2 * 60 * 1000
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Datos actualizados');
  };

  // Recalcular saldo individual
  const mutRecalcular = useMutation({
    mutationFn: (uid) => api.recalcularSaldoVacaciones(uid),
    onSuccess: () => {
      toast.success('Saldo recalculado');
      queryClient.invalidateQueries(['vacaciones-panel']);
    },
    onError: () => toast.error('Error al recalcular')
  });

  const departamentos = [...new Set(empleados.map(e => e.departamento).filter(Boolean))].sort();

  const lista = empleados.filter(e => {
    const matchBusq = !busqueda || e.nombre?.toLowerCase().includes(busqueda.toLowerCase());
    const matchDpto = !filtroDpto || e.departamento === filtroDpto;
    return matchBusq && matchDpto;
  });

  // Estadísticas rápidas
  const sinDerecho     = empleados.filter(e => e.saldo.diasDisponibles === 0).length;
  const conDias        = empleados.filter(e => e.saldo.diasRestantes > 0 && e.saldo.diasDisponibles > 0).length;
  const agotados       = empleados.filter(e => e.saldo.diasDisponibles > 0 && e.saldo.diasRestantes <= 0).length;

  return (
    <AdminLayout>
      <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div className="page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <div>
            <h2 className="mb-1">
              <i className="bi bi-calendar-heart-fill me-2 text-success" />
              Panel de Vacaciones
            </h2>
            <p className="text-muted mb-0">Control de saldo vacacional</p>
          </div>
          <button 
            className="btn btn-outline-secondary w-100 w-md-auto" 
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <i className={`bi bi-arrow-clockwise me-2 ${isFetching ? 'spin' : ''}`} />
            {isFetching ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        <DepartmentBanner />

        {/* Estadísticas */}
        <div className="row g-3 mb-4">
          {[
            { label: 'Total empleados', value: empleados.length, icon: 'bi-people-fill', color: 'primary' },
            { label: 'Con días', value: conDias, icon: 'bi-calendar-check-fill', color: 'success' },
            { label: 'Sin derecho', value: sinDerecho, icon: 'bi-clock-fill', color: 'warning' },
            { label: 'Agotados', value: agotados, icon: 'bi-calendar-x-fill', color: 'danger' },
          ].map(s => (
            <div key={s.label} className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-3">
                  <div className="d-flex flex-column flex-xl-row align-items-center text-center text-xl-start">
                    <div className={`stat-icon bg-${s.color} bg-opacity-10 text-${s.color} mb-2 mb-xl-0 me-xl-3`} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                      <i className={`bi ${s.icon} fs-5`} />
                    </div>
                    <div>
                      <h4 className="mb-0 fw-bold">{s.value}</h4>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{s.label}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label small text-muted">Buscar empleado</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-search text-muted" />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Nombre..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">Departamento</label>
                <select className="form-select" value={filtroDpto} onChange={e => setFiltroDpto(e.target.value)}>
                  <option value="">Todos</option>
                  {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-3 text-muted small pt-4 text-center text-md-start">
                <span className="badge bg-light text-dark border">
                  {lista.length} empleado{lista.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido (Tabla Escritorio / Tarjetas Móvil) */}
        {isLoading && !isFetching ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="alert alert-danger shadow-sm border-0">
            <i className="bi bi-exclamation-triangle-fill me-2" />
            Hubo un error al cargar los datos. Intenta actualizar.
          </div>
        ) : lista.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-calendar-x display-3 text-muted opacity-25" />
              <h5 className="mt-4 text-muted">Sin resultados</h5>
            </div>
          </div>
        ) : (
          <>
            {/* VISTA ESCRITORIO (Oculta en celular) */}
            <div className="card border-0 shadow-sm overflow-hidden d-none d-lg-block">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Empleado</th>
                      <th>Departamento</th>
                      <th>Antigüedad</th>
                      <th style={{ width: 140 }}>Días</th>
                      <th style={{ width: 240 }}>Saldo</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(emp => {
                      const nivel = calcularNivel(emp.mesesAntiguedad);
                      const { diasDisponibles, diasUsados, diasPendientes, diasRestantes } = emp.saldo;
                      return (
                        <tr key={`desktop-${emp.id}`}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{emp.nombre}</div>
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{emp.correo}</div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">{emp.departamento || '—'}</span>
                          </td>
                          <td>
                            <span style={{
                              background: nivel.bg, color: nivel.color,
                              borderRadius: 20, padding: '3px 10px',
                              fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap'
                            }}>
                              {nivel.label}
                            </span>
                          </td>
                          <td>
                            {diasDisponibles === 0 ? (
                              <span style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>Sin derecho</span>
                            ) : (
                              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                                {diasDisponibles} <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>días</span>
                              </span>
                            )}
                          </td>
                          <td>
                            <BarraProgreso diasDisponibles={diasDisponibles} diasUsados={diasUsados} diasPendientes={diasPendientes} />
                            {diasDisponibles > 0 && (
                              <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: 2, color: '#374151', fontWeight: 600 }}>
                                {diasRestantes} de {diasDisponibles} restantes
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <button className="btn btn-sm btn-outline-primary" title="Ajustar" onClick={() => setAjusteEmpleado(emp)} disabled={diasDisponibles === 0}>
                                <i className="bi bi-pencil" />
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" title="Recalcular" onClick={() => mutRecalcular.mutate(emp.id)} disabled={mutRecalcular.isPending}>
                                <i className="bi bi-arrow-repeat" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VISTA MÓVIL (Oculta en escritorio) */}
            <div className="d-block d-lg-none">
              {lista.map(emp => {
                const nivel = calcularNivel(emp.mesesAntiguedad);
                const { diasDisponibles, diasUsados, diasPendientes, diasRestantes } = emp.saldo;
                return (
                  <div key={`mobile-${emp.id}`} className="card border-0 shadow-sm mb-3">
                    <div className="card-body">
                      {/* Header de la tarjeta */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{emp.nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{emp.departamento || 'Sin departamento'}</div>
                        </div>
                        <span style={{
                          background: nivel.bg, color: nivel.color,
                          borderRadius: 20, padding: '3px 8px',
                          fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap'
                        }}>
                          {nivel.label}
                        </span>
                      </div>

                      {/* Progreso y datos */}
                      <div className="mb-3 bg-light rounded-3 p-3 border">
                        <div className="d-flex justify-content-between align-items-end mb-2">
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            Días totales: <strong style={{ color: '#111827' }}>{diasDisponibles}</strong>
                          </div>
                          {diasDisponibles > 0 && (
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              Libres: <strong style={{ color: '#059669', fontSize: '0.95rem' }}>{diasRestantes}</strong>
                            </div>
                          )}
                        </div>
                        <BarraProgreso diasDisponibles={diasDisponibles} diasUsados={diasUsados} diasPendientes={diasPendientes} />
                      </div>

                      {/* Acciones */}
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => setAjusteEmpleado(emp)} disabled={diasDisponibles === 0}>
                          <i className="bi bi-pencil me-1" /> Ajustar
                        </button>
                        <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => mutRecalcular.mutate(emp.id)} disabled={mutRecalcular.isPending}>
                          <i className="bi bi-arrow-repeat me-1" /> Recalcular
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Leyenda footer */}
        <div className="mt-4 p-3 bg-light rounded-3 border d-flex flex-column flex-md-row gap-3" style={{ fontSize: '0.85rem', color: '#4b5563' }}>
          <div><i className="bi bi-pencil text-primary me-2" /><strong>Ajustar:</strong> corrige días usados manualmente si algo no cuadra.</div>
          <div><i className="bi bi-arrow-repeat text-secondary me-2" /><strong>Recalcular:</strong> vuelve a sumar todas las ausencias aprobadas en Firestore.</div>
        </div>
      </div>

      {/* Modal de ajuste */}
      {ajusteEmpleado && (
        <ModalAjuste
          empleado={ajusteEmpleado}
          onClose={() => setAjusteEmpleado(null)}
          onSave={() => queryClient.invalidateQueries(['vacaciones-panel'])}
        />
      )}
    </AdminLayout>
  );
}

export default Vacaciones;
