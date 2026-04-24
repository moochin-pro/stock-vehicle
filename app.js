let parts = JSON.parse(localStorage.getItem('parts')) || [];
let vehicles = JSON.parse(localStorage.getItem('vehicles')) || [];
let history = JSON.parse(localStorage.getItem('history')) || [];

let selV = null; let selP = null; let editIdx = -1; let editType = '';

// AUTH
function handleLogin() {
    if (document.getElementById('username').value === "thea" && document.getElementById('password').value === "cambo@123") {
        sessionStorage.setItem('auth', 'true'); location.reload();
    } else alert("Error Login");
}

// NAVIGATION
function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('bg-indigo-600'));
    const b = document.getElementById('nav-' + id.split('-')[1]);
    if(b) b.classList.add('bg-indigo-600');
    updateUI();
}

// ADJUST REPAIR QTY
function adjustQty(v) {
    let el = document.getElementById('fixQty');
    let val = parseInt(el.value) + v;
    if(val >= 1) el.value = val;
}

// LOG SERVICE
function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return alert("Select Vehicle and Part");
    if (parts[selP].qty < q) return alert("Low Stock!");

    parts[selP].qty -= q;
    history.push({
        date: new Date().toLocaleDateString(),
        month: new Date().getMonth(),
        plate: vehicles[selV].plate,
        partName: parts[selP].name,
        qty: q,
        cost: parts[selP].price * q
    });
    selV = null; selP = null;
    document.getElementById('sumV').innerText = "None Selected";
    document.getElementById('sumP').innerText = "None Selected";
    save();
}

// SMART REPORT EDIT (STOCK REVERSAL)
function editReportItem(idx) {
    const item = history[idx];
    const pIdx = parts.findIndex(p => p.name === item.partName);
    const oldQty = item.qty;
    const newQtyStr = prompt(`New Qty for ${item.partName}:`, oldQty);
    
    if (newQtyStr !== null && newQtyStr !== "") {
        const newQty = parseInt(newQtyStr);
        if (isNaN(newQty) || newQty < 1) return;

        if (pIdx !== -1) {
            const diff = oldQty - newQty;
            if (parts[pIdx].qty + diff < 0) return alert("Inventory too low to change!");
            parts[pIdx].qty += diff;
            item.cost = (item.cost / oldQty) * newQty;
            item.qty = newQty;
            save();
        } else {
            item.cost = (item.cost / oldQty) * newQty;
            item.qty = newQty;
            save();
        }
    }
}

function deleteReportItem(idx) {
    if(!confirm("Delete and return stock?")) return;
    const item = history[idx];
    const pIdx = parts.findIndex(p => p.name === item.partName);
    if(pIdx !== -1) parts[pIdx].qty += item.qty;
    history.splice(idx, 1);
    save();
}

