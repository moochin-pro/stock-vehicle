let parts = JSON.parse(localStorage.getItem('parts')) || [];
let vehicles = JSON.parse(localStorage.getItem('vehicles')) || [];
let history = JSON.parse(localStorage.getItem('history')) || [];
let selV = null, selP = null, editIdx = -1, editType = '';

function handleLogin() {
    if (document.getElementById('username').value === "thea" && document.getElementById('password').value === "cambo@123") {
        sessionStorage.setItem('auth', 'true'); location.reload();
    } else alert("Access Denied");
}

function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('bg-emerald-500', 'shadow-lg'));
    const b = document.getElementById('nav-' + id.split('-')[1]);
    if(b) b.classList.add('bg-emerald-500', 'shadow-lg');
    updateUI();
}

function adjustQty(v) {
    let el = document.getElementById('fixQty');
    let val = parseInt(el.value) + v;
    if(val >= 1) el.value = val;
}

// --- CORE FUNCTIONS ---
function addPart() {
    const n = document.getElementById('pName').value.trim();
    const pr = parseFloat(document.getElementById('pPrice').value);
    const q = parseInt(document.getElementById('pQty').value);
    const now = new Date();
    
    if (n && !isNaN(pr) && !isNaN(q)) {
        if (editType === 'part') {
            parts[editIdx] = { name: n, price: pr, qty: q, lastUpdate: now.toLocaleDateString(), updateMonth: now.getMonth() };
        } else {
            const existIdx = parts.findIndex(p => p.name.toLowerCase() === n.toLowerCase() && p.price === pr);
            if (existIdx !== -1) {
                parts[existIdx].qty += q;
                parts[existIdx].lastUpdate = now.toLocaleDateString();
                parts[existIdx].updateMonth = now.getMonth();
            } else {
                parts.push({ name: n, price: pr, qty: q, lastUpdate: now.toLocaleDateString(), updateMonth: now.getMonth() });
            }
        }
        resetEdit(); save();
    } else alert("Complete all fields");
}

function addVehicle() {
    const p = document.getElementById('vPlate').value.trim().toUpperCase();
    const m = document.getElementById('vModel').value.trim();
    if (p && m) {
        const isDuplicate = vehicles.some((v, idx) => v.plate === p && idx !== editIdx);
        if (isDuplicate) return alert("Plate Number already exists!");

        if (editType === 'vehicle') vehicles[editIdx] = { plate: p, model: m };
        else vehicles.push({ plate: p, model: m });
        resetEdit(); save();
    } else alert("Fill Plate and Model");
}

function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return alert("Select Vehicle and Part");
    if (parts[selP].qty < q) return alert("Low Stock");
    
    const now = new Date();
    parts[selP].qty -= q;
    history.push({ 
        date: now.toLocaleDateString(), month: now.getMonth(),
        plate: vehicles[selV].plate, partName: parts[selP].name, 
        qty: q, cost: parts[selP].price * q 
    });
    selV = null; selP = null; document.getElementById('fixQty').value = 1; save();
}

function deleteReport(actualIdx) {
    const entry = history[actualIdx];
    if (confirm(`Cancel and return ${entry.qty} units to stock?`)) {
        const unitPrice = entry.cost / entry.qty;
        const pIdx = parts.findIndex(p => p.name === entry.partName && p.price === unitPrice);
        if (pIdx !== -1) parts[pIdx].qty += entry.qty;
        else parts.push({ name: entry.partName, price: unitPrice, qty: entry.qty, lastUpdate: new Date().toLocaleDateString(), updateMonth: new Date().getMonth() });
        history.splice(actualIdx, 1);
        save();
    }
}

