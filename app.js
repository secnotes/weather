'use strict';

/* ============================================================
 * 天气查询（纯前端 / GitHub Pages 可部署）
 * 数据源：Open-Meteo（Forecast + Archive + Geocoding），均已开放 CORS
 * ============================================================ */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL  = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODE_URL  = 'https://geocoding-api.open-meteo.com/v1/search';
const AQI_URL      = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const CACHE_PREFIX = 'weather:';
const FORECAST_TTL = 10 * 60 * 1000;          // 10 分钟
const AQI_TTL      = 30 * 60 * 1000;          // 30 分钟
const HISTORY_TTL  = 30 * 24 * 60 * 60 * 1000; // 30 天
const CHUNK_YEARS  = 5;
const CHUNK_COUNT  = 6;                        // 6 × 5 年 = 30 年

/* ---------- 语言 / i18n ---------- */
let LANG = 'zh';
try { LANG = localStorage.getItem('weather:lang') || 'zh'; } catch {}

const I18N = {
  zh: {
    title: '天气查询',
    subtitle: '实时天气 · 7 天预报 · 30 年今日历史',
    'search-ph': '搜索城市，如 北京 / Shanghai / Tokyo',
    'label-humidity': '湿度',
    'label-wind': '风力',
    'label-pressure': '气压',
    'label-uv': '紫外线',
    'label-aqi': '空气质量（中国）',
    'label-sun': '日出 / 日落',
    'label-moon': '月相',
    'sun-cap-sunrise': '日出',
    'sun-cap-sunset': '日落',
    daylen: '昼长',
    'moon-lit': '照亮',
    'fc-title': '未来 7 天预报',
    'fc-cards': '卡片',
    'fc-list': '列表',
    'extremes-title': '过去30年今日天气',
    'ext-label-raindays': '降水天数',
    'ext-label-snowdays': '降雪天数',
    'ext-label-precip': '最大降水',
    'ext-label-hot': '最高温度',
    'ext-label-cold': '最低温度',
    'ext-rain-sub': '天有降水',
    'ext-snow-sub': '天有降雪',
    'ext-onthisdate': '过去 30 年的今天',
    'year-suffix': ' 年',
    'no-data': '无数据',
    'feels-like': '体感',
    today: '今天', tomorrow: '明天', 'day-after': '后天',
    'lv-dry': '干燥', 'lv-comfy': '舒适', 'lv-humid': '偏湿', 'lv-veryhumid': '潮湿',
    'lv-lowp': '低压', 'lv-normalp': '正常', 'lv-highp': '高压',
    'uv-lv1': '弱', 'uv-lv2': '中等', 'uv-lv3': '强', 'uv-lv4': '很强', 'uv-lv5': '极强',
    'aqi-primary': '首要',
    'aqi-err': '获取失败',
    'weather-err': '天气数据加载失败：',
    'history-err': '历史数据加载失败：',
    'net-err': '网络错误，请检查连接',
    'ext-loading': '正在拉取过去 30 年今日历史数据，约需 10-15 秒，之后缓存 30 天…',
    'footer-src': '数据来源：',
    'footer-star': 'Star on GitHub',
    'footer-note': '（免费、开源）。卡片显示所选城市今天这个日期在过去 30 年的历史极值；首次加载约需 6 秒，之后缓存 30 天。',
  },
  en: {
    title: 'Weather',
    subtitle: 'Current · 7-Day Forecast · 30-Year History',
    'search-ph': 'Search city, e.g. Beijing / Shanghai / Tokyo',
    'label-humidity': 'Humidity',
    'label-wind': 'Wind',
    'label-pressure': 'Pressure',
    'label-uv': 'UV Index',
    'label-aqi': 'Air Quality (US)',
    'label-sun': 'Sunrise / Sunset',
    'label-moon': 'Moon Phase',
    'sun-cap-sunrise': 'Sunrise',
    'sun-cap-sunset': 'Sunset',
    daylen: 'Daylight',
    'moon-lit': 'lit',
    'fc-title': '7-Day Forecast',
    'fc-cards': 'Cards',
    'fc-list': 'List',
    'extremes-title': 'This Date in the Past 30 Years',
    'ext-label-raindays': 'Rainy Days',
    'ext-label-snowdays': 'Snowy Days',
    'ext-label-precip': 'Max Precipitation',
    'ext-label-hot': 'Highest Temp',
    'ext-label-cold': 'Lowest Temp',
    'ext-rain-sub': 'days with rain',
    'ext-snow-sub': 'days with snow',
    'ext-onthisdate': 'on this date, past 30 years',
    'year-suffix': '',
    'no-data': 'No data',
    'feels-like': 'Feels',
    today: 'Today', tomorrow: 'Tomorrow', 'day-after': '',
    'lv-dry': 'Dry', 'lv-comfy': 'Comfortable', 'lv-humid': 'Humid', 'lv-veryhumid': 'Very Humid',
    'lv-lowp': 'Low', 'lv-normalp': 'Normal', 'lv-highp': 'High',
    'uv-lv1': 'Low', 'uv-lv2': 'Moderate', 'uv-lv3': 'High', 'uv-lv4': 'Very High', 'uv-lv5': 'Extreme',
    'aqi-primary': 'Primary',
    'aqi-err': 'Failed',
    'weather-err': 'Failed to load weather: ',
    'history-err': 'Failed to load history: ',
    'net-err': 'Network error, check connection',
    'ext-loading': 'Fetching 30-year history for this date, takes ~10-15s, then cached 30 days…',
    'footer-src': 'Data source: ',
    'footer-star': 'Star on GitHub',
    'footer-note': ' (free, open source). Cards show historical extremes for this date over the past 30 years; first load ~6s, then cached 30 days.',
  },
};
function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.zh[key] || key; }
function localeTag() { return LANG === 'zh' ? 'zh-CN' : 'en-US'; }

/* 静态文案：按 data-i18n / data-i18n-ph 属性整体切换 */
function applyLang() {
  document.documentElement.lang = localeTag();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('#lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === LANG);
  });
}

