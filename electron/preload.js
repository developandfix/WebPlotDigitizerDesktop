const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wpdDesktop', {
  isDesktopApp: true,
  showOpenProjectDialog: function () {
    return ipcRenderer.invoke('wpd:show-open-project-dialog')
  },
  showSaveProjectDialog: function (defaultPath) {
    return ipcRenderer.invoke('wpd:show-save-project-dialog', defaultPath)
  },
  readBinaryFile: async function (filePath) {
    const data = await ipcRenderer.invoke('wpd:read-binary-file', filePath)
    return new Uint8Array(data)
  },
  writeBinaryFile: function (filePath, data) {
    return ipcRenderer.invoke('wpd:write-binary-file', filePath, data)
  },
  onNativeMenuAction: function (callback) {
    const listener = function (event, action) {
      callback(action)
    }
    ipcRenderer.on('wpd:native-menu-action', listener)
    return function () {
      ipcRenderer.removeListener('wpd:native-menu-action', listener)
    }
  }
})
