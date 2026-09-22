// --- KONFIGURACE BACKENDU ---
const API_URL = "https://script.google.com/macros/s/AKfycbx9BAsEWP3exm4LeraEDgxbActd_-6pXlIUSpMH1mlqLjs3c_7IiXa37KOxMCMc3May/exec";
let USER_ID = localStorage.getItem('budgetUserId') || '';
let USER_PIN = localStorage.getItem('budgetUserPin') || '';

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

// --- POMOCNÉ FUNKCE PRO DATUM ---
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
            startDate: firstDayStr, endDate: getDateString(lastDay),
            income: oldDataV3.income, wallet: oldDataV3.wallet, monthPool: oldDataV3.monthPool,
            totalSavings: oldDataV3.totalSavings || 0,
            lastProcessedDate: oldDataV3.lastProcessedDate,
            expenses: oldDataV3.expenses || [], lastUpdated: Date.now()
        };
    } else {
        budgetData = {
            startDate: '', endDate: '', income: 0, wallet: 0, monthPool: 0,
            totalSavings: 0, lastProcessedDate: '', expenses: [], lastUpdated: Date.now()
        };
    }
    localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
}

function initApp() {
    const today = new Date();
    const todayStr = getDateString(today);

    // BEZPEČNÉ POROVNÁNÍ DAT (místo textu porovnáme reálný čas)
    if (budgetData.endDate) {
        let endObj = new Date(budgetData.endDate);
        endObj.setHours(23, 59, 59); // Nastavíme na úplný konec daného dne
        
        if (today > endObj) {
            budgetData.totalSavings += (Math.max(0, budgetData.wallet) + budgetData.monthPool);
            budgetData.income = 0; budgetData.wallet = 0; budgetData.monthPool = 0;
            budgetData.expenses = []; budgetData.startDate = ''; budgetData.endDate = ''; budgetData.lastProcessedDate = '';
            saveData();
        }
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

// --- CLOUD A DATA LOGIKA ---
let autoSyncTimeout;
function autoSaveToCloudSilent() {
    if (!API_URL || API_URL.includes("SEM_VLOZ") || !USER_ID || !USER_PIN) return;
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = setTimeout(async () => {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ userId: USER_ID, pin: USER_PIN, action: 'save', data: budgetData })
            });
        } catch (e) { console.error("☁️ Auto-save selhal:", e); }
    }, 3000); 
}

function saveData() {
    budgetData.lastUpdated = Date.now();
    localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
    autoSaveToCloudSilent();
}

// --- VYKRESLOVÁNÍ OBRAZOVKY ---
function updateUI() {
    document.getElementById('totalSavingsDisplay').innerText = formatMoney(Math.floor(budgetData.totalSavings));
    const limitDisplay = document.getElementById('dailyLimitDisplay');
    const walletVal = Math.floor(budgetData.wallet);
    limitDisplay.innerText = formatMoney(walletVal) + ' Kč';
    limitDisplay.style.color = walletVal < 0 ? 'var(--danger)' : 'var(--primary)';

    const remainingTotal = budgetData.wallet + budgetData.monthPool;
    document.getElementById('remainingMonthDisplay').innerText = formatMoney(Math.floor(remainingTotal)) + ' Kč';

    const today = new Date();
    let daysLeft = Math.max(0, getDaysBetween(getDateString(today), budgetData.endDate) + 1);
    document.getElementById('daysLeftDisplay').innerText = daysLeft;
    
    let nextDaysAvg = daysLeft > 0 ? (remainingTotal / daysLeft) : 0;
    const nextDaysEl = document.getElementById('nextDaysDisplay');
    nextDaysEl.innerText = formatMoney(Math.floor(nextDaysAvg)) + ' Kč';
    nextDaysEl.style.color = nextDaysAvg <= 0 ? 'var(--danger)' : 'var(--primary)';

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
            <div class="expense-info"><strong>${item.desc}</strong><small>${dateStr}</small></div>
            <div class="expense-amount">-${formatMoney(item.amount)} Kč<button class="delete-btn" onclick="deleteExpense(${item.id})">&times;</button></div>
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
    
    if (!val || val <= 0 || !sDate || !eDate) return alert('Vyplň všechny údaje.');
    if (sDate > eDate) return alert('Konec období musí být stejný nebo pozdější než začátek.');

    budgetData.income = val; budgetData.startDate = sDate; budgetData.endDate = eDate;
    budgetData.wallet = 0; budgetData.monthPool = val;
    
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

    budgetData.expenses.push({ id: Date.now(), desc: description, amount: amount, date: manualDate || new Date().toISOString() });
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
    if(!amount) return alert("Nejdřív napiš částku nahoře!");
    document.getElementById('customDate').value = getDateString(new Date());
    document.getElementById('customDesc').value = presetDesc;
    document.getElementById('customModal').style.display = 'flex';
    if (presetDesc) document.getElementById('customDate').focus();
    else document.getElementById('customDesc').focus();
}

