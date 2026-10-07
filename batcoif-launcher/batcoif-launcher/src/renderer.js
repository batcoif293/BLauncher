const $ = (id) => document.getElementById(id);
const grid = $('grid'), empty = $('empty'), detail = $('detail'), search = $('search');
const titleEl = $('title'), toastEl = $('toast'), topEl = document.querySelector('.top');

let games = [];
let view = 'all';       // 'all' | 'recent'
let openId = null;      // game shown on the detail page
let animate = true;     // only play entrance animations on view changes
let toastTimer;
const playing = new Map(); // id -> start timestamp (ms)

function toast(msg, isErr) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('err', !!isErr);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function hue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return 205 + (h % 55); // keep tiles in the blue range
}
const gradient = (name) => { const h = hue(name); return `linear-gradient(145deg, hsl(${h} 70% 28%), hsl(${h + 20} 75% 14%))`; };

function dur(s) {
  s = Math.round(s || 0);
  if (s <= 0) return '0m';
  if (s < 60) return '<1m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function clock(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function ago(ts) {
  if (!ts) return 'Never';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
const dateStr = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

function iconImg(g) {
  const img = document.createElement('img');
  img.src = g.icon;
  img.onload = () => { if (img.naturalWidth <= 32) img.style.imageRendering = 'pixelated'; };
  return img;
}
function letter(g) {
  const l = document.createElement('div');
  l.className = 'letter';
  l.textContent = g.name[0].toUpperCase();
  return l;
}

async function launchGame(g, el) {
  if (el) {
    if (el.classList.contains('launching')) return;
    el.classList.add('launching');
    setTimeout(() => el.classList.remove('launching'), 900);
  }
  const r = await window.api.launch(g.id);
  if (!r.ok) return toast(r.error, true);
  toast(r.already ? `${g.name} is already running` : `Launching ${g.name}`);
  setTimeout(refresh, 600);
}

/* ---------- Library grid ---------- */
function renderGrid() {
  const q = search.value.trim().toLowerCase();
  let list = games.filter(g => g.name.toLowerCase().includes(q));
  if (view === 'recent') list = list.filter(g => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed);
  else list.sort((a, b) => a.name.localeCompare(b.name));

  grid.innerHTML = '';
  const nothing = games.length === 0;
  empty.classList.toggle('hidden', !nothing);
  grid.classList.toggle('hidden', nothing);

  list.forEach((g, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (g.missing ? ' missing' : '');
    card.tabIndex = 0;
    if (animate) card.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
    else card.style.animation = 'none';

    const art = document.createElement('div');
    art.className = 'art' + (g.cover ? ' cover' : '');
    art.style.background = g.cover ? `center / cover url(${g.cover})` : gradient(g.name);
    if (!g.cover) art.appendChild(g.icon ? iconImg(g) : letter(g));

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = '<div class="name"></div><div class="sub"></div>';
    info.querySelector('.name').textContent = g.name;
    info.querySelector('.sub').textContent = g.missing ? 'Exe not found'
      : (g.playtime ? `${dur(g.playtime)} played` : 'Not played yet');

    const go = document.createElement('button');
    go.className = 'go';
    go.title = 'Play';
    go.setAttribute('aria-label', `Play ${g.name}`);
    go.innerHTML = '<span class="tri"></span>';
    go.addEventListener('click', (e) => { e.stopPropagation(); launchGame(g, card); });

    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.textContent = 'Remove';
    let armed;
    rm.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!rm.classList.contains('confirm')) {
        rm.classList.add('confirm');
        rm.textContent = 'Click to confirm';
        armed = setTimeout(() => { rm.classList.remove('confirm'); rm.textContent = 'Remove'; }, 2500);
        return;
      }
      clearTimeout(armed);
      card.style.transition = 'opacity .2s, transform .2s';
      card.style.opacity = '0';
      card.style.transform = 'scale(.9)';
      await window.api.remove(g.id);
      setTimeout(refresh, 200);
      toast(`Removed ${g.name}`);
    });

    const open = () => openDetail(g.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });

    card.append(art, info, go, rm);
    if (playing.has(g.id)) {
      const b = document.createElement('div');
      b.className = 'badge';
      b.textContent = 'Playing';
      card.appendChild(b);
    }
    grid.appendChild(card);
  });

  if (!nothing && list.length === 0)
    grid.innerHTML = '<p style="color:var(--muted);padding:12px">No games match.</p>';
}

/* ---------- Detail page ---------- */
function week(g) {
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); days.push({ d, secs: 0 }); }
  for (const h of g.history || []) {
    const hd = new Date(h.start); hd.setHours(0, 0, 0, 0);
    const slot = days.find(x => x.d.getTime() === hd.getTime());
    if (slot) slot.secs += h.secs;
  }
  return days;
}

