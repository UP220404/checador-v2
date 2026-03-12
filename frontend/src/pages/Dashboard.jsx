import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import '../styles/Dashboard.css';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function Dashboard() {
  const { isAdminArea, userDepartamento, departmentFilter } = useRoleData();

  // Sistema de notificaciones Toast
  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  // Función para extraer fecha en formato [año, mes, día]
  // Usa hora local para que las fechas de calendario (ingreso, cumpleaños) no se desfasen
  const parseFecha = (fecha) => {
    if (!fecha) return null;
    if (typeof fecha === 'string' && fecha.includes('-')) {
      // Si es string YYYY-MM-DD, extraer directamente sin convertir a Date
      const parts = fecha.split('-');
      if (parts.length === 3) {
        return [parts[0], parts[1].padStart(2, '0'), parts[2].padStart(2, '0')];
      }
      return null;
    }
    let dateObj = null;
    if (fecha.toDate) {
      dateObj = fecha.toDate();
    } else if (fecha instanceof Date) {
      dateObj = fecha;
    } else if (fecha._seconds) {
      dateObj = new Date(fecha._seconds * 1000);
    }
    if (dateObj) {
      // Usar hora local para preservar la fecha calendario correcta
      return [
        String(dateObj.getFullYear()),
        String(dateObj.getMonth() + 1).padStart(2, '0'),
        String(dateObj.getDate()).padStart(2, '0')
      ];
    }
    return null;
  };

  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());

  // React Query para Datos Remotos
  const { data: todayStats } = useQuery({
    queryKey: ['todayStats'],
    queryFn: async () => {
      const res = await api.getTodayAttendance().catch(() => ({ data: { data: [] } }));
      const registros = res.data?.data || [];
      return {
        entradasHoy: registros.filter(r => r.tipoEvento === 'entrada').length,
        salidasHoy: registros.filter(r => r.tipoEvento === 'salida').length
      };
    }
  });

  const { data: usuarios = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.getUsers().catch(() => ({ data: { data: [] } }));
      return res.data?.data || [];
    }
  });

  const { data: festivos = [], isLoading: loadingHolidays } = useQuery({
    queryKey: ['holidays', anioActual],
    queryFn: async () => {
      const res = await api.getHolidays(anioActual).catch(() => ({ data: { data: [] } }));
      return res.data?.data?.map(f => ({
        ...f,
        tipo: 'festivo',
        color: '#dc3545',
        icon: 'bi-calendar-x'
      })) || [];
    }
  });

  const loading = loadingUsers || loadingHolidays;

  const [userName] = useState(() => {
    const storedName = sessionStorage.getItem('userName') || 'Administrador';
    return storedName.split(' ')[0];
  });



  const stats = {
    entradasHoy: todayStats?.entradasHoy || 0,
    salidasHoy: todayStats?.salidasHoy || 0,
    usuariosTotales: departmentFilter ? usuarios.filter(u => u.departamento === departmentFilter).length : usuarios.length
  };

  // Genera eventos del calendario dinámicos
  const eventosCalendario = (() => {
    const eventos = [];
    const mesStr = String(mesActual + 1).padStart(2, '0');

    const festivosMesActual = festivos.filter(f => {
      if (f.fecha && typeof f.fecha === 'string') {
        const parts = f.fecha.split('-');
        if (parts.length === 3) return parts[1] === mesStr;
      }
      return false;
    });
    eventos.push(...festivosMesActual);

    usuarios.forEach(u => {
      const fechaNac = parseFecha(u.fechaNacimiento);
      if (fechaNac && fechaNac[1] === mesStr) {
        eventos.push({
          id: `cumple-${u.uid}`,
          fecha: `${anioActual}-${mesStr}-${fechaNac[2]}`,
          nombre: `Cumpleaños: ${u.nombre?.split(' ')[0] || 'Empleado'}`,
          tipo: 'cumpleanos',
          color: '#ffc107',
          icon: 'bi-gift'
        });
      }

      const fechaIng = parseFecha(u.fechaIngreso);
      if (fechaIng && fechaIng[1] === mesStr) {
        const aniosLaborados = anioActual - parseInt(fechaIng[0]);
        if (aniosLaborados >= 1) {
          eventos.push({
            id: `aniv-${u.uid}`,
            fecha: `${anioActual}-${mesStr}-${fechaIng[2]}`,
            nombre: `Aniversario laboral: ${u.nombre?.split(' ')[0]} (${aniosLaborados} ${aniosLaborados === 1 ? 'año' : 'años'})`,
            tipo: 'aniversario',
            color: '#28a745',
            icon: 'bi-award'
          });
        }
      }

      if (u.fechasImportantes && Array.isArray(u.fechasImportantes)) {
        u.fechasImportantes.forEach(fi => {
          let mesFI, diaFI;
          if (fi.fecha && fi.fecha.includes('-')) {
            const partes = fi.fecha.split('-');
            if (partes.length === 2) {
              mesFI = partes[0].padStart(2, '0');
              diaFI = partes[1].padStart(2, '0');
            } else if (partes.length === 3) {
              mesFI = partes[1].padStart(2, '0');
              diaFI = partes[2].padStart(2, '0');
            }
          }

          if (mesFI === mesStr) {
            const iconoTipo = { 'aniversario': 'bi-heart-fill', 'cumpleanos': 'bi-cake2', 'personal': 'bi-star-fill' };
            const colorTipo = { 'aniversario': '#e91e63', 'cumpleanos': '#9c27b0', 'personal': '#607d8b' };
            const nombreTipo = { 'aniversario': 'Aniversario', 'cumpleanos': 'Cumpleaños familiar', 'personal': 'Fecha personal' };
            eventos.push({
              id: `fi-${u.uid}-${fi.id}`,
              fecha: `${anioActual}-${mesStr}-${diaFI}`,
              nombre: `${fi.descripcion || nombreTipo[fi.tipo] || fi.tipo}: ${u.nombre?.split(' ')[0]}`,
              tipo: 'fecha_importante',
              color: colorTipo[fi.tipo] || '#607d8b',
              icon: iconoTipo[fi.tipo] || 'bi-star-fill'
            });
          }
        });
      }

      if (u.contrato && u.contrato.fechaFinContrato && u.contrato.tipo !== 'indefinido' && u.contrato.estado !== 'terminado') {
        const fechaFinContrato = parseFecha(u.contrato.fechaFinContrato);
        if (fechaFinContrato && fechaFinContrato[1] === mesStr) {
          const fechaFinDate = new Date(u.contrato.fechaFinContrato + 'T00:00:00');
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const diffDias = Math.ceil((fechaFinDate - hoy) / (1000 * 60 * 60 * 24));
          const colorVencimiento = diffDias <= 7 ? '#dc3545' : '#fd7e14';
          const tipoContrato = u.contrato.tipo === 'inicial_1_mes' ? '1 mes' : '2 meses';

          eventos.push({
            id: `contrato-${u.uid}`,
            fecha: `${anioActual}-${mesStr}-${fechaFinContrato[2]}`,
            nombre: `Fin contrato (${tipoContrato}): ${u.nombre?.split(' ')[0] || 'Empleado'}`,
            tipo: 'vencimiento_contrato',
            color: colorVencimiento,
            icon: 'bi-file-earmark-x'
          });
        }
      }
    });

    return eventos;
  })();

  // Funciones del calendario
  const getNombreMes = (mes) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes];
  };

  const getDiasDelMes = () => {
    const primerDia = new Date(anioActual, mesActual, 1);
    const ultimoDia = new Date(anioActual, mesActual + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const diaSemanaInicio = primerDia.getDay(); // 0 = Domingo

    const dias = [];
    // Días vacíos al inicio
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }
    // Días del mes
    for (let d = 1; d <= diasEnMes; d++) {
      dias.push(d);
    }
    return dias;
  };

  const getEventosDelDia = (dia) => {
    if (!dia) return [];
    const fechaStr = `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return eventosCalendario.filter(e => e.fecha === fechaStr);
  };

  const esHoy = (dia) => {
    const hoy = new Date();
    return dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();
  };

  const cambiarMes = (delta) => {
    let nuevoMes = mesActual + delta;
    let nuevoAnio = anioActual;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio--;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio++;
    }
    setMesActual(nuevoMes);
    setAnioActual(nuevoAnio);
  };

  return (
    <AdminLayout>
      <motion.div 
        className="section-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2><i className="bi bi-speedometer2 me-2"></i>Panel de Control</h2>
        <div className="text-muted">Bienvenido, {userName}</div>
      </motion.div>

      {/* Banner de departamento para admin_area */}
      <DepartmentBanner />

      {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Calendario Corporativo */}
              <motion.div 
                className="row mb-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="col-12">
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <span>
                        <i className="bi bi-calendar3 me-2"></i>Calendario Corporativo
                      </span>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-success" onClick={() => cambiarMes(-1)}>
                          <i className="bi bi-chevron-left"></i>
                        </button>
                        <button className="btn btn-outline-success" disabled>
                          {getNombreMes(mesActual)} {anioActual}
                        </button>
                        <button className="btn btn-outline-success" onClick={() => cambiarMes(1)}>
                          <i className="bi bi-chevron-right"></i>
                        </button>
                      </div>
                    </div>
                    <div className="card-body p-2">
                      <div className="apple-calendar">
                        {/* Días de la semana */}
                        <div className="apple-calendar-header">
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                            <div key={d} className="apple-day-name">{d}</div>
                          ))}
                        </div>
                        {/* Grid del calendario estilo Apple */}
                        <div className="apple-calendar-grid">
                          {getDiasDelMes().map((dia, idx) => {
                            const eventos = getEventosDelDia(dia);
                            const esDomingo = idx % 7 === 0;
                            const esSabado = idx % 7 === 6;

                            return (
                              <div
                                key={idx}
                                className={`apple-calendar-day ${!dia ? 'empty' : ''} ${esHoy(dia) ? 'today' : ''} ${(esDomingo || esSabado) && dia ? 'weekend' : ''}`}
                              >
                                {dia && (
                                  <>
                                    <div className="apple-day-header">
                                      <span className={`apple-day-number ${esHoy(dia) ? 'today-badge' : ''}`}>{dia}</span>
                                    </div>
                                    <div className="apple-events-container">
                                      {eventos.slice(0, 3).map((e, i) => (
                                        <div
                                          key={i}
                                          className="apple-event-pill"
                                          style={{ backgroundColor: e.color }}
                                          title={e.nombre}
                                        >
                                          <i className={`bi ${e.icon}`}></i>
                                          <span className="apple-event-text">{e.nombre.split(':')[0]}</span>
                                        </div>
                                      ))}
                                      {eventos.length > 3 && (
                                        <div className="apple-more-events">
                                          +{eventos.length - 3} más
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Lista de eventos del mes */}
                        {eventosCalendario.length > 0 && (
                          <div className="apple-events-list">
                            <div className="events-list-header">
                              <i className="bi bi-calendar-event me-2"></i>
                              Eventos de {getNombreMes(mesActual)}
                              <span className="events-count">{eventosCalendario.length}</span>
                            </div>
                            <div className="events-list-items">
                              {eventosCalendario
                                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                                .map((evento, idx) => (
                                  <div key={idx} className="event-list-item">
                                    <div className="event-list-date" style={{ backgroundColor: evento.color }}>
                                      {evento.fecha.split('-')[2]}
                                    </div>
                                    <div className="event-list-content">
                                      <div className="event-list-name">
                                        <i className={`bi ${evento.icon} me-2`} style={{ color: evento.color }}></i>
                                        {evento.nombre}
                                      </div>
                                      <div className="event-list-type">{evento.tipo.replace('_', ' ')}</div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Métricas del día */}
              <motion.div 
                className="row mb-3 g-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="col-md-4">
                  <div className="card card-metric p-3">
                    <div className="icon-wrapper icon-success">
                      <i className="bi bi-door-open"></i>
                    </div>
                    <h3>Entradas Hoy</h3>
                    <p className="metric-value">{stats.entradasHoy}</p>
                    <small className="text-muted">Total de registros de entrada</small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card card-metric p-3">
                    <div className="icon-wrapper icon-info">
                      <i className="bi bi-door-closed"></i>
                    </div>
                    <h3>Salidas Hoy</h3>
                    <p className="metric-value">{stats.salidasHoy}</p>
                    <small className="text-muted">Total de registros de salida</small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card card-metric p-3">
                    <div className="icon-wrapper icon-primary">
                      <i className="bi bi-people"></i>
                    </div>
                    <h3>Usuarios Activos</h3>
                    <p className="metric-value">{stats.usuariosTotales}</p>
                    <small className="text-muted">Total en el sistema</small>
                  </div>
                </div>
              </motion.div>

              {/* Accesos Rapidos */}
              <motion.div 
                className="row"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className={`col-md-${isAdminArea ? '6' : '4'} mb-3`}>
                  <div className="card h-100 quick-access-card">
                    <div className="card-body text-center p-4">
                      <i className="bi bi-table display-4 mb-3 text-success"></i>
                      <h5 className="fw-bold">Ver Registros</h5>
                      <p className="text-muted">Consulta los registros de asistencia</p>
                      <Link to="/admin/registros" className="btn btn-success mt-2">
                        <i className="bi bi-arrow-right-circle me-2"></i>Ir a Registros
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Solo mostrar Usuarios para admin_rh */}
                {!isAdminArea && (
                  <div className="col-md-4 mb-3">
                    <div className="card h-100 quick-access-card">
                      <div className="card-body text-center p-4">
                        <i className="bi bi-people display-4 mb-3 text-success"></i>
                        <h5 className="fw-bold">Gestionar Usuarios</h5>
                        <p className="text-muted">Administra empleados del sistema</p>
                        <Link to="/admin/usuarios" className="btn btn-success mt-2">
                          <i className="bi bi-arrow-right-circle me-2"></i>Ir a Usuarios
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`col-md-${isAdminArea ? '6' : '4'} mb-3`}>
                  <div className="card h-100 quick-access-card">
                    <div className="card-body text-center p-4">
                      <i className="bi bi-envelope-paper display-4 mb-3 text-success"></i>
                      <h5 className="fw-bold">Gestion de Ausencias</h5>
                      <p className="text-muted">Administra solicitudes de ausencia</p>
                      <Link to="/admin/ausencias" className="btn btn-success mt-2">
                        <i className="bi bi-arrow-right-circle me-2"></i>Ir a Ausencias
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}

    </AdminLayout>
  );
}

export default Dashboard;
