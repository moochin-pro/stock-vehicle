let parts = JSON.parse(localStorage.getItem('parts')) || [];
let vehicles = JSON.parse(localStorage.getItem('vehicles')) || [];
let history = JSON.parse(localStorage.getItem('history')) || [];
let selV = null, selP = null, editIdx = -1, editType = '';

function handleLogin() {
    if (document.getElementById('username').value === "thea" && document.getElementById('password').value === "cambo@123") {
        sessionStorage.setItem('auth', 'true'); location.reload();
    } else alert("Denied");
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

// --- EXPORT TOOLS ---
function exportInventoryExcel() {
    let table = document.getElementById("inventoryTable");
    let wb = XLSX.utils.table_to_book(table, {sheet: "Inventory", display: true});
    XLSX.writeFile(wb, "C21_Inventory.xlsx");
}

function exportReportExcel() {
    let table = document.getElementById("reportDataTable");
    let wb = XLSX.utils.table_to_book(table, {sheet: "Report"});
    XLSX.writeFile(wb, "C21_Operations_Report.xlsx");
}

function exportInventoryPDF() {
    const el = document.getElementById('inventory-pdf-area');
    html2pdf().set({ margin: 10, filename: 'C21_Inventory.pdf', html2canvas: { scale: 2, ignoreElements: (el) => el.classList.contains('action-col') }, jsPDF: { format: 'a4' } }).from(el).save();
}

function exportReportPDF() {
    const el = document.getElementById('report-pdf-area');
    html2pdf().set({ margin: 10, filename: 'C21_Report.pdf', html2canvas: { scale: 2, ignoreElements: (el) => el.classList.contains('action-col') }, jsPDF: { format: 'a4', orientation: 'landscape' } }).from(el).save();
}

// --- LOGIC ---
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
    }
}

