import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function HistorialMejorado({ userData, attendanceSummary }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [filtro, setFiltro] = useState({
    fechaInicio: '',
    fechaFin: ''
  });

  useEffect(() => {
    if (userData) {
      if (viewMode === 'calendar') {
        cargarHistorialMes(currentMonth.year, currentMonth.month);
      } else {
        cargarHistorial();
      }
    }
  }, [userData, currentMonth, viewMode]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const hoy = new Date();
      const hace30Dias = new Date(hoy);
      hace30Dias.setDate(hace30Dias.getDate() - 30);

      const response = await api.getAttendanceRecords({
        userId: userData.uid,
        limit: 100,
        startDate: filtro.fechaInicio || hace30Dias.toISOString().split('T')[0],
        endDate: filtro.fechaFin || hoy.toISOString().split('T')[0]
      });

      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorialMes = async (year, month) => {
    try {
      setLoading(true);
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const response = await api.getAttendanceRecords({
        userId: userData.uid,
        limit: 100,
        startDate,
        endDate
      });

      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial mensual:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = () => {
    cargarHistorial();
  };

  const formatHoras = (horas) => {
    const horasEnteras = Math.floor(horas);
    const minutos = Math.round((horas - horasEnteras) * 60);
    return `${horasEnteras}h ${minutos}m`;
  };

  // Agrupar registros por dia
  const registrosAgrupados = historial.reduce((acc, reg) => {
    if (!acc[reg.fecha]) {
      acc[reg.fecha] = { entrada: null, salida: null, retardo: false };
    }
    if (reg.tipoEvento === 'entrada') {
      acc[reg.fecha].entrada = reg.hora;
      acc[reg.fecha].retardo = reg.estado === 'retardo';
    } else if (reg.tipoEvento === 'salida') {
      acc[reg.fecha].salida = reg.hora;
    }
    return acc;
  }, {});

  const diasOrdenados = Object.keys(registrosAgrupados).sort((a, b) => b.localeCompare(a));

  // Calendar helpers
  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      if (newMonth > 11) { newMonth = 0; newYear++; }
      return { year: newYear, month: newMonth };
    });
    setSelectedDay(null);
  };

  const generateCalendarDays = () => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, type: 'padding' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = registrosAgrupados[dateStr];
      const dateObj = new Date(year, month, d);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isFuture = dateObj > today;
      const isToday = dateObj.getTime() === today.getTime();

      let status = 'no-record';
      if (isFuture) status = 'future';
      else if (isWeekend && !record) status = 'weekend';
      else if (record?.retardo) status = 'late';
      else if (record?.entrada && record?.salida) status = 'complete';
      else if (record?.entrada) status = 'partial';

      days.push({
        day: d,
        dateStr,
        record,
        status,
        isToday,
        isWeekend,
        isFuture
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Calendar stats
  const calendarStats = {
    completos: Object.values(registrosAgrupados).filter(r => r.entrada && r.salida && !r.retardo).length,
    retardos: Object.values(registrosAgrupados).filter(r => r.retardo).length,
    incompletos: Object.values(registrosAgrupados).filter(r => r.entrada && !r.salida).length,
    sinRegistro: (() => {
      const { year, month } = currentMonth;
      const today = new Date();
      const lastDay = new Date(year, month + 1, 0).getDate();
      let count = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dateObj = new Date(year, month, d);
        if (dateObj > today) continue;
        if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!registrosAgrupados[dateStr]) count++;
      }
      return count;
    })()
  };

  return (
    <div className="historial-mejorado">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h4 className="section-title mb-0">
          <i className="bi bi-clock-history me-2 text-success"></i>
          Historial de Asistencia
        </h4>
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <i className="bi bi-calendar3"></i> Calendario
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <i className="bi bi-list-ul"></i> Lista
          </button>
        </div>
      </div>

      {/* Resumen de horas */}
      <div className="resumen-horas">
        <div className="resumen-card">
          <div className="resumen-icon">
            <i className="bi bi-calendar-week"></i>
          </div>
          <div className="resumen-info">
            <span className="resumen-value">
              {formatHoras(attendanceSummary?.semana?.horasTrabajadas || 0)}
            </span>
            <span className="resumen-label">Esta semana</span>
          </div>
          <div className="resumen-extra">
            <span>{attendanceSummary?.semana?.diasTrabajados || 0} dias</span>
            {(attendanceSummary?.semana?.retardos || 0) > 0 && (
              <span className="text-warning">{attendanceSummary.semana.retardos} retardos</span>
            )}
          </div>
        </div>

        <div className="resumen-card">
          <div className="resumen-icon">
            <i className="bi bi-calendar-month"></i>
          </div>
          <div className="resumen-info">
            <span className="resumen-value">
              {formatHoras(attendanceSummary?.mes?.horasTrabajadas || 0)}
            </span>
            <span className="resumen-label">Este mes</span>
          </div>
          <div className="resumen-extra">
            <span>{attendanceSummary?.mes?.diasTrabajados || 0} dias</span>
            {(attendanceSummary?.mes?.retardos || 0) > 0 && (
              <span className="text-warning">{attendanceSummary.mes.retardos} retardos</span>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* ============ CALENDAR VIEW ============ */
        <div className="attendance-calendar">
          {/* Month Navigation */}
          <div className="calendar-nav">
            <button className="btn-cal-nav" onClick={() => navigateMonth(-1)}>
              <i className="bi bi-chevron-left"></i>
            </button>
            <h5 className="calendar-month-label">
              {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
            </h5>
            <button className="btn-cal-nav" onClick={() => navigateMonth(1)}>
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="calendar-grid">
                {DAY_NAMES.map(day => (
                  <div key={day} className="calendar-header-cell">{day}</div>
                ))}

                {/* Day Cells */}
                {calendarDays.map((dayData, idx) => (
                  <motion.div
                    key={idx}
                    className={`calendar-cell ${dayData.status || ''} ${dayData.isToday ? 'today' : ''} ${selectedDay === dayData.dateStr ? 'selected' : ''} ${dayData.type === 'padding' ? 'padding' : ''}`}
                    onClick={() => {
                      if (dayData.day && !dayData.isFuture && dayData.status !== 'weekend') {
                        setSelectedDay(selectedDay === dayData.dateStr ? null : dayData.dateStr);
                      }
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.008, duration: 0.2 }}
                  >
                    {dayData.day && (
                      <>
                        <span className="calendar-day-number">{dayData.day}</span>
                        <span className="calendar-status-dot"></span>
                        {dayData.record?.entrada && (
                          <span className="calendar-time-mini">{dayData.record.entrada}</span>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="calendar-legend">
                <span><span className="legend-dot complete"></span> Puntual</span>
                <span><span className="legend-dot late"></span> Retardo</span>
                <span><span className="legend-dot partial"></span> Incompleto</span>
                <span><span className="legend-dot no-record"></span> Sin registro</span>
              </div>

              {/* Selected Day Detail */}
              <AnimatePresence>
                {selectedDay && (
                  <motion.div
                    className="day-detail-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h6>
                      <i className="bi bi-calendar-day me-2"></i>
                      {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-MX', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </h6>
                    {registrosAgrupados[selectedDay] ? (
                      <div className="day-detail-times">
                        <div>
                          <i className="bi bi-box-arrow-in-right text-success me-2"></i>
                          <strong>Entrada:</strong> {registrosAgrupados[selectedDay].entrada || '--:--'}
                        </div>
                        <div>
                          <i className="bi bi-box-arrow-right text-danger me-2"></i>
                          <strong>Salida:</strong> {registrosAgrupados[selectedDay].salida || '--:--'}
                        </div>
                        <div>
                          {registrosAgrupados[selectedDay].retardo ? (
                            <span className="badge bg-warning text-dark">
                              <i className="bi bi-exclamation-triangle me-1"></i> Retardo
                            </span>
                          ) : registrosAgrupados[selectedDay].entrada ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i> Puntual
                            </span>
                          ) : (
                            <span className="badge bg-secondary">Sin registro</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        No hay registros para este dia
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        /* ============ LIST VIEW ============ */
        <>
          {/* Filtros */}
          <div className="filtros-bar">
            <div className="filtro-item">
              <label className="form-label">Desde</label>
              <input
                type="date"
                className="form-control-portal"
                value={filtro.fechaInicio}
                onChange={(e) => setFiltro({ ...filtro, fechaInicio: e.target.value })}
              />
            </div>
            <div className="filtro-item">
              <label className="form-label">Hasta</label>
              <input
                type="date"
                className="form-control-portal"
                value={filtro.fechaFin}
                onChange={(e) => setFiltro({ ...filtro, fechaFin: e.target.value })}
              />
            </div>
            <div className="filtro-item d-flex align-items-end">
              <button className="btn-portal btn-portal-primary" onClick={handleBuscar}>
                <i className="bi bi-search"></i>
                Buscar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : diasOrdenados.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <h5>Sin registros</h5>
              <p>No hay registros de asistencia en el periodo seleccionado</p>
            </div>
          ) : (
            <div className="historial-table-container">
              <table className="historial-table-v2">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {diasOrdenados.map((fecha) => {
                    const reg = registrosAgrupados[fecha];
                    const fechaObj = new Date(fecha + 'T00:00:00');
                    const diaSemana = fechaObj.toLocaleDateString('es-MX', { weekday: 'short' });
                    const fechaFormateada = fechaObj.toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short'
                    });

                    return (
                      <tr key={fecha}>
                        <td>
                          <div className="fecha-cell">
                            <span className="dia-semana">{diaSemana}</span>
                            <span className="fecha-texto">{fechaFormateada}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`hora-cell ${reg.entrada ? 'recorded' : 'missing'}`}>
                            <i className={`bi ${reg.entrada ? 'bi-box-arrow-in-right' : 'bi-dash'} me-1`}></i>
                            {reg.entrada || '--:--'}
                          </span>
                        </td>
                        <td>
                          <span className={`hora-cell ${reg.salida ? 'recorded' : 'missing'}`}>
                            <i className={`bi ${reg.salida ? 'bi-box-arrow-right' : 'bi-dash'} me-1`}></i>
                            {reg.salida || '--:--'}
                          </span>
                        </td>
                        <td>
                          {reg.retardo ? (
                            <span className="estado-badge retardo">
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              Retardo
                            </span>
                          ) : reg.entrada ? (
                            <span className="estado-badge puntual">
                              <i className="bi bi-check-circle me-1"></i>
                              Puntual
                            </span>
                          ) : (
                            <span className="estado-badge sin-registro">
                              Sin registro
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Estadisticas del periodo */}
      {!loading && (
        <div className="estadisticas-periodo">
          <div className="stat-item">
            <span className="stat-value">{viewMode === 'calendar' ? calendarStats.completos : diasOrdenados.length}</span>
            <span className="stat-label">{viewMode === 'calendar' ? 'Dias puntuales' : 'Dias con registro'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: '#ffc107' }}>
              {viewMode === 'calendar' ? calendarStats.retardos : Object.values(registrosAgrupados).filter(r => r.retardo).length}
            </span>
            <span className="stat-label">Retardos</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {viewMode === 'calendar'
                ? calendarStats.completos + calendarStats.retardos
                : Object.values(registrosAgrupados).filter(r => r.entrada && r.salida).length
              }
            </span>
            <span className="stat-label">Dias completos</span>
          </div>
          {viewMode === 'calendar' && (
            <div className="stat-item">
              <span className="stat-value" style={{ color: '#adb5bd' }}>{calendarStats.sinRegistro}</span>
              <span className="stat-label">Sin registro</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HistorialMejorado;
