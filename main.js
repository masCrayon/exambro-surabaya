// Exambro Surabaya v3.3.0 - Copyright @2026 by masCrayon
// Licensed by masCrayon - Proprietary
const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_VERSION = "3.3.0";
const APP_COPYRIGHT = "Copyright @2026 by masCrayon";
const APP_LICENSE = "Licensed by masCrayon";

console.log(`Exambro Surabaya v${APP_VERSION} - ${APP_COPYRIGHT}`);

let mainWindow;
let isQuiting = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: false, // set true kalau mau fullscreen ujian
    fullscreenable: true,
    show: false,
    title: `Exambro Surabaya v${APP_VERSION} - ${APP_COPYRIGHT}`,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.maximize();
  mainWindow.show();

  // Load halaman login password
  mainWindow.loadFile('password.html');

  // Cek update otomatis 15 detik setelah buka (hanya di app jadi, bukan npm start)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(()=>{});
    }, 15000);
  }

  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Keluar Exambro',
        message: 'Yakin ingin keluar dari Exambro Surabaya?',
        detail: APP_COPYRIGHT,
        buttons: ['Batal', 'Keluar'],
        defaultId: 0
      }).then(({response}) => {
        if (response === 1) {
          isQuiting = true;
          app.quit();
        }
      });
    }
  });
}

// --- AUTO UPDATER EVENTS ---
autoUpdater.on('checking-for-update', () => {
  console.log('Mengecek update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update tersedia:', info.version);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Tersedia',
    message: `Versi baru Exambro Surabaya v${info.version} tersedia!`,
    detail: `Versi kamu: v${APP_VERSION}\n${APP_COPYRIGHT}\n\nKlik Download untuk update otomatis. Aplikasi akan terupdate tanpa perlu install ulang.`,
    buttons: ['Nanti', 'Download & Update'],
    defaultId: 1
  }).then(({response}) => {
    if (response === 1) {
      autoUpdater.downloadUpdate();
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mendownload Update',
        message: 'Sedang mendownload update... Mohon tunggu sampai selesai.',
        buttons: ['OK']
      });
    }
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('Aplikasi sudah versi terbaru');
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`Download: ${Math.round(progress.percent)}%`);
  if (mainWindow) {
    mainWindow.setProgressBar(progress.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.setProgressBar(-1);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Siap Install',
    message: `Update v${info.version} sudah di-download!`,
    detail: 'Aplikasi akan restart dan install otomatis. Semua data aman.',
    buttons: ['Restart & Install Sekarang', 'Nanti'],
    defaultId: 0
  }).then(({response}) => {
    if (response === 0) {
      isQuiting = true;
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.log('AutoUpdate error:', err);
});

// IPC dari preload.js
ipcMain.on('app-quit', () => { isQuiting = true; app.quit(); });
ipcMain.on('check-for-update-manual', () => {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, { message: 'Cek update hanya bisa di aplikasi yang sudah di-install (bukan npm start)', buttons: ['OK'] });
    return;
  }
  autoUpdater.checkForUpdates();
});
ipcMain.handle('get-app-info', () => {
  return { version: APP_VERSION, copyright: APP_COPYRIGHT, license: APP_LICENSE };
});

app.whenReady().then(() => {
  createWindow();
  // Blokir Alt+Tab, Alt+F4, dll pas ujian
  globalShortcut.register('Alt+F4', () => {});
  globalShortcut.register('Control+Alt+Delete', () => {});
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
