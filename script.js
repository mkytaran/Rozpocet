// --- PŘEPÍNÁNÍ MOTIVU ---
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('budgetTheme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeBtn) themeBtn.textContent = '🌙';
    }
}

function toggleTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    
    if (root.getAttribute('data-theme') === 'dark') {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('budgetTheme', 'light');
        themeBtn.textContent = '🌙';
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('budgetTheme', 'dark');
        themeBtn.textContent = '☀️';
    }
}

initTheme();

// Pomocné funkce pro práci s datem
function getDateString(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getDaysBetween(d1Str, d2Str) {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

let budgetData = JSON.parse(localStorage.getItem('myBudgetApp_v4'));

if (!budgetData) {
    const oldDataV3 = JSON.parse(localStorage.getItem('myBudgetApp_v3')); 
    
    if (oldDataV3 && oldDataV3.income > 0) {
        let parts = oldDataV3.monthId.split('-');
        let y = parseInt(parts[0]);
        let m = parseInt(parts[1]);
        let lastDay = new Date(y, m, 0); 
        let firstDayStr = oldDataV3.monthId + '-01';

        budgetData = {
            startDate: firstDayStr,
            endDate: getDateString(lastDay),
            income: oldDataV3.income,
            wallet: oldDataV3.wallet,
            monthPool: oldDataV3.monthPool,
            totalSavings: oldDataV3.totalSavings || 0,
            lastProcessedDate: oldDataV3.lastProcessedDate,
            expenses: oldDataV3.expenses || []
        };
    } else {
        budgetData = {
            startDate: '', endDate: '', income: 0, wallet: 0, monthPool: 0,
            totalSavings: 0, lastProcessedDate: '', expenses: []
        };
    }
    localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
}

function initApp() {
    const today = new Date();
    const todayStr = getDateString(today);

    if (budgetData.endDate && todayStr > budgetData.endDate) {
        budgetData.totalSavings += (Math.max(0, budgetData.wallet) + budgetData.monthPool);
        budgetData.income = 0;
        budgetData.wallet = 0;
        budgetData.monthPool = 0;
        budgetData.expenses = [];
        budgetData.startDate = '';
        budgetData.endDate = '';
        budgetData.lastProcessedDate = '';
        saveData();
    }

    if (budgetData.income === 0 || !budgetData.endDate) {
        document.getElementById('incomeModal').style.display = 'flex';
        
        document.getElementById('startDateInput').value = todayStr;
        let nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(nextMonth.getDate() - 1);
        document.getElementById('endDateInput').value = getDateString(nextMonth);
        
        document.getElementById('incomeInput').focus();
        return;
    } 

    if (budgetData.lastProcessedDate !== todayStr && budgetData.lastProcessedDate !== '') {
        if (budgetData.wallet > 0) {
            document.getElementById('leftoverAmountDisplay').innerText = formatMoney(Math.floor(budgetData.wallet)) + ' Kč';
            document.getElementById('dailyActionModal').style.display = 'flex';
            return; 
        } else {
            processDailyAllowance();
        }
    }

    updateUI();
}

function handleLeftover(action) {
    let leftover = budgetData.wallet;
    
    if (action === 'rozpocitat') {
        budgetData.monthPool += leftover;
        budgetData.wallet = 0;
    } else if (action === 'usporit') {
        budgetData.totalSavings += leftover;
        budgetData.wallet = 0;
    }
    
    document.getElementById('dailyActionModal').style.display = 'none';
    processDailyAllowance();
}

function processDailyAllowance() {
    if (!budgetData.lastProcessedDate) return;

    let lastDate = new Date(budgetData.lastProcessedDate);
    let today = new Date();
    today.setHours(0,0,0,0);
    
    let endDateObj = new Date(budgetData.endDate);
    endDateObj.setHours(0,0,0,0);

    let changed = false;

    if (lastDate < today && budgetData.wallet < 0) {
        budgetData.monthPool += budgetData.wallet; 
        budgetData.wallet = 0; 
        changed = true;
    }
    
    while(lastDate < today) {
        lastDate.setDate(lastDate.getDate() + 1);
        
        if (lastDate > endDateObj) break;

        let currentStr = getDateString(lastDate);
        let daysLeft = getDaysBetween(currentStr, budgetData.endDate) + 1;

        if (daysLeft > 0 && budgetData.monthPool > 0) {
            let allowance = budgetData.monthPool / daysLeft;
            budgetData.wallet += allowance;
            budgetData.monthPool -= allowance;
        }
        budgetData.lastProcessedDate = getDateString(lastDate);
        changed = true;
    }
    
    if (changed) saveData();
    updateUI();
}

function saveData() {
    localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
}

function updateUI() {
    document.getElementById('totalSavingsDisplay').innerText = formatMoney(Math.floor(budgetData.totalSavings));
    
    const limitDisplay = document.getElementById('dailyLimitDisplay');
    const walletVal = Math.floor(budgetData.wallet);
    limitDisplay.innerText = formatMoney(walletVal) + ' Kč';
    
    if (walletVal < 0) {
        limitDisplay.style.color = 'var(--danger)';
    } else {
        limitDisplay.style.color = 'var(--primary)';
    }

    const remainingTotal = budgetData.wallet + budgetData.monthPool;
    document.getElementById('remainingMonthDisplay').innerText = formatMoney(Math.floor(remainingTotal)) + ' Kč';

    const today = new Date();
    let daysLeft = getDaysBetween(getDateString(today), budgetData.endDate) + 1;
    if (daysLeft < 0) daysLeft = 0;
    
    document.getElementById('daysLeftDisplay').innerText = daysLeft;
    
    let nextDaysAvg = 0;
    if (daysLeft > 0) {
        nextDaysAvg = remainingTotal / daysLeft;
    }
    
    const nextDaysEl = document.getElementById('nextDaysDisplay');
    nextDaysEl.innerText = formatMoney(Math.floor(nextDaysAvg)) + ' Kč';
    
    if (nextDaysAvg <= 0) {
        nextDaysEl.style.color = 'var(--danger)';
    } else {
        nextDaysEl.style.color = 'var(--primary)';
    }

    renderExpenseList();
}

function renderExpenseList() {
    const listEl = document.getElementById('expenseList');
    listEl.innerHTML = '';
    
    if (budgetData.expenses.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; color: var(--text-muted); padding: 10px 0;">Zatím žádné výdaje.</li>';
        return;
    }

    const sorted = [...budgetData.expenses].sort((a, b) => b.id - a.id);

    sorted.forEach(item => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        
        const dateObj = new Date(item.date);
        const dateStr = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

        li.innerHTML = `
            <div class="expense-info">
                <strong>${item.desc}</strong>
                <small>${dateStr}</small>
            </div>
            <div class="expense-amount">
                -${formatMoney(item.amount)} Kč
                <button class="delete-btn" onclick="deleteExpense(${item.id})">&times;</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function formatMoney(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function saveIncome() {
    const val = parseFloat(document.getElementById('incomeInput').value);
    const sDate = document.getElementById('startDateInput').value;
    const eDate = document.getElementById('endDateInput').value;
    
    if (!val || val <= 0 || !sDate || !eDate) {
        alert('Vyplň všechny údaje (příjem i data).');
        return;
    }
    if (sDate > eDate) {
        alert('Konec období musí být stejný nebo pozdější než začátek.');
        return;
    }

    budgetData.income = val;
    budgetData.startDate = sDate;
    budgetData.endDate = eDate;
    budgetData.wallet = 0;
    budgetData.monthPool = val;
    
    let startD = new Date(sDate);
    startD.setDate(startD.getDate() - 1);
    budgetData.lastProcessedDate = getDateString(startD);
    
    document.getElementById('incomeModal').style.display = 'none';
    saveData();
    processDailyAllowance();
}

function addQuickExpense(description, manualAmount = null, manualDate = null) {
    const amountInput = document.getElementById('quickAmount');
    const amount = manualAmount || parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
        amountInput.style.borderColor = 'var(--danger)';
        setTimeout(() => amountInput.style.borderColor = 'var(--border-color)', 500);
        return;
    }

    budgetData.expenses.push({
        id: Date.now(),
        desc: description,
        amount: amount,
        date: manualDate || new Date().toISOString()
    });

    budgetData.wallet -= amount;

    amountInput.value = '';
    saveData();
    updateUI();
}

function deleteExpense(id) {
    if(confirm('Smazat tento výdaj? Peníze se ti vrátí do dnešního limitu.')) {
        const item = budgetData.expenses.find(i => i.id === id);
        if (item) {
            budgetData.wallet += item.amount;
            budgetData.expenses = budgetData.expenses.filter(i => i.id !== id);
            saveData();
            updateUI();
        }
    }
}

function openCustomModal(presetDesc = '') {
    const amount = document.getElementById('quickAmount').value;
    if(!amount) {
        alert("Nejdřív napiš částku nahoře!");
        return;
    }
    
    document.getElementById('customDate').value = getDateString(new Date());
    document.getElementById('customDesc').value = presetDesc;
    
    document.getElementById('customModal').style.display = 'flex';
    
    if (presetDesc) {
        document.getElementById('customDate').focus();
    } else {
        document.getElementById('customDesc').focus();
    }
}

function closeCustomModal() {
    document.getElementById('customModal').style.display = 'none';
}

function saveCustomExpense() {
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const desc = document.getElementById('customDesc').value.trim() || 'Různé';
    const dateVal = document.getElementById('customDate').value || new Date().toISOString();

    addQuickExpense(desc, amount, dateVal);
    closeCustomModal();
}

function openManageModal() {
    const currentWallet = Math.floor(budgetData.wallet);
    if (currentWallet <= 0) {
        alert("Dnes už v limitu nezbývají žádné peníze ke správě.");
        return;
    }
    document.getElementById('manageInput').value = currentWallet;
    document.getElementById('manageModal').style.display = 'flex';
}

function closeManageModal() {
    document.getElementById('manageModal').style.display = 'none';
}

function executeManage(actionType) {
    const val = parseFloat(document.getElementById('manageInput').value);
    
    if (!val || val <= 0 || val > budgetData.wallet) {
        alert("Zadej platnou částku do výše tvého dnešního limitu.");
        return;
    }

    if (actionType === 'rozpocitat') {
        budgetData.monthPool += val;
        budgetData.wallet -= val;
    } else if (actionType === 'usporit') {
        budgetData.totalSavings += val;
        budgetData.wallet -= val;
    }
    
    saveData();
    updateUI();
    closeManageModal();
}

function openSavingsModal() {
    document.getElementById('modalCurrentSavings').innerText = formatMoney(Math.floor(budgetData.totalSavings)) + ' Kč';
    document.getElementById('savingsManageInput').value = '';
    document.getElementById('savingsModal').style.display = 'flex';
}

function closeSavingsModal() {
    document.getElementById('savingsModal').style.display = 'none';
}

function addDirectToSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);
    const totalRemaining = budgetData.wallet + budgetData.monthPool;

    if (amount && amount > 0) {
        if (amount > totalRemaining) {
            alert('Tolik peněz ve svém aktuálním rozpočtu nemáš.');
            return;
        }
        
        budgetData.totalSavings += amount;

        if (amount <= budgetData.monthPool) {
            budgetData.monthPool -= amount;
        } else {
            const remainder = amount - budgetData.monthPool;
            budgetData.monthPool = 0;
            budgetData.wallet -= remainder;
        }

        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const today = new Date();
        const daysLeft = getDaysBetween(getDateString(today), budgetData.endDate) + 1;
        
        if (daysLeft > 0) {
            budgetData.wallet = totalRemainingAfter / daysLeft;
            budgetData.monthPool = totalRemainingAfter - budgetData.wallet;
            budgetData.lastProcessedDate = getDateString(today);
        }

        saveData();
        updateUI();
        closeSavingsModal();
    }
}

function withdrawDirectFromSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);

    if (amount && amount > 0) {
        if (amount > budgetData.totalSavings) {
            alert('Tolik peněz v úsporách nemáš.');
            return;
        }
        
        budgetData.totalSavings -= amount;
        budgetData.monthPool += amount; 
        
        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const today = new Date();
        const daysLeft = getDaysBetween(getDateString(today), budgetData.endDate) + 1;
        
        if (daysLeft > 0) {
            budgetData.wallet = totalRemainingAfter / daysLeft;
            budgetData.monthPool = totalRemainingAfter - budgetData.wallet;
            budgetData.lastProcessedDate = getDateString(today);
        }
        
        saveData();
        updateUI();
        closeSavingsModal();
    }
}

function openSettingsModal() {
    document.getElementById('editIncomeInput').value = budgetData.income;
    document.getElementById('editEndDateInput').value = budgetData.endDate;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

// ZMĚNA: Vše sjednoceno do jedné robustní funkce. Uloží a natvrdo přepočítá.
function saveEditedSettings() {
    const newIncomeInput = document.getElementById('editIncomeInput').value;
    const newEndDateInput = document.getElementById('editEndDateInput').value;
    
    const newIncome = parseFloat(newIncomeInput);
    const newEndDate = newEndDateInput;

    if (!newIncome || newIncome <= 0 || !newEndDate) {
        alert('Vyplň prosím správně příjem i datum konce.');
        return;
    }

    if (newEndDate < getDateString(new Date())) {
        alert('Nové datum konce nemůže být v minulosti.');
        return;
    }

    // Aplikace změn příjmu a data
    const difference = newIncome - budgetData.income;
    budgetData.income = newIncome;
    budgetData.monthPool += difference; 
    budgetData.endDate = newEndDate;
    
    // Okamžitý matematický přepočet podle nových dnů
    const totalRemaining = budgetData.wallet + budgetData.monthPool;
    const today = new Date();
    const daysLeft = getDaysBetween(getDateString(today), budgetData.endDate) + 1;
    
    if (daysLeft > 0) {
        budgetData.wallet = totalRemaining / daysLeft;
        budgetData.monthPool = totalRemaining - budgetData.wallet;
        budgetData.lastProcessedDate = getDateString(today);
    }
    
    saveData();
    updateUI();
    closeSettingsModal();
    
    alert('Nastavení uloženo. Zbývající peníze byly přepočítány na ' + daysLeft + ' dnů.');
}

function hardResetApp() {
    const overeni = prompt("⚠️ TOTO SMAŽE ÚPLNĚ VŠECHNA DATA!\n\nPokud opravdu chceš aplikaci vyresetovat a přijít o historii, napiš do pole níže slovo:\nSMAZAT");
    
    if (overeni === "SMAZAT") {
        localStorage.removeItem('myBudgetApp');
        localStorage.removeItem('myBudgetApp_v2');
        localStorage.removeItem('myBudgetApp_v3');
        localStorage.removeItem('myBudgetApp_v4');
        location.reload();
    } else if (overeni !== null) {
        alert("Zadán špatný text. Bezpečnostní pojistka smazání zrušila. Tvá data jsou v bezpečí.");
    }
}

initApp();