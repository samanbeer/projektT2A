// =========================================================================
// --- GLOBAL VARS & CONFIG ---
// =========================================================================
const SERVER_CHECK_INTERVAL = 8000;
const LAT = '49.5995'; 
const LON = '18.1448';
let servers = JSON.parse(localStorage.getItem('servers')) || [];
let bookmarks = JSON.parse(localStorage.getItem('custom_bookmarks')) || [];
let searchHistory = JSON.parse(localStorage.getItem('search_history')) || [];
let importedHistory = JSON.parse(localStorage.getItem('imported_history')) || [];
const shortcuts = { "you":"https://youtube.com", "yt":"https://youtube.com", "fb":"https://facebook.com", "ig":"https://instagram.com", "tw":"https://twitter.com", "rd":"https://reddit.com", "gh":"https://github.com", "sz":"https://seznam.cz", "id":"https://idnes.cz", "srv":"https://nofx.samot.fun" };
let currentFocus = -1;

// =========================================================================
// --- 1. INIT & LOADER ---
// =========================================================================
window.addEventListener("load", function () {
    const loader = document.getElementById("loader-overlay");
    const searchInput = document.getElementById('search-input');
    
    // Okamžitý focus
    if (searchInput) searchInput.focus();

    if (loader) {
        loader.classList.add("loader-hidden");
        loader.addEventListener("transitionend", function () {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Okamžité vykreslení
    renderServers();
    renderBookmarks();
    updateClock();
    
    // Odložený start sítě (500ms)
    setTimeout(() => {
        updateServerStatuses();
        fetchWeather();
        setInterval(updateServerStatuses, SERVER_CHECK_INTERVAL);
        setInterval(fetchWeather, 900000);
        setInterval(updateClock, 1000);
    }, 500);

    // Event listeners pro modaly a tlačítka
    setupEventListeners();
});

// =========================================================================
// --- 2. GLOBAL FUNCTIONS (ABY FUNGOVALY V HTML) ---
// =========================================================================

// --- MENU & MODALS ---
window.toggleMenu = function(dropdownId, btnId) {
    // Zavřít ostatní
    document.querySelectorAll('.dropdown-content').forEach(d => { if(d.id!==dropdownId) d.classList.remove('show'); });
    document.querySelectorAll('.menu-btn').forEach(b => { if(b.id!==btnId) b.classList.remove('active'); });
    
    const dropdown = document.getElementById(dropdownId);
    const btn = document.getElementById(btnId);
    if(dropdown) dropdown.classList.toggle("show");
    if(btn) btn.classList.toggle("active");
};

window.openEditModal = function(url) {
    const s = servers.find(x => x.url === url);
    if(s) {
        document.getElementById('modal-title').textContent = "Upravit server";
        document.getElementById('server-name').value = s.name;
        document.getElementById('server-url').value = s.url;
        document.getElementById('edit-original-url').value = s.url;
        document.getElementById('server-cloudflare').checked = s.isCloudflare || false;
        document.getElementById('add-server-modal').style.display = 'block';
    }
};

window.deleteServer = function(url) {
    if(confirm("Opravdu smazat tento server?")) {
        servers = servers.filter(s => s.url !== url);
        localStorage.setItem('servers', JSON.stringify(servers));
        renderServers();
    }
};

window.delBm = function(e, index) {
    e.preventDefault();
    e.stopPropagation();
    if(confirm("Smazat záložku?")) {
        bookmarks.splice(index, 1);
        localStorage.setItem('custom_bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
    }
};

// =========================================================================
// --- 3. LOGIC & HELPERS ---
// =========================================================================

function setupEventListeners() {
    // Add Server Btn
    document.getElementById('add-server-btn').onclick = () => {
        document.getElementById('modal-title').textContent = "Přidat nový server";
        document.getElementById('edit-original-url').value = "";
        document.getElementById('add-server-form').reset();
        document.getElementById('add-server-modal').style.display = 'block';
    };
    
    // Add Bookmark Btn
    document.getElementById('add-bookmark-btn').onclick = () => {
        document.getElementById('add-bookmark-form').reset();
        document.getElementById('add-bookmark-modal').style.display = 'block';
        document.getElementById('bookmark-url').focus();
    };

    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = function() {
            this.closest('.modal').style.display = 'none';
        }
    });

    // Server Form Submit
    document.getElementById('add-server-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('server-name').value;
        const url = document.getElementById('server-url').value;
        const orig = document.getElementById('edit-original-url').value;
        const isCF = document.getElementById('server-cloudflare').checked;

        if(orig) {
            const i = servers.findIndex(s => s.url === orig);
            if(i !== -1) servers[i] = { name, url, isCloudflare: isCF, status: 'offline', ping: null };
        } else {
            if(servers.some(s => s.url === url)) return alert('Existuje');
            servers.push({ name, url, isCloudflare: isCF, status: 'offline', ping: null });
        }
        localStorage.setItem('servers', JSON.stringify(servers));
        document.getElementById('add-server-modal').style.display = 'none';
        renderServers();
        updateServerStatuses();
    });

    // Bookmark Form Submit
    document.getElementById('add-bookmark-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let url = document.getElementById('bookmark-url').value.trim().replace(/^https?:\/\//,'').replace(/^www\./,'');
        const name = document.getElementById('bookmark-name').value.trim();
        bookmarks.push({ url, name });
        localStorage.setItem('custom_bookmarks', JSON.stringify(bookmarks));
        document.getElementById('add-bookmark-modal').style.display = 'none';
        renderBookmarks();
    });

    // Settings & Import
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const fileInput = document.getElementById('history-file-input');
    
    settingsBtn.onclick = (e) => { e.stopPropagation(); settingsMenu.classList.toggle('show'); };
    document.getElementById('import-history-btn').onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0]; if(!file) return;
        const bar = document.getElementById('import-progress-container'); 
        const status = document.getElementById('import-status');
        bar.style.display='block'; status.textContent="Nahrávám...";
        
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const raw = JSON.parse(ev.target.result);
                    const limit = Date.now() - (180*24*3600*1000);
                    const clean = raw.filter(i => i.url && i.url.startsWith('http') && !i.url.includes('google.com/search') && i.lastVisitTime > limit)
                        .sort((a,b) => b.visitCount - a.visitCount).slice(0, 200)
                        .map(i => { try{ const u = new URL(i.url); return u.origin+u.pathname;}catch{return i.url}});
                    
                    importedHistory = [...new Set(clean)];
                    localStorage.setItem('imported_history', JSON.stringify(importedHistory));
                    status.textContent = `✅ ${importedHistory.length} importováno.`; status.style.color="#4CAF50";
                } catch { status.textContent = "❌ Chyba."; status.style.color="#F44336"; }
                finally { bar.style.display='none'; fileInput.value=''; }
            };
            reader.readAsText(file);
        }, 100);
    };

    // Global Click (Close menus)
    window.onclick = (e) => {
        if(!settingsMenu.contains(e.target) && e.target.id!=='settings-btn') settingsMenu.classList.remove('show');
        if(!document.getElementById('search-form').contains(e.target)) document.getElementById('search-suggestions').style.display='none';
        if(e.target.classList.contains('modal')) e.target.style.display='none';
        if (!e.target.matches('.menu-btn')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        }
    };

    // Search Logic
    const sInput = document.getElementById('search-input');
    const sForm = document.getElementById('search-form');
    
    sInput.addEventListener('input', (e) => getGoogleSuggestions(e.target.value));
    sInput.addEventListener('focus', () => { if(sInput.value.length > 0) getGoogleSuggestions(sInput.value); });
    
    sInput.addEventListener('keydown', (e) => {
        const items = document.getElementById('search-suggestions').getElementsByClassName('suggestion-item');
        if (items.length > 0) {
            if (e.key === 'ArrowDown') { currentFocus++; addActive(items); }
            else if (e.key === 'ArrowUp') { currentFocus--; addActive(items); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentFocus > -1) items[currentFocus].click();
                else { const ev = new Event('submit', {cancelable: true}); sForm.dispatchEvent(ev); }
            }
        }
    });

    sForm.addEventListener('submit', (e) => {
        const q = sInput.value.trim().toLowerCase();
        if(shortcuts[q]) { e.preventDefault(); window.location.href=shortcuts[q]; return; }
        if(isUrl(q)) { e.preventDefault(); window.location.href=q.startsWith('http')?q:`https://${q}`; return; }
        addToHistory(sInput.value);
    });
}

