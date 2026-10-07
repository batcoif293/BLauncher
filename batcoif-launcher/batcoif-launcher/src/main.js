const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = () => app.getPath('userData');
const shortcutDir = () => path.join(dataDir(), 'shortcuts');
const coverDir = () => path.join(dataDir(), 'covers');
const dbFile = () => path.join(dataDir(), 'games.json');

function readDb() {
  try { return JSON.parse(fs.readFileSync(dbFile(), 'utf8')); } catch { return []; }
}
function writeDb(games) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(dbFile(), JSON.stringify(games, null, 2));
}
const safeName = (s) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Game';

let win;
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 820,
    minHeight: 540,
    backgroundColor: '#070d1f',
    title: 'Batcoif Launcher',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#070d1f', symbolColor: '#8fa6d9', height: 38 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  fs.mkdirSync(shortcutDir(), { recursive: true });
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ---------- Play time tracking ----------
   We launch through the shortcut, then watch for the game's exe in the
   process list. Time is counted while the exe is running. */
const running = new Map(); // id -> { start, lastAlive, started, miss, timer }

function notify(id, playing, start) {
  if (win && !win.isDestroyed()) win.webContents.send('games:state', { id, playing, start: start || null });
}

function isRunning(exeName) {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `IMAGENAME eq ${exeName}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true }, (err, out) => {
        // tasklist truncates long names to 25 chars in its output
        resolve(!err && out.toLowerCase().includes(`"${exeName.toLowerCase().slice(0, 25)}`));
      });
  });
}

function finish(id) {
  const s = running.get(id);
  if (!s) return;
  clearTimeout(s.timer);
  running.delete(id);
  if (s.started) {
    const secs = Math.round((s.lastAlive - s.start) / 1000);
    const games = readDb();
    const g = games.find(x => x.id === id);
    if (g && secs >= 5) {
      g.playtime = (g.playtime || 0) + secs;
      g.sessions = (g.sessions || 0) + 1;
      g.longest = Math.max(g.longest || 0, secs);
      g.history = [...(g.history || []), { start: s.start, secs }].slice(-300);
      writeDb(games);
    }
    notify(id, false);
  }
}

function track(g) {
  if (running.has(g.id)) return;
  const exeName = path.basename(g.exe);
  const s = { start: Date.now(), lastAlive: Date.now(), started: false, miss: 0, timer: null };
  const t0 = Date.now();
  running.set(g.id, s);
  const tick = async () => {
    if (!running.has(g.id)) return;
    const alive = await isRunning(exeName);
    if (!running.has(g.id)) return;
    if (alive) {
      if (!s.started) { s.started = true; s.start = Date.now(); notify(g.id, true, s.start); }
      s.lastAlive = Date.now();
      s.miss = 0;
    } else if (s.started) {
      if (++s.miss >= 3) return finish(g.id); // tolerate brief gaps (launchers restarting)
    } else if (Date.now() - t0 > 45000) {
      running.delete(g.id); // never saw the process; give up
      return;
    }
    s.timer = setTimeout(tick, 4000);
  };
  tick();
}

app.on('before-quit', () => { for (const id of [...running.keys()]) finish(id); });

/* ---------- IPC ---------- */
ipcMain.handle('games:list', async () => {
  const out = [];
  for (const g of readDb()) {
    let icon = null;
    try { icon = (await app.getFileIcon(g.exe, { size: 'large' })).toDataURL(); } catch {}
    let cover = null;
    if (g.cover && fs.existsSync(g.cover)) {
      try { cover = 'data:image/jpeg;base64,' + fs.readFileSync(g.cover).toString('base64'); } catch {}
    }
    const r = running.get(g.id);
    out.push({
      ...g, icon, cover,
      missing: !fs.existsSync(g.exe),
      trackable: g.exe.toLowerCase().endsWith('.exe'),
      playingSince: r && r.started ? r.start : null
    });
  }
  return out;
});

ipcMain.handle('games:add', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose the game\'s launch .exe',
    properties: ['openFile'],
    filters: [{ name: 'Programs', extensions: ['exe', 'lnk', 'bat'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };

  const exe = res.filePaths[0];
  const games = readDb();
  if (games.some(g => g.exe.toLowerCase() === exe.toLowerCase()))
    return { ok: false, error: 'That game is already in your library.' };

  const name = path.basename(exe, path.extname(exe));
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lnk = path.join(shortcutDir(), `${safeName(name)}-${id}.lnk`);

  const made = shell.writeShortcutLink(lnk, 'create', {
    target: exe,
    cwd: path.dirname(exe),
    description: `${name} (added by Batcoif Launcher)`,
    icon: exe,
    iconIndex: 0
  });
  if (!made) return { ok: false, error: 'Could not create the shortcut.' };

  games.push({ id, name, exe, lnk, added: Date.now(), lastPlayed: null, playtime: 0, sessions: 0, longest: 0, history: [] });
  writeDb(games);
  return { ok: true };
});

ipcMain.handle('games:launch', async (_e, id) => {
  const games = readDb();
  const g = games.find(x => x.id === id);
  if (!g) return { ok: false, error: 'Game not found.' };
  if (!fs.existsSync(g.exe)) return { ok: false, error: 'The game\'s .exe is missing. Remove it and add it again.' };
  const r = running.get(id);
  if (r && r.started) return { ok: true, already: true };
  const err = await shell.openPath(g.lnk);
  if (err) return { ok: false, error: err };
  g.lastPlayed = Date.now();
  writeDb(games);
  if (g.exe.toLowerCase().endsWith('.exe')) track(g);
  return { ok: true };
});

ipcMain.handle('games:remove', async (_e, id) => {
  finish(id);
  const games = readDb();
  const g = games.find(x => x.id === id);
  if (g) {
    try { fs.unlinkSync(g.lnk); } catch {}
    if (g.cover) { try { fs.unlinkSync(g.cover); } catch {} }
  }
  writeDb(games.filter(x => x.id !== id));
  return { ok: true };
});

ipcMain.handle('games:setCover', async (_e, id) => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a cover image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  let img = nativeImage.createFromPath(res.filePaths[0]);
  if (img.isEmpty()) return { ok: false, error: 'Could not read that image.' };
  if (img.getSize().width > 1280) img = img.resize({ width: 1280, quality: 'best' });
  fs.mkdirSync(coverDir(), { recursive: true });
  const file = path.join(coverDir(), `${id}.jpg`);
  fs.writeFileSync(file, img.toJPEG(88));
  const games = readDb();
  const g = games.find(x => x.id === id);
  if (g) { g.cover = file; writeDb(games); }
  return { ok: true };
});

ipcMain.handle('games:clearCover', async (_e, id) => {
  const games = readDb();
  const g = games.find(x => x.id === id);
  if (g && g.cover) { try { fs.unlinkSync(g.cover); } catch {} delete g.cover; writeDb(games); }
  return { ok: true };
});

ipcMain.handle('games:showInFolder', async (_e, id) => {
  const g = readDb().find(x => x.id === id);
  if (g) shell.showItemInFolder(g.exe);
});

ipcMain.handle('games:showFolder', async () => { shell.openPath(shortcutDir()); });
