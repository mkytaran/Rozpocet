// --- PŘEPÍNÁNÍ MOTIVU (Světlý/Tmavý včetně navigačního proužku) ---
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    // Pokud meta značka v HTML náhodou chybí, vytvoříme ji dynamicky
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }

    const savedTheme = localStorage.getItem('budgetTheme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.textContent = '☀️';
        metaThemeColor.setAttribute('content', '#0f172a'); // Barva pozadí tmavého režimu
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeBtn) themeBtn.textContent = '🌙';
        metaThemeColor.setAttribute('content', '#f8fafc'); // Barva pozadí světlého režimu
    }
}

function toggleTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (root.getAttribute('data-theme') === 'dark') {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('budgetTheme', 'light');
        themeBtn.textContent = '🌙';
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#f8fafc'); // Světlé pozadí
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('budgetTheme', 'dark');
        themeBtn.textContent = '☀️';
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#0f172a'); // Tmavé pozadí
    }
}

initTheme();

function getDateString(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let budgetData = JSON.parse(localStorage.getItem('myBudgetApp_v3'));

if (!budgetData) {
    const oldDataV1 = JSON.parse(localStorage.getItem('myBudgetApp')); 
    
    if (oldDataV1 && oldDataV1.income > 0) {
        const totalExpenses = oldDataV1.expenses.reduce((sum, item) => sum + item.amount, 0);
        const remaining = oldDataV1.income - totalExpenses;
        
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        budgetData = {
            monthId: oldDataV1.monthId,
            income: oldDataV1.income,
            wallet: 0, 
            monthPool: remaining > 0 ? remaining : 0, 
            totalSavings: oldDataV1.totalSavings || 0,
            lastProcessedDate: getDateString(yesterday), 
            expenses: oldDataV1.expenses
        };
        localStorage.setItem('myBudgetApp_v3', JSON.stringify(budgetData));
    } else {
        budgetData = {
            monthId: '', income: 0, wallet: 0, monthPool: 0,
            totalSavings: 0, lastProcessedDate: '', expenses: []
        };
    }
}

function initApp() {
    const today = new Date();
    const currentMonthId = `${today.getFullYear()}-${today.getMonth() + 1}`;
    const todayStr = getDateString(today);

    if (budgetData.monthId !== currentMonthId) {
        if (budgetData.monthId !== '') {
            budgetData.totalSavings += (budgetData.wallet + budgetData.monthPool);
        }
        
        budgetData.monthId = currentMonthId;
        budgetData.income = 0;
        budgetData.wallet = 0;
        budgetData.monthPool = 0;
        budgetData.expenses = [];
        
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        budgetData.lastProcessedDate = getDateString(yesterday);
        
        saveData();
    }

    if (budgetData.income === 0) {
        document.getElementById('incomeModal').style.display = 'flex';
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
    } else if (action === 'dnesek') {
        // Zůstane ve wallet
    }
    
    document.getElementById('dailyActionModal').style.display = 'none';
    processDailyAllowance();
}

function processDailyAllowance() {
    if (!budgetData.lastProcessedDate) return;

    let parts = budgetData.lastProcessedDate.split('-');
    let lastDate = new Date(parts[0], parts[1]-1, parts[2]);
    let today = new Date();
    today.setHours(0,0,0,0);
    lastDate.setHours(0,0,0,0);

    let changed = false;
    
    while(lastDate < today) {
        lastDate.setDate(lastDate.getDate() + 1);
        let daysInMonth = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0).getDate();
        let currentDay = lastDate.getDate();
        let daysLeft = daysInMonth - currentDay + 1; 

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
    localStorage.setItem('myBudgetApp_v3', JSON.stringify(budgetData));
}

// --- VYKRESLOVÁNÍ OBRAZOVKY ---
function updateUI() {
    document.getElementById('totalSavingsDisplay').innerText = formatMoney(Math.floor(budgetData.totalSavings));
    
    // Zobrazení dnešního limitu (včetně barvení do červena, pokud jsi v mínusu)
    const limitDisplay = document.getElementById('dailyLimitDisplay');
    const walletVal = Math.floor(budgetData.wallet);
    limitDisplay.innerText = formatMoney(walletVal) + ' Kč';
    
    if (walletVal < 0) {
        limitDisplay.style.color = 'var(--danger)';
    } else {
        limitDisplay.style.color = 'var(--primary)';
    }

    // Zbývá celkově
    const remainingTotal = budgetData.wallet + budgetData.monthPool;
    document.getElementById('remainingMonthDisplay').innerText = formatMoney(Math.floor(remainingTotal)) + ' Kč';

    // Výpočet dnů
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - today.getDate() + 1;
    document.getElementById('daysLeftDisplay').innerText = daysLeft;
    
    // NOVÉ: Výpočet "Na další dny"
    let nextDaysAvg = 0;
    if (daysLeft > 0) {
        nextDaysAvg = remainingTotal / daysLeft;
    }
    document.getElementById('nextDaysDisplay').innerText = '(cca ' + formatMoney(Math.floor(nextDaysAvg)) + ' Kč / den)';

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
    if (val > 0) {
        budgetData.income = val;
        
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - today.getDate() + 1;
        
        const allowance = val / daysLeft;
        budgetData.wallet = allowance;
        budgetData.monthPool = val - allowance;
        budgetData.lastProcessedDate = getDateString(today);
        
        document.getElementById('incomeModal').style.display = 'none';
        saveData();
        updateUI();
    }
}

// ZMĚNA: Limit nyní padá přirozeně do mínusu, už ho nezastavujeme na nule!
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
            alert('Tolik peněz ve svém aktuálním rozpočtu na tento měsíc nemáš.');
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

        // NOVÉ: Okamžitý přepočet zbývajících peněz do dnů včetně dneška
        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - today.getDate() + 1;
        
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
        budgetData.monthPool += amount; // Přidá peníze zpět do oběhu
        
        // NOVÉ: Okamžitý přepočet do zbývajících dnů včetně dneška i po vrácení z úspor
        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - today.getDate() + 1;
        
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
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveEditedIncome() {
    const newIncome = parseFloat(document.getElementById('editIncomeInput').value);
    if (newIncome && newIncome > 0) {
        const difference = newIncome - budgetData.income;
        budgetData.income = newIncome;
        budgetData.monthPool += difference; 
        
        saveData();
        updateUI();
        alert('Měsíční rozpočet byl úspěšně upraven.');
    }
}

function forceRecalculate() {
    const totalRemaining = budgetData.wallet + budgetData.monthPool;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - today.getDate() + 1;
    
    if (daysLeft > 0) {
        budgetData.wallet = totalRemaining / daysLeft;
        budgetData.monthPool = totalRemaining - budgetData.wallet;
        budgetData.lastProcessedDate = getDateString(today);
        
        saveData();
        updateUI();
        alert('Rozpočet byl srovnán a spravedlivě rozpočítán na všechny zbývající dny.');
    }
    closeSettingsModal();
}

function hardResetApp() {
    const overeni = prompt("⚠️ TOTO SMAŽE ÚPLNĚ VŠECHNA DATA!\n\nPokud opravdu chceš aplikaci vyresetovat a přijít o historii, napiš do pole níže slovo:\nSMAZAT");
    
    if (overeni === "SMAZAT") {
        localStorage.removeItem('myBudgetApp');
        localStorage.removeItem('myBudgetApp_v2');
        localStorage.removeItem('myBudgetApp_v3');
        location.reload();
    } else if (overeni !== null) {
        alert("Zadán špatný text. Bezpečnostní pojistka smazání zrušila. Tvá data jsou v bezpečí.");
    }
}

initApp();