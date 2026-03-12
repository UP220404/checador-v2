import { useState, useEffect, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';
import '../styles/Analisis.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Analisis() {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [datosGraficas, setDatosGraficas] = useState({
    mensual: [],
    usuarios: []
  });

  useEffect(() => {
    cargarAnalisis();
  }, []);

  const cargarAnalisis = async () => {
    try {
      setLoading(true);
      console.log('[Analisis] Cargando datos optimizados desde el backend...');

      // UNA SOLA LLAMADA API - El backend retorna todo procesado
      const response = await api.getAnalyticsSummary();

      if (response.data.success) {
        const { ranking, tendenciaMensual, topUsuarios, metadata } = response.data.data;

        console.log('[Analisis] Datos recibidos:', {
          ranking: ranking.length,
          tendencia: tendenciaMensual.length,
          topUsuarios: topUsuarios.length,
          metadata
        });

        // Setear los datos ya procesados del backend
        setRankingData(ranking);
        setDatosGraficas({
          mensual: tendenciaMensual,
          usuarios: topUsuarios.map(u => [u.nombre, u.count])
        });
      }
    } catch (error) {
      console.error('Error cargando análisis:', error);
      setRankingData([]);
      setDatosGraficas({ mensual: [], usuarios: [] });
    } finally {
      setLoading(false);
    }
  };

  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const mensualChartData = {
    labels: datosGraficas.mensual.length > 0
      ? datosGraficas.mensual.map(m => `${mesesNombres[m.mes]} ${m.anio}`)
      : ['Sin datos'],
    datasets: [{
      label: 'Registros de Asistencia',
      data: datosGraficas.mensual.length > 0
        ? datosGraficas.mensual.map(m => m.count)
        : [0],
      backgroundColor: 'rgba(25, 135, 84, 0.2)',
      borderColor: 'rgba(25, 135, 84, 1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    }]
  };

  const usuariosChartData = {
    labels: datosGraficas.usuarios.length > 0
      ? datosGraficas.usuarios.map(([nombre]) => nombre)
      : ['Sin datos'],
    datasets: [{
      label: 'Registros',
      data: datosGraficas.usuarios.length > 0
        ? datosGraficas.usuarios.map(([, count]) => count)
        : [0],
      backgroundColor: 'rgba(25, 135, 84, 0.6)',
      borderColor: 'rgba(25, 135, 84, 1)',
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    }
  };

  return (
    <AdminLayout>
      <div className="section-header">
        <h2><i className="bi bi-graph-up-arrow me-2"></i>Análisis Avanzados</h2>
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-md-6">
          <div className="chart-container">
            <h4><i className="bi bi-calendar-month me-2"></i>Tendencia Mensual</h4>
            <Line data={mensualChartData} options={chartOptions} height={250} />
          </div>
        </div>

        <div className="col-md-6">
          <div className="chart-container">
            <h4><i className="bi bi-person-lines-fill me-2"></i>Usuarios Más Activos</h4>
            <Bar data={usuariosChartData} options={chartOptions} height={250} />
          </div>
        </div>

        {/* Ranking de Puntualidad */}
        <div className="col-12 mt-4">
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header bg-success text-white">
              🏆 Ranking de Puntualidad (Top 10)
            </div>
            <div className="card-body p-0">
              {rankingData.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-trophy" style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                  <h5 className="mt-3 text-muted">Sin datos de puntualidad</h5>
                  <p className="text-muted">No hay registros para este mes</p>
                </div>
              ) : (
                <div id="ranking-puntualidad">
                  {rankingData.map((user, index) => {
                    const estilos = [
                      { icon: 'bi-gem', bgGradient: 'linear-gradient(135deg, #0dcaf0, #17a2b8)', nombre: 'Diamante', emoji: '💎' },
                      { icon: 'bi-gem', bgGradient: 'linear-gradient(135deg, #dc3545, #c82333)', nombre: 'Rubí', emoji: '🔴' },
                      { icon: 'bi-award-fill', bgGradient: 'linear-gradient(135deg, #ffc107, #e0a800)', nombre: 'Oro', emoji: '🥇' },
                      { icon: 'bi-award-fill', bgGradient: 'linear-gradient(135deg, #6c757d, #5a6268)', nombre: 'Plata', emoji: '🥈' },
                      { icon: 'bi-award-fill', bgGradient: 'linear-gradient(135deg, #b87333, #996633)', nombre: 'Bronce', emoji: '🥉' },
                      { icon: 'bi-gem', bgGradient: 'linear-gradient(135deg, #198754, #0f5132)', nombre: 'Esmeralda', emoji: '💚' },
                      { icon: 'bi-award', bgGradient: 'linear-gradient(135deg, #fd7e14, #ca6510)', nombre: 'Ámbar', emoji: '🟠' },
                      { icon: 'bi-gem', bgGradient: 'linear-gradient(135deg, #0d6efd, #0a58ca)', nombre: 'Zafiro', emoji: '🔵' },
                      { icon: 'bi-award', bgGradient: 'linear-gradient(135deg, #e9ecef, #adb5bd)', nombre: 'Perla', emoji: '⚪' },
                      { icon: 'bi-award', bgGradient: 'linear-gradient(135deg, #cd7f32, #9a5f24)', nombre: 'Cobre', emoji: '🟤' }
                    ];

                    // Determinar la medalla basada en puntos únicos
                    const puntosUnicos = [...new Set(rankingData.map(u => u.puntos))].sort((a, b) => b - a);
                    const indiceMedalla = Math.min(puntosUnicos.indexOf(user.puntos), estilos.length - 1);
                    const estilo = estilos[indiceMedalla];

                    return (
                      <div key={index} className="ranking-item-nuevo">
                        <div className="ranking-card-nuevo" style={{ background: estilo.bgGradient }}>
                          <div className="ranking-position-nuevo">
                            <span className="position-number-nuevo">{index + 1}</span>
                            <span className="position-emoji-nuevo">{estilo.emoji}</span>
                          </div>
                          <div className="ranking-info-nuevo">
                            <div className="ranking-name-nuevo">{user.nombre}</div>
                            <div className="ranking-medal-nuevo">
                              <i className={`bi ${estilo.icon}`}></i> <span>{estilo.nombre}</span>
                            </div>
                          </div>
                          <div className="ranking-points-nuevo">
                            <span className="points-number-nuevo">{user.puntos}</span>
                            <span className="points-text-nuevo">punto{user.puntos !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Analisis;
