const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const Menu = electron.Menu
const dialog = electron.dialog
const ipcMain = electron.ipcMain
const shell = electron.shell

const fs = require('fs')
const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function sendMenuAction(action) {
  if (mainWindow != null && mainWindow.webContents != null) {
    mainWindow.webContents.send('wpd:native-menu-action', action)
  }
}

function createApplicationMenu() {
  const template = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push(
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-project')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-project')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-project-as')
        },
        { type: 'separator' },
        {
          label: 'Load Image(s)...',
          accelerator: 'CmdOrCtrl+L',
          click: () => sendMenuAction('load-image')
        },
        ...(process.platform === 'darwin' ? [] : [{ type: 'separator' }, { role: 'quit' }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(process.platform === 'darwin' ? [{ role: 'pasteandmatchstyle' }] : []),
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WebPlotDigitizer',
          click: () => sendMenuAction('show-about')
        },
        { type: 'separator' },
        {
          label: 'Tutorials',
          click: () => shell.openExternal('https://automeris.io/WebPlotDigitizer/tutorial.html')
        },
        {
          label: 'User Manual',
          click: () => shell.openExternal('https://automeris.io/WebPlotDigitizer/userManual.pdf')
        },
        {
          label: 'GitHub Page',
          click: () => shell.openExternal('https://github.com/ankitrohatgi/WebPlotDigitizer')
        },
        {
          label: 'Report Issues',
          click: () => shell.openExternal('https://github.com/ankitrohatgi/WebPlotDigitizer/issues')
        }
      ]
    }
  )

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    icon: path.join(__dirname, '../app/images/icon/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../app/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  createApplicationMenu()
  // mainWindow.setIcon(path.join(__dirname, '../app/images/icon/icon.png'))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  var allow_quit = false;
  mainWindow.on('close', async function(e) {
    if(!allow_quit) {
      e.preventDefault();
      var choice = await electron.dialog.showMessageBox(mainWindow,
          {
              type: 'question',
              buttons: ['Yes', 'No'],
              title: 'Confirm',
              message: 'Are you sure you want to quit?'
          });
      if(choice.response == 0){
        allow_quit = true;
        app.quit();
      }
    }
  })

}

ipcMain.handle('wpd:show-open-project-dialog', async function () {
  if (mainWindow == null) {
    return null
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    properties: ['openFile'],
    filters: [
      { name: 'WebPlotDigitizer Project', extensions: ['tar'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('wpd:show-save-project-dialog', async function (event, defaultPath) {
  if (mainWindow == null) {
    return null
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project As',
    defaultPath: defaultPath,
    filters: [
      { name: 'WebPlotDigitizer Project', extensions: ['tar'] }
    ]
  })

  if (result.canceled || result.filePath == null) {
    return null
  }
  return result.filePath
})

ipcMain.handle('wpd:read-binary-file', async function (event, filePath) {
  return Uint8Array.from(fs.readFileSync(filePath))
})

ipcMain.handle('wpd:write-binary-file', async function (event, filePath, data) {
  fs.writeFileSync(filePath, Buffer.from(data))
  return true
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