/* ---------- WMO 天气代码 -> 中文标签 + emoji ---------- */
const WMO = {
  0:  { label: '晴',     emoji: '☀️' },
  1:  { label: '晴间多云', emoji: '🌤️' },
  2:  { label: '多云',    emoji: '⛅' },
  3:  { label: '阴',     emoji: '☁️' },
  45: { label: '雾',     emoji: '🌫️' },
  48: { label: '雾凇',   emoji: '🌫️' },
  51: { label: '轻毛毛雨', emoji: '🌦️' },
  53: { label: '毛毛雨',   emoji: '🌦️' },
  55: { label: '密毛毛雨', emoji: '🌦️' },
  56: { label: '冻毛毛雨', emoji: '🌧️' },
  57: { label: '强冻毛毛雨', emoji: '🌧️' },
  61: { label: '小雨',   emoji: '🌧️' },
  63: { label: '中雨',   emoji: '🌧️' },
  65: { label: '大雨',   emoji: '🌧️' },
  66: { label: '冻雨',   emoji: '🌧️' },
  67: { label: '强冻雨', emoji: '🌧️' },
  71: { label: '小雪',   emoji: '🌨️' },
  73: { label: '中雪',   emoji: '🌨️' },
  75: { label: '大雪',   emoji: '❄️' },
  77: { label: '米雪',   emoji: '🌨️' },
  80: { label: '小阵雨', emoji: '🌦️' },
  81: { label: '阵雨',   emoji: '🌦️' },
  82: { label: '强阵雨', emoji: '⛈️' },
  85: { label: '小阵雪', emoji: '🌨️' },
  86: { label: '强阵雪', emoji: '❄️' },
  95: { label: '雷暴',   emoji: '⛈️' },
  96: { label: '雷暴伴小冰雹', emoji: '⛈️' },
  99: { label: '雷暴伴大冰雹', emoji: '⛈️' },
};

/* 英文天气标签（与上方 WMO 的 code 对应） */
const WMO_EN = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle', 56: 'Freezing Drizzle', 57: 'Heavy Freezing Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Freezing Rain', 67: 'Heavy Freezing Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Light Showers', 81: 'Showers', 82: 'Violent Showers', 85: 'Light Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Thunderstorm w/ Heavy Hail',
};
function wmoText(code) {
  const w = WMO[code];
  if (!w) return LANG === 'zh' ? '未知' : 'Unknown';
  return LANG === 'zh' ? w.label : (WMO_EN[code] || w.label);
}
function wmoEmoji(code) { return (WMO[code] || { emoji: '❓' }).emoji; }

/* ---------- 工具函数 ---------- */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addYears(d, n) { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); }
function roundCoord(v) { return Math.round(v * 100) / 100; } // ~1km 精度
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function windDirLabel(deg) {
  const dirs = LANG === 'zh'
    ? ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
    : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
/* km/h -> 蒲福风级（0-12 级） */
function windLevel(kmh) {
  const uppers = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117]; // 各级上界
  for (let i = 0; i < uppers.length; i++) if (kmh <= uppers[i]) return i;
  return 12;
}
function fmtTime(iso) { const t = iso.split('T')[1]; return t || iso; }
function formatDateZh(iso) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString(localeTag(), { year: 'numeric', month: 'long', day: 'numeric' });
}
function setText(id, v) { document.getElementById(id).textContent = v; }

/* localStorage TTL 缓存 */
function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > ttl) return null;
    return v;
  } catch { return null; }
}
function cacheSet(key, v) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch {}
}

