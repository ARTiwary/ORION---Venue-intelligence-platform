// ---- backend location ----
// Set via API_BASE_URL environment variable (see scripts/generate-config.js
// and README.md) — do not hardcode a URL here.
const API_BASE = window.API_BASE || '';

// ---- server health check ----
async function checkHealth(){
  const strip = document.getElementById('statusStrip');
  try{
    const res = await fetch(API_BASE + '/api/health');
    const data = await res.json();
    if(data.groq && data.cohere){
      strip.textContent = 'All systems operational';
      strip.classList.add('ok');
    } else {
      strip.textContent = 'Some systems are temporarily unavailable';
      strip.classList.add('warn');
    }
  }catch(e){
    strip.textContent = 'Unable to reach the platform right now';
    strip.classList.add('warn');
  }
}
checkHealth();


// ---- tabs (ARIA tablist pattern: click + arrow-key navigation) ----
const tabButtons = Array.from(document.querySelectorAll('.tab'));

function activateTab(tab){
  tabButtons.forEach(t=>{
    const isActive = t === tab;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', String(isActive));
    t.tabIndex = isActive ? 0 : -1;
    const panel = document.getElementById('panel-' + t.dataset.tab);
    if(panel) panel.hidden = !isActive;
  });
  tab.focus();
}

tabButtons.forEach((tab, i)=>{
  tab.addEventListener('click', ()=> activateTab(tab));
  tab.addEventListener('keydown', (e)=>{
    let next = null;
    if(e.key === 'ArrowRight') next = tabButtons[(i + 1) % tabButtons.length];
    else if(e.key === 'ArrowLeft') next = tabButtons[(i - 1 + tabButtons.length) % tabButtons.length];
    else if(e.key === 'Home') next = tabButtons[0];
    else if(e.key === 'End') next = tabButtons[tabButtons.length - 1];
    if(next){ e.preventDefault(); activateTab(next); }
  });
});

// ---- constellation highlight ----
function highlightAgents(ids){
  ids.forEach(id=>{
    const g = document.getElementById('star-'+id);
    if(g){
      g.querySelector('circle').setAttribute('fill', '#F2A93B');
      g.querySelector('text').classList.add('active');
    }
  });
  setTimeout(()=>{
    ids.forEach(id=>{
      const g = document.getElementById('star-'+id);
      if(g){
        g.querySelector('circle').setAttribute('fill', '#7FD1C4');
        g.querySelector('text').classList.remove('active');
      }
    });
  }, 4000);
}

async function postJSON(path, body){
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'request failed');
  return data;
}

// ---- Ask ORION ----
const AGENT_LABELS = {
  polaris: 'Wayfinding',
  rigel: 'Crowd flow',
  cassiopeia: 'Languages',
  vega: 'Accessibility',
  atlas: 'Transport',
  lyra: 'Sustainability'
};
const chatLog = document.getElementById('chatLog');
function addMsg(role, text, agents){
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if(role === 'orion' && agents && agents.length){
    const tag = document.createElement('span');
    tag.className = 'tag';
    const labels = agents.map(a => AGENT_LABELS[a] || a);
    tag.textContent = labels.join(' · ');
    div.appendChild(tag);
  }
  const body = document.createElement('span');
  body.textContent = text;
  div.appendChild(body);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

document.getElementById('chatSend').addEventListener('click', async ()=>{
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  if(!q) return;
  addMsg('user', q);
  input.value = '';
  const btn = document.getElementById('chatSend');
  btn.disabled = true; btn.textContent = 'Thinking…';
  try{
    const { reply, agents } = await postJSON('/api/chat', { message: q });
    addMsg('orion', reply, agents);
    highlightAgents(agents);
  }catch(e){
    addMsg('orion', 'Error: ' + e.message);
  }
  btn.disabled = false; btn.textContent = 'Ask';
});
document.getElementById('chatInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); document.getElementById('chatSend').click(); }
});

// ---- Cassiopeia ----
document.getElementById('langSend').addEventListener('click', async ()=>{
  const q = document.getElementById('langInput').value.trim();
  const target = document.getElementById('langTarget').value;
  const out = document.getElementById('langOut');
  if(!q) return;
  out.classList.remove('empty');
  out.innerHTML = '<span class="loading">Cassiopeia is listening…</span>';
  try{
    const { reply } = await postJSON('/api/translate', { message: q, target });
    out.textContent = reply;
    highlightAgents(['cassiopeia']);
  }catch(e){
    out.textContent = 'Error: ' + e.message;
  }
});

// ---- Control room ----
document.getElementById('controlSend').addEventListener('click', async ()=>{
  const q = document.getElementById('controlInput').value.trim();
  const out = document.getElementById('controlOut');
  if(!q) return;
  out.classList.remove('empty');
  out.innerHTML = '<span class="loading">Running crowd-flow simulation…</span>';
  try{
    const { reply } = await postJSON('/api/control', { message: q });
    out.textContent = reply;
    highlightAgents(['rigel','atlas']);
  }catch(e){
    out.textContent = 'Error: ' + e.message;
  }
});

// ---- Lyra ----
document.getElementById('sustainSend').addEventListener('click', async ()=>{
  const modeSel = document.getElementById('sMode');
  const foodSel = document.getElementById('sFood');
  const dist = document.getElementById('sDist').value;
  const out = document.getElementById('sustainOut');
  out.classList.remove('empty');
  document.getElementById('sMsg').textContent = 'Generating note…';
  try{
    const { totalCO2, note } = await postJSON('/api/sustain', {
      modeLabel: modeSel.selectedOptions[0].text,
      modeFactor: modeSel.value,
      distanceKm: dist,
      foodLabel: foodSel.selectedOptions[0].text,
      foodFactor: foodSel.value
    });
    document.getElementById('sNum').textContent = totalCO2;
    document.getElementById('sMsg').textContent = note;
    highlightAgents(['lyra']);
  }catch(e){
    document.getElementById('sMsg').textContent = 'Error: ' + e.message;
  }
});
