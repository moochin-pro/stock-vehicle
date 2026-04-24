let parts = [], vehicles = [], history = [];
let selV = null, selP = null, editIdx = -1, editType = '';

// --- AUTH ---
function handleLogin() {
    if (document.getElementById('username').value === "thea" && document.getElementById('password').value === "cambo@123") {
        sessionStorage.setItem('auth', 'true'); location.reload();
    } else alert("Access Denied");
}

// --- FIREBASE SYNC ---
function syncData() {
    // Sync Inventory
    db.collection("parts").onSnapshot(snap => {
        parts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    // Sync Fleet
    db.collection("vehicles").onSnapshot(snap => {
        vehicles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    // Sync History
    db.collection("history").orderBy("timestamp", "desc").onSnapshot(snap => {
        history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
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

// --- CORE ACTIONS ---
async function addPart() {
    const n = document.getElementById('pName').value.trim();
    const pr = parseFloat(document.getElementById('pPrice').value);
    const q = parseInt(document.getElementById('pQty').value);
    const now = new Date();
    
    if (n && !isNaN(pr) && !isNaN(q)) {
        const data = { 
            name: n, price: pr, qty: q, 
            lastUpdate: now.toLocaleDateString(), 
            updateMonth: now.getMonth() 
        };

        if (editType === 'part' && editIdx !== -1) {
            await db.collection("parts").doc(parts[editIdx].id).update(data);
        } else {
            // Check for duplicate names/prices to stack quantity
            const exist = parts.find(p => p.name.toLowerCase() === n.toLowerCase() && p.price === pr);
            if (exist) {
                await db.collection("parts").doc(exist.id).update({ 
                    qty: exist.qty + q,
                    lastUpdate: now.toLocaleDateString()
                });
            } else {
                await db.collection("parts").add(data);
            }
        }
        resetEdit();
    } else alert("Fill all fields, a-oun!");
}

async function addVehicle() {
    const p = document.getElementById('vPlate').value.trim().toUpperCase();
    const m = document.getElementById('vModel').value.trim();
    if (p && m) {
        if (editType === 'vehicle' && editIdx !== -1) {
            await db.collection("vehicles").doc(vehicles[editIdx].id).update({ plate: p, model: m });
        } else {
            if (vehicles.some(v => v.plate === p)) return alert("Plate exists!");
            await db.collection("vehicles").add({ plate: p, model: m });
        }
        resetEdit();
    }
}

async function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return alert("Select Vehicle and Part");
    
    const part = parts[selP];
    if (part.qty < q) return alert("Low Stock");

    // Update Firestore stock
    await db.collection("parts").doc(part.id).update({ qty: part.qty - q });

    // Record in History
    await db.collection("history").add({
        date: new Date().toLocaleDateString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        month: new Date().getMonth(),
        plate: vehicles[selV].plate,
        partName: part.name,
        qty: q,
        cost: part.price * q
    });

    selV = null; selP = null;
    document.getElementById('fixQty').value = 1;
}

async function deleteReport(actualIdx) {
    const entry = history[actualIdx];
    if (!confirm("Cancel and return stock?")) return;

    const p = parts.find(x => x.name === entry.partName);
    if (p) await db.collection("parts").doc(p.id).update({ qty: p.qty + entry.qty });
    
    await db.collection("history").doc(entry.id).delete();
}

// --- UI UPDATE ---
function updateUI() {
    const invM = document.getElementById('inventoryMonthFilter').value;
    const invS = (document.getElementById('invSearchInput') || {value:''}).value.toLowerCase();
    const assetS = (document.getElementById('assetSearchInput') || {value:''}).value.toLowerCase();
    const repM = document.getElementById('reportMonthFilter').value;
    const repS = (document.getElementById('reportSearch') || {value:''}).value.toLowerCase();

    // Inventory
    document.getElementById('partsList').innerHTML = parts
        .filter(p => p.name.toLowerCase().includes(invS) && (invM === 'all' || p.updateMonth == invM))
        .map((p, idx) => {
            const actualIdx = parts.indexOf(p);
            return `
            <tr class="border-b font-bold hover:bg-emerald-50 ${editIdx === actualIdx && editType === 'part' ? 'bg-emerald-100' : ''}">
                <td class="p-6 uppercase">${p.name}</td>
                <td class="p-6 text-[10px] text-slate-400">${p.lastUpdate}</td>
                <td class="p-6 text-emerald-600">$${p.price.toFixed(2)}</td>
                <td class="p-6 text-center font-black">${p.qty} UNIT</td>
                <td class="p-6 text-slate-400 font-black">$${(p.price*p.qty).toFixed(2)}</td>
                <td class="p-6 text-right no-print">
                    <button onclick="setEdit('part', ${actualIdx})" class="text-sky-500 mr-4 text-[10px]">EDIT</button>
                    <button onclick="db.collection('parts').doc('${p.id}').delete()" class="text-red-400 text-[10px]">DEL</button>
                </td>
            </tr>`}).join('');

    // Assets
    document.getElementById('vTable').innerHTML = vehicles
        .filter(v => v.plate.toLowerCase().includes(assetS) || v.model.toLowerCase().includes(assetS))
        .map((v, idx) => {
            const actualIdx = vehicles.indexOf(v);
            return `
            <tr class="border-b font-bold hover:bg-sky-50 ${editIdx === actualIdx && editType === 'vehicle' ? 'bg-sky-100' : ''}">
                <td class="p-6 text-sky-600 uppercase">${v.plate}</td>
                <td class="p-6 uppercase text-[10px]">${v.model}</td>
                <td class="p-6 text-right no-print">
                    <button onclick="setEdit('vehicle', ${actualIdx})" class="text-emerald-500 mr-4 text-[10px]">EDIT</button>
                    <button onclick="db.collection('vehicles').doc('${v.id}').delete()" class="text-red-400 text-[10px]">DEL</button>
                </td>
            </tr>`}).join('');

    // Reports
    let total = 0;
    document.getElementById('reportTable').innerHTML = history
        .filter(h => (repM === 'all' || h.month == repM) && (h.plate.toLowerCase().includes(repS) || h.partName.toLowerCase().includes(repS)))
        .map((h, idx) => {
            const actualIdx = history.indexOf(h);
            total += h.cost;
            const curP = parts.find(p => p.name === h.partName);
            const v = vehicles.find(v => v.plate === h.plate);
            return `<tr class="border-b font-bold">
                <td class="py-4 text-slate-400 text-[9px] uppercase">${h.date}</td>
                <td class="font-black uppercase">${h.plate}</td>
                <td class="text-emerald-600 text-[9px] uppercase">${v ? v.model : 'N/A'}</td>
                <td class="text-slate-600 text-xs uppercase">${h.partName}</td>
                <td class="text-center">${h.qty}</td>
                <td class="text-sky-500 text-center font-black">${curP ? curP.qty : '0'}</td>
                <td class="font-black">$${h.cost.toFixed(2)}</td>
                <td class="no-print"><button onclick="deleteReport(${actualIdx})" class="text-red-400 text-[9px]">Cancel</button></td>
            </tr>`;
        }).join('');
    document.getElementById('totalSpend').innerText = `$${total.toFixed(2)}`;
    filterFix();
}

function setEdit(type, idx) {
    editType = type; editIdx = idx;
    if (type === 'part') {
        const p = parts[idx];
        document.getElementById('pName').value = p.name;
        document.getElementById('pPrice').value = p.price;
        document.getElementById('pQty').value = p.qty;
        document.getElementById('cancelPartEdit').classList.remove('hidden');
    } else {
        const v = vehicles[idx];
        document.getElementById('vPlate').value = v.plate;
        document.getElementById('vModel').value = v.model;
        document.getElementById('cancelVehicleEdit').classList.remove('hidden');
    }
    updateUI();
}

function resetEdit() {
    editType = ''; editIdx = -1;
    document.querySelectorAll('input').forEach(i => { if(i.id !== 'fixQty') i.value = ''; });
    document.getElementById('cancelPartEdit').classList.add('hidden');
    document.getElementById('cancelVehicleEdit').classList.add('hidden');
    updateUI();
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

function exportInventoryExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("inventoryTable")), "C21_Inventory.xlsx"); }
function exportReportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("reportDataTable")), "C21_Report.xlsx"); }
function logout() { sessionStorage.clear(); location.reload(); }

if (sessionStorage.getItem('auth') === 'true') {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    syncData(); // Start syncing from Firestore
    showPage('page-fix');
}