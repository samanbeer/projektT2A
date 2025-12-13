// =========================================================================
// --- 1. START APLIKACE ---
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById("loader-overlay");
    const loaderText = document.getElementById("loader-text");
    const searchInput = document.getElementById('search-input');
    const isInstalled = localStorage.getItem('dashboard_v1_installed');

    // Inicializace
    initDefaults();
    loadBackground(); // Načíst pozadí HNED

    // Vykreslení
    renderServers();
    renderBookmarks();
    updateClock();
    setupEventListeners();

    if (!isInstalled) {
        if (loaderText) loaderText.textContent = "Nastavuji výchozí prostředí...";
        setTimeout(() => {
            if (loader) {
                loader.classList.add("loader-hidden");
                setTimeout(() => { if(loader.parentNode) loader.parentNode.removeChild(loader); }, 500);
            }
            if (searchInput) searchInput.focus();
            localStorage.setItem('dashboard_v1_installed', 'true');
            startNetworkTasks();
        }, 3000); 
    } else {
        if (loader) {
            loader.classList.add("loader-hidden");
            setTimeout(() => { if(loader.parentNode) loader.parentNode.removeChild(loader); }, 300);
        }
        if (searchInput) searchInput.focus();
        setTimeout(startNetworkTasks, 100);
    }
});

function initDefaults() {
    if (!localStorage.getItem('servers')) {
        const defaultServers = [
            { name: "Google", url: "https://www.google.com/", isCloudflare: false, status: 'offline', ping: null, history: [] },
            { name: "Frengp", url: "https://www.frengp.cz/", isCloudflare: false, status: 'offline', ping: null, history: [] }
        ];
        localStorage.setItem('servers', JSON.stringify(defaultServers));
    }
    let s = JSON.parse(localStorage.getItem('servers')) || [];
    let updated = false;
    s.forEach(srv => { if (!srv.history) { srv.history = []; updated = true; } });
    if (updated) localStorage.setItem('servers', JSON.stringify(s));
}

function startNetworkTasks() {
    initCharts();
    updateServerStatuses();
    fetchWeather();
    setInterval(updateServerStatuses, 5000);
    setInterval(fetchWeather, 900000);
    setInterval(updateClock, 1000);
}

// =========================================================================
// --- KONFIGURACE ---
// =========================================================================
const LAT = '49.5995'; 
const LON = '18.1448';
let servers = JSON.parse(localStorage.getItem('servers')) || [];
let bookmarks = JSON.parse(localStorage.getItem('custom_bookmarks')) || [];
let searchHistory = JSON.parse(localStorage.getItem('search_history')) || [];
let importedHistory = JSON.parse(localStorage.getItem('imported_history')) || [];
const shortcuts = { "you":"https://youtube.com", "yt":"https://youtube.com", "fb":"https://facebook.com", "ig":"https://instagram.com", "gh":"https://github.com", "sz":"https://seznam.cz", "srv":"https://nofx.samot.fun" };
let currentFocus = -1;
const serverCharts = {};

// =========================================================================
// --- POZADÍ (BACKGROUND) ---
// =========================================================================
function loadBackground() {
    const bgUrl = localStorage.getItem('custom_bg');
    if (bgUrl && bgUrl !== 'null') { // Kontrola platnosti
        document.body.style.backgroundImage = `url('${bgUrl}')`;
    }
}

async function changeBackground() {
    const btn = document.getElementById('change-bg-btn');
    btn.textContent = "⏳ Stahuji...";
    const newBgUrl = `https://picsum.photos/1920/1080?random=${Date.now()}`; 
    
    const img = new Image();
    img.src = newBgUrl;
    img.onload = () => {
        document.body.style.backgroundImage = `url('${newBgUrl}')`;
        localStorage.setItem('custom_bg', newBgUrl);
        btn.textContent = "🖼️ Změnit tapetu (Náhodná)";
    };
    img.onerror = () => {
        alert("Nepodařilo se stáhnout tapetu.");
        btn.textContent = "🖼️ Změnit tapetu (Náhodná)";
    };
}

