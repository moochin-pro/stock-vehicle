const tg = window.Telegram.WebApp;
tg.expand();

let parts = [], vehicles = [], history = [];
let selV = null, selP = null, editIdx = -1, editType = '';

// --- AUTH ---
function handleLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if (u === "thea" && p === "cambo@123") {
        sessionStorage.setItem('auth', 'true');
        location.reload();
    } else {
        tg.showAlert("Access Denied!");
    }
}

// --- SYNC ---
function syncData() {
    db.collection("parts").onSnapshot(s => {
        parts = s.docs.map(d => ({ id: d.id, ...d.data() }));
        updateUI();
    });
    db.collection("vehicles").onSnapshot(s => {
        vehicles = s.docs.map(d => ({ id: d.id, ...d.data() }));
        updateUI();
    });
    db.collection("history").orderBy("timestamp", "desc").onSnapshot(s => {
        history = s.docs.map(d => ({ id: d.id, ...d.data() }));
        updateUI();
    });
}

// --- NAVIGATION ---
function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    // Sidebar Update
    document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('bg-emerald-500', 'text-white'));
    const btn = document.getElementById('nav-' + id.split('-')[1]);
    if(btn) btn.classList.add('bg-emerald-500', 'text-white');

    // Mobile Nav Update
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('text-emerald-400'));
    const mobileIndex = { 'page-fix':0, 'page-parts':1, 'page-vehicles':2, 'page-report':3 }[id];
    document.querySelectorAll('.bottom-nav button')[mobileIndex].classList.add('text-emerald-400');
    
    window.scrollTo(0, 0);
}

// --- CORE ACTIONS ---
async function applyFix() {
    const q = parseInt(document.getElementById('fixQty').value);
    if (selV === null || selP === null) return tg.showAlert("Select a unit and a part first.");
    
    const part = parts[selP];
    if (part.qty < q) return tg.showAlert("Low Stock!");

    await db.collection("parts").doc(part.id).update({ qty: part.qty - q });
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
    tg.HapticFeedback.notificationOccurred('success');
    updateUI();
}

function updateUI() {
    // Inventory List Rendering
    const pList = document.getElementById('partsList');
    if(pList) {
        pList.innerHTML = parts.map((p, i) => `
            <tr class="border-b">
                <td class="p-4 font-bold uppercase">${p.name}</td>
                <td class="p-4 text-center font-black">${p.qty}</td>
                <td class="p-4 text-right">
                    <button onclick="setEdit('part', ${i})" class="text-sky-500 font-bold">EDIT</button>
                </td>
            </tr>`).join('');
    }
    filterFix();
}

function filterFix() {
    const vSearch = document.getElementById('fixVSearch')?.value.toLowerCase() || '';
    const pSearch = document.getElementById('fixPSearch')?.value.toLowerCase() || '';

    document.getElementById('fixVList').innerHTML = vehicles
        .filter(v => v.plate.toLowerCase().includes(vSearch))
        .map(v => `
            <div onclick="selV=${vehicles.indexOf(v)};updateUI()" class="p-3 border rounded-xl flex justify-between items-center ${selV === vehicles.indexOf(v) ? 'card-active' : 'bg-white'}">
                <span class="font-black text-xs uppercase">${v.plate}</span>
                <span class="text-[9px] text-slate-400 uppercase">${v.model}</span>
            </div>`).join('');

    document.getElementById('fixPList').innerHTML = parts
        .filter(p => p.name.toLowerCase().includes(pSearch))
        .map(p => `
            <div onclick="selP=${parts.indexOf(p)};updateUI()" class="p-3 border rounded-xl flex justify-between items-center ${selP === parts.indexOf(p) ? 'card-active' : 'bg-white'}">
                <span class="font-bold text-xs uppercase">${p.name}</span>
                <span class="text-[10px] text-sky-500 font-black">${p.qty} UNIT</span>
            </div>`).join('');

    if(selV !== null) document.getElementById('sumV').innerText = vehicles[selV].plate;
    if(selP !== null) document.getElementById('sumP').innerText = parts[selP].name;
}

function adjustQty(v) {
    let el = document.getElementById('fixQty');
    let val = parseInt(el.value) + v;
    if(val >= 1) el.value = val;
}

function logout() { sessionStorage.clear(); location.reload(); }

// --- INIT ---
if (sessionStorage.getItem('auth') === 'true') {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    syncData();
    showPage('page-fix');
}