function closeCustomModal() { document.getElementById('customModal').style.display = 'none'; }

function saveCustomExpense() {
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const desc = document.getElementById('customDesc').value.trim() || 'Různé';
    addQuickExpense(desc, amount, document.getElementById('customDate').value || new Date().toISOString());
    closeCustomModal();
}

function openManageModal() {
    const currentWallet = Math.floor(budgetData.wallet);
    if (currentWallet <= 0) return alert("Dnes už v limitu nezbývají žádné peníze ke správě.");
    document.getElementById('manageInput').value = currentWallet;
    document.getElementById('manageModal').style.display = 'flex';
}

function closeManageModal() { document.getElementById('manageModal').style.display = 'none'; }

function executeManage(actionType) {
    const val = parseFloat(document.getElementById('manageInput').value);
    if (!val || val <= 0 || val > budgetData.wallet) return alert("Zadej platnou částku do výše tvého dnešního limitu.");

    if (actionType === 'rozpocitat') {
        budgetData.monthPool += val; budgetData.wallet -= val;
    } else if (actionType === 'usporit') {
        budgetData.totalSavings += val; budgetData.wallet -= val;
    }
    saveData(); updateUI(); closeManageModal();
}

function openSavingsModal() {
    document.getElementById('modalCurrentSavings').innerText = formatMoney(Math.floor(budgetData.totalSavings)) + ' Kč';
    document.getElementById('savingsManageInput').value = '';
    document.getElementById('savingsModal').style.display = 'flex';
}
function closeSavingsModal() { document.getElementById('savingsModal').style.display = 'none'; }

function addDirectToSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);
    const totalRemaining = budgetData.wallet + budgetData.monthPool;

    if (amount && amount > 0) {
        if (amount > totalRemaining) return alert('Tolik peněz ve svém aktuálním rozpočtu nemáš.');
        
        budgetData.totalSavings += amount;
        if (amount <= budgetData.monthPool) {
            budgetData.monthPool -= amount;
        } else {
            const remainder = amount - budgetData.monthPool;
            budgetData.monthPool = 0; budgetData.wallet -= remainder;
        }

        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const daysLeft = getDaysBetween(getDateString(new Date()), budgetData.endDate) + 1;
        
        if (daysLeft > 0) {
            budgetData.wallet = totalRemainingAfter / daysLeft;
            budgetData.monthPool = totalRemainingAfter - budgetData.wallet;
            budgetData.lastProcessedDate = getDateString(new Date());
        }
        saveData(); updateUI(); closeSavingsModal();
    }
}

function withdrawDirectFromSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);
    if (amount && amount > 0) {
        if (amount > budgetData.totalSavings) return alert('Tolik peněz v úsporách nemáš.');
        
        budgetData.totalSavings -= amount;
        budgetData.monthPool += amount; 
        
        const totalRemainingAfter = budgetData.wallet + budgetData.monthPool;
        const daysLeft = getDaysBetween(getDateString(new Date()), budgetData.endDate) + 1;
        
        if (daysLeft > 0) {
            budgetData.wallet = totalRemainingAfter / daysLeft;
            budgetData.monthPool = totalRemainingAfter - budgetData.wallet;
            budgetData.lastProcessedDate = getDateString(new Date());
        }
        saveData(); updateUI(); closeSavingsModal();
    }
}

function openSettingsModal() {
    document.getElementById('editIncomeInput').value = budgetData.income;
    document.getElementById('editEndDateInput').value = budgetData.endDate;
    document.getElementById('editUserId').value = USER_ID;
    document.getElementById('editUserPin').value = USER_PIN;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }

function saveEditedSettings() {
    const newIncome = parseFloat(document.getElementById('editIncomeInput').value);
    const newEndDate = document.getElementById('editEndDateInput').value;

    if (!newIncome || newIncome <= 0 || !newEndDate) return alert('Vyplň prosím správně příjem i datum konce.');
    if (newEndDate < getDateString(new Date())) return alert('Nové datum konce nemůže být v minulosti.');

    const difference = newIncome - budgetData.income;
    budgetData.income = newIncome;
    budgetData.monthPool += difference; 
    budgetData.endDate = newEndDate;
    
    const totalRemaining = budgetData.wallet + budgetData.monthPool;
    const daysLeft = getDaysBetween(getDateString(new Date()), budgetData.endDate) + 1;
    
    if (daysLeft > 0) {
        budgetData.wallet = totalRemaining / daysLeft;
        budgetData.monthPool = totalRemaining - budgetData.wallet;
        budgetData.lastProcessedDate = getDateString(new Date());
    }
    
    saveData(); updateUI(); closeSettingsModal();
    alert('Rozpočet uloženo. Zbývající peníze byly přepočítány na ' + daysLeft + ' dnů.');
}

