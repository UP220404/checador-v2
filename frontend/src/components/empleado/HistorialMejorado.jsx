import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

function HistorialMejorado({ userData, attendanceSummary }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = actual, -1 = previa, etc.
  const [filtro, setFiltro] = useState({
    fechaInicio: '',
    fechaFin: ''
  });
  const [festivos, setFestivos] = useState([]);

  // Efecto para cargar historial según el modo y la semana
  useEffect(() => {
    if (userData) {
      if (viewMode === 'calendar') {
        cargarHistorialMes(currentMonth.year, currentMonth.month);
        cargarFestivos(currentMonth.year);
      } else if (viewMode === 'list') {
        const { start, end } = getWeekDates(weekOffset);
        cargarHistorialSemana(start, end);
        cargarFestivos(new Date(start).getFullYear());
      }
    }
  }, [userData, currentMonth, viewMode, weekOffset]);

  const getWeekDates = (offset) => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diffToMonday + (offset * 7)));
    const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
    
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
      mondayLabel: monday.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
      sundayLabel: sunday.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    };
  };

  const cargarHistorialSemana = async (start, end) => {
    try {
      setLoading(true);
      const response = await api.getAttendanceRecords({
        userId: userData.uid,
        limit: 50,
        startDate: start,
        endDate: end
      });
      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando semana:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    // Mantengo esta para búsqueda manual
    try {
      setLoading(true);
      const response = await api.getAttendanceRecords({
        userId: userData.uid,
        limit: 100,
        startDate: filtro.fechaInicio,
        endDate: filtro.fechaFin
      });
      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
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

      // Cargar asistencia y ausencias aprobadas en paralelo
      const [resAsistencia, resAusencias] = await Promise.all([
        api.getAttendanceRecords({ userId: userData.uid, limit: 100, startDate, endDate }),
        api.getMyAbsenceRequests()
      ]);

      if (resAsistencia.data.success) {
        let records = resAsistencia.data.data || [];
        
        // Filtrar ausencias aprobadas que caen en este mes
        if (resAusencias.data.success) {
          const aprobadas = (resAusencias.data.data || []).filter(a => 
            (a.estado === 'aprobado' || a.estado === 'aprobada') &&
            !(a.fechaInicio > endDate || a.fechaFin < startDate)
          );
          
          // Inyectar ausencias aprobadas como tipos virtuales si no hay registro manual
          aprobadas.forEach(ausencia => {
            // Expandir rango de fechas
            let current = new Date(ausencia.fechaInicio + 'T00:00:00');
            const end = new Date((ausencia.fechaFin || ausencia.fechaInicio) + 'T00:00:00');
            
            while (current <= end) {
              const dateStr = current.toISOString().split('T')[0];
              // Solo agregar si no hay ya un registro de asistencia real para ese dia
              if (!records.some(r => r.fecha === dateStr) && dateStr >= startDate && dateStr <= endDate) {
                records.push({
                  fecha: dateStr,
                  tipoEvento: 'justificada',
                  tipoAusencia: ausencia.tipo,
                  virtual: true
                });
              }
              current.setDate(current.getDate() + 1);
            }
          });
        }
        
        setHistorial(records);
      }
    } catch (error) {
      console.error('Error cargando historial mensual:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarFestivos = async (year) => {
    try {
      const response = await api.getHolidays(year);
      if (response.data.success) {
        setFestivos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando festivos:', error);
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
      acc[reg.fecha] = { entrada: null, salida: null, retardo: false, justificada: false, esVacacion: false, tipoAusencia: null };
    }
    if (reg.tipoEvento === 'entrada') {
      acc[reg.fecha].entrada = reg.hora;
      acc[reg.fecha].retardo = reg.estado === 'retardo';
    } else if (reg.tipoEvento === 'salida') {
      acc[reg.fecha].salida = reg.hora;
    } else if (reg.tipoEvento === 'justificada') {
      acc[reg.fecha].justificada = true;
      acc[reg.fecha].tipoAusencia = reg.tipoAusencia;
      acc[reg.fecha].esVacacion = reg.tipoAusencia === 'vacaciones';
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

      const isHoliday = festivos.find(f => f.fecha === dateStr);
      const holidayName = isHoliday ? isHoliday.nombre : null;

      let status = 'no-record';
      // Vacaciones y festivos tienen prioridad absoluta, incluso si el día es futuro
      if (record?.esVacacion) status = 'vacation';
      else if (isHoliday) status = 'holiday';
      else if (isFuture) status = 'future';
      else if (isWeekend && !record) status = 'weekend';
      else if (record?.justificada) status = 'justified';
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
        isFuture,
        isHoliday: !!isHoliday,
        holidayName
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
        
        // No contar como falta si es un dia festivo
        const isHoliday = festivos.some(f => f.fecha === dateStr);
        if (isHoliday) continue;

        // No contar como falta si está justificada (incluyendo vacaciones)
        if (registrosAgrupados[dateStr]?.justificada) continue;

        if (!registrosAgrupados[dateStr]) count++;
      }
      return count;
    })(),
    vacaciones: Object.values(registrosAgrupados).filter(r => r.esVacacion).length,
    justificados: Object.values(registrosAgrupados).filter(r => r.justificada && !r.esVacacion).length,
    festivos: (() => {
      const { year, month } = currentMonth;
      const monthStr = String(month + 1).padStart(2, '0');
      const yearStr = String(year);
      return festivos.filter(f => f.fecha.startsWith(`${yearStr}-${monthStr}`)).length;
    })()
  };

  const getStatusLabelText = (status) => {
    switch (status) {
      case 'holiday': return 'FESTIVO';
      case 'late': return 'RETARDO';
      case 'complete': return 'PUNTUAL';
      case 'vacation': return 'VACACIONES';
      case 'justified': return 'JUSTIFICANTE';
      case 'partial': return 'INCOMPLETO';
      default: return '';
    }
  };

  return (
    <div className="historial-mejorado">
      <div className="history-top-navbar">
        <div className="nav-left">
          <h4 className="navbar-title">
            <i className="bi bi-clock-history text-success me-2"></i>
            Historial
          </h4>
          <div className="navbar-stats">
            <div className="stat-v3">
              <span className="v">{formatHoras(attendanceSummary?.semana?.horasTrabajadas || 0)}</span>
              <span className="l">Semana</span>
            </div>
            <div className="stat-v3">
              <span className="v">{formatHoras(attendanceSummary?.mes?.horasTrabajadas || 0)}</span>
              <span className="l">Mes</span>
            </div>
          </div>
        </div>

        <div className="nav-center">
          {viewMode === 'list' && (
            <div className="week-nav-navbar">
              <button className="nav-btn" onClick={() => setWeekOffset(prev => prev - 1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <div className="week-label-v3">
                <span className="s">{weekOffset === 0 ? 'Esta Semana' : `Semana ${weekOffset}`}</span>
                <span className="d">{getWeekDates(weekOffset).mondayLabel} - {getWeekDates(weekOffset).sundayLabel}</span>
              </div>
              <button className="nav-btn" onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset >= 0}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          )}
        </div>

        <div className="nav-right">
          <div className="navbar-search">
            <input
              type="date"
              className="navbar-date-input"
              value={filtro.fechaInicio}
              onChange={(e) => setFiltro({ ...filtro, fechaInicio: e.target.value })}
            />
            <button className="navbar-search-btn" onClick={handleBuscar}>
              <i className="bi bi-search"></i>
            </button>
          </div>
          <div className="navbar-toggles">
            <button
              className={`nav-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Calendario"
            >
              <i className="bi bi-calendar3"></i>
            </button>
            <button
              className={`nav-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <i className="bi bi-list-ul"></i>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* ============ CALENDAR VIEW (DUAL LAYOUT) ============ */
        <div className="calendar-dual-layout">
          {/* Columna Izquierda: Calendario */}
          <div className="calendar-main-col">
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
              <div className="calendar-grid">
                {DAY_NAMES.map(day => (
                  <div key={day} className="calendar-header-cell">{day}</div>
                ))}

                {calendarDays.map((dayData, idx) => (
                  <motion.div
                    key={idx}
                    className={`calendar-cell ${dayData.status || ''} ${dayData.isToday ? 'is-today' : ''} ${selectedDay === dayData.dateStr ? 'is-selected' : ''} ${dayData.type === 'padding' ? 'is-padding' : ''}`}
                    onClick={() => {
                      // Cualquier dia real (no padding, no fin de semana sin nada) es clickeable
                      const isClickable = dayData.day && dayData.type !== 'padding' && dayData.status !== 'weekend';
                      if (isClickable) {
                        setSelectedDay(selectedDay === dayData.dateStr ? null : dayData.dateStr);
                      }
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.005, duration: 0.2 }}
                  >
                    {dayData.day && (
                      <div className="cell-content">
                        <span className="calendar-day-number">{dayData.day}</span>
                        {dayData.status && dayData.status !== 'no-record' && dayData.status !== 'future' && dayData.status !== 'weekend' && (
                          <span className={`cell-status-label-v3 ${dayData.status}`}>
                            {getStatusLabelText(dayData.status)}
                          </span>
                        )}
                        {dayData.record?.entrada && (
                          <div className="cell-info-hover">
                            <span className="mini-time">{dayData.record.entrada}</span>
                            <span className="status-dot-inner"></span>
                          </div>
                        )}
                        {dayData.record?.esVacacion && (
                          <div className="justified-indicator-v3 vacation-indicator">
                            <i className="bi bi-umbrella-fill"></i>
                          </div>
                        )}
                        {dayData.record?.justificada && !dayData.record?.esVacacion && (
                          <div className="justified-indicator-v3">
                            <i className="bi bi-file-earmark-check-fill"></i>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Panel de Info */}
          <div className="calendar-side-panel">
            {/* Detalle del Dia */}
            <div className="side-panel-section detail">
              <h6 className="side-panel-title">Detalle del Día</h6>
              {selectedDay ? (
                <div className="selected-day-info">
                  <div className="selected-date-badge-v2">
                    <span className="sdb-weekday">
                      {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' })}
                    </span>
                    <span className="sdb-date">
                      {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  {registrosAgrupados[selectedDay] ? (
                    registrosAgrupados[selectedDay].esVacacion ? (
                      <div className="detail-status-card vacation-card">
                        <div className="dsc-icon">🏖️</div>
                        <div className="dsc-label">Vacaciones</div>
                        <div className="dsc-sub">Día de vacaciones aprobado</div>
                      </div>
                    ) : registrosAgrupados[selectedDay].justificada ? (
                      <div className="detail-status-card justified-card">
                        <div className="dsc-icon"><i className="bi bi-file-earmark-check-fill"></i></div>
                        <div className="dsc-label">Justificante</div>
                        <div className="dsc-sub">{registrosAgrupados[selectedDay].tipoAusencia?.replace(/_/g, ' ') || 'Ausencia justificada'}</div>
                      </div>
                    ) : (
                      <div className="side-times">
                        <div className={`side-time-item ${registrosAgrupados[selectedDay].retardo ? 'retardo' : ''}`}>
                          <span className="label"><i className="bi bi-box-arrow-in-right me-1"></i>Entrada</span>
                          <span className="val">{registrosAgrupados[selectedDay].entrada || '--:--'}</span>
                          {registrosAgrupados[selectedDay].retardo && <span className="retardo-badge">Retardo</span>}
                        </div>
                        <div className="side-time-item">
                          <span className="label"><i className="bi bi-box-arrow-in-left me-1"></i>Salida</span>
                          <span className="val">{registrosAgrupados[selectedDay].salida || '--:--'}</span>
                        </div>
                      </div>
                    )
                  ) : calendarDays.find(d => d.dateStr === selectedDay)?.isHoliday ? (
                    <div className="detail-status-card holiday-card">
                      <div className="dsc-icon">🎉</div>
                      <div className="dsc-label">Día Festivo</div>
                      <div className="dsc-sub">{calendarDays.find(d => d.dateStr === selectedDay)?.holidayName}</div>
                    </div>
                  ) : calendarDays.find(d => d.dateStr === selectedDay)?.isFuture ? (
                    <div className="detail-status-card future-card">
                      <div className="dsc-icon"><i className="bi bi-calendar-check"></i></div>
                      <div className="dsc-label">Día próximo</div>
                      <div className="dsc-sub">Aún no hay registros para este día</div>
                    </div>
                  ) : (
                    <div className="detail-status-card empty-card">
                      <div className="dsc-icon"><i className="bi bi-calendar-x"></i></div>
                      <div className="dsc-label">Sin registros</div>
                      <div className="dsc-sub">No hay asistencia registrada para este día</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="select-prompt">
                  <i className="bi bi-cursor-fill"></i>
                  <span>Selecciona un día</span>
                </div>
              )}
            </div>

            {/* Leyenda y Stats integradas al costado */}
            <div className="side-panel-section stats">
              <h6 className="side-panel-title">Resumen del Mes</h6>
              <div className="side-stats-grid">
                <div className="side-stat success">
                  <span className="v">{calendarStats.completos}</span>
                  <span className="l">Puntuales</span>
                </div>
                <div className="side-stat warn">
                  <span className="v">{calendarStats.retardos}</span>
                  <span className="l">Retardos</span>
                </div>
                <div className="side-stat error">
                  <span className="v">{calendarStats.sinRegistro}</span>
                  <span className="l">Faltas</span>
                </div>
                {calendarStats.vacaciones > 0 && (
                  <div className="side-stat info" style={{ background: '#e0f7fa', color: '#0097a7' }}>
                    <span className="v">{calendarStats.vacaciones}</span>
                    <span className="l">🏖️ Vacaciones</span>
                  </div>
                )}
                {calendarStats.justificados > 0 && (
                  <div className="side-stat info" style={{ background: '#e7f3ff', color: '#0d6efd' }}>
                    <span className="v">{calendarStats.justificados}</span>
                    <span className="l">Justificadas</span>
                  </div>
                )}
                <div className="side-stat info" style={{ background: '#f3f0ff', color: '#7048e8' }}>
                  <span className="v">{calendarStats.festivos}</span>
                  <span className="l">Festivos</span>
                </div>
              </div>
            </div>

            <div className="side-panel-section legend">
              <div className="mini-legend">
                <div className="leg-item"><span className="dot complete"></span> Puntual</div>
                <div className="leg-item"><span className="dot late"></span> Retardo</div>
                <div className="leg-item">
                  <span className="dot" style={{ background: '#0097a7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-umbrella-fill" style={{ fontSize: '0.6rem', color: 'white' }}></i>
                  </span>
                  Vacaciones
                </div>
                <div className="leg-item">
                  <span className="dot justified" style={{ background: '#0d6efd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-file-earmark-check-fill" style={{ fontSize: '0.6rem', color: 'white' }}></i>
                  </span>
                  Justificada
                </div>
                <div className="leg-item"><span className="dot holiday" style={{ background: '#7048e8' }}></span> Festivo</div>
                <div className="leg-item"><span className="dot no-record"></span> Vacío</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============ LIST VIEW ============ */
        <div className="historial-list-view">
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
                  {(() => {
                    const groups = {};
                    diasOrdenados.forEach(fecha => {
                      const fechaObj = new Date(fecha + 'T00:00:00');
                      // Obtener el lunes de esa semana para agrupar
                      const day = fechaObj.getDay();
                      const diff = fechaObj.getDate() - day + (day === 0 ? -6 : 1);
                      const monday = new Date(fechaObj.setDate(diff));
                      const label = `Semana del ${monday.toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}`;
                      
                      if (!groups[label]) groups[label] = [];
                      groups[label].push(fecha);
                    });

                    return Object.entries(groups).map(([semana, dias]) => (
                      <React.Fragment key={semana}>
                        <tr className="week-header-row">
                          <td colSpan="4">
                            <div className="week-label">
                              <i className="bi bi-calendar-range me-2"></i>
                              {semana}
                            </div>
                          </td>
                        </tr>
                        {dias.map((fecha) => {
                          const reg = registrosAgrupados[fecha];
                          const fechaObj = new Date(fecha + 'T00:00:00');
                          const diaSemana = fechaObj.toLocaleDateString('es-MX', { weekday: 'long' });
                          const diaMes = fechaObj.getDate();
                          const mesNombre = fechaObj.toLocaleDateString('es-MX', { month: 'short' });

                          return (
                            <tr key={fecha} className="list-row">
                              <td>
                                <div className="fecha-cell-v3">
                                  <span className="dia-texto">{diaSemana}</span>
                                  <span className="fecha-num">{diaMes} {mesNombre}</span>
                                </div>
                              </td>
                              <td>
                                <div className={`hora-badge ${reg.entrada ? 'success' : 'missing'}`}>
                                  <i className={`bi ${reg.entrada ? 'bi-box-arrow-in-right' : 'bi-dash'}`}></i>
                                  {reg.entrada || '--:--'}
                                </div>
                              </td>
                              <td>
                                <div className={`hora-badge ${reg.salida ? 'info' : 'missing'}`}>
                                  <i className={`bi ${reg.salida ? 'bi-box-arrow-in-left' : 'bi-dash'}`}></i>
                                  {reg.salida || '--:--'}
                                </div>
                              </td>
                              <td>
                                {(() => {
                                  const isHoliday = festivos.find(f => f.fecha === fecha);
                                  if (reg.justificada) return <span className="status-pill info" style={{ background: '#e7f3ff', color: '#0d6efd' }}>Justificada: {reg.tipoAusencia?.replace(/_/g, ' ')}</span>;
                                  if (reg.retardo) return <span className="status-pill warning">Retardo</span>;
                                  if (reg.entrada) return <span className="status-pill success">Puntual</span>;
                                  if (isHoliday) return <span className="status-pill info" style={{ background: '#f3f0ff', color: '#7048e8' }}>Festivo: {isHoliday.nombre}</span>;
                                  return <span className="status-pill secondary">Sin Registro</span>;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