// --- UI UPDATE ---
function updateUI() {
    const invM = document.getElementById('inventoryMonthFilter').value;
    const repM = document.getElementById('reportMonthFilter').value;
    const repS = (document.getElementById('reportSearch') || {value:''}).value.toLowerCase();

    // Inventory Rendering (Separate Columns for Excel Compatibility)
    let fParts = parts;
    if (invM !== 'all') fParts = parts.filter(p => p.updateMonth == invM);
    document.getElementById('partsList').innerHTML = fParts.map((p) => `
        <tr class="border-b font-bold hover:bg-emerald-50">
            <td class="p-6 uppercase">${p.name}</td>
            <td class="p-6 text-[11px] text-slate-500">${p.lastUpdate}</td>
            <td class="p-6 text-emerald-600 font-black">$${p.price.toFixed(2)}</td>
            <td class="p-6 text-center font-black">${p.qty} UNIT</td>
            <td class="p-6 text-slate-400 font-black">$${(p.price*p.qty).toFixed(2)}</td>
            <td class="p-6 text-right no-print action-col">
                <button onclick="editType='part';editIdx=${parts.indexOf(p)};document.getElementById('pName').value='${p.name}';document.getElementById('pPrice').value='${p.price}';document.getElementById('pQty').value='${p.qty}';updateUI()" class="text-sky-500 mr-4 text-[10px] uppercase">Edit</button>
                <button onclick="if(confirm('Delete?')){parts.splice(${parts.indexOf(p)},1);save();}" class="text-red-400 text-[10px] uppercase">Del</button>
            </td>
        </tr>`).join('');

    // Asset Rendering
    document.getElementById('vTable').innerHTML = vehicles.map((v, idx) => `
        <tr class="border-b font-bold hover:bg-sky-50">
            <td class="p-6 text-sky-600 uppercase">${v.plate}</td>
            <td class="p-6 uppercase text-[11px]">${v.model}</td>
            <td class="p-6 text-right no-print action-col">
                <button onclick="editType='vehicle';editIdx=${idx};document.getElementById('vPlate').value='${v.plate}';document.getElementById('vModel').value='${v.model}';updateUI()" class="text-emerald-500 mr-4 text-[10px] uppercase">Edit</button>
                <button onclick="if(confirm('Delete?')){vehicles.splice(${idx},1);save();}" class="text-red-400 text-[10px] uppercase">Del</button>
            </td>
        </tr>`).join('');

    // Report Rendering
    let total = 0;
    let fHist = history.map((h, idx) => {
        const v = vehicles.find(v => v.plate === h.plate);
        return { ...h, model: v ? v.model : "N/A", originalIdx: idx };
    });
    if (repM !== 'all') fHist = fHist.filter(h => h.month == repM);
    fHist = fHist.filter(h => h.plate.toLowerCase().includes(repS) || h.model.toLowerCase().includes(repS) || h.partName.toLowerCase().includes(repS));

    document.getElementById('reportTable').innerHTML = fHist.map((h) => {
        total += h.cost;
        const curP = parts.find(p => p.name === h.partName);
        return `<tr class="border-b font-bold"><td class="py-4 text-slate-400 text-[9px] uppercase">${h.date}</td><td class="font-black uppercase">${h.plate}</td><td class="text-emerald-600 text-[9px] uppercase">${h.model}</td><td class="text-slate-600 text-xs uppercase">${h.partName}</td><td class="text-center">${h.qty}</td><td class="text-sky-500 text-center font-black">${curP ? curP.qty : '0'}</td><td class="font-black">$${h.cost.toFixed(2)}</td><td class="action-col no-print"><button onclick="deleteReport(${h.originalIdx})" class="text-red-400 text-[9px] font-black uppercase">Cancel</button></td></tr>`;
    }).join('');
    document.getElementById('totalSpend').innerText = `$${total.toFixed(2)}`;
    filterFix();
}

function filterFix() {
    const vQ = document.getElementById('fixVSearch').value.toLowerCase();
    const pQ = document.getElementById('fixPSearch').value.toLowerCase();
    document.getElementById('fixVList').innerHTML = vehicles.filter(v => v.plate.toLowerCase().includes(vQ)).map((v) => `
        <div onclick="selV=${vehicles.indexOf(v)};updateUI()" class="p-3 border rounded-xl cursor-pointer flex justify-between items-center ${selV === vehicles.indexOf(v) ? 'card-active' : 'bg-white hover:bg-slate-50'}">
            <p class="font-black uppercase text-sm">${v.plate}</p><p class="text-[9px] text-slate-400 uppercase">${v.model}</p></div>`).join('');
    document.getElementById('fixPList').innerHTML = parts.filter(p => p.name.toLowerCase().includes(pQ)).map((p) => `
        <div onclick="selP=${parts.indexOf(p)};updateUI()" class="p-3 border rounded-xl cursor-pointer flex justify-between items-center ${selP === parts.indexOf(p) ? 'card-active' : 'bg-white hover:bg-slate-50'}">
            <p class="font-black uppercase text-xs">${p.name}</p><p class="font-bold text-sky-500 text-[10px] uppercase">Stock: ${p.qty}</p></div>`).join('');
    if(selV !== null) document.getElementById('sumV').innerText = vehicles[selV].plate;
    if(selP !== null) document.getElementById('sumP').innerText = parts[selP].name;
}

// --- EXPORTS ---
function exportInventoryExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("inventoryTable")), "C21_Inventory.xlsx"); }
function exportReportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("reportDataTable")), "C21_Report.xlsx"); }

function save() { localStorage.setItem('parts', JSON.stringify(parts)); localStorage.setItem('vehicles', JSON.stringify(vehicles)); localStorage.setItem('history', JSON.stringify(history)); updateUI(); }
function resetEdit() { editType = ''; editIdx = -1; document.getElementById('vPlate').value=''; document.getElementById('vModel').value=''; document.getElementById('pName').value=''; document.getElementById('pPrice').value=''; document.getElementById('pQty').value=''; }
function logout() { sessionStorage.clear(); location.reload(); }
if (sessionStorage.getItem('auth') === 'true') { document.getElementById('loginOverlay').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); showPage('page-fix'); }