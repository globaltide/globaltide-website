export function renderLineChart(canvasId, label, data) {
  const ctx = document.getElementById(canvasId);
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label,
        data: data.map(d => d.value),
        tension: 0.35,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        y: { ticks: { callback: v => v + "bp" } }
      }
    }
  });
}