function renderDetail() {
  const g = games.find(x => x.id === openId);
  if (!g) { openId = null; return render(); }
  detail.innerHTML = '';
  const isPlaying = playing.has(g.id);
  const sessions = g.sessions || 0, total = g.playtime || 0;

  const back = document.createElement('button');
  back.className = 'back';
  back.textContent = 'Library';
  back.onclick = closeDetail;

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.style.background = g.cover ? `center / cover url(${g.cover})` : gradient(g.name);
  const shade = document.createElement('div');
  shade.className = 'hero-shade';

  const row = document.createElement('div');
  row.className = 'hero-row';
  const fg = document.createElement('div');
  fg.className = 'fg';
  fg.style.background = gradient(g.name);
  fg.appendChild(g.icon ? iconImg(g) : letter(g));

  const text = document.createElement('div');
  text.className = 'hero-text';
  const h2 = document.createElement('h2');
  h2.textContent = g.name;
  const status = document.createElement('div');
  status.className = 'status' + (isPlaying ? ' on live' : '');
  if (isPlaying) status.dataset.since = playing.get(g.id);
  status.textContent = isPlaying ? '' : (g.missing ? 'Exe not found' : `Last played: ${ago(g.lastPlayed)}`);
  text.append(h2, status);

  const play = document.createElement('button');
  play.className = 'primary bigplay';
  play.disabled = isPlaying || g.missing;
  play.innerHTML = '<span class="tri"></span><span></span>';
  play.lastChild.textContent = isPlaying ? 'Playing' : 'Play';
  play.onclick = () => launchGame(g, null);

  row.append(fg, text, play);
  hero.append(shade, row);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const mk = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'ghost ' + (cls || ''); b.textContent = label; b.onclick = fn; return b; };
  actions.append(
    mk(g.cover ? 'Change cover' : 'Set cover image', async () => {
      const r = await window.api.setCover(g.id);
      if (r.ok) { toast('Cover updated'); refresh(); } else if (!r.canceled) toast(r.error, true);
    }),
    ...(g.cover ? [mk('Remove cover', async () => { await window.api.clearCover(g.id); refresh(); })] : []),
    mk('Show in folder', () => window.api.showInFolder(g.id))
  );
  const rm = mk('Remove game', async () => {
    if (!rm.classList.contains('confirm')) {
      rm.classList.add('confirm'); rm.textContent = 'Click to confirm';
      setTimeout(() => { rm.classList.remove('confirm'); rm.textContent = 'Remove game'; }, 2500);
      return;
    }
    await window.api.remove(g.id);
    toast(`Removed ${g.name}`);
    closeDetail();
  }, 'danger');
  actions.append(rm);

  const stats = document.createElement('div');
  stats.className = 'stats';
  const stat = (v, l) => { const s = document.createElement('div'); s.className = 'stat'; s.innerHTML = '<div class="v"></div><div class="l"></div>'; s.firstChild.textContent = v; s.lastChild.textContent = l; return s; };
  stats.append(
    stat(dur(total), 'Time played'),
    stat(String(sessions), 'Sessions'),
    stat(sessions ? dur(g.longest) : '-', 'Longest session'),
    stat(sessions ? dur(total / sessions) : '-', 'Average session'),
    stat(ago(g.lastPlayed), 'Last played'),
    stat(dateStr(g.added), 'Added to library')
  );

  const days = week(g);
  const max = Math.max(...days.map(d => d.secs), 1);
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = '<h3>Last 7 days</h3>';
  const wk = document.createElement('div');
  wk.className = 'week';
  days.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.title = `${dateStr(d.d.getTime())}: ${dur(d.secs)}`;
    const fill = document.createElement('div');
    fill.className = 'fill' + (d.secs ? '' : ' zero');
    fill.style.height = d.secs ? `${Math.max(6, (d.secs / max) * 100)}%` : '4px';
    if (animate) fill.style.animationDelay = `${i * 50}ms`; else fill.style.animation = 'none';
    const lab = document.createElement('div');
    lab.className = 'd';
    lab.textContent = d.d.toLocaleDateString(undefined, { weekday: 'short' });
    bar.append(fill, lab);
    wk.appendChild(bar);
  });
  panel.appendChild(wk);

  const info = document.createElement('div');
  info.className = 'panel';
  info.innerHTML = '<h3>Details</h3><div class="path"></div>';
  info.querySelector('.path').textContent = g.exe;
  if (!g.trackable) {
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = 'Play time is only tracked for .exe files.';
    info.appendChild(n);
  }

  detail.append(back, hero, actions, stats, panel, info);
  tickLive();
}

function tickLive() {
  document.querySelectorAll('.live').forEach(el => {
    const since = Number(el.dataset.since);
    if (since) el.textContent = `Playing now: ${clock(Math.max(0, Math.floor((Date.now() - since) / 1000)))}`;
  });
}
setInterval(tickLive, 1000);

/* ---------- Navigation ---------- */
function render() {
  const inDetail = !!openId;
  topEl.classList.toggle('hidden', inDetail);
  detail.classList.toggle('hidden', !inDetail);
  if (inDetail) { grid.classList.add('hidden'); empty.classList.add('hidden'); renderDetail(); }
  else renderGrid();
  animate = false;
}
function openDetail(id) { openId = id; animate = true; detail.scrollTop = 0; render(); }
function closeDetail() { openId = null; animate = true; render(); refresh(); }

async function refresh() {
  games = await window.api.list();
  playing.clear();
  games.forEach(g => { if (g.playingSince) playing.set(g.id, g.playingSince); });
  render();
}

async function addGame() {
  const r = await window.api.add();
  if (r.ok) { toast('Game added'); refresh(); }
  else if (!r.canceled) toast(r.error, true);
}

$('add').onclick = addGame;
$('add2').onclick = addGame;
$('openFolder').onclick = () => window.api.showFolder();
search.addEventListener('input', () => { animate = false; render(); });

document.querySelectorAll('.nav[data-view]').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.nav[data-view]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    view = b.dataset.view;
    titleEl.textContent = view === 'all' ? 'Library' : 'Recently played';
    openId = null; animate = true; render();
  });
});

window.api.onState(({ id, playing: on, start }) => {
  const g = games.find(x => x.id === id);
  if (on) { playing.set(id, start); if (g) toast(`Tracking play time for ${g.name}`); }
  refresh();
});

refresh();