/* ---------- 城市搜索（双语结果，选中后可跨语言重渲染） ---------- */
async function searchCity(q, lang) {
  if (!q.trim()) return [];
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=6&language=${lang || LANG}&format=json`;
  const data = await fetch(url).then(r => r.json());
  return data.results || [];
}
function fullName(r, lang) {
  const sep = lang === 'zh' ? '，' : ', ';
  return r.name + (r.admin1 ? sep + r.admin1 : '');
}

/* ---------- 实时天气 + 7 天预报 ---------- */
async function loadWeather(lat, lon) {
  const key = `${CACHE_PREFIX}weather2:${roundCoord(lat)},${roundCoord(lon)}`;
  const cached = cacheGet(key, FORECAST_TTL);
  if (cached) return cached;
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max',
  });
  const data = await fetch(`${FORECAST_URL}?${params}`).then(r => r.json());
  cacheSet(key, data);
  return data;
}

/* ---------- 30 年历史数据（拉取 + 缓存原始逐日数据） ---------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* 限并发执行任务，避免一次性发出过多请求触发归档接口限流（429） */
async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function fetchChunk(lat, lon, start, end) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    start_date: start, end_date: end,
    daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min,snowfall_sum',
  });
  const url = `${ARCHIVE_URL}?${params}`;
  // 429 / 5xx / 网络错误：指数退避重试（1s, 2s, 4s）
  for (let attempt = 0; attempt < 4; attempt++) {
    let r;
    try {
      r = await fetch(url);
    } catch (e) {
      if (attempt < 3) { await sleep(1000 * Math.pow(2, attempt)); continue; }
      throw new Error(t('net-err'));
    }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) {
      if (attempt < 3) { await sleep(1000 * Math.pow(2, attempt)); continue; }
      throw new Error(r.status === 429
        ? (LANG === 'zh' ? '归档接口限流（429），请稍后刷新重试' : 'Archive API rate-limited (429), retry later')
        : (LANG === 'zh' ? `归档接口 ${r.status}` : `Archive API ${r.status}`));
    }
    throw new Error(LANG === 'zh' ? `归档接口 ${r.status}` : `Archive API ${r.status}`);  // 其他 4xx 不重试
  }
  throw new Error('归档接口请求失败');
}

async function loadHistoryData(lat, lon) {
  const key = `${CACHE_PREFIX}history3:${roundCoord(lat)},${roundCoord(lon)}`;
  const cached = cacheGet(key, HISTORY_TTL);
  if (cached) return cached;

  const end = new Date();
  const start = addYears(end, -30);
  const chunks = [];
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const s = addYears(start, i * CHUNK_YEARS);
    const nextStart = addYears(start, (i + 1) * CHUNK_YEARS);
    // 归档接口两端均含端点：最后一块截止到 end，其余块截止到下一块起点前一天，避免端点重复
    const e = nextStart >= end
      ? end
      : new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1);
    chunks.push([fmtDate(s), fmtDate(e)]);
  }
  // 6 个分块、限并发 3 + 429 重试，避免触发归档接口限流
  const results = await runLimited(
    chunks.map(([s, e]) => () => fetchChunk(lat, lon, s, e)),
    3,
  );

  const times = [], precip = [], tmax = [], tmin = [], snow = [];
  for (const r of results) {
    const d = r.daily;
    times.push(...d.time);
    precip.push(...d.precipitation_sum);
    tmax.push(...d.temperature_2m_max);
    tmin.push(...d.temperature_2m_min);
    snow.push(...(d.snowfall_sum || []));
  }
  const data = {
    window: { start: fmtDate(start), end: fmtDate(end) },
    times, precip, tmax, tmin, snow,
  };
  cacheSet(key, data);
  return data;
}

/* ---------- 空气质量（独立 API，30 分钟缓存） ---------- */
async function loadAQI(lat, lon) {
  const key = `${CACHE_PREFIX}aqi2:${roundCoord(lat)},${roundCoord(lon)}`;
  const cached = cacheGet(key, AQI_TTL);
  if (cached) return cached;
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    current: 'pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi',
  });
  const r = await fetch(`${AQI_URL}?${params}`);
  if (!r.ok) throw new Error(`空气质量接口 ${r.status}`);
  const data = await r.json();
  cacheSet(key, data);
  return data;
}

/* ---------- AQI 评级（中文=中国 HJ 633-2012 口径，英文=US EPA 口径） ---------- */
/* 中国 AQI：各污染物浓度 → IAQI 分段线性插值，取最大值。
   断点为 24h/8h 均值口径，此处用模型即时浓度近似，结果为估算值 */
const HJ633 = {
  pm2_5:           { bps: [0, 35, 75, 115, 150, 250, 350] },
  pm10:            { bps: [0, 50, 150, 250, 350, 420, 500] },
  ozone:           { bps: [0, 100, 160, 215, 265, 800] },            // 8h 均值口径
  nitrogen_dioxide:{ bps: [0, 40, 80, 180, 280, 565, 750] },
  sulphur_dioxide: { bps: [0, 50, 150, 475, 800, 1600, 2088] },
  carbon_monoxide: { bps: [0, 2, 4, 14, 24, 36, 48], div: 1000 },    // 接口 µg/m³，断点 mg/m³
};
const IAQI_LEVELS = [0, 50, 100, 150, 200, 300, 400];

function iaqi(bps, c) {
  const n = bps.length;
  if (c == null || c < 0 || bps[1] == null) return null;
  for (let i = 1; i < n; i++) {
    if (c <= bps[i]) {
      return (IAQI_LEVELS[i] - IAQI_LEVELS[i - 1]) / (bps[i] - bps[i - 1]) * (c - bps[i - 1]) + IAQI_LEVELS[i - 1];
    }
  }
  // 超过最高断点：按最后一段斜率外推，封顶 500
  return Math.min(
    IAQI_LEVELS[n - 1] + (c - bps[n - 1]) * (IAQI_LEVELS[n - 1] - IAQI_LEVELS[n - 2]) / (bps[n - 1] - bps[n - 2]),
    500,
  );
}

/* 污染物显示名（接口字段名 -> 中/英） */
const POLLUTANT_NAMES = {
  pm2_5:            { zh: 'PM2.5',   en: 'PM2.5' },
  pm10:             { zh: 'PM10',    en: 'PM10' },
  ozone:            { zh: '臭氧',    en: 'Ozone' },
  nitrogen_dioxide: { zh: '二氧化氮', en: 'NO₂' },
  sulphur_dioxide:  { zh: '二氧化硫', en: 'SO₂' },
  carbon_monoxide:  { zh: '一氧化碳', en: 'CO' },
};

function calcChinaAqi(cur) {
  let aqi = null;
  const primary = [];
  for (const k of Object.keys(HJ633)) {
    let c = cur ? cur[k] : null;
    if (c == null) continue;
    if (HJ633[k].div) c = c / HJ633[k].div;
    const v = iaqi(HJ633[k].bps, c);
    if (v == null) continue;
    if (aqi == null || v > aqi) { aqi = v; primary.length = 0; primary.push(k); }
    else if (v === aqi) primary.push(k);   // 并列最大时国标要求全部列出
  }
  return { aqi, primary };
}

/* 等级评定：两种标准的档位边界一致（0/50/100/150/200/300），返回 {text, cls, pct, segs} */
function aqiScale(v) {
  if (v == null) return null;
  const t = LANG === 'zh'
    ? (v <= 50 ? '优' : v <= 100 ? '良' : v <= 150 ? '轻度污染' : v <= 200 ? '中度污染' : v <= 300 ? '重度污染' : '严重污染')
    : (v <= 50 ? 'Good' : v <= 100 ? 'Moderate' : v <= 150 ? 'Unhealthy (SG)' : v <= 200 ? 'Unhealthy' : v <= 300 ? 'Very Unhealthy' : 'Hazardous');
  const cls = v <= 50 ? 'lv-low' : v <= 100 ? 'lv-mid' : v <= 150 ? 'lv-high' : v <= 200 ? 'lv-severe' : 'lv-extreme';
  return {
    text: t, cls,
    pct: Math.min(v / 300, 1) * 100,
    segs: [{ to: 17, cls: 'lv-low' }, { to: 33, cls: 'lv-mid' }, { to: 50, cls: 'lv-high' }, { to: 67, cls: 'lv-severe' }, { to: 100, cls: 'lv-extreme' }],
  };
}

function renderAQI(aqiData) {
  const cur = aqiData && aqiData.current;
  let value = null, sub = '';
  if (LANG === 'zh') {
    // 中国口径：浓度重算，>50 时附首要污染物
    const cn = calcChinaAqi(cur);
    value = cn.aqi;
    sub = cn.aqi == null ? ''
      : cn.aqi > 50 ? `${t('aqi-primary')} ${cn.primary.map(k => POLLUTANT_NAMES[k][LANG === 'zh' ? 'zh' : 'en']).join(LANG === 'zh' ? '、' : ', ')}`
      : (cur && cur.pm2_5 != null ? `PM2.5 ${Math.round(cur.pm2_5)}` : '');
  } else {
    value = cur ? cur.us_aqi : null;
    sub = cur && cur.pm2_5 != null ? `PM2.5 ${Math.round(cur.pm2_5)}` : '';
  }
  const sc = aqiScale(value);
  setDetail('d-aqi', value != null ? String(Math.round(value)) : '--', sc);
  setText('d-aqi-level', sc ? `${sc.text}${sub ? ' · ' + sub : ''}` : '');
}

/* ---------- 今天的历史天气统计（纯函数） ---------- */
function computeExtremes(data, todayMMdd, lat) {
  const { times, precip, tmax, tmin, snow } = data;
  // 收集今天这个日期（MM-DD）的所有索引（合并后时间正序）
  const idxs = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i].slice(5, 10) === todayMMdd) idxs.push(i);
  }
  // 窗口可能含 31 个（含今年今天），只取最近 30 个；不足 30 则全用
  const recent = idxs.length > 30 ? idxs.slice(idxs.length - 30) : idxs;

  let maxP = -Infinity, maxPDate = null;
  let maxT = -Infinity, maxTDate = null;
  let minT = Infinity, minTDate = null;
  let precipDays = 0, snowDays = 0;
  for (const i of recent) {
    const p = precip[i];
    if (p != null && p > 0) { precipDays++; if (p > maxP) { maxP = p; maxPDate = times[i]; } } // 今天最大降水
    const s = snow ? snow[i] : null;
    if (s != null && s > 0) snowDays++;                  // 今天有降雪
    const tx = tmax[i];
    if (tx != null && tx > maxT) { maxT = tx; maxTDate = times[i]; } // 今天最高温度
    const tn = tmin[i];
    if (tn != null && tn < minT) { minT = tn; minTDate = times[i]; } // 今天最低温度
  }
  // 冬季判断（按半球）：北半球 12/1/2 月，南半球 6/7/8 月
  const month = +todayMMdd.slice(0, 2);
  const isWinter = lat >= 0
    ? (month === 12 || month === 1 || month === 2)
    : (month >= 6 && month <= 8);
  const mk = (v, date) => date ? { value: v, date, year: +date.slice(0, 4) } : null;
  return {
    window: data.window,
    today: todayMMdd,
    rainDays: {
      isSnow: isWinter,
      count: isWinter ? snowDays : precipDays,
      total: recent.length,
    },
    maxPrecip: mk(maxP, maxPDate),
    maxTemp: mk(maxT, maxTDate),
    minTemp: mk(minT, minTDate),
  };
}

/* ---------- 渲染 ---------- */
/* ---------- 详情卡：数值 + 等级 + 分段指示条 ---------- */
const LV_COLORS = { 'lv-low': '#4ade80', 'lv-mid': '#facc15', 'lv-high': '#fb923c', 'lv-severe': '#fb7185', 'lv-extreme': '#c084fc' };

/* 各指标等级评定：返回 {text, cls, pct, segs}
   pct  = 倒三角位置（0-100）；segs = 指示条分段 [{to, cls}]，边界与实际阈值一致 */
const DETAIL_SCALES = {
  humidity: v => v == null ? null : ({
    text: v < 30 ? t('lv-dry') : v <= 60 ? t('lv-comfy') : v <= 80 ? t('lv-humid') : t('lv-veryhumid'),
    cls: v < 30 ? 'lv-mid' : v <= 60 ? 'lv-low' : v <= 80 ? 'lv-high' : 'lv-severe',
    pct: v,
    segs: [{ to: 30, cls: 'lv-mid' }, { to: 60, cls: 'lv-low' }, { to: 80, cls: 'lv-high' }, { to: 100, cls: 'lv-severe' }],
  }),
  pressure: v => v == null ? null : ({
    text: v < 1000 ? t('lv-lowp') : v <= 1025 ? t('lv-normalp') : t('lv-highp'),
    cls: v < 1000 ? 'lv-extreme' : v <= 1025 ? 'lv-low' : 'lv-high',
    pct: Math.max(0, Math.min((v - 970) / 70, 1)) * 100,
    segs: [{ to: 43, cls: 'lv-extreme' }, { to: 79, cls: 'lv-low' }, { to: 100, cls: 'lv-high' }],
  }),
  uv: v => v == null ? null : ({
    text: v < 3 ? t('uv-lv1') : v < 6 ? t('uv-lv2') : v < 8 ? t('uv-lv3') : v < 11 ? t('uv-lv4') : t('uv-lv5'),
    cls: v < 3 ? 'lv-low' : v < 6 ? 'lv-mid' : v < 8 ? 'lv-high' : v < 11 ? 'lv-severe' : 'lv-extreme',
    pct: Math.min(v / 12, 1) * 100,
    segs: [{ to: 25, cls: 'lv-low' }, { to: 50, cls: 'lv-mid' }, { to: 67, cls: 'lv-high' }, { to: 92, cls: 'lv-severe' }, { to: 100, cls: 'lv-extreme' }],
  }),
};

/* 按分段生成渐变：段间加深色分隔口 */
function barGradient(segs) {
  const stops = [];
  let prev = 0;
  segs.forEach((s, i) => {
    const to = Math.min(Math.max(s.to, prev + 1), 100);
    const c = LV_COLORS[s.cls] || LV_COLORS['lv-low'];
    if (i > 0) stops.push(`rgba(15,32,39,.7) ${prev}%, rgba(15,32,39,.7) ${prev + 1.5}%`);
    stops.push(`${c} ${i === 0 ? 0 : prev + 1.5}%, ${c} ${to}%`);
    prev = to;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function setDetail(id, valueText, scale) {
  setText(id, valueText);
  const lvEl = document.getElementById(`${id}-level`);
  const bar = document.getElementById(`${id}-bar`);
  if (lvEl) {
    lvEl.textContent = scale ? scale.text : '';
    lvEl.className = `dlevel ${scale ? scale.cls : ''}`;
  }
  if (bar) {
    const marker = bar.querySelector('.dbar-marker');
    if (marker) marker.style.left = `${scale ? Math.max(0, Math.min(100, scale.pct)) : 0}%`;
    if (scale && scale.segs) bar.style.background = barGradient(scale.segs);
  }
}

/* ---------- 湿度仪表弧（270° 速度表样式） ---------- */
/* 极坐标 -> 屏幕坐标：0°=东，顺时针为正（y 向下） */
function polar(cx, cy, r, deg) {
  const a = deg * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
/* SVG 圆弧路径：从 startDeg 顺时针画到 endDeg */
function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
const GAUGE = { cx: 50, cy: 52, r: 36, start: 135, sweep: 270 };  // 270° 弧，缺口朝下

function renderHumidityGauge(v) {
  const el = document.getElementById('d-humidity-gauge');
  if (!el) return;
  const { cx, cy, r, start, sweep } = GAUGE;
  const pct = v == null || v < 0 ? 0 : v > 100 ? 100 : v;
  const angle = start + (pct / 100) * sweep;
  // 分段着色（阈值取自 DETAIL_SCALES.humidity，与原 dbar 一致）
  const segs = DETAIL_SCALES.humidity(50).segs;
  let prev = 0;
  const arcs = segs.map(s => {
    const a0 = start + (prev / 100) * sweep;
    const a1 = start + (Math.min(s.to, 100) / 100) * sweep;
    prev = s.to;
    const c = LV_COLORS[s.cls] || LV_COLORS['lv-low'];
    return `<path d="${arcPath(cx, cy, r, a0, a1)}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="butt"/>`;
  }).join('');
  // 指针：从圆心指向当前值，用 stroke-dashoffset 做 draw-in 动画
  const tip = polar(cx, cy, r - 5, angle);
  const len = (r - 5).toFixed(2);
  const needle =
    `<line class="gauge-needle" x1="${cx}" y1="${cy}" x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(2)}" ` +
    `stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>`;
  const hub = `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#fff"/>`;
  const p0 = polar(cx, cy, r + 9, start);
  const p100 = polar(cx, cy, r + 9, start + sweep);
  el.innerHTML =
    `<svg viewBox="0 0 100 94" class="gauge-svg" aria-hidden="true">` +
    `<path d="${arcPath(cx, cy, r, start, start + sweep)}" stroke="rgba(255,255,255,.10)" stroke-width="7" fill="none"/>` +
    arcs + needle + hub +
    `<text x="${p0.x.toFixed(2)}" y="${p0.y.toFixed(2)}" class="gauge-tick" text-anchor="middle" dominant-baseline="middle">0</text>` +
    `<text x="${p100.x.toFixed(2)}" y="${p100.y.toFixed(2)}" class="gauge-tick" text-anchor="middle" dominant-baseline="middle">100</text>` +
    `</svg>`;
  // 下一帧触发指针 draw-in
  const needleEl = el.querySelector('.gauge-needle');
  if (needleEl) requestAnimationFrame(() => { needleEl.style.strokeDashoffset = 0; });
}

