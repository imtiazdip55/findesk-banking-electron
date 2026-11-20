const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// Path where banking data will be stored locally on the computer
const dataFilePath = path.join(app.getPath('userData'), 'bank_data.json');

// Initialize default accounts if no data file exists yet
function loadBankData() {
  if (!fs.existsSync(dataFilePath)) {
    const initialData = {
      accounts: [
        { accNo: '1001', name: 'Arafat Rahman', type: 'Savings', balance: 25000 },
        { accNo: '1002', name: 'Nusrat Jahan', type: 'Current', balance: 42000 }
      ],
      transactions: [
        { id: 'TXN-101', date: new Date().toLocaleString(), accNo: '1001', type: 'Deposit', amount: 25000, note: 'Initial Deposit' },
        { id: 'TXN-102', date: new Date().toLocaleString(), accNo: '1002', type: 'Deposit', amount: 42000, note: 'Initial Deposit' }
      ]
    };
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
}

function saveBankData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1150,
    height: 760,
    minWidth: 950,
    minHeight: 650,
    title: 'FinDesk - Desktop Banking System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS (Communication between Frontend & Backend) ---

ipcMain.handle('get-bank-data', () => {
  return loadBankData();
});

ipcMain.handle('create-account', (event, { name, type, initialDeposit }) => {
  const data = loadBankData();
  const nextAccNo = String(1001 + data.accounts.length);
  const amount = parseFloat(initialDeposit) || 0;

  const newAccount = {
    accNo: nextAccNo,
    name: name.trim(),
    type,
    balance: amount
  };

  data.accounts.push(newAccount);

  if (amount > 0) {
    data.transactions.unshift({
      id: 'TXN-' + Date.now().toString().slice(-5),
      date: new Date().toLocaleString(),
      accNo: nextAccNo,
      type: 'Deposit',
      amount,
      note: 'Account Opening Deposit'
    });
  }

  saveBankData(data);
  return { success: true, data };
});

ipcMain.handle('process-transaction', (event, { accNo, type, amount, targetAccNo }) => {
  const data = loadBankData();
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return { success: false, message: 'Please enter a valid positive amount.' };
  }

  const account = data.accounts.find(a => a.accNo === accNo);
  if (!account) return { success: false, message: 'Account not found.' };

  if (type === 'Deposit') {
    account.balance += numAmount;
    data.transactions.unshift({
      id: 'TXN-' + Date.now().toString().slice(-5),
      date: new Date().toLocaleString(),
      accNo,
      type: 'Deposit',
      amount: numAmount,
      note: 'Cash Deposit'
    });
  } else if (type === 'Withdraw') {
    if (account.balance < numAmount) {
      return { success: false, message: 'Insufficient balance!' };
    }
    account.balance -= numAmount;
    data.transactions.unshift({
      id: 'TXN-' + Date.now().toString().slice(-5),
      date: new Date().toLocaleString(),
      accNo,
      type: 'Withdraw',
      amount: numAmount,
      note: 'Cash Withdrawal'
    });
  } else if (type === 'Transfer') {
    if (accNo === targetAccNo) {
      return { success: false, message: 'Cannot transfer to the same account.' };
    }
    const targetAccount = data.accounts.find(a => a.accNo === targetAccNo);
    if (!targetAccount) {
      return { success: false, message: 'Recipient account not found.' };
    }
    if (account.balance < numAmount) {
      return { success: false, message: 'Insufficient balance for transfer!' };
    }

    account.balance -= numAmount;
    targetAccount.balance += numAmount;

    const txnId = 'TXN-' + Date.now().toString().slice(-5);
    data.transactions.unshift(
      {
        id: txnId,
        date: new Date().toLocaleString(),
        accNo,
        type: 'Transfer Out',
        amount: numAmount,
        note: `Transferred to A/C ${targetAccNo}`
      },
      {
        id: txnId,
        date: new Date().toLocaleString(),
        accNo: targetAccNo,
        type: 'Transfer In',
        amount: numAmount,
        note: `Received from A/C ${accNo}`
      }
    );
  }

  saveBankData(data);

  // Trigger a native desktop notification
  if (Notification.isSupported()) {
    new Notification({
      title: 'Transaction Completed',
      body: `${type} of BDT ${numAmount.toLocaleString()} for A/C ${accNo}`
    }).show();
  }

  return { success: true, data };
});

// Export transaction history to a TXT report using Native Save Dialog
ipcMain.handle('export-statement', async () => {
  const data = loadBankData();
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Bank Statement',
    defaultPath: 'Bank_Statement.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (canceled || !filePath) return { success: false };

  let report = '=== FINDESK BANKING SYSTEM - TRANSACTION STATEMENT ===\n';
  report += `Generated on: ${new Date().toLocaleString()}\n\n`;
  report += '--- ACCOUNTS SUMMARY ---\n';
  data.accounts.forEach(acc => {
    report += `A/C: ${acc.accNo} | Name: ${acc.name} (${acc.type}) | Balance: BDT ${acc.balance.toLocaleString()}\n`;
  });
  report += '\n--- TRANSACTION LOG ---\n';
  data.transactions.forEach(t => {
    report += `[${t.date}] ${t.id} | A/C: ${t.accNo} | ${t.type} | BDT ${t.amount.toLocaleString()} | ${t.note}\n`;
  });

  fs.writeFileSync(filePath, report, 'utf-8');
  return { success: true, filePath };
});
