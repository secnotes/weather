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
    'sun-modal-title': '日出日落详情',
    'sun-modal-sunrise': '日出',
    'sun-modal-sunset': '日落',
    'sun-modal-noon': '太阳正午',
    'sun-modal-segments': '今日天光时刻',
    'sun-modal-civildawn': '民用黎明',
    'sun-modal-civildusk': '民用黄昏',
    'sun-modal-astrodusk': '天文黄昏',
    'tw-day': '白天',
    'tw-civil': '民用曙暮光',
    'tw-naut': '海事曙暮光',
    'tw-astro': '天文曙暮光',
    'tw-night': '夜间',
    'sun-modal-note': '太阳高度由 NOAA 算法本地计算（含曙暮光分级）；日出日落来自 Open-Meteo，时刻均为城市当地时区。',
    'sun-modal-close': '关闭',
    'sun-now': '当前',
    'sun-cap-sunrise': '日出',
    'sun-cap-sunset': '日落',
    daylen: '昼长',
    'yesterday': '昨天',
    'moon-lit': '照亮',
    'moon-modal-title': '月相详情',
    'moon-modal-age': '月龄',
    'moon-modal-cycle': '朔望周期',
    'moon-modal-days': '天',
    'moon-modal-waxing': '渐盈',
    'moon-modal-waning': '渐亏',
    'moon-modal-next-full': '距满月',
    'moon-modal-upcoming': '月相日程',
    'moon-modal-note': '月相由 2000-01-06 基准新月与 29.53 天朔望月本地推算，误差小于 1 天；农历为近似推算，可能与日历相差一天。',
    'moon-modal-close': '关闭',
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
    'p-rising': '升', 'p-falling': '降', 'p-steady': '稳', 'p-trend-note': '· 3h 变压', 'p-now': '现在',
    'p-modal-title': '气压详情',
    'p-modal-24h': '过去 24 小时',
    'p-modal-max': '最高', 'p-modal-min': '最低', 'p-modal-avg': '平均', 'p-modal-range': '变幅',
    'p-modal-note': '气压骤降常为风雨前兆，持续回升多预示放晴。点击/滑过曲线可查看各时刻数值。',
    'p-forecast-tag': '预报',
    'p-modal-close': '关闭',
    'uv-lv1': '弱', 'uv-lv2': '中等', 'uv-lv3': '强', 'uv-lv4': '很强', 'uv-lv5': '极强',
    'uv-modal-title': '紫外线详情',
    'uv-modal-today': '今日曲线',
    'uv-modal-peak': '峰值',
    'uv-modal-week': '未来 7 天峰值',
    'uv-modal-advice': '防护建议',
    'uv-modal-note': 'UV 指数来自 Open-Meteo 模式估算；防护建议参考 WHO 五级标准。',
    'uv-modal-close': '关闭',
    'uv-peak-short': '今日峰值',
    'uv-now': '当前',
    'uv-adv1': '弱：无需特别防护，可安全户外活动。',
    'uv-adv2': '中等：建议 SPF30+ 防晒霜与太阳镜。',
    'uv-adv3': '强：SPF30+ 防晒霜、太阳镜、遮阳帽；10-16 时注意遮蔽。',
    'uv-adv4': '很强：尽量减少户外暴露；外出需高倍防晒与物理遮挡。',
    'uv-adv5': '极强：避免 10-16 时户外活动；全方位防护必不可少。',
    'aqi-primary': '首要',
    'aqi-modal-title': '空气质量详情',
    'aqi-modal-conc': '污染物浓度',
    'aqi-modal-bars': '各污染物分档',
    'aqi-modal-limit': '日均限值',
    'aqi-modal-note': '各污染物浓度来自 CAMS 大气模型估算，为即时值；中文模式 AQI 按 HJ 633-2012 插值计算，英文模式为 US AQI。',
    'aqi-modal-close': '关闭',
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
    'sun-modal-title': 'Sunrise & Sunset',
    'sun-modal-sunrise': 'Sunrise',
    'sun-modal-sunset': 'Sunset',
    'sun-modal-noon': 'Solar noon',
    'sun-modal-segments': 'Today\'s Twilight Times',
    'sun-modal-civildawn': 'Civil dawn',
    'sun-modal-civildusk': 'Civil dusk',
    'sun-modal-astrodusk': 'Astronomical dusk',
    'tw-day': 'Daylight',
    'tw-civil': 'Civil twilight',
    'tw-naut': 'Nautical twilight',
    'tw-astro': 'Astronomical twilight',
    'tw-night': 'Night',
    'sun-modal-note': 'Solar altitude computed locally (NOAA, with twilight bands); sunrise/sunset from Open-Meteo. All times in the city\'s local timezone.',
    'sun-modal-close': 'Close',
    'sun-now': 'now',
    'sun-cap-sunrise': 'Sunrise',
    'sun-cap-sunset': 'Sunset',
    daylen: 'Daylight',
    'yesterday': 'Yesterday',
    'moon-lit': 'lit',
    'moon-modal-title': 'Moon Phase Details',
    'moon-modal-age': 'Moon age',
    'moon-modal-cycle': 'Synodic cycle',
    'moon-modal-days': 'days',
    'moon-modal-waxing': 'Waxing',
    'moon-modal-waning': 'Waning',
    'moon-modal-next-full': 'to Full',
    'moon-modal-upcoming': 'Upcoming Phases',
    'moon-modal-note': 'Computed locally from the 2000-01-06 reference new moon and the 29.53-day synodic month; error under 1 day.',
    'moon-modal-close': 'Close',
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
    'p-rising': 'Rising', 'p-falling': 'Falling', 'p-steady': 'Steady', 'p-trend-note': '· 3h', 'p-now': 'now',
    'p-modal-title': 'Pressure Details',
    'p-modal-24h': 'Past 24 Hours',
    'p-modal-max': 'High', 'p-modal-min': 'Low', 'p-modal-avg': 'Avg', 'p-modal-range': 'Range',
    'p-modal-note': 'A sharp pressure drop often precedes wind and rain; a steady rise usually means clearing. Hover or drag the curve to inspect values.',
    'p-forecast-tag': 'forecast',
    'p-modal-close': 'Close',
    'uv-lv1': 'Low', 'uv-lv2': 'Moderate', 'uv-lv3': 'High', 'uv-lv4': 'Very High', 'uv-lv5': 'Extreme',
    'uv-modal-title': 'UV Index Details',
    'uv-modal-today': 'Today\'s Curve',
    'uv-modal-peak': 'Peak',
    'uv-modal-week': '7-Day Peak',
    'uv-modal-advice': 'Protection Advice',
    'uv-modal-note': 'UV index is an Open-Meteo model estimate; advice follows the WHO 5-level standard.',
    'uv-modal-close': 'Close',
    'uv-peak-short': 'today peak',
    'uv-now': 'now',
    'uv-adv1': 'Low: no special protection needed; safe for outdoor activities.',
    'uv-adv2': 'Moderate: SPF30+ sunscreen and sunglasses recommended.',
    'uv-adv3': 'High: SPF30+ sunscreen, sunglasses and a hat; seek shade 10:00-16:00.',
    'uv-adv4': 'Very High: limit outdoor exposure; high-SPF sunscreen and physical shading required.',
    'uv-adv5': 'Extreme: avoid outdoor activity 10:00-16:00; full protection is essential.',
    'aqi-primary': 'Primary',
    'aqi-modal-title': 'Air Quality Details',
    'aqi-modal-conc': 'Pollutant Concentrations',
    'aqi-modal-bars': 'Pollutant Levels',
    'aqi-modal-limit': '24h limit',
    'aqi-modal-note': 'Concentrations are CAMS model estimates (instantaneous). Chinese mode computes AQI per HJ 633-2012; English mode shows US AQI.',
    'aqi-modal-close': 'Close',
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
  const key = `${CACHE_PREFIX}weather4:${roundCoord(lat)},${roundCoord(lon)}`;
  const cached = cacheGet(key, FORECAST_TTL);
  if (cached) return cached;
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7',
    past_hours: '24',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index',
    hourly: 'surface_pressure,uv_index',
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

  // 点击弹详情模态（事件只绑一次，数据每次刷新）
  const elCard = document.getElementById('d-aqi-card');
  if (elCard && !elCard._aqiBound) {
    elCard._aqiBound = true;
    elCard.style.cursor = 'pointer';
    elCard.addEventListener('click', () => openAqiModal());
  }
}