/* ---------- 太阳轨迹弧（合并日出/日落卡） ---------- */
/* 圆弧（非椭圆）：恒定曲率，左右两端不再陡峭；复用上方的 polar()/arcPath() */
const SUN = { cx: 141.5, cy: 195.5, r: 190, start: -130, end: -50 };  // start=日出(左) end=日落(右) -90°=正午(顶)，端点仰角≈40°

function renderSunArc(sunriseIso, sunsetIso, nowIso) {
  const el = document.getElementById('d-sun-arc');
  if (!el) return;
  const { cx, cy, r, start, end } = SUN;
  const sweep = end - start;                 // 80°：日出 -> 正午 -> 日落
  const toMin = iso => {
    const [h, m] = iso.split('T')[1].split(':').map(Number);
    return h * 60 + m;
  };
  const sr = toMin(sunriseIso), ss = toMin(sunsetIso);
  const span = ss - sr;
  const now = nowIso ? toMin(nowIso) : null;
  let p = 0, isDay = false;
  if (now != null && span > 0) {
    isDay = now >= sr && now <= ss;
    p = Math.max(0, Math.min((now - sr) / span, 1));
  }
  const ang = start + p * sweep;             // 沿圆弧的当前角度
  const sun = polar(cx, cy, r, ang);
  const track = arcPath(cx, cy, r, start, end);
  const prog = p > 0 ? arcPath(cx, cy, r, start, ang) : '';
  const left = polar(cx, cy, r, start);
  const right = polar(cx, cy, r, end);
  el.innerHTML =
    `<svg viewBox="0 0 283 56" class="sun-svg" aria-hidden="true">` +
    `<defs><linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs>` +
    `<line x1="10" y1="${left.y.toFixed(2)}" x2="273" y2="${left.y.toFixed(2)}" stroke="rgba(255,255,255,.16)" stroke-width="0.8" stroke-dasharray="2 3"/>` +
    `<path d="${track}" stroke="rgba(255,255,255,.14)" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    (prog ? `<path d="${prog}" stroke="url(#sunGrad)" stroke-width="3" fill="none" stroke-linecap="round"/>` : '') +
    `<circle cx="${left.x.toFixed(2)}" cy="${left.y.toFixed(2)}" r="2.4" fill="#fbbf24"/>` +
    `<circle cx="${right.x.toFixed(2)}" cy="${right.y.toFixed(2)}" r="2.4" fill="#fb923c"/>` +
    `<text x="${sun.x.toFixed(2)}" y="${sun.y.toFixed(2)}" class="sun-mark" text-anchor="middle" dominant-baseline="central">${isDay ? '☀️' : '🌙'}</text>` +
    `</svg>`;
}

/* ---------- 风向罗盘（MSN 风格：圆周刻度 + 方位字母 + 指针） ---------- */
function renderWindCompass(deg) {
  const el = document.getElementById('d-winddir-rose');
  if (!el) return;
  const cx = 50, cy = 50, r = 36;
  // 刻度：每 15° 一格，正方位（90° 倍数）加长加亮；-90° 使 0° 朝上（北）
  let ticks = '';
  for (let a = 0; a < 360; a += 15) {
    const major = a % 90 === 0;
    const p1 = polar(cx, cy, r, a - 90);
    const p2 = polar(cx, cy, r - (major ? 6 : 3.5), a - 90);
    ticks += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" ` +
      `stroke="rgba(255,255,255,${major ? '.6' : '.22'})" stroke-width="${major ? 1.6 : 1}"/>`;
  }
  const dirs = LANG === 'zh' ? ['北', '东', '南', '西'] : ['N', 'E', 'S', 'W'];
  const labels = [0, 90, 180, 270].map((a, i) => {
    const p = polar(cx, cy, r + 7, a - 90);
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="drose-lab" text-anchor="middle" dominant-baseline="central">${dirs[i]}</text>`;
  }).join('');
  el.innerHTML =
    `<svg viewBox="0 0 100 100" class="drose-svg" aria-hidden="true">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1"/>` +
    ticks + labels +
    `<g class="drose-needle">` +
    `<line x1="${cx}" y1="${cy + 16}" x2="${cx}" y2="${cy - 10}" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round"/>` +
    `<polygon points="${cx - 4.5},${cy - 8} ${cx + 4.5},${cy - 8} ${cx},${cy - 22}" fill="#4ade80"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>` +
    `</g></svg>`;
  const needle = el.querySelector('.drose-needle');
  if (needle) needle.style.transform = `rotate(${Math.round(deg) + 180}deg)`;
}

/* ---------- 月相（本地推算：基准新月 + 朔望月） ---------- */
/* 2000-01-06 18:14 UTC 基准新月，朔望月 29.530588853 天；误差 <1 天，足够八相分桶 */
const MOON = { epoch: Date.UTC(2000, 0, 6, 18, 14), synodic: 29.530588853 };
const MOON_PHASES = [
  { zh: '新月',   en: 'New Moon' },
  { zh: '娥眉月', en: 'Waxing Crescent' },
  { zh: '上弦月', en: 'First Quarter' },
  { zh: '盈凸月', en: 'Waxing Gibbous' },
  { zh: '满月',   en: 'Full Moon' },
  { zh: '亏凸月', en: 'Waning Gibbous' },
  { zh: '下弦月', en: 'Last Quarter' },
  { zh: '残月',   en: 'Waning Crescent' },
];

/* 月龄（自上次新月起的天数）与照亮比例 */
function moonAge(dateMs) {
  const days = (dateMs - MOON.epoch) / 86400000;
  return ((days % MOON.synodic) + MOON.synodic) % MOON.synodic;
}
function moonIllum(age) { return (1 - Math.cos(2 * Math.PI * age / MOON.synodic)) / 2; }

/* 月相 SVG：暗面圆盘 + 亮面路径（半圆 + 椭圆明暗界线）
   phase: 0=新月 … 0.5=满月 … 1=下次新月 */
function moonSvg(r, phase) {
  return `<svg viewBox="0 0 ${2 * r + 8} ${2 * r + 8}" class="moon-svg" aria-hidden="true">
    <circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="rgba(255,255,255,.10)"/>
    <path d="${moonLitPath(r + 4, r + 4, r, phase)}" fill="#f5f0dc"/>
    <circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
  </svg>`;
}

/* 亮面路径：亮半圆 + 明暗界线（半椭圆弧）围成的区域 */
function moonLitPath(cx, cy, r, phase) {
  const waxing = phase < 0.5;
  const cosT = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(cosT) * r;
  // 亮半圆（右或左），从上端点到下端点
  const top = { x: cx, y: cy - r }, bot = { x: cx, y: cy + r };
  const halfArc = waxing
    ? `M ${top.x} ${top.y} A ${r} ${r} 0 0 1 ${bot.x} ${bot.y}`   // 右半圆（顺时针）
    : `M ${top.x} ${top.y} A ${r} ${r} 0 0 0 ${bot.x} ${bot.y}`;  // 左半圆（逆时针）
  // 明暗界线凸向：凸离亮面半圆 = 凸月（sweep=1），凸向亮面 = 月牙（sweep=0）
  const bulgeAway = waxing === (cosT < 0);
  const term = `A ${rx.toFixed(2)} ${r} 0 0 ${bulgeAway ? 1 : 0} ${top.x} ${top.y}`;
  return `${halfArc} ${term} Z`;
}

function renderMoon(nowMs) {
  const age = moonAge(nowMs);
  const phase = age / MOON.synodic;
  const idx = Math.round(phase * 8) % 8;
  const mp = MOON_PHASES[idx];
  const pct = Math.round(moonIllum(age) * 100);
  setText('d-moon', LANG === 'zh' ? mp.zh : mp.en);
  setText('d-moon-level', `${t('moon-lit')} ${pct}%`);
  const viz = document.getElementById('d-moon-viz');
  if (viz) viz.innerHTML = moonSvg(38, phase);
}

function renderDetails(c, d) {
  const uv = d.uv_index_max != null ? d.uv_index_max[0] : null;
  setDetail('d-humidity', `${c.relative_humidity_2m} %`, DETAIL_SCALES.humidity(c.relative_humidity_2m));
  renderHumidityGauge(c.relative_humidity_2m);
  // 风力合并卡：风级大字 + 风速/风向副行（罗盘箭头在下方风向段旋转）
  const wl = windLevel(c.wind_speed_10m);
  setText('d-wind', LANG === 'zh' ? `${wl} 级` : `Force ${wl}`);
  setText('d-wind-sub', `${c.wind_speed_10m} km/h · ${windDirLabel(c.wind_direction_10m)}${LANG === 'zh' ? '风' : ''}`);
  setDetail('d-pressure', `${Math.round(c.surface_pressure)} hPa`, DETAIL_SCALES.pressure(c.surface_pressure));
  setDetail('d-uv', uv != null ? uv.toFixed(1) : '--', DETAIL_SCALES.uv(uv));
  // 日出/日落（合并卡）：时间 + 昼长 + 太阳轨迹弧
  setText('d-sunrise', fmtTime(d.sunrise[0]));
  setText('d-sunset', fmtTime(d.sunset[0]));
  setText('d-daylen', `${t('daylen')} ${dayLength(d.sunrise[0], d.sunset[0])}`);
  renderSunArc(d.sunrise[0], d.sunset[0], c.time);
  renderMoon(Date.parse(c.time));   // 月相：城市当前时刻推算
  // 风向：MSN 风格刻度罗盘（箭头指向风吹去的方向 = 来向 + 180°）
  renderWindCompass(c.wind_direction_10m);
}

/* 昼长：日出-日落 */
function dayLength(sunriseIso, sunsetIso) {
  const toMin = t => {
    const [h, m] = t.split('T')[1].split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(sunsetIso) - toMin(sunriseIso);
  return LANG === 'zh'
    ? `${Math.floor(diff / 60)} 小时 ${String(diff % 60).padStart(2, '0')} 分`
    : `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, '0')}m`;
}

function renderWeather(data, cityLabel) {
  const c = data.current, d = data.daily;

  setText('city-name', cityLabel);
  setText('current-date', new Date().toLocaleDateString(localeTag(),
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));
  setText('current-desc', wmoText(c.weather_code));
  setText('current-emoji', wmoEmoji(c.weather_code));
  setText('current-temp', `${Math.round(c.temperature_2m)}°`);
  setText('feels-like', `${t('feels-like')} ${Math.round(c.apparent_temperature)}°`);
  document.getElementById('temp-range').innerHTML =
    `<span class="t-low">${Math.round(d.temperature_2m_min[0])}°</span> ~ <span class="t-high">${Math.round(d.temperature_2m_max[0])}°</span>`;

  renderDetails(c, d);

  renderForecast(d);
  document.getElementById('current').classList.remove('skeleton');
}

/* ---------- 7 天预报：卡片 / 列表 双模式 ---------- */
let forecastData = null;   // 缓存最近一次预报数据，供模式切换时重绘
let forecastMode = localStorage.getItem('weather:fcMode') || 'cards';

function dayRelLabel(iso, i) {
  const date = new Date(iso + 'T00:00');
  if (i === 0) return t('today');
  if (i === 1) return t('tomorrow');
  if (i === 2 && LANG === 'zh') return t('day-after');
  return date.toLocaleDateString(localeTag(), { weekday: 'short' });
}
function dayMD(iso) {
  const d = new Date(iso + 'T00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function renderForecast(d) {
  forecastData = d;
  document.getElementById('fc-mode-btns').style.display = '';
  const cards = document.getElementById('forecast');
  const list = document.getElementById('forecast-list');
  cards.style.display = forecastMode === 'cards' ? '' : 'none';
  list.style.display = forecastMode === 'list' ? '' : 'none';
  // 切换按钮高亮
  document.querySelectorAll('#fc-mode-btns button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === forecastMode);
  });
  if (forecastMode === 'cards') renderForecastCards(d);
  else renderForecastList(d);
}

function renderForecastCards(d) {
  const row = document.getElementById('forecast');
  row.innerHTML = '';
  d.time.forEach((iso, i) => {
    const weekday = dayRelLabel(iso, i);
    const md = i === 0 ? '' : dayMD(iso);
    const pop = d.precipitation_probability_max[i];
    const el = document.createElement('div');
    el.className = 'fday';
    el.innerHTML =
      `<div class="fdate">${weekday}${md ? ' ' + md : ''}</div>` +
      `<div class="femoji">${wmoEmoji(d.weather_code[i])}</div>` +
      `<div class="ftemps"><span class="fhigh">${Math.round(d.temperature_2m_max[i])}°</span>` +
      ` <span class="flow">${Math.round(d.temperature_2m_min[i])}°</span></div>` +
      (pop != null ? `<div class="fpop">💧${pop}%</div>` : '');
    row.appendChild(el);
  });
}

/* 列表模式：仿墨迹 15 天预报，每行一天 */
function renderForecastList(d) {
  const list = document.getElementById('forecast-list');
  list.innerHTML = '';
  d.time.forEach((iso, i) => {
    const dir = d.wind_direction_10m_dominant != null ? windDirLabel(d.wind_direction_10m_dominant[i]) : '--';
    const spd = d.wind_speed_10m_max != null
      ? (LANG === 'zh' ? `${windLevel(d.wind_speed_10m_max[i])} 级` : `Force ${windLevel(d.wind_speed_10m_max[i])}`) : '--';
    const pop = d.precipitation_probability_max[i];
    const el = document.createElement('div');
    el.className = 'frow';
    el.innerHTML =
      `<div class="fr-left"><span class="fr-rel">${dayRelLabel(iso, i)}</span><span class="fr-date muted">${dayMD(iso)}</span></div>` +
      `<div class="fr-emoji">${wmoEmoji(d.weather_code[i])}</div>` +
      `<div class="fr-wx">${wmoText(d.weather_code[i])}${pop != null && pop > 0 ? `<span class="fr-pop">💧${pop}%</span>` : ''}</div>` +
      `<div class="fr-temps"><span class="fhigh">${Math.round(d.temperature_2m_max[i])}°</span>` +
      ` <span class="flow">${Math.round(d.temperature_2m_min[i])}°</span></div>` +
      `<div class="fr-wind muted">${dir}${LANG === 'zh' ? '风' : ''} ${spd}</div>`;
    list.appendChild(el);
  });
}

/* 模式切换 */
document.getElementById('fc-cards-btn').addEventListener('click', () => setForecastMode('cards'));
document.getElementById('fc-list-btn').addEventListener('click', () => setForecastMode('list'));
function setForecastMode(mode) {
  if (mode === forecastMode) return;
  forecastMode = mode;
  try { localStorage.setItem('weather:fcMode', mode); } catch {}
  if (forecastData) renderForecast(forecastData);
}

const EXTREME_CARDS = [
  { id: 'ext-precip', key: 'maxPrecip', unit: 'mm' },
  { id: 'ext-hot',    key: 'maxTemp',   unit: '°C' },
  { id: 'ext-cold',   key: 'minTemp',   unit: '°C' },
];
const ALL_EXT_IDS = ['ext-raindays', 'ext-precip', 'ext-hot', 'ext-cold'];

function renderRainDays(rd) {
  const el = document.getElementById('ext-raindays');
  el.classList.remove('loading');
  if (!rd || rd.total === 0) {
    el.querySelector('.ext-value').textContent = t('no-data');
    el.querySelector('.ext-year').textContent = '';
    el.querySelector('.ext-date').textContent = '';
    return;
  }
  el.querySelector('.ext-emoji').textContent = rd.isSnow ? '❄️' : '🌧️';
  el.querySelector('.ext-label').textContent = t(rd.isSnow ? 'ext-label-snowdays' : 'ext-label-raindays');
  el.querySelector('.ext-value').textContent = `${rd.count} / ${rd.total}`;
  el.querySelector('.ext-year').textContent = t(rd.isSnow ? 'ext-snow-sub' : 'ext-rain-sub');
  el.querySelector('.ext-date').textContent = t('ext-onthisdate');
}

function renderExtremes(data, cityLabel) {
  setText('extremes-window', LANG === 'zh'
    ? `${cityLabel} · 过去 30 年今日历史（${data.window.start} 至 ${data.window.end}）`
    : `${cityLabel} · History on this date, past 30 years (${data.window.start} to ${data.window.end})`);
  renderRainDays(data.rainDays);
  for (const card of EXTREME_CARDS) {
    const el = document.getElementById(card.id);
    el.classList.remove('loading');
    const ex = data[card.key];
    el.querySelector('.ext-value').textContent = ex ? `${ex.value} ${card.unit}` : t('no-data');
    el.querySelector('.ext-year').textContent = ex ? `${ex.year}${t('year-suffix')}` : '';
    el.querySelector('.ext-date').textContent = ex ? formatDateZh(ex.date) : '';
  }
}

function showExtremesLoading() {
  for (const id of ALL_EXT_IDS) {
    const el = document.getElementById(id);
    el.classList.add('loading');
    el.querySelector('.ext-value').textContent = '';
    el.querySelector('.ext-year').textContent = '';
    el.querySelector('.ext-date').textContent = '';
  }
  setText('extremes-window', t('ext-loading'));
}

function showExtremesError(msg) {
  setText('extremes-window', msg);
  for (const id of ALL_EXT_IDS) {
    document.getElementById(id).classList.remove('loading');
  }
}

/* ---------- 主流程 ---------- */
/* 最近一次加载的上下文：语言切换时用缓存数据整体重渲染，不重新请求 */
let lastCtx = {
  lat: 39.9075, lon: 116.39723, zhName: '北京', enName: 'Beijing',
  weather: null, aqi: null, extremes: null,
};
function cityLabel() { return LANG === 'zh' ? lastCtx.zhName : lastCtx.enName; }

async function selectCity(lat, lon, zhName, enName) {
  lastCtx = {
    lat, lon,
    zhName: zhName || lastCtx.zhName, enName: enName || zhName || lastCtx.enName,
    weather: null, aqi: null, extremes: null,
  };
  showExtremesLoading();

  // 天气 / 历史 / 空气质量并行拉取（历史是慢的那个，约 10 秒）
  const weatherP = loadWeather(lat, lon);
  const historyP = loadHistoryData(lat, lon);
  const aqiP = loadAQI(lat, lon).then(d => { lastCtx.aqi = d; renderAQI(d); }).catch(e => {
    setText('d-aqi', '--');
    setText('d-aqi-level', t('aqi-err'));
  });

  // "今天"取所选城市当地日期（来自预报 daily.time[0]，已按城市时区）
  let todayMMdd = fmtDate(new Date()).slice(5, 10); // 兜底：浏览器本地今天
  try {
    const data = await weatherP;
    lastCtx.weather = data;
    if (data && data.daily && data.daily.time[0]) {
      todayMMdd = data.daily.time[0].slice(5, 10);
    }
    renderWeather(data, cityLabel());
  } catch (e) {
    showToast(t('weather-err') + e.message);
  }

  try {
    const hist = await historyP;
    const extremes = computeExtremes(hist, todayMMdd, lat);
    lastCtx.extremes = extremes;
    renderExtremes(extremes, cityLabel());
  } catch (e) {
    showExtremesError(t('history-err') + e.message);
  }
}

/* 语言切换：静态文案 + 已缓存数据整体重渲染 */
function setLang(lang) {
  if (lang === LANG) return;
  LANG = lang;
  try { localStorage.setItem('weather:lang', lang); } catch {}
  applyLang();
  if (lastCtx.weather) renderWeather(lastCtx.weather, cityLabel());
  if (lastCtx.aqi) renderAQI(lastCtx.aqi);
  if (lastCtx.extremes) renderExtremes(lastCtx.extremes, cityLabel());
  else showExtremesLoading();  // 历史仍在后台拉取，完成时会按新语言渲染
}
document.querySelectorAll('#lang-switch button').forEach(b => {
  b.addEventListener('click', () => setLang(b.dataset.lang));
});

/* ---------- 搜索框交互 ---------- */
let searchTimer;
const searchInput = document.getElementById('search');
const suggBox = document.getElementById('suggestions');

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q) { suggBox.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    try {
      // 双语并行搜索：切换语言与跨语言重渲染都需要两份名字
      const [zh, en] = await Promise.all([searchCity(q, 'zh'), searchCity(q, 'en')]);
      renderSuggestions({ zh, en });
    } catch { suggBox.hidden = true; }
  }, 300);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = suggBox.querySelector('li');
    if (first && !suggBox.hidden) first.click();
  } else if (e.key === 'Escape') {
    suggBox.hidden = true;
  }
});

