let parts = [];
let vehicles = [];
let history = [];
let selV = null, selP = null;

// --- LOGIN ---
function handleLogin() {
    if (document.getElementById('username').value === "thea" && document.getElementById('password').value === "cambo@123") {
        sessionStorage.setItem('auth', 'true'); location.reload();
    } else alert("Access Denied");
}

// --- CLOUD SYNC ---
function syncData() {
    db.collection("parts").onSnapshot(snap => {
        parts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    db.collection("vehicles").onSnapshot(snap => {
        vehicles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    db.collection("history").orderBy("timestamp", "desc").onSnapshot(snap => {
        history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
}

// --- ACTIONS ---
async function addPart() {
    const n = document.getElementById('pName').value.trim();
    const pr = parseFloat(document.getElementById('pPrice').value);
    const q = parseInt(document.getElementById('pQty').value);
    if (n && !isNaN(pr) && !isNaN(q)) {
        await db.collection("parts").doc(n).set({
            name: n, price: pr, qty: q, 
            lastUpdate: new Date().toLocaleDateString(),
            updateMonth: new Date().getMonth()
        });
        resetInputs();
    }
}

async function addVehicle() {
    const p = document.getElementById('vPlate').value.trim().toUpperCase();
    const m = document.getElementById('vModel').value.trim();
    if (p && m) {
        await db.collection("vehicles").doc(p).set({ plate: p, model: m });
        resetInputs();
    }
}

async function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return alert("Select Asset and Part");
    const part = parts[selP];
    if (part.qty < q) return alert("Low Stock");

    await db.collection("parts").doc(part.name).update({ qty: part.qty - q });
    await db.collection("history").add({
        date: new Date().toLocaleDateString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        month: new Date().getMonth(),
        plate: vehicles[selV].plate,
        partName: part.name,
        qty: q,
        cost: part.price * q
    });
    selV = null; selP = null; document.getElementById('fixQty').value = 1;
}

async function deleteReport(docId, partName, qty, cost) {
    if (confirm("Cancel this entry and return stock?")) {
        const pRef = db.collection("parts").doc(partName);
        const doc = await pRef.get();
        if (doc.exists) await pRef.update({ qty: doc.data().qty + qty });
        await db.collection("history").doc(docId).delete();
    }
}

// --- UI ---
function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('bg-emerald-500'));
    const btn = document.getElementById('nav-' + id.split('-')[1]);
    if(btn) btn.classList.add('bg-emerald-500');
    updateUI();
}

function updateUI() {
    const invM = document.getElementById('inventoryMonthFilter').value;
    const repM = document.getElementById('reportMonthFilter').value;
    const repS = document.getElementById('reportSearch').value.toLowerCase();

    // Render Parts
    let fParts = invM === 'all' ? parts : parts.filter(p => p.updateMonth == invM);
    document.getElementById('partsList').innerHTML = fParts.map(p => `
        <tr class="border-b font-bold hover:bg-emerald-50">
            <td class="p-6 uppercase">${p.name}</td>
            <td class="p-6 text-[11px] text-slate-500">${p.lastUpdate}</td>
            <td class="p-6 text-emerald-600 font-black">$${p.price.toFixed(2)}</td>
            <td class="p-6 text-center font-black">${p.qty} UNIT</td>
            <td class="p-6 text-slate-400 font-black">$${(p.price*p.qty).toFixed(2)}</td>
            <td class="p-6 text-right no-print"><button onclick="db.collection('parts').doc('${p.name}').delete()" class="text-red-400 text-[10px]">DEL</button></td>
        </tr>`).join('');

    // Render Assets
    document.getElementById('vTable').innerHTML = vehicles.map(v => `
        <tr class="border-b font-bold hover:bg-sky-50">
            <td class="p-6 text-sky-600 uppercase">${v.plate}</td>
            <td class="p-6 uppercase text-[11px]">${v.model}</td>
            <td class="p-6 text-right no-print"><button onclick="db.collection('vehicles').doc('${v.plate}').delete()" class="text-red-400 text-[10px]">DEL</button></td>
        </tr>`).join('');

    // Render Report
    let total = 0;
    let fHist = repM === 'all' ? history : history.filter(h => h.month == repM);
    fHist = fHist.filter(h => h.plate.toLowerCase().includes(repS) || h.partName.toLowerCase().includes(repS));
    
    document.getElementById('reportTable').innerHTML = fHist.map(h => {
        total += h.cost;
        const v = vehicles.find(v => v.plate === h.plate);
        return `<tr class="border-b font-bold"><td class="py-4 text-slate-400 text-[9px] uppercase">${h.date}</td><td class="font-black uppercase">${h.plate}</td><td class="text-[9px] uppercase">${v?v.model:'--'}</td><td class="text-slate-600 text-xs uppercase">${h.partName}</td><td class="text-center">${h.qty}</td><td class="font-black">$${h.cost.toFixed(2)}</td><td class="no-print"><button onclick="deleteReport('${h.id}','${h.partName}',${h.qty},${h.cost})" class="text-red-400 text-[9px]">CANCEL</button></td></tr>`;
    }).join('');
    document.getElementById('totalSpend').innerText = `$${total.toFixed(2)}`;
    filterFix();
}

function filterFix() {
    const vQ = document.getElementById('fixVSearch').value.toLowerCase();
    const pQ = document.getElementById('fixPSearch').value.toLowerCase();
    document.getElementById('fixVList').innerHTML = vehicles.filter(v => v.plate.toLowerCase().includes(vQ)).map(v => `
        <div onclick="selV=${vehicles.indexOf(v)};updateUI()" class="p-3 border rounded-xl cursor-pointer flex justify-between items-center ${selV === vehicles.indexOf(v) ? 'card-active' : 'bg-white'}">
            <p class="font-black uppercase text-sm">${v.plate}</p></div>`).join('');
    document.getElementById('fixPList').innerHTML = parts.filter(p => p.name.toLowerCase().includes(pQ)).map(p => `
        <div onclick="selP=${parts.indexOf(p)};updateUI()" class="p-3 border rounded-xl cursor-pointer flex justify-between items-center ${selP === parts.indexOf(p) ? 'card-active' : 'bg-white'}">
            <p class="font-black uppercase text-xs">${p.name}</p><p class="font-bold text-sky-500 text-[10px]">STOCK: ${p.qty}</p></div>`).join('');
    if(selV !== null) document.getElementById('sumV').innerText = vehicles[selV].plate;
    if(selP !== null) document.getElementById('sumP').innerText = parts[selP].name;
}

function adjustQty(v) { let el = document.getElementById('fixQty'); let val = parseInt(el.value) + v; if(val >= 1) el.value = val; }
function resetInputs() { document.querySelectorAll('input').forEach(i => { if(i.id !== 'username' && i.id !== 'password') i.value = ''; }); }
function logout() { sessionStorage.clear(); location.reload(); }
function exportInventoryExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("inventoryTable")), "C21_Stock.xlsx"); }
function exportReportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("reportDataTable")), "C21_Report.xlsx"); }

if (sessionStorage.getItem('auth') === 'true') {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    syncData();
    showPage('page-fix');
}