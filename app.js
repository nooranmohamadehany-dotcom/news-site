/* ====== SETTINGS ====== */
function seasonName(back) {                    // Aug-Dec 2026 -> "2026-2027", Jan-Jul 2027 -> "2026-2027"
  const d = new Date(), y = (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1) - back;
  return `${y}-${y + 1}`;
}
const CFG = {
  NEWS_KEY: 'pub_15195a2a769d860bb1675300eb53ffeedb5e4',   // NewsData.io key (https://newsdata.io)
  COUNTRY: 'eg',                               // Egyptian news only
  LANG: 'ar',                                  // language of the NEWS: 'ar' = Arabic, 'en' = English
  UI: 'en',                                    // language of the site labels/menu: 'en' or 'ar'
  CITY: { name: 'Asyut', ar: 'أسيوط', lat: 27.18, lon: 31.18 },
  SEASON: seasonName(0)                        // current football season, calculated automatically
};
const LEAGUES = { 4328: 'Premier League', 4335: 'La Liga', 4332: 'Serie A', 4331: 'Bundesliga', 4334: 'Ligue 1' };
const SPORTS_DB = 'https://www.thesportsdb.com/api/v1/json/3';

/* ====== HELPERS ====== */
const L = (en, ar) => CFG.UI === 'ar' ? ar : en;     // pick English or Arabic text
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Date(d).toLocaleDateString(L('en-GB', 'ar-EG'), { day: 'numeric', month: 'short', year: 'numeric' });

async function getJSON(url, cache = false) {            // cache = save API quota during the session
  if (cache && sessionStorage[url]) return JSON.parse(sessionStorage[url]);
  const r = await fetch(url);
  if (!r.ok) {
    let why = ''; try { const j = await r.json(); why = ' - ' + [].concat((j.results && j.results.message) || j.errors || j.error || j.message || '').join(' ') } catch (_) {}
    throw new Error('Error ' + r.status + why);
  }
  const data = await r.json();
  if (cache) sessionStorage[url] = JSON.stringify(data);
  return data;
}
const msg = (el, t) => el.innerHTML = `<p class="muted">${esc(t)}</p>`;

/* ====== SHARED LAYOUT (header, footer) ====== */
const PAGES = [['index.html', L('Home', 'الرئيسية'), 'home'], ['convert.html', L('Convert', 'تحويل العملات'), 'convert'],
  ['standings.html', L('Standings', 'الترتيب'), 'standings'], ['fixture.html', L('Fixture', 'المباريات'), 'fixture'],
  ['states.html', L('Analysis', 'التحليل'), 'analysis']];
const TITLES = { Sports: 'الرياضة', Business: 'الأعمال', Health: 'الصحة', Currencies: 'العملات', Weather: 'الطقس' };
function layout() {
  const cur = document.body.dataset.page;
  $('#header').innerHTML = `<div class="bar"><a class="logo" href="index.html"><i>DP</i>Daily Pulse</a>
    <nav>${PAGES.map(p => `<a href="${p[0]}" class="${p[2] === cur ? 'on' : ''}">${p[1]}</a>`).join('')}</nav></div>`;
  $('#footer').textContent = 'Daily Pulse · News by GNews · Weather by Open-Meteo · Rates by ExchangeRate-API · Football by TheSportsDB';
}