function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return alert("Select Both");
    if (parts[selP].qty < q) return alert("Low Stock");
    const now = new Date();
    parts[selP].qty -= q;
    history.push({ 
        date: now.toLocaleDateString(), 
        month: now.getMonth(),
        plate: vehicles[selV].plate, 
        partName: parts[selP].name, 
        qty: q, 
        cost: parts[selP].price * q 
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

function updateUI() {
    const pQ = document.getElementById('pSearch').value.toLowerCase();
    const vQ = (document.getElementById('vSearch') || {value:''}).value.toLowerCase();
    const rQ = document.getElementById('reportSearch').value.toLowerCase();
    const invM = document.getElementById('inventoryMonthFilter').value;
    const rM = document.getElementById('reportMonthFilter').value;
    const sortM = (document.getElementById('reportSortMode') || {value:'date'}).value;

    // Inventory
    let fParts = parts.filter(p => p.name.toLowerCase().includes(pQ));
    if (invM !== 'all') fParts = fParts.filter(p => p.updateMonth == invM);
    document.getElementById('partsList').innerHTML = fParts.map((p) => `
        <tr class="border-b hover:bg-emerald-50 font-bold transition">
            <td class="p-6 uppercase">${p.name}<br><span class="text-[9px] text-emerald-600">Update: ${p.lastUpdate}</span></td>
            <td class="p-6 text-emerald-600 font-black">$${p.price.toFixed(2)}</td>
            <td class="p-6 text-center font-black">${p.qty} UNIT</td>
            <td class="p-6 text-slate-400 font-black">$${(p.price*p.qty).toFixed(2)}</td>
            <td class="p-6 text-right no-print action-col">
                <button onclick="editType='part';editIdx=${parts.indexOf(p)};document.getElementById('pName').value='${p.name}';document.getElementById('pPrice').value='${p.price}';document.getElementById('pQty').value='${p.qty}';updateUI()" class="text-sky-500 mr-4 text-[10px] uppercase">Edit</button>
            </td>
        </tr>`).join('');

    // Report
    let total = 0;
    let fHist = history.map((h, idx) => {
        const vInfo = vehicles.find(v => v.plate === h.plate);
        return { ...h, model: vInfo ? vInfo.model : "N/A", originalIdx: idx };
    });
    if (rM !== 'all') fHist = fHist.filter(h => h.month == rM);
    fHist = fHist.filter(h => h.plate.toLowerCase().includes(rQ) || h.model.toLowerCase().includes(rQ) || h.partName.toLowerCase().includes(rQ));
    
    document.getElementById('reportTable').innerHTML = fHist.map((h) => {
        total += h.cost;
        const curP = parts.find(p => p.name === h.partName);
        return `<tr class="border-b font-bold"><td class="py-4 text-slate-400 text-[9px] uppercase">${h.date}</td><td class="font-black uppercase">${h.plate}</td><td class="text-emerald-600 text-[9px] uppercase">${h.model}</td><td class="text-slate-600 text-xs uppercase">${h.partName}</td><td class="text-center">${h.qty}</td><td class="text-sky-500 text-center font-black">${curP ? curP.qty : '0'}</td><td class="font-black">$${h.cost.toFixed(2)}</td><td class="action-col no-print"><button onclick="deleteReport(${h.originalIdx})" class="text-red-400 text-[9px] font-black uppercase">Cancel</button></td></tr>`;
    }).join('');
    document.getElementById('totalSpend').innerText = `$${total.toFixed(2)}`;

    // Assets
    const vTable = document.getElementById('vTable');
    if(vTable) vTable.innerHTML = vehicles.filter(v => v.plate.toLowerCase().includes(vQ)).map((v) => `<tr class="border-b font-bold"><td class="p-6 text-sky-600 uppercase">${v.plate}</td><td class="p-6 uppercase text-[11px]">${v.model}</td><td class="p-6 text-right no-print action-col"><button onclick="editType='vehicle';editIdx=${vehicles.indexOf(v)};document.getElementById('vPlate').value='${v.plate}';document.getElementById('vModel').value='${v.model}';updateUI()" class="text-emerald-500 mr-4 text-[10px] uppercase">Edit</button></td></tr>`).join('');
    
    filterFix();
}

function filterFix() {
    const vQ = document.getElementById('fixVSearch').value.toLowerCase();
    const pQ = document.getElementById('fixPSearch').value.toLowerCase();
    document.getElementById('fixVList').innerHTML = vehicles.filter(v => v.plate.toLowerCase().includes(vQ)).map((v) => `<div onclick="selV=${vehicles.indexOf(v)};updateUI()" class="p-3 border rounded-xl cursor-pointer ${selV === vehicles.indexOf(v) ? 'card-active' : 'bg-white'}"><p class="font-black uppercase text-sm">${v.plate}</p></div>`).join('');
    document.getElementById('fixPList').innerHTML = parts.filter(p => p.name.toLowerCase().includes(pQ)).map((p) => `<div onclick="selP=${parts.indexOf(p)};updateUI()" class="p-3 border rounded-xl cursor-pointer ${selP === parts.indexOf(p) ? 'card-active' : 'bg-white'}"><p class="font-black uppercase text-xs">${p.name} ($${p.price})</p></div>`).join('');
    if(selV !== null) document.getElementById('sumV').innerText = vehicles[selV].plate;
    if(selP !== null) document.getElementById('sumP').innerText = parts[selP].name;
}

function save() { localStorage.setItem('parts', JSON.stringify(parts)); localStorage.setItem('vehicles', JSON.stringify(vehicles)); localStorage.setItem('history', JSON.stringify(history)); updateUI(); }
function logout() { sessionStorage.clear(); location.reload(); }
function resetEdit() { editType = ''; editIdx = -1; document.getElementById('vPlate').value=''; document.getElementById('vModel').value=''; document.getElementById('pName').value=''; document.getElementById('pPrice').value=''; document.getElementById('pQty').value=''; }

if (sessionStorage.getItem('auth') === 'true') { document.getElementById('loginOverlay').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); showPage('page-fix'); }