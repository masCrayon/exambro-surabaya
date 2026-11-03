const { app, BrowserWindow, globalShortcut, ipcMain, dialog, powerSaveBlocker, session } = require('electron');
const path = require('path');

let mainWindow;
let passWindow = null;
let blockerId;

const PROKTOR_PASSWORD = 'surabaya2026';
const EXAM_URL = 'https://ujian.smp-kotasurabaya.org/';

function createWindow() {
  blockerId = powerSaveBlocker.start('prevent-display-sleep');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: true,
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnAllWorkspaces: true });

  // ANTI CACHE SOAL
  const ses = mainWindow.webContents.session;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders || {};
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
    callback({ requestHeaders: headers });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      try {
        document.querySelectorAll('input').forEach(i=>{
          i.setAttribute('autocomplete','off');
          i.setAttribute('data-lpignore','true');
        });
      } catch(e){}
    `, true).catch(()=>{});
  });

  mainWindow.loadURL(EXAM_URL);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (input.control && input.shift && key === 'q') { event.preventDefault(); askExit(); }
    if (input.control && input.alt && key === 'p') { event.preventDefault(); askExit(); }
    if (input.control && input.shift && input.alt && key === 'q') { event.preventDefault(); askExit(); }
  });

  mainWindow.on('blur', () => {
    if (app.isQuiting) return;
    if (passWindow && !passWindow.isDestroyed()) return;
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !app.isQuiting) {
        mainWindow.focus();
        mainWindow.moveTop();
      }
    }, 100);
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); askExit(); }
  });
}

function registerBlockers() {
  const toBlock = [
    'Alt+Tab','Alt+F4','F11','F5','Super','Meta','Alt+Space',
    'CommandOrControl+Tab','Super+D','Super+E','Super+L','Super+R',
    'Control+Shift+Esc','Control+Alt+Delete'
  ];
  toBlock.forEach(k => { try { globalShortcut.register(k, () => true); } catch {} });

  setInterval(() => {
    if (app.isQuiting) return;
    if (passWindow) return;
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
      mainWindow.focus();
      mainWindow.moveTop();
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 600);
}

function unregisterAndUnlock() {
  globalShortcut.unregisterAll();
  if (blockerId) { try { powerSaveBlocker.stop(blockerId); } catch {} }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setMovable(true);
  }
}

async function unlockAndQuit() {
  app.isQuiting = true;
  unregisterAndUnlock();
  try {
    const ses = mainWindow ? mainWindow.webContents.session : session.defaultSession;
    await ses.clearStorageData({ storages: ['cookies','localstorage','sessionstorage','caches'] });
    await ses.clearCache();
    await ses.clearAuthCache();
  } catch(e){}
  if (passWindow && !passWindow.isDestroyed()) passWindow.close();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  setTimeout(() => app.quit(), 800);
}

function createPassWindow() {
  if (passWindow && !passWindow.isDestroyed()) { passWindow.focus(); return; }
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setKiosk(false);
  }

  passWindow = new BrowserWindow({
    width: 420,
    height: 210,
    parent: mainWindow,
    modal: true,
    frame: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    title: 'Password Proktor',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  passWindow.setMenu(null);
  passWindow.loadFile(path.join(__dirname, 'password.html'));
  
  passWindow.once('ready-to-show', () => {
    passWindow.show();
    passWindow.focus();
  });

  passWindow.on('closed', () => {
    passWindow = null;
    if (!app.isQuiting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });
}

function askExit() {
  if (app.isQuiting) return;
  if (passWindow) return;
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Keluar Exambro - Proktor Only',
    message: 'Yakin ingin keluar? Ujian akan di-submit otomatis.',
    detail: 'Aksi ini butuh password proktor dan akan menghapus cache siswa sebelumnya.',
    buttons: ['Batal', 'Lanjut'],
    defaultId: 0, cancelId: 0
  }).then(({ response }) => { if (response === 1) createPassWindow(); });
}

app.isQuiting = false;
ipcMain.on('exit-with-password', (e, pass) => {
  if (pass === PROKTOR_PASSWORD) {
    try { app.setLoginItemSettings({ openAtLogin: false }); } catch {}
    if (passWindow) passWindow.close();
    unlockAndQuit();
  } else {
    dialog.showErrorBox('Akses Ditolak', 'Password proktor salah!');
  }
});

app.whenReady().then(() => {
  try { app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') }); } catch {}
  createWindow();
  registerBlockers();
});

app.on('will-quit', () => unregisterAndUnlock());
app.on('window-all-closed', () => { app.isQuiting = true; app.quit(); });
