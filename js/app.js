const state = {
  rows: structuredClone(defaultRows),
  method: 'ma',
  windowSize: 3,
  weightsText: '1,2,3',
  alpha: 0.3,
  theme: localStorage.getItem('ie-toolkit-theme') || 'light'
};

const methodNames = {
  ma: 'MA',
  wma: 'WMA',
  es: 'ES'
};

const methodFullNames = {
  ma: 'Moving Average',
  wma: 'Weighted Moving Average',
  es: 'Exponential Smoothing'
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  cacheElements();
  bindEvents();
  applyTheme();
  render();
});

function cacheElements() {
  els.settingsBox = document.querySelector('#settingsBox');
  els.dataTable = document.querySelector('#dataTable');
  els.nextForecast = document.querySelector('#nextForecast');
  els.methodLabel = document.querySelector('#methodLabel');
  els.madValue = document.querySelector('#madValue');
  els.mseValue = document.querySelector('#mseValue');
  els.mapeValue = document.querySelector('#mapeValue');
  els.errorCount = document.querySelector('#errorCount');
  els.canvas = document.querySelector('#forecastChart');
}

function bindEvents() {
  document.querySelectorAll('.method-card').forEach((button) => {
    button.addEventListener('click', () => {
      state.method = button.dataset.method;
      render();
    });
  });

  document.querySelector('#addRowBtn').addEventListener('click', () => {
    state.rows.push({ period: `P${state.rows.length + 1}`, actual: '' });
    render();
  });

  document.querySelector('#resetBtn').addEventListener('click', () => {
    state.rows = structuredClone(defaultRows);
    state.method = 'ma';
    state.windowSize = 3;
    state.weightsText = '1,2,3';
    state.alpha = 0.3;
    render();
  });

  document.querySelector('#exportBtn').addEventListener('click', exportCsv);
  document.querySelector('#themeBtn').addEventListener('click', toggleTheme);
  document.querySelector('#csvInput').addEventListener('change', importCsv);

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(() => renderChart(lastResult?.rows || []));
  });
}

let lastResult = null;

function render() {
  document.querySelectorAll('.method-card').forEach((button) => {
    button.classList.toggle('active', button.dataset.method === state.method);
  });

  renderSettings();
  const settings = getSettings();
  lastResult = computeForecast(state.rows, state.method, settings);
  renderTable(lastResult.rows);
  renderSummary(lastResult);
  renderChart(lastResult.rows);
}

function getSettings() {
  return {
    windowSize: Math.max(2, Number(state.windowSize) || 2),
    weights: parseWeights(state.weightsText),
    alpha: Math.min(0.95, Math.max(0.05, Number(state.alpha) || 0.3))
  };
}

function renderSettings() {
  if (state.method === 'ma') {
    els.settingsBox.innerHTML = `
      <label class="input-label">
        Window/periode
        <input id="windowInput" class="input-control" type="number" min="2" value="${state.windowSize}">
      </label>
      <p class="input-help">Contoh window 3 berarti forecast dihitung dari rata-rata 3 periode sebelumnya.</p>
    `;
    document.querySelector('#windowInput').addEventListener('input', (e) => {
      state.windowSize = e.target.value;
      render();
    });
  }

  if (state.method === 'wma') {
    els.settingsBox.innerHTML = `
      <label class="input-label">
        Bobot, dari periode lama ke terbaru
        <input id="weightsInput" class="input-control" value="${state.weightsText}" placeholder="Contoh: 1,2,3">
      </label>
      <p class="input-help">Contoh 1,2,3 berarti periode terbaru punya bobot paling besar.</p>
    `;
    document.querySelector('#weightsInput').addEventListener('input', (e) => {
      state.weightsText = e.target.value;
      render();
    });
  }

  if (state.method === 'es') {
    els.settingsBox.innerHTML = `
      <label class="input-label">
        Alpha
        <div class="range-row">
          <input id="alphaInput" type="range" min="0.05" max="0.95" step="0.05" value="${state.alpha}">
          <span class="range-value">${state.alpha}</span>
        </div>
      </label>
      <p class="input-help">Alpha tinggi lebih responsif terhadap perubahan data terbaru.</p>
    `;
    document.querySelector('#alphaInput').addEventListener('input', (e) => {
      state.alpha = Number(e.target.value).toFixed(2).replace(/0$/, '').replace(/\.$/, '');
      render();
    });
  }
}

function renderTable(rows) {
  const head = `
    <div class="table-row table-head" role="row">
      <div>Periode</div><div>Aktual</div><div>Forecast</div><div>Error</div><div></div>
    </div>
  `;

  const body = rows.map((row, index) => `
    <div class="table-row" role="row">
      <input class="row-input" aria-label="Periode baris ${index + 1}" value="${escapeHtml(row.period ?? '')}" data-index="${index}" data-key="period">
      <input class="row-input" aria-label="Aktual baris ${index + 1}" type="number" value="${state.rows[index].actual ?? ''}" data-index="${index}" data-key="actual">
      <div class="value-pill">${round(row.forecast)}</div>
      <div class="value-pill cell-muted">${round(row.error)}</div>
      <button class="icon-btn" type="button" aria-label="Hapus baris" data-delete="${index}">${ICONS.trash}</button>
    </div>
  `).join('');

  els.dataTable.innerHTML = head + body;

  els.dataTable.querySelectorAll('input[data-index]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = Number(e.target.dataset.index);
      const key = e.target.dataset.key;
      state.rows[index][key] = e.target.value;
      render();
    });
  });

  els.dataTable.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.delete);
      state.rows.splice(index, 1);
      render();
    });
  });
}

