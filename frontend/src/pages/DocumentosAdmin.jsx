import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import '../styles/DocumentosAdmin.css';

// Tipos de documentos
const TIPOS_DOCUMENTO = [
  { value: 'contrato', label: 'Contrato', icon: 'bi-file-earmark-text', color: 'primary' },
  { value: 'recibo_nomina', label: 'Recibo de Nomina', icon: 'bi-receipt', color: 'success' },
  { value: 'constancia', label: 'Constancia', icon: 'bi-award', color: 'info' },
  { value: 'acta_administrativa', label: 'Acta Administrativa', icon: 'bi-exclamation-triangle', color: 'warning' },
  { value: 'carta_recomendacion', label: 'Carta de Recomendacion', icon: 'bi-envelope-paper', color: 'secondary' },
  { value: 'identificacion', label: 'Identificacion', icon: 'bi-person-badge', color: 'dark' },
  { value: 'comprobante_domicilio', label: 'Comprobante de Domicilio', icon: 'bi-house', color: 'info' },
  { value: 'certificado', label: 'Certificado', icon: 'bi-patch-check', color: 'success' },
  { value: 'otro', label: 'Otro', icon: 'bi-file-earmark', color: 'secondary' }
];

// Datos de ejemplo
const EJEMPLO_DOCUMENTOS = [
  {
    id: 'doc-1',
    titulo: 'Contrato Laboral 2026',
    tipo: 'contrato',
    descripcion: 'Contrato por tiempo indeterminado',
    empleadoNombre: 'Maria Garcia',
    empleadoEmail: 'maria@ejemplo.com',
    fechaSubida: '2026-01-15',
    tamanio: '245 KB',
    esEjemplo: true
  },
  {
    id: 'doc-2',
    titulo: 'Recibo Nomina Enero 2026',
    tipo: 'recibo_nomina',
    descripcion: 'Periodo del 1 al 15 de enero',
    empleadoNombre: 'Juan Lopez',
    empleadoEmail: 'juan@ejemplo.com',
    fechaSubida: '2026-01-16',
    tamanio: '89 KB',
    esEjemplo: true
  },
  {
    id: 'doc-3',
    titulo: 'Constancia Laboral',
    tipo: 'constancia',
    descripcion: 'Constancia de trabajo activo',
    empleadoNombre: 'Ana Martinez',
    empleadoEmail: 'ana@ejemplo.com',
    fechaSubida: '2026-01-20',
    tamanio: '156 KB',
    esEjemplo: true
  },
  {
    id: 'doc-4',
    titulo: 'Certificado ISO 9001',
    tipo: 'certificado',
    descripcion: 'Certificacion de calidad completada',
    empleadoNombre: 'Carlos Ruiz',
    empleadoEmail: 'carlos@ejemplo.com',
    fechaSubida: '2026-01-22',
    tamanio: '312 KB',
    esEjemplo: true
  }
];

