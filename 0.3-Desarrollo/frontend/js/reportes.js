const NAVY = '#0b2340';
const BRASS = '#a9812f';
const SLATE = '#7c8a96';

Chart.defaults.font.family = "Inter, sans-serif";
Chart.defaults.color = SLATE;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatearPrecio(valor) {
  const n = Number(valor) || 0;
  return '$' + n.toLocaleString('es-CO');
}

function estrellas(promedio) {
  const llenas = Math.round(Number(promedio) || 0);
  return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
}

async function cargarReporte() {
  // Este reporte muestra métricas globales del negocio: solo el administrador
  // debe poder verlo (requisito: "reportes globales" son parte del panel admin).
  const sesion = (typeof authLeer === 'function') ? authLeer() : null;
  if (!sesion?.token || sesion.rol !== 'admin') {
    window.location.href = 'login.html?redirect=reportes.html';
    return;
  }

  const base = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:8080';
  const estado = document.getElementById('reportes-estado');

  try {
    const resp = await fetch(base + '/api/reportes/mensual');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    // --- A) Clientes atendidos ---
    document.getElementById('kpiAtendidos').textContent = data.clientesAtendidos ?? 0;
    document.getElementById('kpiEscalados').textContent = data.escaladosAHumano ?? 0;
    const totalAtenciones = Number(data.clientesAtendidos) || 0;
    const escalados = Number(data.escaladosAHumano) || 0;
    const pctResuelto = totalAtenciones > 0 ? Math.round(((totalAtenciones - escalados) / totalAtenciones) * 100) : 0;
    document.getElementById('kpiResueltos').textContent = pctResuelto + '%';

    // --- Gráfica: pedidos por estado ---
    const pedidosPorEstado = data.pedidosPorEstado || [];
    new Chart(document.getElementById('chartClientes'), {
      type: 'bar',
      data: {
        labels: pedidosPorEstado.map(p => p.estado),
        datasets: [{
          label: 'Pedidos',
          data: pedidosPorEstado.map(p => p.cantidad),
          backgroundColor: [NAVY, BRASS, '#2e7d6b'],
          borderRadius: 3,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(11,35,64,0.06)' }, ticks: { precision: 0 } }, x: { grid: { display: false } } }
      }
    });

    // --- B) Calificación de la atención ---
    document.getElementById('kpiPromedio').textContent = data.calificacionPromedio ?? 0;
    document.getElementById('kpiPromedioEstrellas').textContent = estrellas(data.calificacionPromedio);

    // La API no devuelve el desglose 1-5 estrellas; se muestra el total de
    // atenciones agrupado por si el backend lo agrega en el futuro.
    new Chart(document.getElementById('chartCalificacion'), {
      type: 'bar',
      data: {
        labels: ['Calificación promedio'],
        datasets: [{
          label: 'Promedio',
          data: [data.calificacionPromedio ?? 0],
          backgroundColor: [BRASS],
          borderRadius: 3,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 5, grid: { color: 'rgba(11,35,64,0.06)' } }, x: { grid: { display: false } } }
      }
    });

    // --- C) Sugerencias (comentarios con calificación baja) ---
    const cont = document.getElementById('sugerenciasContainer');
    const sugerencias = data.sugerencias || [];
    if (!sugerencias.length) {
      cont.innerHTML = '<p class="text-muted small">No hay comentarios con calificación baja registrados todavía.</p>';
    } else {
      cont.innerHTML = sugerencias.map(s => `
        <div class="sugerencia-item">
          <div class="origen">Calificación ${escapeHtml(s.calificacion)}/5 · ${escapeHtml((s.fecha ?? '').toString().replace('T', ' ').slice(0, 16))}</div>
          <p class="small text-muted mb-0">${escapeHtml(s.comentario || '(sin comentario)')}</p>
        </div>`).join('');
    }

    // --- Productos más vendidos ---
    const tbodyVendidos = document.getElementById('tbodyMasVendidos');
    const masVendidos = data.productosMasVendidos || [];
    if (tbodyVendidos) {
      if (!masVendidos.length) {
        tbodyVendidos.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Todavía no hay pedidos suficientes para calcular este ranking.</td></tr>';
      } else {
        tbodyVendidos.innerHTML = masVendidos.map(p => `
          <tr><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(p.total_vendidos)}</td></tr>`).join('');
      }
    }

    if (estado) estado.textContent = '';
  } catch (err) {
    console.error(err);
    if (estado) estado.textContent = 'No se pudo cargar el reporte (' + err.message + ').';
  }
}

document.addEventListener('DOMContentLoaded', cargarReporte);
