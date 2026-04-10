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

  const {
    diasDisponibles = 0,
    diasUsados = 0,
    diasPendientes = 0,
    diasRestantes,
    tieneDerecho = diasDisponibles > 0,
    mesesAntiguedad = null
  } = saldo;

  const restantes = diasRestantes ?? Math.max(0, diasDisponibles - diasUsados - diasPendientes);

  // Construir label de antigüedad
  const etiquetaAntiguedad = () => {
    if (mesesAntiguedad === null || mesesAntiguedad === undefined) return null;
    if (mesesAntiguedad < 6)  return `${mesesAntiguedad} mes${mesesAntiguedad !== 1 ? 'es' : ''} de antigüedad`;
    if (mesesAntiguedad < 12) return `${mesesAntiguedad} meses de antigüedad`;
    const anios = Math.floor(mesesAntiguedad / 12);
    const mesesResto = mesesAntiguedad % 12;
    return `${anios} año${anios !== 1 ? 's' : ''}${mesesResto > 0 ? ` y ${mesesResto} mes${mesesResto !== 1 ? 'es' : ''}` : ''} de antigüedad`;
  };

  // Estado: sin derecho (< 6 meses)
  if (!tieneDerecho) {
    if (compact) {
      return (
        <div className="saldo-vacaciones compact">
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '12px 16px',
            textAlign: 'center'
          }}>
            <i className="bi bi-clock-history" style={{ fontSize: '1.5rem', color: '#dc2626' }} />
            <div style={{ fontWeight: 700, color: '#dc2626', marginTop: 4 }}>Sin derecho a vacaciones</div>
            {mesesAntiguedad !== null && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                {etiquetaAntiguedad()} · Se requieren 6 meses
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="saldo-vacaciones">
        <div className="saldo-header">
          <i className="bi bi-calendar-heart" />
          <h5>Vacaciones</h5>
        </div>
        <div className="saldo-body">
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '1px solid #fecaca',
            borderRadius: 14,
            padding: '24px 20px',
            textAlign: 'center'
          }}>
            <i className="bi bi-clock-history" style={{ fontSize: '2.5rem', color: '#dc2626' }} />
            <h5 style={{ color: '#dc2626', fontWeight: 700, marginTop: 12 }}>Sin derecho a vacaciones</h5>
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: 0 }}>
              {mesesAntiguedad !== null ? etiquetaAntiguedad() : ''}
              {mesesAntiguedad !== null && mesesAntiguedad < 6 && (
                <><br />Podrás solicitar vacaciones con 6 meses de antigüedad.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const porcentajeUsado = diasDisponibles > 0 ? ((diasUsados + diasPendientes) / diasDisponibles) * 100 : 0;

  if (compact) {
    return (
      <div className="saldo-vacaciones compact">
        <div className="saldo-main">
          <span className="saldo-numero">{restantes}</span>
          <span className="saldo-label">días disponibles</span>
        </div>
        {mesesAntiguedad !== null && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>
            {etiquetaAntiguedad()}
          </div>
        )}
        <div className="saldo-progress">
          <div className="progress-bar-custom">
            <div
              className="progress-fill used"
              style={{ width: `${(diasUsados / diasDisponibles) * 100}%` }}
            />
            <div
              className="progress-fill pending"
              style={{ width: `${(diasPendientes / diasDisponibles) * 100}%` }}
            />
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
        <i className="bi bi-calendar-heart" />
        <h5>Saldo de Vacaciones</h5>
      </div>

      <div className="saldo-body">
        <div className="saldo-main-full">
          <div className="saldo-disponible">
            <span className="numero">{restantes}</span>
            <span className="label">días disponibles</span>
          </div>
          <div className="saldo-total">
            de {diasDisponibles} días totales este año
          </div>
          {mesesAntiguedad !== null && (
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
              <i className="bi bi-calendar3 me-1" />
              {etiquetaAntiguedad()}
            </div>
          )}
        </div>

        <div className="saldo-progress-full">
          <div className="progress-bar-full">
            <div
              className="progress-fill used"
              style={{ width: `${(diasUsados / diasDisponibles) * 100}%` }}
              title={`${diasUsados} días usados`}
            />
            <div
              className="progress-fill pending"
              style={{ width: `${(diasPendientes / diasDisponibles) * 100}%` }}
              title={`${diasPendientes} días en solicitudes pendientes`}
            />
          </div>
        </div>

        <div className="saldo-detalle">
          <div className="detalle-item">
            <span className="detalle-color used" />
            <span className="detalle-label">Usados</span>
            <span className="detalle-value">{diasUsados} días</span>
          </div>
          {diasPendientes > 0 && (
            <div className="detalle-item">
              <span className="detalle-color pending" />
              <span className="detalle-label">En solicitudes pendientes</span>
              <span className="detalle-value">{diasPendientes} días</span>
            </div>
          )}
          <div className="detalle-item">
            <span className="detalle-color available" />
            <span className="detalle-label">Disponibles</span>
            <span className="detalle-value">{restantes} días</span>
          </div>
        </div>
      </div>

      {saldo.ultimaActualizacion && (
        <div className="saldo-footer">
          <small className="text-muted">
            <i className="bi bi-clock me-1" />
            Actualizado: {new Date(saldo.ultimaActualizacion?.seconds ? saldo.ultimaActualizacion.seconds * 1000 : saldo.ultimaActualizacion).toLocaleDateString('es-MX')}
          </small>
        </div>
      )}
    </div>
  );
}

export default SaldoVacaciones;
