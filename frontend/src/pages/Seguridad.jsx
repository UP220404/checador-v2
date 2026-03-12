import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import '../styles/Seguridad.css';

function Seguridad() {
  const [accesosSospechosos, setAccesosSospechosos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    ultimas24h: 0,
    ultima1h: 0,
    recargas: 0,
    directos: 0
  });

  useEffect(() => {
    cargarAccesosSospechosos();
  }, []);

  const cargarAccesosSospechosos = async () => {
    try {
      setLoading(true);

      // TODO: Implementar endpoint en el backend para accesos sospechosos
      // Por ahora, no hay datos reales disponibles
      console.warn('[Seguridad] El endpoint de seguridad no está implementado en el backend');

      setAccesosSospechosos([]);
      setStats({
        ultimas24h: 0,
        ultima1h: 0,
        recargas: 0,
        directos: 0
      });

    } catch (error) {
      console.error('Error cargando accesos sospechosos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="section-header">
        <h2>
          <i className="bi bi-shield-exclamation me-2"></i>
          Monitor de Seguridad
        </h2>
        <button className="btn btn-outline-primary" onClick={cargarAccesosSospechosos}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Actualizar
        </button>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="bi bi-shield-exclamation me-2"></i>
                Accesos Sospechosos - Detección en Tiempo Real
              </h5>
            </div>
            <div className="card-body">
              {/* Métricas rápidas */}
              <div className="row mb-4 g-3">
                <div className="col-md-3">
                  <div className="alert alert-danger text-center mb-0">
                    <h6>Últimas 24h</h6>
                    <h4>{stats.ultimas24h}</h4>
                    <small>intentos sospechosos</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="alert alert-warning text-center mb-0">
                    <h6>Última hora</h6>
                    <h4>{stats.ultima1h}</h4>
                    <small>intentos recientes</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="alert alert-info text-center mb-0">
                    <h6>Recargas</h6>
                    <h4>{stats.recargas}</h4>
                    <small>páginas recargadas</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="alert alert-secondary text-center mb-0">
                    <h6>Accesos directos</h6>
                    <h4>{stats.directos}</h4>
                    <small>sin QR</small>
                  </div>
                </div>
              </div>

              {/* Información del sistema */}
              <div className="alert alert-warning mb-4">
                <h6>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Funcionalidad en Desarrollo
                </h6>
                <p className="mb-2">
                  <strong>Esta página está lista para mostrar accesos sospechosos, pero el endpoint del backend aún no está implementado.</strong>
                </p>
                <p className="mb-2">Cuando esté implementado, el sistema detectará:</p>
                <ul className="mb-0">
                  <li><strong>Recargas de página:</strong> Usuarios que recargan para saltarse validaciones</li>
                  <li><strong>Accesos directos:</strong> Intentos de acceder sin escanear QR</li>
                  <li><strong>Navegación con historial:</strong> Uso de botones atrás/adelante</li>
                  <li><strong>Patrones sospechosos:</strong> Múltiples intentos en poco tiempo</li>
                </ul>
              </div>

              <div className="alert alert-info mb-4">
                <h6>
                  <i className="bi bi-code-slash me-2"></i>
                  Para Desarrolladores
                </h6>
                <p className="mb-0">
                  Para implementar esta funcionalidad, se necesita crear un endpoint en el backend que:
                </p>
                <ol className="mb-0 mt-2">
                  <li>Registre eventos de navegación sospechosos</li>
                  <li>Almacene logs de acceso con metadatos (IP, user agent, referer)</li>
                  <li>Proporcione un endpoint GET para consultar estos registros</li>
                  <li>Incluya filtros por fecha y tipo de evento</li>
                </ol>
              </div>

              {/* Tabla de accesos */}
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th width="15%">Fecha/Hora</th>
                      <th width="20%">Usuario</th>
                      <th width="15%">Tipo</th>
                      <th width="20%">URL</th>
                      <th width="15%">IP</th>
                      <th width="15%">Navegador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="text-center py-3">
                          <div className="spinner-border spinner-border-sm text-warning me-2"></div>
                          Cargando datos de seguridad...
                        </td>
                      </tr>
                    ) : accesosSospechosos.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-3">
                          <i className="bi bi-shield-check text-success" style={{ fontSize: '2rem' }}></i>
                          <p className="mt-2 mb-0">No hay accesos sospechosos registrados</p>
                        </td>
                      </tr>
                    ) : (
                      accesosSospechosos.map((acceso) => (
                        <tr key={acceso.id}>
                          <td>{acceso.fechaHora}</td>
                          <td>{acceso.usuario}</td>
                          <td>
                            <span className={`badge ${
                              acceso.tipo === 'Recarga de página' ? 'bg-danger' :
                              acceso.tipo === 'Acceso directo' ? 'bg-warning' :
                              'bg-info'
                            }`}>
                              {acceso.tipo}
                            </span>
                          </td>
                          <td><code>{acceso.url}</code></td>
                          <td>{acceso.ip}</td>
                          <td>{acceso.navegador}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Seguridad;
