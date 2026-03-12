function SaldoVacaciones({ saldo, compact = false }) {
  if (!saldo) {
    return (
      <div className={`saldo-vacaciones ${compact ? 'compact' : ''}`}>
        <div className="saldo-loading">
          <span className="text-muted">Cargando...</span>
        </div>
      </div>
    );
  }

  const { diasDisponibles = 6, diasUsados = 0, diasPendientes = 0, diasRestantes } = saldo;
  const restantes = diasRestantes ?? (diasDisponibles - diasUsados - diasPendientes);
  const porcentajeUsado = diasDisponibles > 0 ? ((diasUsados + diasPendientes) / diasDisponibles) * 100 : 0;

  if (compact) {
    return (
      <div className="saldo-vacaciones compact">
        <div className="saldo-main">
          <span className="saldo-numero">{restantes}</span>
          <span className="saldo-label">dias disponibles</span>
        </div>
        <div className="saldo-progress">
          <div className="progress-bar-custom">
            <div
              className="progress-fill used"
              style={{ width: `${(diasUsados / diasDisponibles) * 100}%` }}
            ></div>
            <div
              className="progress-fill pending"
              style={{ width: `${(diasPendientes / diasDisponibles) * 100}%` }}
            ></div>
          </div>
          <div className="progress-legend-compact">
            <span>{diasUsados} usados</span>
            {diasPendientes > 0 && <span>{diasPendientes} pendientes</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saldo-vacaciones">
      <div className="saldo-header">
        <i className="bi bi-calendar-heart"></i>
        <h5>Saldo de Vacaciones</h5>
      </div>

      <div className="saldo-body">
        <div className="saldo-main-full">
          <div className="saldo-disponible">
            <span className="numero">{restantes}</span>
            <span className="label">dias disponibles</span>
          </div>
          <div className="saldo-total">
            de {diasDisponibles} dias totales
          </div>
        </div>

        <div className="saldo-progress-full">
          <div className="progress-bar-full">
            <div
              className="progress-fill used"
              style={{ width: `${(diasUsados / diasDisponibles) * 100}%` }}
              title={`${diasUsados} dias usados`}
            ></div>
            <div
              className="progress-fill pending"
              style={{ width: `${(diasPendientes / diasDisponibles) * 100}%` }}
              title={`${diasPendientes} dias en solicitudes pendientes`}
            ></div>
          </div>
        </div>

        <div className="saldo-detalle">
          <div className="detalle-item">
            <span className="detalle-color used"></span>
            <span className="detalle-label">Usados</span>
            <span className="detalle-value">{diasUsados} dias</span>
          </div>
          {diasPendientes > 0 && (
            <div className="detalle-item">
              <span className="detalle-color pending"></span>
              <span className="detalle-label">En solicitudes pendientes</span>
              <span className="detalle-value">{diasPendientes} dias</span>
            </div>
          )}
          <div className="detalle-item">
            <span className="detalle-color available"></span>
            <span className="detalle-label">Disponibles</span>
            <span className="detalle-value">{restantes} dias</span>
          </div>
        </div>
      </div>

      {saldo.ultimaActualizacion && (
        <div className="saldo-footer">
          <small className="text-muted">
            <i className="bi bi-clock me-1"></i>
            Actualizado: {new Date(saldo.ultimaActualizacion).toLocaleDateString('es-MX')}
          </small>
        </div>
      )}
    </div>
  );
}

export default SaldoVacaciones;
