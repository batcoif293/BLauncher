const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('games:list'),
  add: () => ipcRenderer.invoke('games:add'),
  launch: (id) => ipcRenderer.invoke('games:launch', id),
  remove: (id) => ipcRenderer.invoke('games:remove', id),
  setCover: (id) => ipcRenderer.invoke('games:setCover', id),
  clearCover: (id) => ipcRenderer.invoke('games:clearCover', id),
  showInFolder: (id) => ipcRenderer.invoke('games:showInFolder', id),
  showFolder: () => ipcRenderer.invoke('games:showFolder'),
  onState: (cb) => ipcRenderer.on('games:state', (_e, data) => cb(data))
});