/* ====== NEWS (NewsData.io API) ====== */
const enc = encodeURIComponent;
const CATEGORIES = [   // title, NewsData query params, how many cards
  ['Sports', 'category=sports', 6],
  ['Business', 'category=business', 3],
  ['Health', 'category=health', 3],
  ['Currencies', 'q=' + enc(CFG.LANG === 'ar' ? 'الدولار OR الجنيه OR "سعر الصرف"' : 'dollar OR pound OR "exchange rate"'), 3],
  ['Weather', 'q=' + enc(CFG.LANG === 'ar' ? 'الطقس OR الأرصاد OR "حالة الطقس"' : 'weather OR forecast'), 3]
];
const newsURL = params => `https://newsdata.io/api/1/latest?apikey=${CFG.NEWS_KEY}&country=${CFG.COUNTRY}&language=${CFG.LANG}&${params}`;
async function loadNews(title, params, max) {
  const d = await getJSON(newsURL(params), true);                  // country=eg => Egyptian sources only
  return (d.results || []).slice(0, max).map(i => ({              // convert to the shape the cards use
    title: i.title, url: i.link, image: i.image_url || '',
    description: i.description || '',
    content: /ONLY AVAILABLE/i.test(i.content || '') ? '' : (i.content || ''),
    publishedAt: i.pubDate.replace(' ', 'T') + 'Z',
    source: { name: i.source_name || i.source_id || '' }
  }));
}
function card(a) {
  return `<div class="card" data-id="${a._i}">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
    <div><small>${fmtDate(a.publishedAt)} · ${esc(a.source.name)}</small><h3 dir="auto">${esc(a.title)}</h3></div></div>`;
}
async function homePage() {
  const box = $('#news'); box.innerHTML = '';
  const store = {};
  for (const [title, q, max] of CATEGORIES) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="sec-title"><h2>${L(title, TITLES[title])}</h2></div><div class="grid"><p class="muted">Loading…</p></div>`;
    box.append(sec);
    const grid = sec.querySelector('.grid');
    try {
      const articles = await loadNews(title, q, max);
      articles.forEach((a, i) => { a._i = title + i; store[a._i] = a; });
      grid.innerHTML = articles.map(card).join('') || '<p class="muted">No articles found.</p>';
    } catch (e) { console.error(e); msg(grid, 'Could not load news (' + e.message + ')'); }
  }
  box.addEventListener('click', e => {                        // open article page
    const c = e.target.closest('.card'); if (!c) return;
    sessionStorage.article = JSON.stringify(store[c.dataset.id]);
    location.href = 'details.html';
  });
}
function articlePage() {
  const a = sessionStorage.article && JSON.parse(sessionStorage.article), box = $('#article');
  if (!a) return box.innerHTML = '<p>No article selected. <a href="index.html">Back to home</a></p>';
  document.title = a.title;
  box.innerHTML = `<small class="muted">${fmtDate(a.publishedAt)} · ${esc(a.source.name)}</small><h1 dir="auto">${esc(a.title)}</h1>
    ${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}<p dir="auto">${esc(a.description)}</p><p class="muted" dir="auto">${esc(a.content)}</p>
    <a class="btn" href="${esc(a.url)}" target="_blank" rel="noopener">${L('Read full story', 'اقرأ الخبر كاملاً')}</a>`;
}

/* ====== SIDEBAR: weather + rates + results ====== */
const WMO = c => c === 0 ? '☀️' : c < 4 ? '⛅' : c < 50 ? '🌫️' : c < 70 ? '🌧️' : c < 80 ? '❄️' : c < 95 ? '🌦️' : '⛈️';
async function sidebar() {
  const s = $('#side'); if (!s) return;
  s.innerHTML = `<div class="panel weather" id="w">…</div><div class="panel" id="r"><h4>${L('EGP rates', 'أسعار العملات')}</h4>…</div><div class="panel" id="l"><h4>${L('Latest results', 'آخر النتائج')}</h4>…</div>`;
  getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${CFG.CITY.lat}&longitude=${CFG.CITY.lon}&current=temperature_2m,weather_code`)
    .then(d => $('#w').innerHTML = `<div style="font-size:2rem">${WMO(d.current.weather_code)}</div><b>${Math.round(d.current.temperature_2m)}°C</b>${L(CFG.CITY.name, CFG.CITY.ar)}`)
    .catch(() => msg($('#w'), 'Weather unavailable'));
  getJSON('https://open.er-api.com/v6/latest/EGP')
    .then(d => $('#r').innerHTML = `<h4>${L('EGP rates', 'أسعار العملات')}</h4>` + ['USD', 'EUR', 'SAR'].map(c =>
      `<div class="rate"><span>${c}</span><b>${(1 / d.rates[c]).toFixed(2)}</b></div>`).join(''))
    .catch(() => msg($('#r'), 'Rates unavailable'));
  getJSON(`${SPORTS_DB}/eventspastleague.php?id=4328`, true)
    .then(d => $('#l').innerHTML = `<h4>${L('Latest results', 'آخر النتائج')}</h4>` + (d.events || []).slice(-5).reverse().map(e =>
      `<div class="score"><span>${esc(e.strHomeTeam)}</span><b>${e.intHomeScore}:${e.intAwayScore}</b><span>${esc(e.strAwayTeam)}</span></div>`).join(''))
    .catch(() => msg($('#l'), 'Results unavailable'));
}

