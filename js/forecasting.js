const defaultRows = [
  { period: 'Jan', actual: 120 },
  { period: 'Feb', actual: 132 },
  { period: 'Mar', actual: 128 },
  { period: 'Apr', actual: 145 },
  { period: 'Mei', actual: 152 },
  { period: 'Jun', actual: 160 }
];

function toNumber(value) {
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '-';
}

function movingAverage(values, windowSize) {
  return values.map((_, index) => {
    if (index < windowSize) return null;
    const slice = values.slice(index - windowSize, index);
    return slice.reduce((total, value) => total + value, 0) / windowSize;
  });
}

function weightedMovingAverage(values, weights) {
  const totalWeight = weights.reduce((total, value) => total + value, 0);
  return values.map((_, index) => {
    if (index < weights.length) return null;
    const slice = values.slice(index - weights.length, index);
    return slice.reduce((total, value, i) => total + value * weights[i], 0) / totalWeight;
  });
}

function exponentialSmoothing(values, alpha) {
  return values.map((_, index) => {
    if (index === 0) return null;
    if (index === 1) return values[0];
    let forecast = values[0];
    for (let i = 1; i < index; i += 1) {
      forecast = alpha * values[i] + (1 - alpha) * forecast;
    }
    return forecast;
  });
}

function nextForecast(values, method, settings) {
  if (!values.length) return null;

  if (method === 'ma') {
    const n = settings.windowSize;
    if (values.length < n) return null;
    return values.slice(-n).reduce((total, value) => total + value, 0) / n;
  }

  if (method === 'wma') {
    const weights = settings.weights;
    if (values.length < weights.length) return null;
    const totalWeight = weights.reduce((total, value) => total + value, 0);
    return values.slice(-weights.length).reduce((total, value, i) => total + value * weights[i], 0) / totalWeight;
  }

  let forecast = values[0];
  for (let i = 1; i < values.length; i += 1) {
    forecast = settings.alpha * values[i] + (1 - settings.alpha) * forecast;
  }
  return forecast;
}

function calculateMetrics(rows) {
  const pairs = rows.filter((row) => Number.isFinite(row.actual) && Number.isFinite(row.forecast));
  if (!pairs.length) return { mad: null, mse: null, mape: null, count: 0 };

  const absErrors = pairs.map((row) => Math.abs(row.actual - row.forecast));
  const squaredErrors = pairs.map((row) => Math.pow(row.actual - row.forecast, 2));
  const apeValues = pairs
    .filter((row) => row.actual !== 0)
    .map((row) => Math.abs((row.actual - row.forecast) / row.actual) * 100);

  return {
    mad: absErrors.reduce((total, value) => total + value, 0) / absErrors.length,
    mse: squaredErrors.reduce((total, value) => total + value, 0) / squaredErrors.length,
    mape: apeValues.length ? apeValues.reduce((total, value) => total + value, 0) / apeValues.length : null,
    count: pairs.length
  };
}

function parseWeights(text) {
  const values = text.split(',').map((item) => toNumber(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
  return values.length ? values : [1, 2, 3];
}

function computeForecast(rows, method, settings) {
  const validValues = rows.map((row) => toNumber(row.actual)).filter((item) => Number.isFinite(item));
  let forecasts = [];

  if (method === 'ma') forecasts = movingAverage(validValues, settings.windowSize);
  if (method === 'wma') forecasts = weightedMovingAverage(validValues, settings.weights);
  if (method === 'es') forecasts = exponentialSmoothing(validValues, settings.alpha);

  let validIndex = -1;
  const computedRows = rows.map((row) => {
    const actual = toNumber(row.actual);
    if (Number.isFinite(actual)) validIndex += 1;
    const forecast = Number.isFinite(actual) ? forecasts[validIndex] : null;
    return { ...row, actual, forecast, error: Number.isFinite(forecast) ? actual - forecast : null };
  });

  return {
    rows: computedRows,
    next: nextForecast(validValues, method, settings),
    metrics: calculateMetrics(computedRows)
  };
}