function setCustomBackground() {
    const input = document.getElementById('custom-bg-url');
    const url = input.value.trim();
    if(url) {
        document.body.style.backgroundImage = `url('${url}')`;
        localStorage.setItem('custom_bg', url);
        input.value = '';
    }
}

// =========================================================================
// --- FUNKCE VYKRESLOVÁNÍ (RENDERING) ---
// =========================================================================

function updateClock() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('current-seconds').textContent = (now.getSeconds() < 10 ? '0' : '') + now.getSeconds();
    document.getElementById('current-date').textContent = now.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function renderServers() {
    const list = document.getElementById('server-list');
    list.innerHTML = '';
    
    servers.forEach((s, i) => {
        const container = document.createElement('div');
        container.className = 'server-item-container';
        
        const div = document.createElement('div'); 
        div.className = 'server-item';
        // Rozbalení grafu (OPRAVA: nyní funguje vždy)
        div.onclick = (e) => { 
            if(!e.target.closest('.menu-container')) toggleGraph(i); 
        };

        const cfIcon = s.isCloudflare ? '<span style="font-size:0.7em; color:#f38020; margin-right:5px;" title="Cloudflare">☁️</span>' : '';
        
        div.innerHTML = `
            <div class="server-info">
                <span class="server-name">${cfIcon}${s.name}</span>
                <span class="server-url">${s.url}</span>
            </div>
            <div class="server-actions">
                <span class="server-ping" id="ping-${i}">-- ms</span>
                <div class="status-indicator status-offline" id="status-${i}"></div>
                <div class="menu-container">
                    <button id="menu-btn-${i}" onclick="event.stopPropagation(); toggleMenu('dd-${i}', 'menu-btn-${i}')" class="menu-btn">⋮</button>
                    <div id="dd-${i}" class="dropdown-content">
                        <button onclick="openEditModal('${s.url}')">Upravit</button>
                        <button onclick="deleteServer('${s.url}')" style="color:#ff6b6b;">Smazat</button>
                    </div>
                </div>
            </div>`;
        
        const graphDiv = document.createElement('div');
        graphDiv.id = `graph-container-${i}`;
        graphDiv.className = 'server-graph-container';
        graphDiv.innerHTML = `<canvas id="chart-${i}"></canvas>`;

        container.appendChild(div);
        container.appendChild(graphDiv);
        list.appendChild(container);
    });
}

function initCharts() {
    servers.forEach((s, i) => {
        const ctx = document.getElementById(`chart-${i}`).getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 100);
        gradient.addColorStop(0, 'rgba(0, 123, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 123, 255, 0.0)');

        serverCharts[i] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(s.history.length).fill(''), 
                datasets: [{
                    data: s.history,
                    borderColor: '#007bff',
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, 
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false }, 
                    // UPRAVENÝ TOOLTIP (MENŠÍ)
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        bodyFont: { size: 10 },
                        titleFont: { size: 10 },
                        padding: 6,
                        displayColors: false
                    } 
                },
                scales: {
                    x: { display: false },
                    y: { display: false, min: 0 } 
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    });
}