/* ====== CONVERTER ====== */
async function convertPage() {
  const from = $('#from'), to = $('#to'), amt = $('#amount');
  const d = await getJSON('https://open.er-api.com/v6/latest/USD');
  const opts = Object.keys(d.rates).map(c => `<option>${c}</option>`).join('');
  from.innerHTML = to.innerHTML = opts; from.value = 'USD'; to.value = 'EGP';
  async function run() {
    const r = await getJSON(`https://open.er-api.com/v6/latest/${from.value}`);
    const rate = r.rates[to.value];
    $('#result').textContent = `${(amt.value * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to.value}`;
    $('#rate').textContent = `1 ${from.value} = ${rate.toFixed(4)} ${to.value} · updated ${fmtDate(r.time_last_update_utc)}`;
  }
  [from, to, amt].forEach(el => el.addEventListener('input', run));
  $('#swap').onclick = () => { [from.value, to.value] = [to.value, from.value]; run(); };
  run();
}

/* ====== FOOTBALL PAGES ====== */
function leagueSelect(cb) {
  const sel = document.createElement('select');
  sel.innerHTML = Object.entries(LEAGUES).map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
  sel.onchange = () => cb(sel.value);
  $('#league').append(sel); cb(sel.value);
}
const getTable = async id => {                 // if the new season has no table yet, use the previous one
  for (const season of [CFG.SEASON, seasonName(1)]) {
    const t = (await getJSON(`${SPORTS_DB}/lookuptable.php?l=${id}&s=${season}`, true)).table;
    if (t && t.length) return t;
  }
  return [];
};

function standingsPage() {
  leagueSelect(async id => {
    const el = $('#table'); msg(el, 'Loading…');
    const t = await getTable(id).catch(() => null);
    if (!t || !t.length) return msg(el, 'No table available for this league/season.');
    el.innerHTML = `<table><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
      ${t.map(r => `<tr><td>${r.intRank}</td><td><img src="${esc(r.strBadge)}/tiny" alt="">${esc(r.strTeam)}</td><td>${r.intPlayed}</td><td>${r.intWin}</td>
      <td>${r.intDraw}</td><td>${r.intLoss}</td><td>${r.intGoalsFor}</td><td>${r.intGoalsAgainst}</td><td>${r.intGoalDifference}</td><td><b>${r.intPoints}</b></td></tr>`).join('')}</table>`;
  });
}
function fixturePage() {
  let tab = 'next', id;
  const load = async () => {
    const el = $('#list'); msg(el, 'Loading…');
    const url = `${SPORTS_DB}/events${tab === 'next' ? 'next' : 'past'}league.php?id=${id}`;
    const ev = (await getJSON(url, true).catch(() => ({}))).events || [];
    el.innerHTML = ev.map(e => `<div class="fx"><span class="muted">${fmtDate(e.dateEvent)}<br>${(e.strTime || '').slice(0, 5)}</span><span>${esc(e.strHomeTeam)}</span>
      <strong>${e.intHomeScore ?? '-'} : ${e.intAwayScore ?? '-'}</strong><span>${esc(e.strAwayTeam)}</span></div>`).join('') || '<p class="muted">No matches found.</p>';
  };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on'); tab = b.dataset.t; load();
  });
  leagueSelect(v => { id = v; load(); });
}
function analysisPage() {
  leagueSelect(async id => {
    const t = await getTable(id).catch(() => []), el = $('#bars');
    if (!t.length) { $('#stats').innerHTML = ''; return msg(el, 'No data available.'); }
    const n = k => t.map(r => +r[k]), best = (k, dir) => t.reduce((a, b) => (dir * (+b[k] - +a[k]) > 0 ? b : a));
    const atk = best('intGoalsFor', 1), def = best('intGoalsAgainst', -1), win = best('intWin', 1);
    $('#stats').innerHTML = [['Best attack', atk.strTeam, atk.intGoalsFor + ' goals'], ['Best defence', def.strTeam, def.intGoalsAgainst + ' conceded'],
      ['Most wins', win.strTeam, win.intWin + ' wins'], ['Total goals', Math.round(n('intGoalsFor').reduce((a, b) => a + b, 0)), 'this season']]
      .map(([l, v, s]) => `<div class="panel"><span class="muted">${l}</span><b>${esc(v)}</b><span class="muted">${s}</span></div>`).join('');
    const max = Math.max(...n('intGoalsFor'));
    el.innerHTML = '<h4>Goals scored by team</h4>' + t.map(r => `<div class="bar-row"><span>${esc(r.strTeam)}</span><i style="width:${r.intGoalsFor / max * 100}%"></i><b>${r.intGoalsFor}</b></div>`).join('');
  });
}

/* ====== START ====== */
layout(); sidebar();
({ home: homePage, article: articlePage, convert: convertPage, standings: standingsPage, fixture: fixturePage, analysis: analysisPage })[document.body.dataset.page]();