/* ---------- 空气质量详情模态 ---------- */
/* 污染物单位 + 国标日均限值（用于对照展示，µg/m³；CO 为 mg/m³） */
const POLLUTANT_META = {
  pm2_5:            { unit: 'µg/m³', limit: 35 },
  pm10:             { unit: 'µg/m³', limit: 50 },
  ozone:            { unit: 'µg/m³', limit: 100 },   // 8h 均值口径
  nitrogen_dioxide: { unit: 'µg/m³', limit: 80 },
  sulphur_dioxide:  { unit: 'µg/m³', limit: 150 },
  carbon_monoxide:  { unit: 'mg/m³', limit: 4, div: 1000 },
};

function openAqiModal() {
  const cur = lastCtx.aqi && lastCtx.aqi.current;
  if (!cur) return;
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeModal);

  const zh = LANG === 'zh';
  // 当前 AQI + 等级 + 首要污染物（中文口径）
  const cn = calcChinaAqi(cur);
  const value = zh ? cn.aqi : (cur.us_aqi != null ? cur.us_aqi : null);
  const sc = aqiScale(value);
  const primary = zh && cn.aqi != null && cn.aqi > 50
    ? `${t('aqi-primary')} ${cn.primary.map(k => POLLUTANT_NAMES[k][zh ? 'zh' : 'en']).join('、')}` : '';

  // 六污染物浓度格
  const keys = Object.keys(POLLUTANT_META);
  const concs = keys.map(k => {
    const meta = POLLUTANT_META[k];
    let v = cur[k];
    if (v == null) return `<div><i>${POLLUTANT_NAMES[k][zh ? 'zh' : 'en']}</i><b>--</b></div>`;
    if (meta.div) v = v / meta.div;
    const over = v > meta.limit;
    return `<div class="${over ? 'aq-over' : ''}"><i>${POLLUTANT_NAMES[k][zh ? 'zh' : 'en']}</i>` +
      `<b>${v < 10 ? v.toFixed(1) : Math.round(v)}</b><u>${meta.unit}</u></div>`;
  }).join('');

  // 逐污染物分档条：浓度 -> IAQI -> 档位色 + 比例条
  const bars = keys.map(k => {
    const meta = POLLUTANT_META[k];
    let v = cur[k];
    if (v == null) return '';
    if (meta.div) v = v / meta.div;
    const ia = iaqi(HJ633[k].bps, v);
    if (ia == null) return '';
    const bs = aqiScale(Math.min(ia, 400));
    const pct = Math.min(Math.max(ia / 300, 0), 1) * 100;
    return `<div class="aq-row">` +
      `<span class="aq-name">${POLLUTANT_NAMES[k][zh ? 'zh' : 'en']}</span>` +
      `<div class="aq-track"><div class="aq-fill ${bs.cls}" style="width:${pct.toFixed(0)}%"></div></div>` +
      `<span class="aq-iaqi">${Math.round(ia)}</span>` +
      `<span class="aq-grade ${bs.cls}">${bs.text}</span></div>`;
  }).join('');

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.addEventListener('click', e => e.stopPropagation());
  box.innerHTML =
    `<button class="modal-close" aria-label="${t('aqi-modal-close')}">✕</button>` +
    `<h3 class="modal-title">${t('aqi-modal-title')}</h3>` +
    `<div class="pm-now">` +
    `<span class="pm-cur">${value != null ? Math.round(value) : '--'}<small> AQI</small></span>` +
    `<span class="dlevel ${sc ? sc.cls : ''}">${sc ? sc.text : ''}</span>` +
    `</div>` +
    (primary ? `<p class="pm-trend">${primary}</p>` : '') +
    `<h4 class="pm-sub">${t('aqi-modal-conc')}（${t('aqi-modal-limit')}）</h4>` +
    `<div class="aq-concs">${concs}</div>` +
    `<h4 class="pm-sub">${t('aqi-modal-bars')}</h4>` +
    `<div class="aq-rows">${bars}</div>` +
    `<p class="pm-note">${t('aqi-modal-note')}</p>`;
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', closeModalOnEsc);
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

/* 农历（查表版）：2025-2027 各农历月首日（北京时区初一，即朔日）+ 月名。
   表外日期回退月龄近似（仅日名）。 */
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const LUNAR_TABLE = [
  // 2025 乙巳年（闰六月）
  ['2025-01-29', '正'], ['2025-02-28', '二'], ['2025-03-29', '三'], ['2025-04-28', '四'],
  ['2025-05-27', '五'], ['2025-06-25', '六'], ['2025-07-25', '闰六'], ['2025-08-23', '七'],
  ['2025-09-22', '八'], ['2025-10-21', '九'], ['2025-11-20', '十'], ['2025-12-20', '冬'],
  // 2026 丙午年
  ['2026-01-19', '腊'], ['2026-02-17', '正'], ['2026-03-19', '二'], ['2026-04-17', '三'],
  ['2026-05-17', '四'], ['2026-06-15', '五'], ['2026-07-14', '六'], ['2026-08-13', '七'],
  ['2026-09-11', '八'], ['2026-10-10', '九'], ['2026-11-09', '十'], ['2026-12-09', '冬'],
  // 2027 丁未年
  ['2027-01-08', '腊'], ['2027-02-06', '正'], ['2027-03-08', '二'], ['2027-04-07', '三'],
  ['2027-05-06', '四'], ['2027-06-05', '五'], ['2027-07-04', '六'], ['2027-08-02', '七'],
  ['2027-09-01', '八'], ['2027-10-01', '九'], ['2027-10-30', '十'], ['2027-11-29', '冬'],
  ['2027-12-29', '腊'], ['2028-01-28', '正'],
];
function lunarLabel(dateMs) {
  let hit = null;
  for (const [d, name] of LUNAR_TABLE) {
    const ms = Date.parse(d + 'T00:00:00+08:00');   // 北京时区当日零点
    if (ms <= dateMs) hit = { ms, name };
    else break;
  }
  if (!hit) return LUNAR_DAYS[Math.round(moonAge(dateMs)) % 30] || '';   // 表外：仅日名
  const day = Math.floor((dateMs - hit.ms) / 86400000) + 1;
  return hit.name + '月' + (LUNAR_DAYS[day - 1] || LUNAR_DAYS[29]);
}

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

