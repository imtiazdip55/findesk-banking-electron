const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bankAPI', {
  getBankData: () => ipcRenderer.invoke('get-bank-data'),
  createAccount: (accountData) => ipcRenderer.invoke('create-account', accountData),
  processTransaction: (txnData) => ipcRenderer.invoke('process-transaction', txnData),
  exportStatement: () => ipcRenderer.invoke('export-statement')
});