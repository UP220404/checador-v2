import axios from 'axios';
import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación
// Usa Firebase getIdToken() que renueva automáticamente tokens expirados
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (auth.currentUser) {
        // getIdToken() renueva el token automáticamente si expiró
        const token = await auth.currentUser.getIdToken();
        sessionStorage.setItem('authToken', token);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Fallback a sessionStorage si Firebase auth aún no inicializa
        const token = sessionStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      // Si falla la renovación, usar token existente
      const token = sessionStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
apiClient.interceptors.response.use(
  (response) => {
    // Transformar uid a id para consistencia en el frontend
    if (response.data?.data) {
      if (Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map(item => {
          if (item.uid && !item.id) {
            return { ...item, id: item.uid };
          }
          return item;
        });
      } else if (response.data.data.uid && !response.data.data.id) {
        response.data.data = { ...response.data.data, id: response.data.data.uid };
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const api = {
  // Users
  getUsers: () => apiClient.get('/users'),
  getUserById: (id) => apiClient.get(`/users/${id}`),
  getCurrentUserRole: () => apiClient.get('/users/me/role'),
  getOrganigrama: () => apiClient.get('/users/organigrama'),
  createUser: (data) => apiClient.post('/users', data),
  updateUser: (id, data) => apiClient.put(`/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/users/${id}`),
  deactivateUser: (id, data) => apiClient.patch(`/users/${id}/deactivate`, data),
  reactivateUser: (id) => apiClient.put(`/users/${id}`, { activo: true, motivoBaja: null, fechaBaja: null, observacionesBaja: null, fechaRetencionHasta: null }),

  // Attendance
  getTodayAttendance: () => apiClient.get('/attendance/today'),
  getAttendanceRecords: (params = {}) => {
    // Use user-specific history endpoint
    if (params.userId) {
      return apiClient.get(`/attendance/history/${params.userId}`, {
        params: {
          limit: params.limit || 30,
          startDate: params.startDate,
          endDate: params.endDate
        }
      });
    }

    // Fallback to weekly report endpoint for admin views
    const today = new Date();
    const defaultEndDate = today.toISOString().split('T')[0];
    const defaultStartDate = new Date(today.setDate(today.getDate() - 90)).toISOString().split('T')[0];

    return apiClient.get('/reports/weekly', {
      params: {
        fechaInicio: params.fechaInicio || params.startDate || defaultStartDate,
        fechaFin: params.fechaFin || params.endDate || defaultEndDate
      }
    });
  },
  registerAttendance: (data) => apiClient.post('/attendance/check-in', data),
  registerManualAttendance: (data) => apiClient.post('/attendance/manual', data),
  deleteAttendanceRecord: (id) => apiClient.delete(`/attendance/${id}`),

  // QR
  generateQR: () => apiClient.post('/qr/generate'),
  validateQR: (token) => apiClient.post('/qr/validate', { token }),
  getQRStats: () => apiClient.get('/qr/stats'),

  // Payroll
  validatePayrollPassword: (password) => apiClient.post('/payroll/validate-password', { password }),
  getPayrollConfig: (uid) => apiClient.get(`/users/${uid}/payroll-config`),
  updatePayrollConfig: (uid, config) => apiClient.put(`/users/${uid}/payroll-config`, config),
  getPayrollPeriod: (mes, anio, tipoNomina) =>
    apiClient.get(`/payroll/period/${mes}/${anio}`, { params: { tipoNomina } }),
  getPayrollEmployees: (tipoNomina) =>
    apiClient.get('/payroll/employees', { params: { tipoNomina } }),
  calculatePayroll: (data) => apiClient.post('/payroll/calculate', data),
  savePayroll: (data) => apiClient.post('/payroll/save', data),
  calculateAndSavePayroll: (data) => apiClient.post('/payroll/calculate-and-save', data),
  getPayroll: (periodoId) => apiClient.get(`/payroll/${periodoId}`),
  updateManualConcept: (periodoId, empleadoId, data) =>
    apiClient.put(`/payroll/${periodoId}/employee/${empleadoId}/concept`, data),
  getWeeksOfMonth: (anio, mes) => apiClient.get(`/payroll/weeks/${anio}/${mes}`),
  sendPayrollEmails: (nominasCalculadas, periodo) =>
    apiClient.post('/payroll/send-emails', { nominasCalculadas, periodo }),

  // Payroll Employee Portal
  getMyPayrollHistory: (params) => apiClient.get('/payroll/my-history', { params }),
  getMyPayrollProjection: (params) => apiClient.get('/payroll/my-projection', { params }),

  // Holidays
  getHolidays: (anio) => apiClient.get(`/payroll/holidays/${anio}`),
  createHoliday: (data) => apiClient.post('/payroll/holidays', data),
  deleteHoliday: (id) => apiClient.delete(`/payroll/holidays/${id}`),

  // Absences (Admin)
  getAbsences: (params) => apiClient.get('/absences', { params }),
  getAbsenceById: (id) => apiClient.get(`/absences/${id}`),
  createAbsence: (data) => apiClient.post('/absences', data),
  updateAbsence: (id, data) => apiClient.put(`/absences/${id}`, data),
  approveAbsence: (id) => apiClient.put(`/absences/${id}/approve`),
  rejectAbsence: (id) => apiClient.put(`/absences/${id}/reject`),
  deleteAbsence: (id) => apiClient.delete(`/absences/${id}`),
  getAbsenceStats: () => apiClient.get('/absences/stats'),
  getUrgentAbsenceRequests: () => apiClient.get('/absences/urgent'),

  // Absences (Employee Portal)
  getMyAbsenceRequests: (params) => apiClient.get('/absences/my-requests', { params }),
  createAbsenceRequest: (data) => apiClient.post('/absences/request', data),
  cancelMyAbsenceRequest: (id) => apiClient.delete(`/absences/my-requests/${id}`),

  // User Profile (Employee Portal)
  updateMyProfile: (uid, data) => apiClient.put(`/users/${uid}/profile`, data),

  // ============================================
  // PORTAL EMPLEADO V2
  // ============================================

  // User Profile Extended
  updateProfileExtended: (uid, data) => apiClient.put(`/users/${uid}/profile-extended`, data),
  updateProfilePhoto: (uid, file) => {
    const formData = new FormData();
    formData.append('foto', file);
    return apiClient.put(`/users/${uid}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteProfilePhoto: (uid) => apiClient.delete(`/users/${uid}/foto`),

  // Fechas Importantes
  getFechasImportantes: (uid) => apiClient.get(`/users/${uid}/fechas-importantes`),
  addFechaImportante: (uid, data) => apiClient.post(`/users/${uid}/fechas-importantes`, data),
  deleteFechaImportante: (uid, fechaId) => apiClient.delete(`/users/${uid}/fechas-importantes/${fechaId}`),

  // Preferencias de Notificaciones
  updatePreferenciasNotificaciones: (uid, data) => apiClient.put(`/users/${uid}/preferencias`, data),

  // Saldo de Vacaciones
  getSaldoVacaciones: (uid) => apiClient.get(`/users/${uid}/vacaciones-saldo`),
  updateSaldoVacaciones: (uid, data) => apiClient.put(`/users/${uid}/vacaciones-saldo`, data),
  recalcularSaldoVacaciones: (uid) => apiClient.post(`/users/${uid}/vacaciones-recalcular`),
  // Panel RH — todos los empleados con su saldo calculado
  getVacacionesPanel: () => apiClient.get('/users/vacaciones-panel'),

  // Admin Profile Update
  updateProfileByAdmin: (uid, data) => apiClient.put(`/users/${uid}/admin-profile`, data),

  // Attendance Summary (Portal Empleado)
  getAttendanceSummary: (uid) => apiClient.get(`/attendance/summary/${uid}`),
  getAttendanceMonthlyReport: (uid, year, month) => apiClient.get(`/attendance/monthly/${uid}/${year}/${month}`),
  getTodayRecord: (uid) => apiClient.get(`/attendance/today-record/${uid}`),

  // Documents
  getMyDocuments: (params) => apiClient.get('/documents/my', { params }),
  getAllDocumentsAdmin: () => apiClient.get('/documents/admin/all'),
  getGlobalDocumentCounts: () => apiClient.get('/documents/admin/counts'),
  getMyPayrollReceipts: (params) => apiClient.get('/documents/my/payroll', { params }),
  getMyDocumentCount: () => apiClient.get('/documents/my/count'),
  getDocument: (id) => apiClient.get(`/documents/${id}`),
  getUserDocuments: (uid, params) => apiClient.get(`/documents/user/${uid}`, { params }),
  uploadDocument: (data) => {
    // Si data tiene un archivo, enviar como FormData
    if (data.archivo) {
      const formData = new FormData();
      formData.append('archivo', data.archivo);
      formData.append('uid', data.uid);
      formData.append('tipo', data.tipo);
      formData.append('nombre', data.nombre);
      if (data.descripcion) formData.append('descripcion', data.descripcion);
      if (data.visible !== undefined) formData.append('visible', data.visible);
      if (data.periodoNomina) formData.append('periodoNomina', data.periodoNomina);
      return apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    // Fallback para compatibilidad
    return apiClient.post('/documents/upload', data);
  },
  updateDocument: (id, data) => apiClient.put(`/documents/${id}`, data),
  deleteDocument: (id) => apiClient.delete(`/documents/${id}`),

  // Notifications
  getMyNotifications: (params) => apiClient.get('/notifications/my', { params }),
  getUnreadNotificationCount: () => apiClient.get('/notifications/unread-count'),
  markNotificationAsRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllNotificationsAsRead: () => apiClient.put('/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  sendNotification: (data) => apiClient.post('/notifications/send', data),
  cleanupOldNotifications: (params) => apiClient.post('/notifications/cleanup', null, { params }),

  // Settings (Admin RH only)
  getAllSettings: () => apiClient.get('/settings'),
  getSettings: (category) => apiClient.get(`/settings/${category}`),
  updateSettings: (category, data) => apiClient.put(`/settings/${category}`, data),
  addAbsenceType: (data) => apiClient.post('/settings/ausencias/tipos', data),
  updateAbsenceType: (typeId, data) => apiClient.put(`/settings/ausencias/tipos/${typeId}`, data),
  deleteAbsenceType: (typeId) => apiClient.delete(`/settings/ausencias/tipos/${typeId}`),
  addDepartment: (nombre) => apiClient.post('/settings/departamentos', { nombre }),
  removeDepartment: (nombre) => apiClient.delete(`/settings/departamentos/${encodeURIComponent(nombre)}`),

  // Reports
  getDailyReport: (date) => apiClient.get('/reports/daily', { params: { fecha: date } }),
  getWeeklyReport: (startDate, endDate) =>
    apiClient.get('/reports/weekly', { params: { fechaInicio: startDate, fechaFin: endDate } }),
  getMonthlyReport: (month, year) => {
    // Calculate first and last day of the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const fechaInicio = firstDay.toISOString().split('T')[0];
    const fechaFin = lastDay.toISOString().split('T')[0];
    return apiClient.get('/reports/weekly', { params: { fechaInicio, fechaFin } });
  },
  getAbsencesReport: (params) => apiClient.get('/reports/absences', { params }),
  getPayrollReport: (id) => apiClient.get(`/reports/payroll/${id}`),
  exportAttendanceExcel: (params) =>
    apiClient.get('/reports/export/attendance-excel', { params, responseType: 'blob' }),
  exportAttendancePDF: (params) =>
    apiClient.get('/reports/export/attendance-pdf', { params, responseType: 'blob' }),
  exportPayrollExcel: (id) =>
    apiClient.get(`/reports/export/payroll-excel/${id}`, { responseType: 'blob' }),
  exportAbsencesPDF: (params) =>
    apiClient.get('/reports/export/absences-pdf', { params, responseType: 'blob' }),
  generateMissingRankings: () => apiClient.post('/reports/generate-rankings'),
  getAnalyticsSummary: () => apiClient.get('/reports/analytics'),

  // User-specific attendance report
  getUserAttendanceReport: (params) =>
    apiClient.get('/reports/user-attendance', { params }),
  exportUserAttendanceExcel: (params) =>
    apiClient.get('/reports/export/user-attendance-excel', { params, responseType: 'blob' }),
  exportUserAttendancePDF: (params) =>
    apiClient.get('/reports/export/user-attendance-pdf', { params, responseType: 'blob' }),

  // ============================================
  // SISTEMA DE ADMINISTRACIÓN
  // ============================================

  // User Role Management
  updateUserRole: (uid, role, departamento) =>
    apiClient.put(`/users/${uid}/role`, { role, departamento }),

  // Admin Notifications
  sendNotificationToDepartment: (data) => apiClient.post('/notifications/send-department', data),
  sendNotificationToAll: (data) => apiClient.post('/notifications/send-all', data),
  getAdminPendingItems: () => apiClient.get('/notifications/admin/pending'),

  // Evaluations
  getEvaluations: (params) => apiClient.get('/evaluations', { params }),
  getEvaluationById: (id) => apiClient.get(`/evaluations/${id}`),
  getEvaluationsByEmployee: (uid) => apiClient.get(`/evaluations/employee/${uid}`),
  getMyEvaluations: () => apiClient.get('/evaluations/my'),
  createEvaluation: (data) => apiClient.post('/evaluations', data),
  updateEvaluation: (id, data) => apiClient.put(`/evaluations/${id}`, data),
  deleteEvaluation: (id) => apiClient.delete(`/evaluations/${id}`),
  getEvaluationStats: () => apiClient.get('/evaluations/stats'),

  // Training
  getTrainings: (params) => apiClient.get('/training', { params }),
  getTrainingById: (id) => apiClient.get(`/training/${id}`),
  getMyTrainings: () => apiClient.get('/training/my'),
  createTraining: (data) => apiClient.post('/training', data),
  updateTraining: (id, data) => apiClient.put(`/training/${id}`, data),
  deleteTraining: (id) => apiClient.delete(`/training/${id}`),
  enrollEmployee: (trainingId, uid) => apiClient.post(`/training/${trainingId}/enroll/${uid}`),
  unenrollEmployee: (trainingId, uid) => apiClient.delete(`/training/${trainingId}/enroll/${uid}`),
  updateParticipantStatus: (trainingId, uid, data) =>
    apiClient.put(`/training/${trainingId}/complete/${uid}`, data),
  getTrainingStats: () => apiClient.get('/training/stats'),

  // Audit
  getAuditLogs: (params) => apiClient.get('/audit', { params }),
  getAuditStats: (params) => apiClient.get('/audit/stats', { params }),
  getEntityHistory: (tipo, id) => apiClient.get(`/audit/entity/${tipo}/${id}`),
  cleanupAuditLogs: (params) => apiClient.post('/audit/cleanup', null, { params }),

  // Contract Evaluations
  getContractEvaluations: (params) => apiClient.get('/contract-evaluations', { params }),
  getPendingContractEvaluations: () => apiClient.get('/contract-evaluations/pending'),
  getContractEvaluationById: (id) => apiClient.get(`/contract-evaluations/${id}`),
  getContractEvaluationStats: () => apiClient.get('/contract-evaluations/stats'),
  completeContractEvaluation: (id, data) => apiClient.post(`/contract-evaluations/${id}/complete`, data),
  checkPendingContractEvaluations: () => apiClient.post('/contract-evaluations/check-pending'),
  initializeUserContract: (uid, data) => apiClient.post(`/users/${uid}/initialize-contract`, data),

  // Marketing Carousel
  getCarouselImages: () => apiClient.get('/marketing/carousel'),
  uploadCarouselImage: (data) => {
    const formData = new FormData();
    formData.append('foto', data.foto);
    formData.append('tipo', data.tipo);
    if (data.fechaExpiracion) formData.append('fechaExpiracion', data.fechaExpiracion);
    if (data.titulo) formData.append('titulo', data.titulo);
    if (data.duracion) formData.append('duracion', data.duracion);
    return apiClient.post('/marketing/carousel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateCarouselImage: (id, formData) => {
    const data = new FormData();
    data.append('titulo', formData.titulo);
    data.append('tipo', formData.tipo);
    if (formData.duracion) data.append('duracion', formData.duracion);
    if (formData.fechaExpiracion) data.append('fechaExpiracion', formData.fechaExpiracion);
    if (formData.foto) data.append('foto', formData.foto);
    return apiClient.patch(`/marketing/carousel/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteCarouselImage: (id) => apiClient.delete(`/marketing/carousel/${id}`),
};

export default apiClient;