/* ---------- 气压 24h 趋势线（骤降=风雨前兆，回升=放晴） ---------- */
/* Catmull-Rom 样条 -> 三次贝塞尔路径（过点平滑，无折角） */
function smoothPath(P) {
  if (P.length < 3) return P.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  let d = `M ${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
function renderPressureTrend(c) {
  const el = document.getElementById('d-pressure-trend');
  if (!el) return;
  // hourly 与 daily 同级（data.hourly），从最近一次天气数据里取
  const h = (lastCtx.weather && lastCtx.weather.hourly) || {};
  const times = h.time || [];
  const series = h.surface_pressure || [];
  // 过去 24h：hourly 数组 = 过去+未来混排，按时间定位"<= 当前的最后整点"，往前取 24 个
  // （time 均为同格式本地 ISO 串，字典序即时间序，避免 Date.parse 时区错位）
  const nowStr = c.time || '';
  let last = -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] && times[i] <= nowStr) last = i; else if (last >= 0) break;
  }
  let pts = last >= 0 ? series.slice(Math.max(0, last - 23), last + 1).filter(v => v != null) : [];
  if (pts.length === 0) { el.innerHTML = ''; return; }
  // 当前观测值作为最新点补入（比整点更接近"现在"）
  if (c.surface_pressure != null) pts = [...pts, c.surface_pressure];
  // 未来 24h 预报：当前整点之后取 24 个有效点（虚线段）
  let fut = [];
  for (let i = last + 1; i < series.length && fut.length < 24; i++) {
    if (series[i] != null) fut.push(series[i]);
  }

  el.innerHTML = pressureChartSvg(pts, fut, { W: 210, H: 84, detailed: false });

  // ---- 副行等级 + 点击弹详情模态 ----
  const n = pts.length;
  const cur = c.surface_pressure != null ? c.surface_pressure : pts[n - 1];
  const grade = DETAIL_SCALES.pressure(cur);
  const lv = document.getElementById('d-pressure-level');
  if (lv) {
    lv.className = `dlevel ${grade ? grade.cls : ''}`;
    lv.textContent = grade ? grade.text : '';
  }
  const p3h = n >= 4 ? cur - pts[n - 4] : null;   // 24 点每小时 1 个，3h 前 = 往回数 3 个间隔

  // 供模态使用的明细：过去 24h 每小时（时间 + 值），时间为显示用 HH:MM
  const histStart = Math.max(0, last - 23);
  const histTimes = times.slice(histStart, last + 1);
  const modalData = {
    cur, grade, p3h, pts, fut,
    hours: histTimes.map((iso, i) => ({
      time: fmtTime(iso),
      v: series[histStart + i],
    })).filter(hh => hh.v != null),
    hoursIso: histTimes.slice().filter((_, i) => series[histStart + i] != null),
    // 指针交互的时间标签（历史点：HH:MM + 是否昨天；未来点直接由下标算 +Xh）
    ptLabels: histTimes.map(iso => ({
      time: fmtTime(iso),
      yesterday: iso.slice(0, 10) < (c.time || '').slice(0, 10),
    })),
  };

  const elCard = document.getElementById('d-pressure-card');
  if (elCard && !elCard._trendBound) {
    elCard._trendBound = true;
    elCard.style.cursor = 'pointer';
    elCard.addEventListener('click', () => openPressureModal(elCard._modalData));
  }
  if (elCard) elCard._modalData = modalData;
}

/* 气压趋势 SVG：卡片迷你版与模态详细版共用一套几何
   opts = { W, H, detailed } —— detailed 时加水平网格+数值刻度+极值点圆标记 */
function pressureChartSvg(pts, fut, opts) {
  const { W, H, detailed } = opts;
  while (pts.length < 2) pts = [pts[0] || 0, ...(pts.length ? pts : [])];   // 单点兜底
  const padX = detailed ? 34 : 10;    // 详细版左侧留数值刻度宽度
  const padY = 10;
  const axisH = 18;                    // 底部刻度行高
  const all = [...pts, ...fut];
  let min = Math.min(...all), max = Math.max(...all);
  const padV = Math.max((max - min) * 0.18, 0.4);
  min -= padV; max += padV;
  const xs = i => padX + (W - padX - 10) * (i / (all.length - 1));
  const ys = v => padY + (H - axisH - padY) * (1 - (v - min) / (max - min));
  const P = pts.map((v, i) => ({ x: xs(i), y: ys(v) }));
  const F = fut.map((v, i) => ({ x: xs(pts.length + i), y: ys(v) }));
  const lineHist = smoothPath(P);
  const lineFut = fut.length ? smoothPath([P[P.length - 1], ...F]) : '';
  const lastP = P[P.length - 1];

  let grid = '';
  if (detailed) {
    // 4 条水平网格线 + 左侧数值刻度（hPa，取整）
    for (let g = 0; g <= 4; g++) {
      const v = min + (max - min) * g / 4;
      const y = ys(v);
      grid += `<line x1="${padX - 4}" y1="${y.toFixed(1)}" x2="${W - 10}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>` +
        `<text x="${padX - 7}" y="${(y + 3.5).toFixed(1)}" class="ptrend-lab" text-anchor="end">${Math.round(v)}</text>`;
    }
  }
  // 1013 标准线（范围内才画）
  const yStd = ys(1013);
  const stdLine = yStd > padY && yStd < H - axisH
    ? `<line x1="${padX}" y1="${yStd.toFixed(1)}" x2="${W - 10}" y2="${yStd.toFixed(1)}" stroke="rgba(255,255,255,.16)" stroke-width="1" stroke-dasharray="3 4"/>` +
      (detailed ? `<text x="${W - 10}" y="${(yStd - 4).toFixed(1)}" class="ptrend-lab" text-anchor="end">1013</text>` : '')
    : '';
  const area = `${lineHist} L ${lastP.x.toFixed(1)} ${H - axisH} L ${padX} ${H - axisH} Z`;

  // 数值标注（历史段极值 + 当前值）
  // 防重叠：字宽按 ~7px/字符估；极值与"现在"水平距离 < 一字宽时跳过，
  // 距离介于 1~1.5 字宽时极值标注下移到点下方错开 y 层
  const marks = [];
  const mark = (p, txt, below) => marks.push(
    `<text x="${Math.min(Math.max(p.x, padX + 14), W - 14).toFixed(1)}" y="${(p.y + (below ? 16 : -11)).toFixed(1)}" ` +
    `class="ptrend-val" text-anchor="middle">${txt}</text>`);
  let hi = 0, lo = 0;
  if (pts.length >= 2) {
    pts.forEach((v, i) => { if (v > pts[hi]) hi = i; if (v < pts[lo]) lo = i; });
    const curTxt = String(Math.round(pts[pts.length - 1]));
    const needX = txt => txt.length * 7 / 2 + 22;   // 两标注中心最小间距（半宽×2 + 间隙）
    const place = (idx, txt, allowBelow) => {
      const dx = Math.abs(P[idx].x - lastP.x);
      if (dx >= needX(txt) || dx >= needX(curTxt)) mark(P[idx], txt, false);
      else if (allowBelow && dx >= needX(txt) * 0.55) mark(P[idx], txt, true);   // 谷底可下移错层
      // 否则跳过（当前值已标）；峰顶不许下移，避免压曲线
    };
    if (hi !== lo) place(hi, pts[hi].toFixed(1), false);
    if (hi !== lo) place(lo, pts[lo].toFixed(1), true);
    mark(lastP, curTxt);
    // 未来段极值：参照点同为"现在"，防重叠逻辑复用
    if (fut.length >= 2) {
      const PF = [lastP, ...F];   // 与曲线衔接点同序
      let fhi = 0, flo = 0;
      fut.forEach((v, i) => { if (v > fut[fhi]) fhi = i; if (v < fut[flo]) flo = i; });
      const placeF = (idx, txt, allowBelow) => {
        const dx = Math.abs(PF[idx + 1].x - lastP.x);
        if (dx >= needX(txt) || dx >= needX(curTxt)) mark(PF[idx + 1], txt, false);
        else if (allowBelow && dx >= needX(txt) * 0.55) mark(PF[idx + 1], txt, true);
      };
      if (fhi !== flo) placeF(fhi, fut[fhi].toFixed(1), false);
      if (fhi !== flo) placeF(flo, fut[flo].toFixed(1), true);
    }
  }
  // 详细版：极值点加小圆标记（历史 + 未来）
  let hiDot = null, loDot = null, fhiDot = null, floDot = null;
  if (detailed && hi !== lo) { hiDot = P[hi]; loDot = P[lo]; }
  if (detailed && fut.length >= 2) {
    let fhi = 0, flo = 0;
    fut.forEach((v, i) => { if (v > fut[fhi]) fhi = i; if (v < fut[flo]) flo = i; });
    if (fhi !== flo) { fhiDot = F[fhi]; floDot = F[flo]; }
  }
  const dots = [hiDot, loDot, fhiDot, floDot].map((p, i) =>
    p ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="${i % 2 === 0 ? '#fb923c' : '#4ade80'}"/>` : ''
  ).join('');

  // 时间刻度
  const lab = (x, txt, anchor) =>
    `<text x="${x.toFixed(1)}" y="${H - 4}" class="ptrend-lab" text-anchor="${anchor}">${txt}</text>`;
  const midH = (padX + lastP.x) / 2;
  const midF = (lastP.x + W - 10) / 2;
  const timeLabs = fut.length
    ? lab(padX, '-24h', 'start') + (detailed ? lab(midH, '-12h', 'middle') : '') + lab(lastP.x, t('p-now'), 'middle') +
      (detailed ? lab(midF, '+12h', 'middle') : '') + lab(W - 10, '+24h', 'end')
    : lab(padX, '-24h', 'start') + lab(midH, '-12h', 'middle') + lab(lastP.x, t('p-now'), 'end');

  // 详细版：指针交互层（垂直参考线 + 高亮点 + 透明捕获矩形，初始隐藏）
  let interactive = '';
  if (detailed) {
    interactive =
      `<g class="pc-cursor" style="display:none">` +
      `<line x1="0" y1="${padY}" x2="0" y2="${H - axisH}" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-dasharray="2 2"/>` +
      `<circle cx="0" cy="0" r="3.4" fill="#fff" stroke="#a78bfa" stroke-width="1.6"/>` +
      `</g>` +
      `<rect class="pc-hit" x="${padX - 6}" y="0" width="${W - padX - 4}" height="${H - axisH + 2}" fill="transparent" style="cursor:crosshair"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="ptrend-svg${detailed ? ' ptrend-detail' : ''}" aria-hidden="true">` +
    `<defs><linearGradient id="pGrad${detailed ? 'D' : ''}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="rgba(167,139,250,.30)"/><stop offset="1" stop-color="rgba(167,139,250,0)"/></linearGradient></defs>` +
    grid + stdLine +
    `<path d="${area}" fill="url(#pGrad${detailed ? 'D' : ''})"/>` +
    `<path d="${lineHist}" class="pline" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    (lineFut ? `<path d="${lineFut}" fill="none" stroke="#a78bfa" stroke-width="1.6" stroke-dasharray="4 3" opacity=".65" stroke-linejoin="round" stroke-linecap="round"/>` : '') +
    marks.join('') + dots +
    `<circle cx="${lastP.x.toFixed(1)}" cy="${lastP.y.toFixed(1)}" r="6" fill="rgba(167,139,250,.22)"/>` +
    `<circle cx="${lastP.x.toFixed(1)}" cy="${lastP.y.toFixed(1)}" r="2.8" fill="#a78bfa" stroke="#fff" stroke-width="1.2"/>` +
    timeLabs + interactive + `</svg>`;
}

/* ---------- 气压详情模态 ---------- */
function openPressureModal(data) {
  if (!data) return;
  closeModal();   // 防重复
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeModal);

  const values = data.hours.map(h => h.v);
  const mx = values.length ? Math.max(...values) : null;
  const mn = values.length ? Math.min(...values) : null;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const f1 = v => v == null ? '--' : v.toFixed(1);

  const grade = data.grade;
  const dp = data.p3h != null ? Math.round(data.p3h * 10) / 10 : null;
  const dir = dp == null ? '' : dp > 0.5 ? '↑' : dp < -0.5 ? '↓' : '→';
  const dirText = dp == null ? '' : dp > 0.5 ? t('p-rising') : dp < -0.5 ? t('p-falling') : t('p-steady');

  // 指针信息行（图上方）：默认显示当前值，指向曲线时显示该时刻
  const all = [...(data.pts || []), ...(data.fut || [])];
  const nHist = (data.pts || []).length;
  const infoId = 'pm-info';
  const infoOf = i => {
    if (i == null || !all.length) return `${Math.round(data.cur)} hPa · ${t('p-now')}`;
    const v = all[i];
    let lab;
    if (i < nHist) {
      const pl = data.ptLabels[i];
      lab = `${pl.yesterday ? t('yesterday') + ' ' : ''}${pl.time}`;
    } else {
      lab = `+${i - nHist + 1}h`;
    }
    return `${v.toFixed(1)} hPa · ${lab}${i >= nHist ? ' · ' + t('p-forecast-tag') : ''}`;
  };

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.addEventListener('click', e => e.stopPropagation());
  box.innerHTML =
    `<button class="modal-close" aria-label="${t('p-modal-close')}">✕</button>` +
    `<h3 class="modal-title">${t('p-modal-title')}</h3>` +
    `<div class="pm-now">` +
    `<span class="pm-cur">${Math.round(data.cur)}<small> hPa</small></span>` +
    `<span class="dlevel ${grade ? grade.cls : ''}">${grade ? grade.text : ''}</span>` +
    `</div>` +
    (dp != null ? `<p class="pm-trend">${dir} ${dirText} ${dp > 0 ? '+' : ''}${dp} hPa${t('p-trend-note')}</p>` : '') +
    (data.pts && data.pts.length >= 2 ? pressureChartSvg(data.pts, data.fut || [], { W: 300, H: 150, detailed: true }) : '') +
    `<p class="pm-info" id="${infoId}">${infoOf(null)}</p>` +
    `<h4 class="pm-sub">${t('p-modal-24h')}</h4>` +
    `<div class="pm-stats">` +
    `<div><i>${t('p-modal-max')}</i><b>${f1(mx)}</b></div>` +
    `<div><i>${t('p-modal-min')}</i><b>${f1(mn)}</b></div>` +
    `<div><i>${t('p-modal-avg')}</i><b>${f1(avg)}</b></div>` +
    `<div><i>${t('p-modal-range')}</i><b>${mx != null && mn != null ? (mx - mn).toFixed(1) : '--'}</b></div>` +
    `</div>` +
    `<p class="pm-note">${t('p-modal-note')}</p>`;
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', closeModalOnEsc);

  // ---- 曲线指针交互：移动/滑动时信息行 + 参考线实时跟随 ----
  const svg = box.querySelector('.ptrend-detail');
  const cursor = svg && svg.querySelector('.pc-cursor');
  const cursorLine = cursor && cursor.querySelector('line');
  const cursorDot = cursor && cursor.querySelector('circle');
  const infoEl = box.querySelector('#' + infoId);
  const W = 300, padX = 34;
  const onPoint = evt => {
    if (!svg || !cursor || !infoEl || !all.length) return;
    const r = svg.getBoundingClientRect();
    const vx = (evt.clientX != null ? evt.clientX : (evt.touches && evt.touches[0].clientX)) - r.left;
    const unitX = vx / r.width * W;                 // 换算到 viewBox 坐标
    const ratio = (unitX - padX) / (W - padX - 10);
    const i = Math.round(Math.max(0, Math.min(1, ratio)) * (all.length - 1));
    // 该点的屏幕坐标（重新用同一几何计算）
    const x = padX + (W - padX - 10) * (i / (all.length - 1));
    let min = Math.min(...all), max = Math.max(...all);
    const padV = Math.max((max - min) * 0.18, 0.4);
    min -= padV; max += padV;
    const y = 10 + (150 - 18 - 10) * (1 - (all[i] - min) / (max - min));
    cursor.style.display = '';
    cursorLine.setAttribute('x1', x.toFixed(1)); cursorLine.setAttribute('x2', x.toFixed(1));
    cursorDot.setAttribute('cx', x.toFixed(1)); cursorDot.setAttribute('cy', y.toFixed(1));
    infoEl.textContent = infoOf(i);
    evt.preventDefault();
  };
  if (svg) {
    svg.addEventListener('mousemove', onPoint);
    svg.addEventListener('touchmove', onPoint, { passive: false });
    svg.addEventListener('mouseleave', () => {
      cursor.style.display = 'none';
      infoEl.textContent = infoOf(null);
    });
  }
}

/* ---------- 紫外线详情模态 ---------- */
/* UV 五级色带（绿/黄/橙/红/紫，与站内等级色一致） */
const UV_BANDS = [
  { to: 3,  cls: 'lv-low' }, { to: 6, cls: 'lv-mid' }, { to: 8, cls: 'lv-high' },
  { to: 11, cls: 'lv-severe' }, { to: 14, cls: 'lv-extreme' },
];

function openUvModal() {
  const w = lastCtx.weather;
  if (!w) return;
  const c = w.current, h = w.hourly || {};
  const uvHourly = h.uv_index || [];
  const times = h.time || [];
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeModal);

  // ---- 今日曲线数据：今天 00:00 起的 uv_index（按城市当地日期过滤）----
  const todayPrefix = (c.time || '').slice(0, 10);
  let day = [], dayTimes = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] && times[i].slice(0, 10) === todayPrefix) { day.push(uvHourly[i]); dayTimes.push(times[i]); }
  }
  const f1 = v => v == null ? '--' : v.toFixed(1);

  // ---- 交互曲线（色带背景 + 白线，复用气压的交互几何思路）----
  const W = 300, H = 150, padX = 10, padY = 10, axisH = 18;
  const uvMax = 12;   // 纵轴固定 0-12（>11 极端区顶部截断）
  const xs = i => padX + (W - padX - 10) * (i / Math.max(day.length - 1, 1));
  const ys = v => padY + (H - axisH - padY) * (1 - Math.max(0, Math.min(v, uvMax)) / uvMax);
  const line = day.some(v => v != null)
    ? smoothPath(day.map((v, i) => ({ x: xs(i), y: ys(v == null ? 0 : v) }))) : '';
  // 色带背景（横向分段，透明度低不干扰曲线）
  const bands = UV_BANDS.map((b, i) => {
    const y0 = ys(i === 0 ? 0 : UV_BANDS[i - 1].to);
    const y1 = ys(Math.min(b.to, uvMax));
    return `<rect x="${padX}" y="${y1.toFixed(1)}" width="${W - padX - 10}" height="${Math.max(y0 - y1, 0).toFixed(1)}" ` +
      `fill="${LV_COLORS[b.cls]}" opacity=".16"/>`;
  }).join('');
  // 当前点
  let curX = null, curY = null;
  if (day.length) {
    // 当前小时索引：<= now 的最后整点
    let li = -1;
    for (let i = 0; i < dayTimes.length; i++) if (dayTimes[i] <= (c.time || '')) li = i;
    if (li >= 0 && day[li] != null) { curX = xs(li); curY = ys(day[li]); }
  }
  // 峰值标注
  let peakMark = '';
  if (day.some(v => v != null)) {
    let pi = 0; day.forEach((v, i) => { if (v != null && v > (day[pi] ?? -1)) pi = i; });
    peakMark = `<text x="${Math.min(Math.max(xs(pi), padX + 12), W - 12).toFixed(1)}" y="${(ys(day[pi]) - 6).toFixed(1)}" class="ptrend-val" text-anchor="middle">▲${day[pi].toFixed(1)}</text>`;
  }
  // 时间刻度（6/12/18 时）
  const tick = hr => {
    const idx = dayTimes.findIndex(tt => tt.slice(11, 13) === String(hr).padStart(2, '0'));
    if (idx < 0) return '';
    return `<text x="${xs(idx).toFixed(1)}" y="${H - 4}" class="ptrend-lab" text-anchor="middle">${hr}:00</text>`;
  };
  const infoId = 'uv-info';
  const svgStr = day.length ? (
    `<svg viewBox="0 0 ${W} ${H}" class="ptrend-svg ptrend-detail" aria-hidden="true">` +
    bands +
    `<path d="${line}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>` +
    peakMark +
    (curX != null ? `<circle cx="${curX.toFixed(1)}" cy="${curY.toFixed(1)}" r="6" fill="rgba(255,255,255,.25)"/>` +
      `<circle cx="${curX.toFixed(1)}" cy="${curY.toFixed(1)}" r="2.8" fill="#fff" stroke="#fbbf24" stroke-width="1.4"/>` : '') +
    `<g class="pc-cursor" style="display:none">` +
    `<line x1="0" y1="${padY}" x2="0" y2="${H - axisH}" stroke="rgba(255,255,255,.6)" stroke-width="1" stroke-dasharray="2 2"/>` +
    `<circle cx="0" cy="0" r="3.2" fill="#fff" stroke="#fbbf24" stroke-width="1.6"/></g>` +
    `<rect class="pc-hit" x="${padX - 4}" y="0" width="${W - padX - 4}" height="${H - axisH + 2}" fill="transparent" style="cursor:crosshair"/>` +
    tick(6) + tick(12) + tick(18) +
    `</svg>`) : '';

  // ---- 7 天峰值小柱图 ----
  const daily = w.daily || {};
  const uvm = daily.uv_index_max || [];
  const days = daily.time || [];
  const maxScale = 12;
  const bars = days.map((iso, i) => {
    const v = uvm[i];
    if (v == null) return '';
    const bh = Math.max(v / maxScale, 0.02) * 56;
    const sc = DETAIL_SCALES.uv(v);
    const wd = dayRelLabel(iso, i);
    return `<div class="uv-bar"><i>${wd}</i>` +
      `<div class="uv-col" style="height:${bh.toFixed(0)}px;background:${LV_COLORS[sc.cls]}"></div>` +
      `<b>${v.toFixed(0)}</b></div>`;
  }).join('');

  // 值与等级
  const curUv = c.uv_index != null ? c.uv_index : (uvm[0] != null ? uvm[0] : null);
  const sc = DETAIL_SCALES.uv(curUv);
  const advKey = curUv == null ? null : curUv < 3 ? 'uv-adv1' : curUv < 6 ? 'uv-adv2' : curUv < 8 ? 'uv-adv3' : curUv < 11 ? 'uv-adv4' : 'uv-adv5';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.addEventListener('click', e => e.stopPropagation());
  box.innerHTML =
    `<button class="modal-close" aria-label="${t('uv-modal-close')}">✕</button>` +
    `<h3 class="modal-title">${t('uv-modal-title')}</h3>` +
    `<div class="pm-now">` +
    `<span class="pm-cur">${curUv != null ? curUv.toFixed(1) : '--'}</span>` +
    `<span class="dlevel ${sc ? sc.cls : ''}">${sc ? sc.text : ''}</span>` +
    `</div>` +
    svgStr +
    `<p class="pm-info" id="${infoId}">${t('uv-modal-today')}</p>` +
    `<h4 class="pm-sub">${t('uv-modal-week')}</h4>` +
    `<div class="uv-week">${bars}</div>` +
    (advKey ? `<h4 class="pm-sub">${t('uv-modal-advice')}</h4>` +
      `<p class="pm-note">${t(advKey)}</p>` : '') +
    `<p class="pm-note" style="margin-top:8px">${t('uv-modal-note')}</p>`;
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', closeModalOnEsc);

  // ---- 指针交互（与气压详情同思路）----
  const svg = box.querySelector('.ptrend-detail');
  const cursor = svg && svg.querySelector('.pc-cursor');
  const cursorLine = cursor && cursor.querySelector('line');
  const cursorDot = cursor && cursor.querySelector('circle');
  const infoEl = box.querySelector('#' + infoId);
  const onPoint = evt => {
    if (!svg || !cursor || !infoEl || !day.length) return;
    const r = svg.getBoundingClientRect();
    const vx = (evt.clientX != null ? evt.clientX : evt.touches[0].clientX) - r.left;
    const unitX = vx / r.width * W;
    const ratio = (unitX - padX) / (W - padX - 10);
    const i = Math.round(Math.max(0, Math.min(1, ratio)) * (day.length - 1));
    if (day[i] == null) return;
    const x = xs(i), y = ys(day[i]);
    cursor.style.display = '';
    cursorLine.setAttribute('x1', x.toFixed(1)); cursorLine.setAttribute('x2', x.toFixed(1));
    cursorDot.setAttribute('cx', x.toFixed(1)); cursorDot.setAttribute('cy', y.toFixed(1));
    infoEl.textContent = `${day[i].toFixed(1)} · ${fmtTime(dayTimes[i])}`;
    evt.preventDefault();
  };
  if (svg) {
    svg.addEventListener('mousemove', onPoint);
    svg.addEventListener('touchmove', onPoint, { passive: false });
    svg.addEventListener('mouseleave', () => {
      cursor.style.display = 'none';
      infoEl.textContent = t('uv-modal-today');
    });
  }
}
/* ---------- 日出日落详情模态 ---------- */
/* ---------- 日出日落详情模态：24h 太阳高度曲线 + 曝暮光色带 ---------- */
/* NOAA 太阳高度角（°，地平线上为正）；四基准已校验：
   北京夏至正午 73.3° / 春分正午 49.9° / 日出时刻 ≈0° / 夏季午夜 -37.0° */