function DocumentosAdmin() {
  const [documentos, setDocumentos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [usandoEjemplos, setUsandoEjemplos] = useState(false);
  const [stats, setStats] = useState(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    empleadoUid: '',
    tipo: 'contrato',
    titulo: '',
    descripcion: '',
    archivo: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Solo cargar la lista de empleados inicialmente (1 llamada a la API)
      const usersRes = await api.getUsers();
      const empleadosData = usersRes.data.data || [];
      setEmpleados(empleadosData);

      // NO cargar documentos de todos los empleados para ahorrar peticiones
      // Los documentos se cargan solo cuando se selecciona un empleado
      setDocumentos([]);
      setUsandoEjemplos(false);

      // Stats iniciales
      const statsCalc = {
        total: 0,
        porTipo: TIPOS_DOCUMENTO.reduce((acc, tipo) => {
          acc[tipo.value] = 0;
          return acc;
        }, {}),
        empleadosConDocs: 0
      };
      setStats(statsCalc);

    } catch (err) {
      console.error('Error cargando datos:', err);
      setDocumentos(EJEMPLO_DOCUMENTOS);
      setUsandoEjemplos(true);
    } finally {
      setLoading(false);
    }
  };

  // Cargar documentos de un empleado especifico
  const loadEmployeeDocuments = async (emp) => {
    try {
      const uid = emp.uid || emp.id;
      const docsRes = await api.getUserDocuments(uid, {});
      const empDocs = (docsRes.data.data || []).map(d => ({
        ...d,
        titulo: d.nombre || d.titulo, // Alias para compatibilidad
        empleadoNombre: emp.nombre,
        empleadoEmail: emp.email || emp.correo
      }));

      if (empDocs.length > 0) {
        setDocumentos(empDocs);
        setUsandoEjemplos(false);
      } else {
        // Mostrar mensaje de que no tiene documentos
        setDocumentos([]);
      }
    } catch (err) {
      console.log('Error cargando documentos del empleado:', err);
      setDocumentos([]);
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.empleadoUid || !formData.titulo || !formData.tipo) {
      showMessage('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    if (!formData.archivo) {
      showMessage('Por favor selecciona un archivo', 'error');
      return;
    }

    try {
      setUploading(true);
      const empleado = empleados.find(e => (e.uid || e.id) === formData.empleadoUid);

      if (!empleado) {
        showMessage('Empleado no encontrado', 'error');
        return;
      }

      // Subir archivo a Firebase Storage
      const timestamp = Date.now();
      const nombreArchivo = `${timestamp}_${formData.archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storageRef = ref(storage, `documentos/${formData.empleadoUid}/${nombreArchivo}`);

      // Subir el archivo
      const uploadResult = await uploadBytes(storageRef, formData.archivo);
      console.log('Archivo subido:', uploadResult);

      // Obtener URL de descarga
      const downloadUrl = await getDownloadURL(storageRef);
      console.log('URL de descarga:', downloadUrl);

      // Guardar en la base de datos
      await api.uploadDocument({
        uid: formData.empleadoUid,
        tipo: formData.tipo,
        nombre: formData.titulo,
        descripcion: formData.descripcion || '',
        url: downloadUrl,
        tamano: formData.archivo.size,
        mimeType: formData.archivo.type || 'application/pdf',
        visible: true
      });

      showMessage('Documento subido exitosamente', 'success');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Error subiendo documento:', err);
      let errorMsg = 'Error al subir el documento';

      if (err.code === 'storage/unauthorized') {
        errorMsg = 'No tienes permisos para subir archivos. Verifica las reglas de Storage.';
      } else if (err.code === 'storage/quota-exceeded') {
        errorMsg = 'Se excedio la cuota de almacenamiento.';
      } else if (err.message?.includes('CORS') || err.message?.includes('preflight') || err.message?.includes('ERR_FAILED')) {
        errorMsg = 'Error de CORS. Ejecuta: gsutil cors set cors.json gs://qr-acceso-cielito-home.appspot.com';
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.message) {
        errorMsg = err.message;
      }

      showMessage(errorMsg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, esEjemplo) => {
    if (esEjemplo) {
      showMessage('Los ejemplos no se pueden eliminar', 'warning');
      return;
    }
    
    const result = await Swal.fire({
      title: '¿Eliminar documento?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;

    try {
      await api.deleteDocument(docId);
      showMessage('Documento eliminado', 'success');
      loadData();
    } catch (err) {
      console.error('Error eliminando documento:', err);
      showMessage('Error al eliminar el documento', 'error');
    }
  };

  const handleVerDocumentos = async (empleado) => {
    setSelectedEmpleado(empleado);
    setFiltroEmpleado(empleado.email || empleado.correo);
    await loadEmployeeDocuments(empleado);
  };

  const showMessage = (msg, type) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setError(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(msg);
      setSuccessMsg(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  const resetForm = () => {
    setFormData({
      empleadoUid: '',
      tipo: 'contrato',
      titulo: '',
      descripcion: '',
      archivo: null
    });
  };

  const getTipoConfig = (tipo) => {
    return TIPOS_DOCUMENTO.find(t => t.value === tipo) || TIPOS_DOCUMENTO[TIPOS_DOCUMENTO.length - 1];
  };

  const filtrarDocumentos = () => {
    return documentos.filter(doc => {
      if (filtroTipo && doc.tipo !== filtroTipo) return false;
      if (filtroEmpleado && doc.empleadoEmail !== filtroEmpleado) return false;
      if (busqueda) {
        const searchLower = busqueda.toLowerCase();
        const docName = (doc.nombre || doc.titulo || '').toLowerCase();
        if (!docName.includes(searchLower) &&
            !doc.empleadoNombre?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-muted">Cargando documentos...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="documentos-admin-container">
        {/* Header */}
        <div className="page-header mb-4">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h2 className="mb-1">
                <i className="bi bi-folder-fill text-warning me-2"></i>
                Documentos de Empleados
              </h2>
              <p className="text-muted mb-0">Sube y administra documentos para cada empleado</p>
            </div>
            <div className="col-md-6 text-md-end">
              <button
                className="btn btn-primary btn-lg shadow-sm"
                onClick={() => { resetForm(); setShowModal(true); }}
              >
                <i className="bi bi-cloud-upload me-2"></i>
                Subir Documento
              </button>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {usandoEjemplos && (
          <div className="alert alert-info alert-dismissible fade show d-flex align-items-center">
            <i className="bi bi-info-circle-fill me-2 fs-5"></i>
            <div>
              <strong>Modo Demo:</strong> Estos son ejemplos para mostrar como funciona el sistema.
              Sube tu primer documento para comenzar.
            </div>
            <button type="button" className="btn-close" onClick={() => setUsandoEjemplos(false)}></button>
          </div>
        )}

        {error && (
          <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center">
            <i className="bi bi-exclamation-circle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show d-flex align-items-center">
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMsg}
            <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                    <i className="bi bi-files"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.total || 0}</h3>
                    <small className="text-muted">Total Documentos</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-success bg-opacity-10 text-success">
                    <i className="bi bi-file-earmark-text"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.porTipo?.contrato || 0}</h3>
                    <small className="text-muted">Contratos</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-info bg-opacity-10 text-info">
                    <i className="bi bi-receipt"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.porTipo?.recibo_nomina || 0}</h3>
                    <small className="text-muted">Recibos Nomina</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                    <i className="bi bi-people"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.empleadosConDocs || 0}</h3>
                    <small className="text-muted">Empleados con Docs</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Panel Izquierdo - Lista de Empleados */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-transparent">
                <h5 className="mb-0">
                  <i className="bi bi-people me-2"></i>
                  Empleados
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="list-group list-group-flush employee-list">
                  {empleados.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-people display-4"></i>
                      <p className="mt-2">No hay empleados registrados</p>
                    </div>
                  ) : (
                    empleados.map((emp) => {
                      const empEmail = emp.email || emp.correo;
                      const docsCount = documentos.filter(d => d.empleadoEmail === empEmail).length;
                      const isSelected = filtroEmpleado === empEmail;

                      return (
                        <button
                          key={emp.uid || emp.id}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isSelected ? 'active' : ''}`}
                          onClick={() => handleVerDocumentos(emp)}
                        >
                          <div className="d-flex align-items-center">
                            <div className="avatar-circle me-3">
                              {emp.nombre?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="fw-medium">{emp.nombre}</div>
                              <small className={isSelected ? 'text-white-50' : 'text-muted'}>
                                {emp.departamento || 'Sin departamento'}
                              </small>
                            </div>
                          </div>
                          <span className={`badge ${isSelected ? 'bg-white text-primary' : 'bg-primary'} rounded-pill`}>
                            {docsCount}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              {filtroEmpleado && (
                <div className="card-footer bg-transparent">
                  <button
                    className="btn btn-sm btn-outline-secondary w-100"
                    onClick={() => { setFiltroEmpleado(''); setSelectedEmpleado(null); }}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Ver todos los documentos
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho - Documentos */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent">
                <div className="row align-items-center">
                  <div className="col">
                    <h5 className="mb-0">
                      <i className="bi bi-folder2-open me-2"></i>
                      {selectedEmpleado
                        ? `Documentos de ${selectedEmpleado.nombre}`
                        : 'Todos los Documentos'}
                    </h5>
                  </div>
                  <div className="col-auto">
                    {selectedEmpleado && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => {
                          setFormData({ ...formData, empleadoUid: selectedEmpleado.uid || selectedEmpleado.id });
                          setShowModal(true);
                        }}
                      >
                        <i className="bi bi-plus-circle me-1"></i>
                        Subir a {selectedEmpleado.nombre?.split(' ')[0]}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="card-body border-bottom py-3">
                <div className="row g-2 align-items-center">
                  <div className="col-md-4">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text"><i className="bi bi-search"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar documento..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <select
                      className="form-select form-select-sm"
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                    >
                      <option value="">Todos los tipos</option>
                      {TIPOS_DOCUMENTO.map(tipo => (
                        <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4 text-end">
                    <span className="badge bg-light text-dark">
                      {filtrarDocumentos().length} documentos
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Documentos */}
              <div className="card-body documents-list p-0">
                {filtrarDocumentos().length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-folder2 display-1 text-muted opacity-25"></i>
                    <p className="text-muted mt-3">
                      {selectedEmpleado
                        ? `${selectedEmpleado.nombre} no tiene documentos`
                        : 'Selecciona un empleado de la lista para ver sus documentos'}
                    </p>
                    {selectedEmpleado && (
                      <button
                        className="btn btn-primary"
                        onClick={() => { resetForm(); setShowModal(true); }}
                      >
                        <i className="bi bi-cloud-upload me-2"></i>
                        Subir Documento
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '40%' }}>Documento</th>
                          <th>Empleado</th>
                          <th>Tipo</th>
                          <th>Fecha</th>
                          <th className="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrarDocumentos().map((doc) => {
                          const tipoConfig = getTipoConfig(doc.tipo);
                          return (
                            <tr key={doc.id} className={doc.esEjemplo ? 'table-light' : ''}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className={`doc-icon bg-${tipoConfig.color} bg-opacity-10 text-${tipoConfig.color} me-3`}>
                                    <i className={`bi ${tipoConfig.icon}`}></i>
                                  </div>
                                  <div>
                                    <div className="fw-medium">{doc.nombre || doc.titulo}</div>
                                    <small className="text-muted">{doc.descripcion || 'Sin descripcion'}</small>
                                    {doc.esEjemplo && <span className="badge bg-info ms-2">Demo</span>}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="avatar-circle-sm me-2">
                                    {doc.empleadoNombre?.charAt(0) || '?'}
                                  </div>
                                  <span>{doc.empleadoNombre}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`badge bg-${tipoConfig.color}`}>
                                  {tipoConfig.label}
                                </span>
                              </td>
                              <td>
                                <small className="text-muted">{doc.fechaSubida}</small>
                              </td>
                              <td className="text-end">
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    title="Descargar"
                                    disabled={doc.esEjemplo}
                                  >
                                    <i className="bi bi-download"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    title="Eliminar"
                                    onClick={() => handleDelete(doc.id, doc.esEjemplo)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Subir Documento */}
        {showModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-cloud-upload me-2"></i>
                    Subir Documento
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Empleado *</label>
                      <select
                        className="form-select"
                        value={formData.empleadoUid}
                        onChange={(e) => setFormData({ ...formData, empleadoUid: e.target.value })}
                        required
                      >
                        <option value="">Seleccionar empleado...</option>
                        {empleados.map((emp) => (
                          <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                            {emp.nombre} - {emp.departamento || 'Sin departamento'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Tipo de Documento *</label>
                      <select
                        className="form-select"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        required
                      >
                        {TIPOS_DOCUMENTO.map(tipo => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Titulo del Documento *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        placeholder="Ej: Contrato Laboral 2026"
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Descripcion</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Descripcion breve del documento..."
                      ></textarea>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Archivo</label>
                      <div className="upload-zone p-4 text-center border rounded bg-light">
                        <i className="bi bi-cloud-arrow-up display-4 text-muted"></i>
                        <p className="text-muted mb-2">Arrastra el archivo aqui o haz clic para seleccionar</p>
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) => setFormData({ ...formData, archivo: e.target.files[0] })}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                        <small className="text-muted d-block mt-2">
                          Formatos permitidos: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setShowModal(false)}
                      disabled={uploading}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                      {uploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-upload me-2"></i>
                          Subir Documento
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default DocumentosAdmin;