async function saveToCloud(event) {
    if (!API_URL || API_URL.includes("SEM_VLOZ")) return alert("Chybí API URL z Google Apps Scriptu!");
    
    // Přímé uložení PINu bez nutnosti měnit rozpočet
    const uid = document.getElementById('editUserId').value.trim();
    const upin = document.getElementById('editUserPin').value.trim();
    if (!uid || !upin) return alert("Nejprve vyplň Jméno a PIN do políček výše!");
    
    USER_ID = uid; USER_PIN = upin;
    localStorage.setItem('budgetUserId', uid);
    localStorage.setItem('budgetUserPin', upin);
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Ukládám..."; btn.disabled = true;

    try {
        budgetData.lastUpdated = Date.now();
        localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData)); 
        const response = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ userId: USER_ID, pin: USER_PIN, action: 'save', data: budgetData })
        });
        const result = await response.json();
        if (result.status === 'success') btn.innerText = "✅ Uloženo";
        else throw new Error(result.error);
    } catch (e) {
        alert("Chyba při ukládání: " + e.message); btn.innerText = "❌ Chyba";
    }
    setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
}

async function loadFromCloud(event) {
    if (!API_URL || API_URL.includes("SEM_VLOZ")) return alert("Chybí API URL!");
    
    // Na novém PC stačí jen vyplnit políčka a kliknout sem. Přečtou a uloží se sama!
    const uid = document.getElementById('editUserId').value.trim();
    const upin = document.getElementById('editUserPin').value.trim();
    if (!uid || !upin) return alert("Nejprve vyplň Jméno a PIN pro obnovu ze zálohy!");
    
    USER_ID = uid; USER_PIN = upin;
    localStorage.setItem('budgetUserId', uid);
    localStorage.setItem('budgetUserPin', upin);
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Načítám..."; btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ userId: USER_ID, pin: USER_PIN, action: 'load' })
        });
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            // Varování zjednodušeno pro čistý start na novém PC
            if (budgetData.lastUpdated && budgetData.income > 0 && result.data.lastUpdated < budgetData.lastUpdated) {
                if(!confirm("⚠️ Pozor: V tomto zařízení máš rozpracovaný rozpočet. Chceš ho opravdu přepsat daty z cloudu?")) {
                    btn.innerText = originalText; btn.disabled = false; return;
                }
            }
            budgetData = result.data;
            localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
            updateUI();
            btn.innerText = "✅ Načteno";
            setTimeout(() => { btn.innerText = originalText; btn.disabled = false; closeSettingsModal(); location.reload(); }, 1000);
            return;
        } else if (result.status === 'empty') {
            alert("V cloudu zatím nejsou žádná data pro tohoto uživatele.");
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        alert("Chyba při stahování: " + e.message); btn.innerText = "❌ Chyba";
    }
    setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
}

// --- CLOUD TLAČÍTKA A FORCE UPDATE ---
async function saveToCloud(event) {
    if (!API_URL || API_URL.includes("SEM_VLOZ")) return alert("Chybí API URL z Google Apps Scriptu!");
    if (!USER_ID || !USER_PIN) return alert("Nejprve vyplň Jméno a PIN, a klikni na 'Uložit a srovnat limity'!");
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Ukládám..."; btn.disabled = true;

    try {
        budgetData.lastUpdated = Date.now();
        localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData)); 
        const response = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ userId: USER_ID, pin: USER_PIN, action: 'save', data: budgetData })
        });
        const result = await response.json();
        if (result.status === 'success') btn.innerText = "✅ Uloženo";
        else throw new Error(result.error);
    } catch (e) {
        alert("Chyba při ukládání: " + e.message); btn.innerText = "❌ Chyba";
    }
    setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
}