function renderSuggestions(results) {
  const list = results[LANG] || [];
  if (!list.length) { suggBox.hidden = true; return; }
  suggBox.innerHTML = list.map(r => {
    // 按地理 id 找另一语言的结果，找不到则退回当前名字
    const zh = (results.zh || []).find(x => x.id === r.id) || (LANG === 'zh' ? r : null);
    const en = (results.en || []).find(x => x.id === r.id) || (LANG === 'en' ? r : null);
    const zhName = zh ? fullName(zh, 'zh') : r.name;
    const enName = en ? fullName(en, 'en') : r.name;
    return `<li data-lat="${r.latitude}" data-lon="${r.longitude}" data-zh="${escapeHtml(zhName)}" data-en="${escapeHtml(enName)}">` +
      `<span>${escapeHtml(r.name)}` +
      (r.admin1 ? `<span class="country"> ${escapeHtml(r.admin1)}${LANG === 'zh' ? '，' : ', '}${escapeHtml(r.country)}</span>` : '') +
      `</span></li>`;
  }).join('');
  suggBox.hidden = false;
  suggBox.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      searchInput.value = LANG === 'zh' ? li.dataset.zh : li.dataset.en;
      suggBox.hidden = true;
      selectCity(parseFloat(li.dataset.lat), parseFloat(li.dataset.lon), li.dataset.zh, li.dataset.en);
    });
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) suggBox.hidden = true;
});

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ---------- 启动：默认北京 ---------- */
applyLang();
selectCity(lastCtx.lat, lastCtx.lon, lastCtx.zhName, lastCtx.enName);