function toggleGraph(index) {
    const g = document.getElementById(`graph-container-${index}`);
    // Rozbalit graf, pokud je server offline nebo má málo dat (historie vždy existuje)
    g.classList.toggle('expanded');
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

// =========================================================================
// --- SÍŤOVÉ FUNKCE ---
// =========================================================================

function getIconFromWmoCode(c) {
    if(c===0)return 2;if(c===1)return 3;if(c===2)return 4;if(c===3)return 7;if(c>=45&&c<=48)return 12;
    if(c>=51&&c<=67)return 14;if(c>=71&&c<=77)return 21;if(c>=80&&c<=82)return 13;if(c>=85&&c<=86)return 23;if(c>=95)return 30;return 7;
}

async function fetchWeather() {
    try {
        const [wRes, aRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`),
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi`)
        ]);
        const wData = await wRes.json(); const aData = await aRes.json();
        
        document.getElementById('weather-temp').textContent = `${Math.round(wData.current.temperature_2m)}°C`;
        document.getElementById('weather-desc').textContent = {0:"Jasno",1:"Skoro jasno",2:"Polojasno",3:"Zataženo",45:"Mlha",51:"Mrholení",61:"Déšť",71:"Sníh",95:"Bouřka"}[wData.current.weather_code]||"Oblačno";
        document.getElementById('weather-icon').src = `https://www.meteosource.com/static/img/ico/weather/${getIconFromWmoCode(wData.current.weather_code)}.svg`;
        document.getElementById('weather-humidity').textContent = `💧 ${Math.round(wData.current.relative_humidity_2m)}%`;
        document.getElementById('weather-aqi').textContent = `🍃 AQI ${aData.current.us_aqi}`;
        document.querySelector('.weather-loading').style.display = 'none';
        document.getElementById('weather-content').style.display = 'flex';

        const forecastDiv = document.getElementById('weather-forecast');
        forecastDiv.innerHTML = '';
        for(let i=1; i<=3; i++) {
            const dayCode = wData.daily.weather_code[i];
            const maxT = Math.round(wData.daily.temperature_2m_max[i]);
            const minT = Math.round(wData.daily.temperature_2m_min[i]);
            const date = new Date(wData.daily.time[i]);
            const dayName = date.toLocaleDateString('cs-CZ', {weekday: 'short'});
            
            const item = document.createElement('div');
            item.className = 'forecast-day';
            item.innerHTML = `
                <div class="f-day">${dayName}</div>
                <img src="https://www.meteosource.com/static/img/ico/weather/${getIconFromWmoCode(dayCode)}.svg" class="f-icon">
                <div class="f-temp">${maxT}° / ${minT}°</div>
            `;
            forecastDiv.appendChild(item);
        }

    } catch(e) { console.error(e); }
}

async function checkServerStatus(s, index) {
    const start = Date.now();
    let currentPing = null;
    let isOnline = false;

    if (s.isCloudflare) {
        await new Promise((resolve) => {
            const img = new Image();
            img.src = `${s.url.replace(/\/$/, '')}/favicon.ico?t=${Date.now()}`;
            img.onload = () => { isOnline=true; currentPing=Date.now()-start; resolve(); };
            img.onerror = () => { isOnline=false; resolve(); };
            setTimeout(() => { if(!img.complete) { isOnline=false; img.src=""; resolve(); } }, 5000);
        });
    } else {
        try { 
            await fetch(s.url, { method:'GET', mode:'no-cors', cache:'no-store', signal:AbortSignal.timeout(5000) }); 
            isOnline=true; currentPing=Date.now()-start; 
        } 
        catch { isOnline=false; }
    }

    s.status = isOnline ? 'online' : 'offline';
    s.ping = currentPing;
    const nowTime = new Date().toLocaleTimeString(); 

    if (!s.history) s.history = [];
    s.history.push(currentPing || 0); 
    if (s.history.length > 30) s.history.shift();

    const pingEl = document.getElementById(`ping-${index}`);
    const statusEl = document.getElementById(`status-${index}`);
    
    if (pingEl) pingEl.textContent = isOnline ? `${currentPing} ms` : '';
    if (statusEl) {
        statusEl.className = `status-indicator status-${s.status}`;
    }

    if (serverCharts[index]) {
        serverCharts[index].data.labels.push(nowTime);
        if (serverCharts[index].data.labels.length > 30) serverCharts[index].data.labels.shift();
        serverCharts[index].data.datasets[0].data = s.history; 
        serverCharts[index].update('none'); 
    }
}

async function updateServerStatuses() { 
    await Promise.all(servers.map((s, i) => checkServerStatus(s, i))); 
    localStorage.setItem('servers', JSON.stringify(servers)); 
}

// =========================================================================
// --- GLOBÁLNÍ FUNKCE ---
// =========================================================================