async function loadFromCloud(event) {
    if (!API_URL || API_URL.includes("SEM_VLOZ")) return alert("Chybí API URL!");
    if (!USER_ID || !USER_PIN) return alert("Nejprve vyplň Jméno a PIN, a klikni na 'Uložit a srovnat limity'!");
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Načítám..."; btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ userId: USER_ID, pin: USER_PIN, action: 'load' })
        });
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            if (budgetData.lastUpdated && result.data.lastUpdated < budgetData.lastUpdated) {
                if(!confirm("⚠️ Lokální data v telefonu jsou novější než v cloudu. Opravdu je chceš přepsat?")) {
                    btn.innerText = originalText; btn.disabled = false; return;
                }
            }
            budgetData = result.data;
            localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
            updateUI();
            btn.innerText = "✅ Načteno";
            setTimeout(() => { btn.innerText = originalText; btn.disabled = false; closeSettingsModal(); }, 1000);
            return;
        } else if (result.status === 'empty') {
            alert("V cloudu zatím nejsou žádná data pro tohoto uživatele.");
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        alert("Chyba při stahování: " + e.message); btn.innerText = "❌ Chyba";
    }
    setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
}

function forceUpdateApp(event) {
    if (event) {
        event.target.innerText = "⏳ Stahuji novou verzi...";
        event.target.disabled = true;
    }
    window.location.href = window.location.pathname + '?v=' + Date.now();
}

function logoutApp() {
    // Pro jistotu se uživatele zeptáme, aby nepřišel o neuložená data
    if (confirm("Opravdu se chceš odhlásit?\n\nZ bezpečnostních důvodů budou data rozpočtu z tohoto zařízení odstraněna (v cloudu samozřejmě zůstanou).\n\nUjisti se, že máš nejnovější změny zazálohované!")) {
        
        // Vymažeme přihlašovací údaje i data z paměti telefonu/prohlížeče
        localStorage.removeItem('budgetUserId');
        localStorage.removeItem('budgetUserPin');
        localStorage.removeItem('myBudgetApp_v4');
        
        // Vynulujeme proměnné
        USER_ID = '';
        USER_PIN = '';
        budgetData = null;
        
        // Znovu načteme stránku, což automaticky vyvolá přihlašovací okno
        location.reload();
    }
}

function hardResetApp() {
    const overeni = prompt("⚠️ TOTO SMAŽE ÚPLNĚ VŠECHNA DATA V TELEFONU!\n\n(Záloha v cloudu zůstane nedotčená)\nNapiš do pole níže slovo:\nSMAZAT");
    if (overeni === "SMAZAT") {
        localStorage.clear();
        location.reload();
    } else if (overeni !== null) {
        alert("Zadán špatný text. Bezpečnostní pojistka smazání zrušila.");
    }
}

// --- STARTOVACÍ LOGIKA (LOGIN FIRST) ---

// Zjistíme, jestli už je uživatel přihlášený z minula
function checkLoginState() {
    if (USER_ID && USER_PIN) {
        // Pokud údaje má, rovnou spouštíme aplikaci
        document.getElementById('loginModal').style.display = 'none';
        initApp();
    } else {
        // Pokud nemá (nové PC/mobil), ukážeme přihlašovací okno
        document.getElementById('loginModal').style.display = 'flex';
    }
}

// Funkce volaná tlačítkem "Vstoupit" na přihlašovací obrazovce
async function performLogin(event) {
    if (!API_URL || API_URL.includes("SEM_VLOZ")) return alert("V kódu chybí API URL z Google Apps Scriptu!");
    
    const uid = document.getElementById('loginUserId').value.trim();
    const upin = document.getElementById('loginUserPin').value.trim();
    
    if (!uid || !upin) return alert("Vyplň Jméno i PIN.");
    
    const btn = event.target;
    btn.innerText = "⏳ Připojuji k serveru...";
    btn.disabled = true;

    try {
        // Zkusíme stáhnout data z cloudu pro toto jméno a PIN
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ userId: uid, pin: upin, action: 'load' })
        });
        
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            // Úspěch: Uživatel existuje a má data. Uložíme a spustíme.
            budgetData = result.data;
            localStorage.setItem('myBudgetApp_v4', JSON.stringify(budgetData));
            
        } else if (result.status === 'empty') {
            // Úspěch: Uživatel vytvořen (nebo je prázdný), pokračujeme s čistým štítem
            // Nezapisujeme přes stará data nic, initApp si vyžádá Nový rozpočet
            
        } else {
            // Chyba: Typicky špatný PIN
            throw new Error(result.error);
        }

        // Pokud jsme došli sem, heslo bylo správné (nebo účet vznikl).
        // Bezpečně uložíme přihlašovací údaje do telefonu
        USER_ID = uid;
        USER_PIN = upin;
        localStorage.setItem('budgetUserId', uid);
        localStorage.setItem('budgetUserPin', upin);
        
        document.getElementById('loginModal').style.display = 'none';
        initApp(); // Spustíme aplikaci

    } catch (e) {
        alert("Chyba přihlášení: " + e.message);
        btn.innerText = "Vstoupit / Vytvořit účet";
        btn.disabled = false;
    }
}

// Odstartování kontroly místo původního natvrdého spuštění
checkLoginState();