function solarAltitude(lat, lon, dateMs) {
  const rad = Math.PI / 180;
  const jd = dateMs / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const raDeg = (((Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad) % 360) + 360) % 360;
  const gmst = (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24;
  const lst = ((gmst + lon / 15) % 24 + 24) % 24;
  let haH = lst - raDeg / 15;
  if (haH > 12) haH -= 24; if (haH < -12) haH += 24;
  const ha = haH * 15 * rad;
  const sinAlt = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
}

/* 曙暮光分级：太阳高度区间 -> 名称/配色 */
const TWILIGHT = [
  { min: 0,   cls: 'tw-day',   icon: '☀️' },
  { min: -6,  cls: 'tw-civil', icon: '🌆' },
  { min: -12, cls: 'tw-naut',  icon: '🌆' },
  { min: -18, cls: 'tw-astro', icon: '🌌' },
  { min: -90, cls: 'tw-night', icon: '🌙' },
];
function twilightZone(alt) { return TWILIGHT.find(z => alt >= z.min) || TWILIGHT[4]; }

function openSunModal() {
  const w = lastCtx.weather;
  if (!w || !w.daily) return;
  const d = w.daily;
  const c = w.current;
  const lat = lastCtx.lat, lon = lastCtx.lon;
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeModal);

  const srIso = d.sunrise[0], ssIso = d.sunset[0];
  const srMs = Date.parse(srIso), ssMs = Date.parse(ssIso);
  const noonMs = Math.round((srMs + ssMs) / 2);
  const fmtT = ms => new Date(ms).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });

  // ---- 当地"今天"的 UTC 起点：由日出串的日期 + 城市经度近似时区推 ----
  // Open-Meteo 本地时间串无偏移，用 utc_offset（若有）或 lon/15 重建绝对时刻
  const offSec = w.utc_offset_seconds != null ? w.utc_offset_seconds : Math.round(lon / 15) * 3600;
  const dayStartLocalMs = Date.parse(srIso.slice(0, 10) + 'T00:00:00Z') - offSec;   // 当地 00:00 对应的 UTC
  const altAtLocalMin = mins => solarAltitude(lat, lon, dayStartLocalMs + mins * 60000);

  // ---- 24h 高度曲线（每 20 分钟一个点）----
  const STEP = 20, NPTS = 24 * 60 / STEP;
  const W = 300, H = 160, padX = 30, padY = 10, axisH = 20;
  const altMax = 90, altMin = -70;
  const xs = i => padX + (W - padX - 10) * (i / (NPTS - 1));
  const ys = a => padY + (H - axisH - padY) * (1 - (a - altMin) / (altMax - altMin));
  const pts = [];
  for (let i = 0; i < NPTS; i++) pts.push(altAtLocalMin(i * STEP));
  const line = smoothPath(pts.map((a, i) => ({ x: xs(i), y: ys(a) })));

  // 曙暮光色带背景（横向分层，弱透明）
  const bandRects = TWILIGHT.slice(0, 4).map((z, i) => {
    const upper = i === 0 ? altMax : TWILIGHT[i - 1].min;
    const y0 = ys(upper), y1 = ys(z.min);
    return `<rect x="${padX}" y="${y1.toFixed(1)}" width="${W - padX - 10}" height="${Math.max(y0 - y1, 0).toFixed(1)}" class="${z.cls}"/>`;
  }).join('');
  // 地平线（0°）
  const yZero = ys(0);
  // 阈值时刻标签（日出/民用/海事/天文黄昏…由曲线过阈值取时刻）
  const thresholdTimes = [-6, -12, -18].map(th => {
    // 找升/降两个过阈时刻
    const crossings = [];
    for (let i = 1; i < NPTS; i++) {
      if ((pts[i - 1] > th && pts[i] <= th) || (pts[i - 1] < th && pts[i] >= th)) {
        crossings.push(Math.round((i - 0.5) * STEP));   // 当地分钟
      }
    }
    return { th, crossings };
  });

  // 当前时刻（当地分钟）
  const nowMsAbs = c.time ? Date.parse(c.time + 'Z') - offSec + Date.parse(c.time.slice(0, 10) + 'T00:00:00Z') : null;
  // 简化：current.time 也是本地串
  const nowLocalMin = c.time ? (() => {
    const [h, m] = c.time.slice(11, 16).split(':').map(Number);
    return h * 60 + m;
  })() : null;
  const curAlt = nowLocalMin != null ? altAtLocalMin(nowLocalMin) : null;
  const curZone = curAlt != null ? twilightZone(curAlt) : null;
  const curI = nowLocalMin != null ? Math.round(nowLocalMin / STEP) : null;
  const curX = curI != null && curI <= NPTS - 1 ? xs(curI) : null;
  const curY = curAlt != null ? ys(curAlt) : null;

  // 时间刻度：0/6/12/18/24
  const ticks = [0, 6, 12, 18].map(h =>
    `<text x="${xs(h * 60 / STEP).toFixed(1)}" y="${H - 6}" class="ptrend-lab" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>` +
    `<line x1="${xs(h * 60 / STEP).toFixed(1)}" y1="${padY}" x2="${xs(h * 60 / STEP).toFixed(1)}" y2="${H - axisH}" stroke="rgba(255,255,255,.06)"/>`
  ).join('');

  const infoId = 'sun-info';
  const fmtMin = mins => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
  const infoOf = i => {
    if (i == null) return '';
    const alt = pts[i];
    const z = twilightZone(alt);
    return `${alt >= 0 ? '+' : ''}${alt.toFixed(0)}° · ${fmtMin(i * STEP)} · ${z.icon}`;
  };

  const svgStr =
    `<svg viewBox="0 0 ${W} ${H}" class="ptrend-svg ptrend-detail sun-alt-svg" aria-hidden="true">` +
    bandRects +
    `<line x1="${padX}" y1="${yZero.toFixed(1)}" x2="${W - 10}" y2="${yZero.toFixed(1)}" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="4 3"/>` +
    `<text x="${padX - 4}" y="${(yZero + 3).toFixed(1)}" class="ptrend-lab" text-anchor="end">0°</text>` +
    `<text x="${padX - 4}" y="${(ys(altMax) + 8).toFixed(1)}" class="ptrend-lab" text-anchor="end">90°</text>` +
    ticks +
    `<path d="${line}" fill="none" stroke="#fde68a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    (curX != null && curY != null && curAlt != null ?
      `<circle cx="${curX.toFixed(1)}" cy="${curY.toFixed(1)}" r="6" fill="rgba(253,230,138,.25)"/>` +
      `<circle cx="${curX.toFixed(1)}" cy="${curY.toFixed(1)}" r="2.8" fill="#fde68a" stroke="#fff" stroke-width="1.2"/>` : '') +
    `<g class="pc-cursor" style="display:none">` +
    `<line x1="0" y1="${padY}" x2="0" y2="${H - axisH}" stroke="rgba(255,255,255,.6)" stroke-width="1" stroke-dasharray="2 2"/>` +
    `<circle cx="0" cy="0" r="3.2" fill="#fff" stroke="#fbbf24" stroke-width="1.6"/></g>` +
    `<rect class="pc-hit" x="${padX - 4}" y="0" width="${W - padX - 4}" height="${H - axisH}" fill="transparent" style="cursor:crosshair"/>` +
    `</svg>`;

  // ---- 六段天光时刻表 ----
  // 日出日落(0°) + 民用(−6) 海事(−12) 天文(−18) 黎明/黄昏
  const crossTime = (th, rising) => {
    const found = thresholdTimes.find(x => x.th === th);
    if (!found) return null;
    const arr = found.crossings;
    if (!arr.length) return null;
    // rising: 升序过阈(早晨)取小; 傍晚取大
    return rising ? Math.min(...arr) : Math.max(...arr);
  };
  const zoneRows = [
    { icon: '🌅', key: 'sun-modal-sunrise', time: fmtTime(srIso) },
    { icon: '🏙️', key: 'sun-modal-civildawn', time: crossTime(-6, true) != null ? fmtMin(crossTime(-6, true)) : '--' },
    { icon: '☀️', key: 'sun-modal-noon', time: fmtT(noonMs) },
    { icon: '🌇', key: 'sun-modal-sunset', time: fmtTime(ssIso) },
    { icon: '🌆', key: 'sun-modal-civildusk', time: crossTime(-6, false) != null ? fmtMin(crossTime(-6, false)) : '--' },
    { icon: '🌌', key: 'sun-modal-astrodusk', time: crossTime(-18, false) != null ? fmtMin(crossTime(-18, false)) : '--' },
  ];

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.addEventListener('click', e => e.stopPropagation());
  box.innerHTML =
    `<button class="modal-close" aria-label="${t('sun-modal-close')}">✕</button>` +
    `<h3 class="modal-title">${t('sun-modal-title')}</h3>` +
    `<div class="pm-now">` +
    `<span class="pm-cur">${curZone ? curZone.icon + ' ' + (curAlt >= 0 ? '+' : '') + curAlt.toFixed(0) + '°' : '--'}</span>` +
    `<span class="dlevel">${curZone ? t('tw-' + curZone.cls.slice(3)) : ''}</span>` +
    `</div>` +
    svgStr +
    `<p class="pm-info" id="${infoId}">${curAlt != null ? t('sun-now') + ' ' + infoOf(curI) : ''}</p>` +
    `<h4 class="pm-sub">${t('sun-modal-segments')}</h4>` +
    `<div class="sun-seg">${zoneRows.map(r =>
      `<div class="sun-seg-row"><span>${r.icon} ${t(r.key)}</span><b>${r.time}</b></div>`).join('')}</div>` +
    `<p class="pm-note">${t('sun-modal-note')}</p>`;
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', closeModalOnEsc);

  // ---- 指针交互 ----
  const svg = box.querySelector('.sun-alt-svg');
  const cursor = svg && svg.querySelector('.pc-cursor');
  const cursorLine = cursor && cursor.querySelector('line');
  const cursorDot = cursor && cursor.querySelector('circle');
  const infoEl = box.querySelector('#' + infoId);
  const onPoint = evt => {
    if (!svg || !cursor || !infoEl) return;
    const r = svg.getBoundingClientRect();
    const vx = (evt.clientX != null ? evt.clientX : evt.touches[0].clientX) - r.left;
    const unitX = vx / r.width * W;
    const ratio = (unitX - padX) / (W - padX - 10);
    const i = Math.round(Math.max(0, Math.min(1, ratio)) * (NPTS - 1));
    const x = xs(i), y = ys(pts[i]);
    cursor.style.display = '';
    cursorLine.setAttribute('x1', x.toFixed(1)); cursorLine.setAttribute('x2', x.toFixed(1));
    cursorDot.setAttribute('cx', x.toFixed(1)); cursorDot.setAttribute('cy', y.toFixed(1));
    infoEl.textContent = infoOf(i);
    evt.preventDefault();
  };
  if (svg) {
    svg.addEventListener('mousemove', onPoint);
    svg.addEventListener('touchmove', onPoint, { passive: false });
    svg.addEventListener('mouseleave', () => {
      cursor.style.display = 'none';
      infoEl.textContent = curAlt != null ? t('sun-now') + ' ' + infoOf(curI) : '';
    });
  }
}

function closeModalOnEsc(e) { if (e.key === 'Escape') closeModal(); }
function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  document.removeEventListener('keydown', closeModalOnEsc);
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

  // 点击弹详情模态（事件只绑一次，时间每次刷新）
  const elCard = document.getElementById('d-moon-card');
  if (elCard && !elCard._moonBound) {
    elCard._moonBound = true;
    elCard.style.cursor = 'pointer';
    elCard.addEventListener('click', () => openMoonModal(Date.parse(lastCtx.weather.current.time)));
  }
}

/* ---------- 月相详情模态 ---------- */
/* 下一个主要相位（新月/上弦/满月/下弦）的时刻：在朔望周期内找下一个 0/.25/.5/.75 相位点 */
function nextPhaseDate(nowMs, target) {
  const age = moonAge(nowMs);
  const cur = age / MOON.synodic;
  let delta = target - cur;
  if (delta <= 0) delta += 1;   // 已过则推到下个周期
  return nowMs + delta * MOON.synodic * 86400000;
}

function openMoonModal(nowMs) {
  if (nowMs == null || Number.isNaN(nowMs)) return;
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeModal);

  const age = moonAge(nowMs);
  const phase = age / MOON.synodic;
  const idx = Math.round(phase * 8) % 8;
  const mp = MOON_PHASES[idx];
  const pct = Math.round(moonIllum(age) * 100);
  const waxing = phase < 0.5;

  // 未来四个相位节点：四个相位各自找下一个时刻，按时间排序
  const order = [0.25, 0.5, 0.75, 0];   // 上弦/满月/下弦/新月
  const names = LANG === 'zh'
    ? ['上弦月', '满月', '下弦月', '新月']
    : ['First Quarter', 'Full Moon', 'Last Quarter', 'New Moon'];
  const upcoming = order
    .map((tp, i) => ({ name: names[i], ms: nextPhaseDate(nowMs, tp) }))
    .sort((a, b) => a.ms - b.ms);
  const nextFull = upcoming.find(u => u.name === (LANG === 'zh' ? '满月' : 'Full Moon'));
  const nextNew = upcoming.find(u => u.name === (LANG === 'zh' ? '新月' : 'New Moon'));

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.addEventListener('click', e => e.stopPropagation());
  box.innerHTML =
    `<button class="modal-close" aria-label="${t('moon-modal-close')}">✕</button>` +
    `<h3 class="modal-title">${t('moon-modal-title')}</h3>` +
    `<div class="pm-now">` +
    `<span class="pm-cur">${LANG === 'zh' ? mp.zh : mp.en}</span>` +
    `<span class="dlevel">${t('moon-lit')} ${pct}% · ${waxing ? t('moon-modal-waxing') : t('moon-modal-waning')}</span>` +
    `</div>` +
    `<div class="moon-big">${moonSvg(56, phase)}</div>` +
    `<h4 class="pm-sub">${t('moon-modal-age')}</h4>` +
    `<div class="pm-stats">` +
    `<div><i>${t('moon-modal-age')} (${t('moon-modal-days')})</i><b>${age.toFixed(1)}</b></div>` +
    `<div><i>${t('moon-modal-cycle')}</i><b>${age.toFixed(0)}/${MOON.synodic.toFixed(1)}</b></div>` +
    `<div><i>${t('moon-lit')}</i><b>${pct}%</b></div>` +
    `<div><i>${t('moon-modal-next-full')}</i><b>${((nextFull.ms - nowMs) / 86400000).toFixed(1)}</b></div>` +
    `</div>` +
    `<h4 class="pm-sub">${t('moon-modal-upcoming')}</h4>` +
    `<div class="moon-next">${upcoming.map(u => {
      const greg = new Date(u.ms).toLocaleString(localeTag(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const lunar = LANG === 'zh' && lunarLabel(u.ms) ? ` <i class="moon-next-lunar">${lunarLabel(u.ms)}</i>` : '';
      return `<div class="moon-next-row"><span>${u.name}</span><b>${greg}${lunar}</b></div>`;
    }).join('')}</div>` +
    `<p class="pm-note">${t('moon-modal-note')}</p>`;
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', closeModalOnEsc);
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
  renderPressureTrend(c);
  setDetail('d-uv', uv != null ? uv.toFixed(1) : '--', DETAIL_SCALES.uv(uv));
  // 副行补当前实时值（卡片主值是今日峰值，current 里另有实时 uv_index）
  {
    const curUv = c.uv_index;
    if (curUv != null && uv != null && Math.abs(curUv - uv) >= 0.05) {
      const lvEl = document.getElementById('d-uv-level');
      if (lvEl) lvEl.textContent = `${DETAIL_SCALES.uv(uv).text} · ${t('uv-now')} ${curUv.toFixed(1)}`;
    }
  }
  // 点击弹详情模态
  {
    const elCard = document.getElementById('d-uv-card');
    if (elCard && !elCard._uvBound) {
      elCard._uvBound = true;
      elCard.style.cursor = 'pointer';
      elCard.addEventListener('click', () => openUvModal());
    }
  }
  // 日出/日落（合并卡）：时间 + 昼长 + 太阳轨迹弧
  setText('d-sunrise', fmtTime(d.sunrise[0]));
  setText('d-sunset', fmtTime(d.sunset[0]));
  setText('d-daylen', `${t('daylen')} ${dayLength(d.sunrise[0], d.sunset[0])}`);
  renderSunArc(d.sunrise[0], d.sunset[0], c.time);
  // 点击弹日出日落详情模态
  {
    const elCard = document.getElementById('d-sun-card');
    if (elCard && !elCard._sunBound) {
      elCard._sunBound = true;
      elCard.style.cursor = 'pointer';
      elCard.addEventListener('click', () => openSunModal());
    }
  }
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
