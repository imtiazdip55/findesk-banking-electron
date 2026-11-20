let bankState = { accounts: [], transactions: [] };

async function init() {
  bankState = await window.bankAPI.getBankData();
  renderUI();
}

function renderUI() {
  // Update summary cards
  document.getElementById('totalAccounts').innerText = bankState.accounts.length;
  const totalBal = bankState.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  document.getElementById('totalBalance').innerText = 'BDT ' + totalBal.toLocaleString();
  document.getElementById('totalTxns').innerText = bankState.transactions.length;

  // Populate account dropdowns
  const accSelect = document.getElementById('txnAccNo');
  const targetSelect = document.getElementById('targetAccNo');
  accSelect.innerHTML = '';
  targetSelect.innerHTML = '';

  bankState.accounts.forEach(acc => {
    const optionText = `${acc.accNo} - ${acc.name} (BDT ${acc.balance.toLocaleString()})`;
    accSelect.innerHTML += `<option value="${acc.accNo}">${optionText}</option>`;
    targetSelect.innerHTML += `<option value="${acc.accNo}">${optionText}</option>`;
  });

  // Render Accounts Table
  const accBody = document.getElementById('accountsTableBody');
  accBody.innerHTML = bankState.accounts.map(acc => `
    <tr>
      <td><strong>${acc.accNo}</strong></td>
      <td>${acc.name}</td>
      <td>${acc.type}</td>
      <td><strong>${acc.balance.toLocaleString()}</strong></td>
    </tr>
  `).join('');

  // Render Transactions Table
  const txnBody = document.getElementById('txnTableBody');
  txnBody.innerHTML = bankState.transactions.map(t => {
    const isPositive = t.type === 'Deposit' || t.type === 'Transfer In';
    return `
      <tr>
        <td>${t.id}</td>
        <td>${t.date}</td>
        <td>${t.accNo}</td>
        <td><span class="badge ${isPositive ? 'badge-in' : 'badge-out'}">${t.type}</span></td>
        <td>BDT ${t.amount.toLocaleString()}</td>
        <td>${t.note}</td>
      </tr>
    `;
  }).join('');
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

function toggleTargetAccount() {
  const type = document.getElementById('txnType').value;
  document.getElementById('targetAccGroup').style.display = type === 'Transfer' ? 'block' : 'none';
}

document.getElementById('txnForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('txnType').value;
  const accNo = document.getElementById('txnAccNo').value;
  const targetAccNo = document.getElementById('targetAccNo').value;
  const amount = document.getElementById('txnAmount').value;

  const result = await window.bankAPI.processTransaction({ accNo, type, amount, targetAccNo });
  const statusEl = document.getElementById('statusMsg');

  if (result.success) {
    bankState = result.data;
    renderUI();
    document.getElementById('txnAmount').value = '';
    statusEl.style.color = '#16a34a';
    statusEl.innerText = '✓ Transaction completed successfully!';
  } else {
    statusEl.style.color = '#dc2626';
    statusEl.innerText = '✗ ' + result.message;
  }
});

document.getElementById('createAccForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('custName').value;
  const type = document.getElementById('custType').value;
  const initialDeposit = document.getElementById('custDeposit').value;

  const result = await window.bankAPI.createAccount({ name, type, initialDeposit });
  if (result.success) {
    bankState = result.data;
    renderUI();
    document.getElementById('custName').value = '';
    alert('New bank account created!');
    switchTab('dashboard', document.querySelectorAll('.nav-btn')[0]);
  }
});

async function exportReport() {
  const res = await window.bankAPI.exportStatement();
  if (res.success) {
    alert('Statement saved to:\n' + res.filePath);
  }
}

init();