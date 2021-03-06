const { app, protocol, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');

let win = null;
let winP = null;
let winC = null;

const BASE_GESTOR="https://gestor.lecard.delivery/";
// const BASE_GESTOR="http://localhost:8080/";

protocol.registerSchemesAsPrivileged([{scheme: 'app', privileges: { secure: true, standard: true } }])
app.commandLine.appendSwitch('--autoplay-policy','no-user-gesture-required');
app.setAppUserModelId('delivery.lecard.gestor');
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();

  winP = new BrowserWindow({
    width: 1000,
    show: false,
    title: 'Impressao'
  });

  winP.loadFile("index.html");

  globalShortcut.register('CommandOrControl+L', () => {
    win.webContents.openDevTools();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});

app.on('web-contents-created', (e, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('new-window', (e, url) => {
      e.preventDefault();
      require('electron').shell.openExternal(url)
    })
  }
});

// ipcmain
ipcMain.on('print', (event, option) => {
  printData(event, option);
});

ipcMain.on('reloadUrl', () => {
  win.loadURL(BASE_GESTOR).then(() => {}).catch(() => {
    win.loadFile('pages/error.html');
  });
});

ipcMain.on('gopage', (evt, opt) => {
  if (winC) {
    return;
  }

  winC = createBrowser('comanda.png');
  winC.loadURL(opt);

  winC.webContents.openDevTools();

  winC.once('ready-to-show', () => {
    winC.show();
    winC.focus();
  });

  winC.on('closed', () => {
    winC = null;
  });
});

function createBrowser(icon) {
  return new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 700,
    minHeight: 700,
    title: 'Gestor de Pedidos',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#2e2c29',
    icon: path.join(__dirname, icon)
  });
}

function createWindow () {
  win = createBrowser('icon.png');

  win.loadURL(BASE_GESTOR).then(() => {}).catch(() => {
    win.show();
    win.loadFile('pages/error.html');
  });

  win.on('closed', () => {
    winP = null;
    win = null;
    winC = null;
    app.quit()
  });

  win.once('ready-to-show', () => {
    win.show()
  });

  const printers = JSON.stringify(win.webContents.getPrinters());
  win.webContents.executeJavaScript(`window.Printers = ${printers}`);
}

function printData(event, option) {
  if (!option) {
    return;
  }

  const ispdv = (typeof option === 'string');

  const impressora = option.impressora || {};
  const copies = option.copies ? option.copies : 1;
  const content = JSON.stringify(`${ispdv ? option : option.content}`);
  const zoom = impressora.zoom ? impressora.zoom : "9px";
  const width = impressora.largura ? impressora.largura : "100%";
  const deviceName = impressora.device ? impressora.device : "";

  const script = `
    document.getElementById('content').innerHTML = ${content};
    document.body.style.fontSize = '${zoom}';
    document.body.style.width = '${width}';
  `;

  const printer = { silent: !deviceName };

  try {
    winP.webContents.executeJavaScript(script).then(() => {

      try {
        winP.webContents.print(printer);

        if (!printer.silent) {
          for (let i = 1; i < copies; i++) {
            setTimeout(() => {
              winP.webContents.print(printer);
            }, 1500);
          }
        }

      } catch (err) {
        dialogMsg("N??o foi poss??vel imprimir","Verifique se a impressora selecionada est?? dispon??vel e tente novamente.")
      }

    }).catch(e => {
      console.log(e)
    });

  } catch (e) {
    dialogMsg("N??o foi poss??vel imprimir","Tente novamente.")
  }
}

function dialogMsg(title, message) {
  dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['OK'],
    title,
    message
  }, null);
}