// --- RENDERING & HELPERS ---

function renderServers() {
    const list = document.getElementById('server-list');
    list.innerHTML = '';
    if (servers.length === 0) { list.innerHTML = '<p class="server-url" style="text-align: center; padding: 20px;">Žádné servery.</p>'; return; }
    
    servers.forEach((s, i) => {
        const div = document.createElement('div'); div.className = 'server-item';
        const ping = (s.status === 'online' && s.ping) ? `<span class="server-ping">${s.ping} ms</span>` : '';
        const cfIcon = s.isCloudflare ? '<span style="font-size:0.7em; color:#f38020; margin-right:5px;" title="Cloudflare">☁️</span>' : '';
        
        div.innerHTML = `
            <div class="server-info"><span class="server-name">${cfIcon}${s.name}</span><span class="server-url">${s.url}</span></div>
            <div class="server-actions">${ping}<div class="status-indicator status-${s.status||'offline'}"></div>
            <div class="menu-container"><button id="menu-btn-${i}" onclick="toggleMenu('dd-${i}', 'menu-btn-${i}')" class="menu-btn">⋮</button>
            <div id="dd-${i}" class="dropdown-content"><button onclick="openEditModal('${s.url}')">Upravit</button><button onclick="deleteServer('${s.url}')" style="color:#ff6b6b;">Smazat</button></div></div></div>`;
        list.appendChild(div);
    });
}

function renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    bookmarks.forEach((bm, i) => {
        let domain = bm.url; try { domain = new URL(bm.url.startsWith('http')?bm.url:'http://'+bm.url).hostname; } catch{}
        const a = document.createElement('a'); a.className = 'bookmark-item'; a.href = bm.url.startsWith('http')?bm.url:`https://${bm.url}`;
        a.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" class="bookmark-icon"><span class="bookmark-name">${bm.name||domain}</span><button class="bookmark-delete" onclick="delBm(event, ${i})">&times;</button>`;
        grid.appendChild(a);
    });
}

// --- CLOCK ---
function updateClock() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('current-seconds').textContent = (now.getSeconds() < 10 ? '0' : '') + now.getSeconds();
    document.getElementById('current-date').textContent = now.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// --- WEATHER ---
function getIconFromWmoCode(c) {
    if(c===0)return 2;if(c===1)return 3;if(c===2)return 4;if(c===3)return 7;if(c>=45&&c<=48)return 12;
    if(c>=51&&c<=67)return 14;if(c>=71&&c<=77)return 21;if(c>=80&&c<=82)return 13;if(c>=85&&c<=86)return 23;if(c>=95)return 30;return 7;
}
async function fetchWeather() {
    try {
        const [wRes, aRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`),
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi`)
        ]);
        const wData = await wRes.json(); const aData = await aRes.json();
        const code = wData.current.weather_code;
        
        document.getElementById('weather-temp').textContent = `${Math.round(wData.current.temperature_2m)}°C`;
        document.getElementById('weather-desc').textContent = {0:"Jasno",1:"Skoro jasno",2:"Polojasno",3:"Zataženo",45:"Mlha",51:"Mrholení",61:"Déšť",71:"Sníh",95:"Bouřka"}[code]||"Oblačno";
        document.getElementById('weather-icon').src = `https://www.meteosource.com/static/img/ico/weather/${getIconFromWmoCode(code)}.svg`;
        document.getElementById('weather-humidity').textContent = `💧 ${Math.round(wData.current.relative_humidity_2m)}%`;
        document.getElementById('weather-aqi').textContent = `🍃 AQI ${aData.current.us_aqi}`;
        document.querySelector('.weather-loading').style.display = 'none';
        document.getElementById('weather-content').style.display = 'flex';
    } catch(e) { console.error(e); }
}