// KHMER SUPPORT EXCEL EXPORT
function exportToCSV() {
    const now = new Date();
    let csv = "Date,Vehicle,Part,Qty,Cost\n";
    history.filter(h => h.month === now.getMonth()).forEach(h => {
        csv += `${h.date},${h.plate},${h.partName},${h.qty},${h.cost.toFixed(2)}\n`;
    });
    // BOM for Khmer Font in Excel
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Report_${now.getMonth()+1}.csv`;
    a.click();
}

// SAVE & UPDATE
function save() {
    localStorage.setItem('parts', JSON.stringify(parts));
    localStorage.setItem('vehicles', JSON.stringify(vehicles));
    localStorage.setItem('history', JSON.stringify(history));
    updateUI();
}

function updateUI() {
    const vQ = document.getElementById('vSearch').value.toLowerCase();
    const pQ = document.getElementById('pSearch').value.toLowerCase();

    // Vehicles List
    document.getElementById('vTable').innerHTML = vehicles.filter(v => v.plate.toLowerCase().includes(vQ)).map((v, i) => `
        <tr class="border-b last:border-0 hover:bg-slate-50 font-bold">
            <td class="p-6 text-indigo-600 font-black">${v.plate}</td>
            <td class="p-6 text-slate-500">${v.model}</td>
            <td class="p-6 text-right no-print">
                <button onclick="editType='vehicle';editIdx=${i};document.getElementById('vPlate').value='${v.plate}';document.getElementById('vModel').value='${v.model}';document.getElementById('btnVehicle').innerText='Update'" class="text-blue-500 mr-4 font-bold">Edit</button>
                <button onclick="vehicles.splice(${i},1);save()" class="text-red-400 font-bold">Del</button>
            </td>
        </tr>`).join('');

    // Inventory
    document.getElementById('partsList').innerHTML = parts.filter(p => p.name.toLowerCase().includes(pQ)).map((p, i) => `
        <tr class="border-b last:border-0 hover:bg-slate-50 font-bold">
            <td class="p-6 uppercase font-black">${p.name}</td>
            <td class="p-6 text-emerald-600">$${p.price.toFixed(2)}</td>
            <td class="p-6"><span class="px-2 py-1 rounded-lg ${p.qty < 5 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'} text-[10px] uppercase font-black">${p.qty} PCS</span></td>
            <td class="p-6 text-slate-300">$${(p.price*p.qty).toFixed(2)}</td>
            <td class="p-6 text-right">
                <button onclick="editType='part';editIdx=${i};document.getElementById('pName').value='${p.name}';document.getElementById('pPrice').value='${p.price}';document.getElementById('pQty').value='${p.qty}';document.getElementById('btnPart').innerText='Update Stock'" class="text-blue-500 mr-4 font-bold">Edit</button>
                <button onclick="parts.splice(${i},1);save()" class="text-red-400 font-bold">Del</button>
            </td>
        </tr>`).join('');

    // History
    let total = 0;
    document.getElementById('reportTable').innerHTML = history.filter(h => h.month === new Date().getMonth()).map((h, i) => {
        total += h.cost;
        return `<tr class="border-b last:border-0 hover:bg-slate-50">
            <td class="py-6 font-bold text-slate-400">${h.date}</td>
            <td class="font-black text-slate-900">${h.plate}</td>
            <td class="font-medium text-slate-600 uppercase">${h.partName}</td>
            <td class="font-black">${h.qty}</td>
            <td class="font-black text-indigo-600">$${h.cost.toFixed(2)}</td>
            <td class="no-print">
                <button onclick="editReportItem(${i})" class="text-indigo-500 mr-3 text-xs font-bold">EDIT</button>
                <button onclick="deleteReportItem(${i})" class="text-red-400 text-xs font-bold">DEL</button>
            </td>
        </tr>`;
    }).join('');
    
    document.getElementById('totalSpend').innerText = `$${total.toFixed(2)}`;
    document.getElementById('reportMonthName').innerText = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('reportDate').innerText = new Date().toLocaleDateString();
    filterFix();
}

// FILTER REPAIR WIZARD
function filterFix() {
    const vQ = document.getElementById('fixVSearch').value.toLowerCase();
    const pQ = document.getElementById('fixPSearch').value.toLowerCase();
    document.getElementById('fixVList').innerHTML = vehicles.map((v, i) => ({v, i})).filter(x => x.v.plate.toLowerCase().includes(vQ)).map(x => `<div onclick="selV=${x.i};updateUI()" class="p-4 border rounded-2xl cursor-pointer text-xs font-bold ${selV === x.i ? 'card-active' : 'bg-slate-50'}">${x.v.plate}</div>`).join('');
    document.getElementById('fixPList').innerHTML = parts.map((p, i) => ({p, i})).filter(x => x.p.name.toLowerCase().includes(pQ)).map(x => `<div onclick="selP=${x.i};updateUI()" class="p-4 border rounded-2xl cursor-pointer text-xs font-bold ${selP === x.i ? 'card-active' : 'bg-slate-50'}">${x.p.name} <span class="block text-slate-400">Stock: ${x.p.qty}</span></div>`).join('');
    if(selV !== null) document.getElementById('sumV').innerText = vehicles[selV].plate;
    if(selP !== null) document.getElementById('sumP').innerText = parts[selP].name;
}

function addVehicle() {
    const p = document.getElementById('vPlate').value.trim().toUpperCase();
    const m = document.getElementById('vModel').value.trim();
    if (p && m) {
        if (editType === 'vehicle') vehicles[editIdx] = { plate: p, model: m };
        else vehicles.push({ plate: p, model: m });
        resetEdit(); save();
    }
}

function addPart() {
    const n = document.getElementById('pName').value.trim();
    const pr = parseFloat(document.getElementById('pPrice').value);
    const q = parseInt(document.getElementById('pQty').value);
    if (n && !isNaN(pr) && !isNaN(q)) {
        if (editType === 'part') parts[editIdx] = { name: n, price: pr, qty: q };
        else parts.push({ name: n, price: pr, qty: q });
        resetEdit(); save();
    }
}

function resetEdit() { 
    editType = ''; editIdx = -1; document.getElementById('btnVehicle').innerText='Add New'; document.getElementById('btnPart').innerText='Save Stock';
    document.getElementById('vPlate').value=''; document.getElementById('vModel').value=''; document.getElementById('pName').value=''; document.getElementById('pPrice').value=''; document.getElementById('pQty').value='';
}

function logout() { sessionStorage.clear(); location.reload(); }
if (sessionStorage.getItem('auth') === 'true') {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    showPage('page-fix');
}