window.toggleMenu = function(dropdownId, btnId) {
    document.querySelectorAll('.dropdown-content').forEach(d => { if(d.id!==dropdownId) d.classList.remove('show'); });
    document.querySelectorAll('.menu-btn').forEach(b => { if(b.id!==btnId) b.classList.remove('active'); });
    const d = document.getElementById(dropdownId); const b = document.getElementById(btnId);
    if(d) d.classList.toggle("show"); if(b) b.classList.toggle("active");
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
        initCharts();
    }
};

window.delBm = function(e, index) {
    e.preventDefault(); e.stopPropagation();
    if(confirm("Smazat záložku?")) {
        bookmarks.splice(index, 1);
        localStorage.setItem('custom_bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
    }
};

async function forceUpdate() {
    if(!confirm("Stáhnout novou verzi?")) return;
    document.getElementById('import-status').textContent = "Aktualizuji...";
    if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) await r.unregister();
    }
    if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k);
    }
    location.reload(true);
}

// =========================================================================
// --- EVENT LISTENERS ---
// =========================================================================

function setupEventListeners() {
    document.getElementById('add-server-btn').onclick = () => {
        document.getElementById('modal-title').textContent = "Přidat nový server";
        document.getElementById('edit-original-url').value = "";
        document.getElementById('add-server-form').reset();
        document.getElementById('add-server-modal').style.display = 'block';
    };
    
    document.getElementById('add-bookmark-btn').onclick = () => {
        document.getElementById('add-bookmark-form').reset();
        document.getElementById('add-bookmark-modal').style.display = 'block';
        document.getElementById('bookmark-url').focus();
    };

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = function() { this.closest('.modal').style.display = 'none'; }
    });

    document.getElementById('add-server-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('server-name').value;
        const url = document.getElementById('server-url').value;
        const orig = document.getElementById('edit-original-url').value;
        const isCF = document.getElementById('server-cloudflare').checked;

        if(orig) {
            const i = servers.findIndex(s => s.url === orig);
            if(i !== -1) {
                const history = servers[i].history || [];
                servers[i] = { name, url, isCloudflare: isCF, status: 'offline', ping: null, history: history };
            }
        } else {
            if(servers.some(s => s.url === url)) return alert('Existuje');
            servers.push({ name, url, isCloudflare: isCF, status: 'offline', ping: null, history: [] });
        }
        localStorage.setItem('servers', JSON.stringify(servers));
        document.getElementById('add-server-modal').style.display = 'none';
        renderServers();
        initCharts(); 
        updateServerStatuses();
    });

    document.getElementById('add-bookmark-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let url = document.getElementById('bookmark-url').value.trim().replace(/^https?:\/\//,'').replace(/^www\./,'');
        const name = document.getElementById('bookmark-name').value.trim();
        bookmarks.push({ url, name });
        localStorage.setItem('custom_bookmarks', JSON.stringify(bookmarks));
        document.getElementById('add-bookmark-modal').style.display = 'none';
        renderBookmarks();
    });

    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const fileInput = document.getElementById('history-file-input');
    
    settingsBtn.onclick = (e) => { e.stopPropagation(); settingsMenu.classList.toggle('show'); };
    document.getElementById('import-history-btn').onclick = () => fileInput.click();
    document.getElementById('force-update-btn').onclick = forceUpdate;
    document.getElementById('change-bg-btn').onclick = changeBackground;
    document.getElementById('set-custom-bg-btn').onclick = setCustomBackground;

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

    window.onclick = (e) => {
        if(!settingsMenu.contains(e.target) && e.target.id!=='settings-btn') settingsMenu.classList.remove('show');
        if(!document.getElementById('search-form').contains(e.target)) document.getElementById('search-suggestions').style.display='none';
        if(e.target.classList.contains('modal')) e.target.style.display='none';
        if (!e.target.matches('.menu-btn')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        }
    };

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
        else if(type==='history') icon=`<svg class="suggestion-icon icon-history" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
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