// --- SERVER CHECK ---
async function checkServerStatus(s) {
    const start = Date.now();
    if (s.isCloudflare) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = `${s.url.replace(/\/$/, '')}/favicon.ico?t=${Date.now()}`;
            img.onload = () => { s.status='online'; s.ping=Date.now()-start; resolve(); };
            img.onerror = () => { s.status='offline'; s.ping=null; resolve(); };
            setTimeout(() => { if(!img.complete) { s.status='offline'; img.src=""; resolve(); } }, 5000);
        });
    } else {
        try { await fetch(s.url, { method:'GET', mode:'no-cors', cache:'no-store', signal:AbortSignal.timeout(5000) }); s.status='online'; s.ping=Date.now()-start; }
        catch { s.status='offline'; s.ping=null; }
    }
}
async function updateServerStatuses() { await Promise.all(servers.map(checkServerStatus)); localStorage.setItem('servers', JSON.stringify(servers)); renderServers(); }

// --- SEARCH HELPERS ---
function addToHistory(q) { if(!q)return; searchHistory=searchHistory.filter(i=>i!==q); searchHistory.unshift(q); if(searchHistory.length>5)searchHistory.pop(); localStorage.setItem('search_history', JSON.stringify(searchHistory)); }
function isUrl(t) { return t.includes('.') && !t.includes(' ') && t.length > 3; }
function cleanUrl(u) { return u.replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,''); }
function getGoogleSuggestions(q) {
    if(!q || q.length===0) { document.getElementById('search-suggestions').style.display='none'; return; }
    const s = document.createElement('script');
    s.src = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${q}&callback=handleGoogleSuggestions`;
    document.body.appendChild(s);
}
window.handleGoogleSuggestions = (d) => showSuggestions(d[1]);

function showSuggestions(gData=[]) {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    const list = document.getElementById('search-suggestions'); list.innerHTML=''; currentFocus=-1;
    if(q.length===0){ list.style.display='none'; return; }

    const add = (txt, val, type) => {
        const div = document.createElement('div'); div.className='suggestion-item'; div.setAttribute('data-value', val);
        let icon='', d=val; try{ if(!d.startsWith('http'))d='http://'+d; d=new URL(d).hostname; }catch{}
        if(type==='link'||type==='imported') icon=`<img src="https://www.google.com/s2/favicons?domain=${d}&sz=32" class="suggestion-icon">`;
        else icon=`<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        div.innerHTML=`${icon}<span>${txt}</span>`;
        div.onclick=()=>{ if(type==='link'||type==='imported') window.location.href=val.startsWith('http')?val:`https://${val}`; else { document.getElementById('search-input').value=val; addToHistory(val); document.getElementById('search-form').submit(); } };
        list.appendChild(div);
    };

    for(const[k,v] of Object.entries(shortcuts)) if(k.startsWith(q)) add(k+" (Přejít)", v, 'link');
    if(isUrl(q)) add(cleanUrl(q), q.startsWith('http')?q:`https://${q}`, 'link');
    importedHistory.filter(u=>u.toLowerCase().includes(q)).slice(0,3).forEach(i=>add(cleanUrl(i), i, 'imported'));
    searchHistory.filter(i=>i.toLowerCase().includes(q)).forEach(i=>{if(!shortcuts[q])add(i,i,'history')});
    gData.slice(0,5).forEach(i=>{if(!shortcuts[q])add(i,i,'search')});
    list.style.display = list.children.length>0 ? 'block' : 'none';
}

function addActive(x) { removeActive(x); if(currentFocus>=x.length)currentFocus=0; if(currentFocus<0)currentFocus=(x.length-1); x[currentFocus].classList.add("selected"); }
function removeActive(x) { for(let i=0;i<x.length;i++)x[i].classList.remove("selected"); }