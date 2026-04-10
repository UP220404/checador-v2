import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

/**
 * AdminBackdoor - Herramienta visual para inyección manual de asistencias
 * Solo debería ser usada en ambiente local.
 */
const AdminBackdoor = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    user: '',
    fecha: new Date().toISOString().split('T')[0],
    horaEntrada: '08:00:00',
    horaSalida: '16:00:00',
    usarEntrada: true,
    usarSalida: true
  });

  // Base URL del backend
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/users-simple`);
        if (res.data.success) {
          setUsers(res.data.data);
        }
      } catch (err) {
        console.error('Error cargando usuarios:', err);
        toast.error('No se pudo conectar con el backend local');
      }
    };
    fetchUsers();
  }, [API_BASE]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user) return toast.warning('Selecciona un empleado');
    if (!formData.usarEntrada && !formData.usarSalida) {
      return toast.warning('Selecciona al menos un registro (Entrada o Salida)');
    }

    const user = JSON.parse(formData.user);
    const payload = {
      uid: user.uid,
      email: user.correo,
      nombre: user.nombre,
      tipo: user.tipo,
      fecha: formData.fecha,
      horaEntrada: formData.usarEntrada ? formData.horaEntrada : null,
      horaSalida: formData.usarSalida ? formData.horaSalida : null
    };

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/manual-attendance`, payload);
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error('Error al inyectar registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ 
      background: 'linear-gradient(135deg, #155d27 0%, #0a2e13 100%)',
      padding: '20px' 
    }}>
      <div className="card shadow-lg border-0" style={{ 
        maxWidth: '550px', 
        width: '100%', 
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="display-4 text-success mb-2">
              <i className="bi bi-shield-lock-fill"></i>
            </div>
            <h2 className="fw-bold text-success m-0">ADMIN BACKDOOR</h2>
            <p className="text-muted small">Herramienta de Control Maestro</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="form-label fw-bold">1. Selección de Empleado</label>
              <select 
                className="form-select" 
                required 
                value={formData.user}
                onChange={(e) => setFormData({...formData, user: e.target.value})}
              >
                <option value="">-- Buscar Ente --</option>
                {users.map(u => (
                  <option key={u.uid} value={JSON.stringify(u)}>
                    {u.nombre} ({u.correo})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold">2. Fecha del Registro</label>
              <input 
                type="date" 
                className="form-control" 
                required 
                value={formData.fecha}
                onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-bold m-0 small">Entrada</label>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      checked={formData.usarEntrada}
                      onChange={(e) => setFormData({...formData, usarEntrada: e.target.checked})}
                    />
                  </div>
                </div>
                <input 
                  type="time" 
                  step="1"
                  className="form-control" 
                  disabled={!formData.usarEntrada}
                  value={formData.horaEntrada}
                  onChange={(e) => setFormData({...formData, horaEntrada: e.target.value})}
                />
              </div>

              <div className="col-md-6 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-bold m-0 small">Salida</label>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      checked={formData.usarSalida}
                      onChange={(e) => setFormData({...formData, usarSalida: e.target.checked})}
                    />
                  </div>
                </div>
                <input 
                  type="time" 
                  step="1"
                  className="form-control" 
                  disabled={!formData.usarSalida}
                  value={formData.horaSalida}
                  onChange={(e) => setFormData({...formData, horaSalida: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-light p-3 rounded-3 mb-4 text-center border">
              <p className="text-muted small m-0">
                <i className="bi bi-info-circle me-1"></i>
                Se usarán los segundos exactos especificados para mayor realismo.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn btn-success w-100 py-3 fw-bold shadow-sm"
              disabled={loading}
              style={{ borderRadius: '16px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Inyectando...
                </>
              ) : (
                <>
                  <i className="bi bi-lightning-fill me-2"></i>
                  EJECUTAR INYECCIÓN
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-top text-center">
            <a href="/" className="text-decoration-none text-muted small">
              <i className="bi bi-arrow-left me-1"></i> Volver al Sistema
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBackdoor;
