import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

function DocumentosTab({ userData, mostrarMensaje }) {
  const [documentos, setDocumentos] = useState([]);
  const [allDocumentos, setAllDocumentos] = useState([]); // Cache de todos los documentos
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [anioRecibos, setAnioRecibos] = useState(new Date().getFullYear());

  // Control para evitar cargas duplicadas
  const dataLoaded = useRef(false);

  useEffect(() => {
    if (userData && !dataLoaded.current) {
      cargarDocumentos();
    }
  }, [userData]);

  // Filtrar documentos en memoria cuando cambia el filtro
  useEffect(() => {
    if (allDocumentos.length > 0) {
      if (filtroTipo) {
        setDocumentos(allDocumentos.filter(d => d.tipo === filtroTipo));
      } else {
        setDocumentos(allDocumentos);
      }
    }
  }, [filtroTipo, allDocumentos]);

  const cargarDocumentos = async () => {
    try {
      setLoading(true);
      dataLoaded.current = true;

      const response = await api.getMyDocuments({});

      if (response.data.success) {
        const docs = response.data.data || [];
        setAllDocumentos(docs);
        setDocumentos(docs);
      }
    } catch (error) {
      console.error('Error cargando documentos:', error);
      // No mostrar error si es problema de cuota
      if (!error.message?.includes('Quota')) {
        mostrarMensaje('error', 'Error al cargar documentos');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDescargar = async (documento) => {
    try {
      window.open(documento.url, '_blank');
    } catch (error) {
      console.error('Error descargando documento:', error);
      mostrarMensaje('error', 'Error al descargar documento');
    }
  };

  const getTipoIcon = (tipo) => {
    const iconos = {
      contrato: 'bi-file-earmark-text',
      recibo_nomina: 'bi-receipt',
      certificado: 'bi-patch-check',
      otro: 'bi-file-earmark'
    };
    return iconos[tipo] || 'bi-file-earmark';
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      contrato: 'Contrato',
      recibo_nomina: 'Recibo de Nomina',
      certificado: 'Certificado',
      otro: 'Otro'
    };
    return labels[tipo] || tipo;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  // Agrupar documentos por tipo
  const documentosAgrupados = documentos.reduce((acc, doc) => {
    const tipo = doc.tipo || 'otro';
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(doc);
    return acc;
  }, {});

  const tiposConDocumentos = Object.keys(documentosAgrupados);

  return (
    <div className="documentos-tab">
      <h4 className="section-title">
        <i className="bi bi-folder2-open me-2 text-success"></i>
        Mis Documentos
      </h4>

      {/* Filtros */}
      <div className="documentos-filtros">
        <div className="filtro-group">
          <label className="form-label">Filtrar por tipo</label>
          <select
            className="form-control-portal"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos los documentos</option>
            <option value="contrato">Contratos</option>
            <option value="recibo_nomina">Recibos de Nomina</option>
            <option value="certificado">Certificados</option>
            <option value="otro">Otros</option>
          </select>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : documentos.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-folder-x"></i>
          <h5>Sin documentos</h5>
          <p>No tienes documentos disponibles</p>
          {filtroTipo && (
            <button
              className="btn-portal btn-portal-secondary"
              onClick={() => setFiltroTipo('')}
            >
              Ver todos los documentos
            </button>
          )}
        </div>
      ) : (
        <div className="documentos-content">
          {/* Vista por tipo */}
          {tiposConDocumentos.map((tipo) => (
            <div key={tipo} className="documento-seccion">
              <h5 className="seccion-titulo">
                <i className={`bi ${getTipoIcon(tipo)} me-2`}></i>
                {getTipoLabel(tipo)}
                <span className="badge bg-secondary ms-2">
                  {documentosAgrupados[tipo].length}
                </span>
              </h5>

              <div className="documentos-lista">
                {documentosAgrupados[tipo].map((doc) => (
                  <div key={doc.id} className="documento-card">
                    <div className="documento-icon">
                      <i className={`bi ${getTipoIcon(doc.tipo)}`}></i>
                    </div>

                    <div className="documento-info">
                      <span className="documento-nombre">{doc.nombre}</span>
                      <div className="documento-meta">
                        <span>
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatDate(doc.fechaSubida)}
                        </span>
                        <span>
                          <i className="bi bi-file-earmark me-1"></i>
                          {formatFileSize(doc.tamano)}
                        </span>
                        {doc.periodoNomina && (
                          <span>
                            <i className="bi bi-calendar-range me-1"></i>
                            {doc.periodoNomina.quincena === 'primera' ? '1ra' : '2da'} quincena {doc.periodoNomina.mes}/{doc.periodoNomina.anio}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="documento-actions">
                      <button
                        className="btn-download"
                        onClick={() => handleDescargar(doc)}
                        title="Descargar"
                      >
                        <i className="bi bi-download"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aviso */}
      <div className="documentos-aviso">
        <i className="bi bi-info-circle me-2"></i>
        Los documentos son subidos por el departamento de Recursos Humanos.
        Si necesitas algun documento, contacta a RH.
      </div>
    </div>
  );
}

export default DocumentosTab;