function renderSummary(result) {
  els.nextForecast.textContent = round(result.next);
  els.methodLabel.textContent = methodNames[state.method];
  els.madValue.textContent = round(result.metrics.mad);
  els.mseValue.textContent = round(result.metrics.mse);
  els.mapeValue.textContent = Number.isFinite(result.metrics.mape) ? `${round(result.metrics.mape)}%` : '-';
  els.errorCount.textContent = result.metrics.count;
}

function renderChart(rows) {
  const canvas = els.canvas;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(700, rect.width * ratio);
  canvas.height = Math.max(320, rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const css = getComputedStyle(document.documentElement);
  const textColor = css.getPropertyValue('--text').trim();
  const mutedColor = css.getPropertyValue('--muted').trim();
  const lineColor = css.getPropertyValue('--line').trim();

  const padding = { top: 26, right: 24, bottom: 46, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = rows.filter((row) => Number.isFinite(row.actual));
  if (points.length < 2) {
    drawEmpty(ctx, width, height, mutedColor);
    return;
  }

  const values = points.flatMap((row) => [row.actual, row.forecast]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yMin = min - span * 0.12;
  const yMax = max + span * 0.12;

  const x = (index) => padding.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  ctx.lineWidth = 1;
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = mutedColor;
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 4; i += 1) {
    const yy = padding.top + (i / 4) * plotHeight;
    const value = yMax - (i / 4) * (yMax - yMin);
    ctx.beginPath();
    ctx.moveTo(padding.left, yy);
    ctx.lineTo(width - padding.right, yy);
    ctx.stroke();
    ctx.fillText(round(value), padding.left - 10, yy);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  points.forEach((row, index) => {
    const interval = Math.ceil(points.length / 8);
    if (index % interval === 0 || index === points.length - 1) ctx.fillText(row.period, x(index), height - padding.bottom + 18);
  });

  drawLine(ctx, points.map((row, index) => ({ x: x(index), y: y(row.actual), valid: true })), textColor, false);
  drawLine(ctx, points.map((row, index) => ({ x: x(index), y: Number.isFinite(row.forecast) ? y(row.forecast) : null, valid: Number.isFinite(row.forecast) })), mutedColor, true);

  drawLegend(ctx, width, textColor, mutedColor);
}

function drawLine(ctx, points, color, dashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dashed ? [7, 6] : []);

  let started = false;
  ctx.beginPath();
  points.forEach((point) => {
    if (!point.valid) {
      started = false;
      return;
    }
    if (!started) {
      ctx.moveTo(point.x, point.y);
      started = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);

  points.forEach((point) => {
    if (!point.valid) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLegend(ctx, width, actualColor, forecastColor) {
  ctx.save();
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = actualColor;
  ctx.fillRect(width - 185, 20, 22, 3);
  ctx.fillText('Aktual', width - 154, 21);
  ctx.fillStyle = forecastColor;
  ctx.fillRect(width - 92, 20, 22, 3);
  ctx.fillText('Forecast', width - 61, 21);
  ctx.restore();
}

function drawEmpty(ctx, width, height, color) {
  ctx.fillStyle = color;
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Tambahkan minimal 2 data aktual untuk menampilkan grafik.', width / 2, height / 2);
}

function exportCsv() {
  const result = lastResult || computeForecast(state.rows, state.method, getSettings());
  const header = ['Periode', 'Aktual', 'Forecast', 'Error', 'Abs Error', 'Squared Error', 'APE (%)'];
  const lines = result.rows.map((row) => {
    const error = Number.isFinite(row.forecast) ? row.actual - row.forecast : '';
    const absError = Number.isFinite(error) ? Math.abs(error) : '';
    const sqError = Number.isFinite(error) ? Math.pow(error, 2) : '';
    const ape = Number.isFinite(error) && row.actual !== 0 ? Math.abs(error / row.actual) * 100 : '';
    return [row.period, row.actual ?? '', row.forecast ?? '', error, absError, sqError, ape];
  });

  lines.push([]);
  lines.push(['Metode', methodFullNames[state.method]]);
  lines.push(['Forecast Periode Berikutnya', result.next ?? '']);
  lines.push(['MAD', result.metrics.mad ?? '']);
  lines.push(['MSE', result.metrics.mse ?? '']);
  lines.push(['MAPE (%)', result.metrics.mape ?? '']);

  const csv = [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'forecasting-tool-result.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = rows.map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()));
    const startIndex = parsed[0]?.some((cell) => /periode|period|aktual|actual/i.test(cell)) ? 1 : 0;
    const imported = parsed.slice(startIndex).map((line, index) => ({
      period: line[0] || `P${index + 1}`,
      actual: line[1] ?? ''
    })).filter((row) => row.period || row.actual !== '');

    if (imported.length) {
      state.rows = imported;
      render();
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ie-toolkit-theme', state.theme);
  applyTheme();
  renderChart(lastResult?.rows || []);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const icon = document.querySelector('#themeBtn .btn-icon');
  if (icon) icon.innerHTML = ICONS[state.theme === 'dark' ? 'sun' : 'moon'];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
