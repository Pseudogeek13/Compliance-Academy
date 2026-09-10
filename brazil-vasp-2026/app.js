const CONFIG={
  owner:"Pseudogeek13",
  repo:"Compliance-Academy",
  branch:"brazil-vasp-dashboard",
  root:"brazil-vasp-2026",
  statePath:"brazil-vasp-2026/project-state.json"
};
const RAWROOT=`https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${CONFIG.root}`;
const API=`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.statePath}`;
const DRAFT_KEY="brazil-vasp-2026-draft-v2";
let state=null, baseRevision=null, dirty=false, preset="all";

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=s=>new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(s+"T12:00:00"));
const daysUntil=s=>Math.ceil((new Date(s+"T23:59:59")-new Date())/86400000);
const slug=s=>String(s).replace(/\s+/g,"-");
const complete=t=>["Complete","Not Applicable"].includes(t.status);
const evidencePct=t=>t.evidenceChecklist.length?Math.round(100*t.evidenceChecklist.filter(x=>x.done).length/t.evidenceChecklist.length):100;

async function fetchJson(url){
  const r=await fetch(url+(url.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});
  if(!r.ok) throw new Error(`Shared data returned ${r.status}`);
  return await r.json();
}
async function fetchShared(){
  const manifest=await fetchJson(`${RAWROOT}/project-data.json`);
  const packs=await Promise.all(manifest.files.map(f=>fetchJson(`${RAWROOT}/${f}`)));
  const sharedState=await fetchJson(`${RAWROOT}/project-state.json`);
  const tasks=packs.flatMap(p=>p.tasks);
  for(const t of tasks){
    const s=sharedState.taskState?.[t.id];
    if(s){
      t.status=s.status??t.status;
      t.owner=s.owner??t.owner;
      t.notes=s.notes??t.notes;
      if(Array.isArray(s.evidence)) t.evidenceChecklist.forEach((e,i)=>e.done=!!s.evidence[i]);
    }
  }
  return {meta:{...manifest.meta,revision:sharedState.revision,lastPublishedBy:sharedState.lastPublishedBy,lastPublishedAt:sharedState.lastPublishedAt},statusOptions:manifest.statusOptions,tasks};
}
function serializableState(){
  return {
    revision:baseRevision,
    lastPublishedBy:state.meta.lastPublishedBy||"Initial build",
    lastPublishedAt:state.meta.lastPublishedAt||null,
    taskState:Object.fromEntries(state.tasks.map(t=>[t.id,{
      status:t.status,owner:t.owner||"",notes:t.notes||"",evidence:t.evidenceChecklist.map(e=>!!e.done)
    }]))
  };
}
async function load(){
  try{
    const remote=await fetchShared();
    baseRevision=remote.meta.revision||1;
    const saved=localStorage.getItem(DRAFT_KEY);
    if(saved){
      try{
        const draft=JSON.parse(saved);
        if(draft.dirty && draft.baseRevision===baseRevision){
          state=draft.project; dirty=true;
        } else { state=remote; localStorage.removeItem(DRAFT_KEY); }
      }catch{state=remote}
    } else state=remote;
    populateFilters(); render();
    $("#syncState").textContent=`Shared revision ${baseRevision} · ${state.meta.tasksUpdated || state.meta.lastPublishedBy || "initial build"}`;
  }catch(e){
    $("#syncState").textContent="Could not load shared data";
    $("#tasks").innerHTML=`<div class="empty">Could not load project data.<br>${esc(e.message)}</div>`;
  }
}
function saveDraft(){
  dirty=true;
  localStorage.setItem(DRAFT_KEY,JSON.stringify({dirty:true,baseRevision,project:state}));
  $("#dirtyBanner").style.display="block";
  $("#syncState").textContent=`Shared revision ${baseRevision} · local changes pending`;
}
function populateFilters(){
  $("#statusFilter").innerHTML='<option value="">All statuses</option>'+state.statusOptions.map(x=>`<option>${esc(x)}</option>`).join("");
  const ws=[...new Set(state.tasks.map(t=>t.workstream))];
  $("#workstreamFilter").innerHTML='<option value="">All workstreams</option>'+ws.map(x=>`<option>${esc(x)}</option>`).join("");
}
function render(){
  $("#subtitle").textContent=`${state.meta.entity} · ${state.meta.group}`;
  $("#publicNotice").textContent=state.meta.publicNotice;
  $("#dirtyBanner").style.display=dirty?"block":"none";
  renderKpis(); renderWorkstreams(); renderTasks();
}
function renderKpis(){
  const total=state.tasks.length, done=state.tasks.filter(complete).length;
  const criticalOpen=state.tasks.filter(t=>t.priority==="Critical"&&!complete(t)).length;
  const blocked=state.tasks.filter(t=>t.status==="Blocked").length;
  const ev=state.tasks.flatMap(t=>t.evidenceChecklist), evDone=ev.filter(x=>x.done).length;
  const days=daysUntil(state.meta.phase1StatutoryDeadline);
  $("#kpis").innerHTML=[
    `<div class="kpi countdown"><div class="label">Phase 1 statutory gate</div><div class="value">${days>=0?days:Math.abs(days)}</div><div class="hint">${days>=0?"days remaining":"days past"} · 30 Oct 2026</div></div>`,
    `<div class="kpi"><div class="label">Programme progress</div><div class="value">${Math.round(done/total*100)}%</div><div class="hint">${done} of ${total} requirements closed</div></div>`,
    `<div class="kpi"><div class="label">Critical open</div><div class="value">${criticalOpen}</div><div class="hint">requires executive attention</div></div>`,
    `<div class="kpi"><div class="label">Blocked</div><div class="value">${blocked}</div><div class="hint">dependency or decision needed</div></div>`,
    `<div class="kpi"><div class="label">Evidence readiness</div><div class="value">${ev.length?Math.round(evDone/ev.length*100):100}%</div><div class="hint">${evDone} of ${ev.length} evidence items</div></div>`,
    `<div class="kpi"><div class="label">Internal filing target</div><div class="value">${fmtDate(state.meta.phase1InternalFilingTarget).split(" ")[0]}</div><div class="hint">${fmtDate(state.meta.phase1InternalFilingTarget)} · 3-day buffer</div></div>`
  ].join("");
}
function renderWorkstreams(){
  const workstreams=[...new Set(state.tasks.map(t=>t.workstream))];
  $("#workstreams").innerHTML=workstreams.map(ws=>{
    const ts=state.tasks.filter(t=>t.workstream===ws), done=ts.filter(complete).length, critical=ts.filter(t=>t.priority==="Critical"&&!complete(t)).length;
    const pct=Math.round(done/ts.length*100);
    return `<div class="ws" data-ws="${esc(ws)}"><div class="ws-head"><div class="ws-name">${esc(ws)}</div><div class="ws-pct">${pct}%</div></div><div class="bar"><i style="width:${pct}%"></i></div><div class="ws-meta"><span>${done}/${ts.length} closed</span><span>${critical} critical open</span></div></div>`;
  }).join("");
  document.querySelectorAll(".ws").forEach(el=>el.onclick=()=>{
    $("#workstreamFilter").value=el.dataset.ws;preset="all";setActivePreset();renderTasks();document.querySelector(".toolbar").scrollIntoView({behavior:"smooth"});
  });
}
function matchPreset(t){
  if(preset==="critical") return t.priority==="Critical"&&!complete(t);
  if(preset==="phase1") return t.gate==="Before Phase 1 filing";
  if(preset==="reporting") return t.gate==="Starts on filing";
  if(preset==="phase2") return t.gate==="Phase 2 readiness";
  if(preset==="2027") return t.gate==="Effective 1 Jan 2027";
  return true;
}
function filtered(){
  const q=$("#search").value.trim().toLowerCase(), sf=$("#statusFilter").value, wf=$("#workstreamFilter").value, pf=$("#priorityFilter").value;
  return state.tasks.filter(t=>{
    const hay=JSON.stringify(t).toLowerCase();
    return matchPreset(t)&&(!q||hay.includes(q))&&(!sf||t.status===sf)&&(!wf||t.workstream===wf)&&(!pf||t.priority===pf);
  }).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
}
function dueClass(t){
  if(complete(t)) return "";
  const d=daysUntil(t.due); if(d<0)return"overdue"; if(d<=7)return"soon"; return"";
}
function renderTasks(){
  const list=filtered(); $("#resultCount").textContent=`${list.length} of ${state.tasks.length} requirements`;
  $("#registerTitle").textContent=({all:"Requirement register",critical:"Critical path",phase1:"Phase 1 / pre-filing gate",reporting:"Controls starting on filing",phase2:"Phase 2 readiness",2027:"1 January 2027 implementation"})[preset]||"Requirement register";
  if(!list.length){$("#tasks").innerHTML='<div class="empty">No requirements match the current filters.</div>';return}
  $("#tasks").innerHTML=list.map(t=>`
  <details class="task" data-id="${esc(t.id)}">
    <summary>
      <div>
        <div class="task-title-line"><span class="id">${esc(t.id)}</span><div><div class="task-title">${esc(t.title)}</div>
        <div class="meta-line"><span class="badge ${t.priority==="Critical"?"b-critical":"b-high"}">${esc(t.priority)}</span><span class="badge b-gate">${esc(t.gate)}</span><span class="badge b-gate">${evidencePct(t)}% evidence</span></div></div></div>
      </div>
      <div><div class="cell-label">Status</div><select class="status ${slug(t.status)}" data-status="${esc(t.id)}">${state.statusOptions.map(x=>`<option ${x===t.status?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="hide-tablet"><div class="cell-label">Accountable lead</div><div class="cell-value">${esc(t.owner||t.leadRole)}</div></div>
      <div><div class="cell-label">Target</div><div class="cell-value due ${dueClass(t)}">${fmtDate(t.due)}</div></div>
    </summary>
    <div class="detail">
      <div class="detail-grid">
        <div>
          <h3>Why this matters</h3><p>${esc(t.why)}</p>
          <h3>Required actions</h3><ol>${t.actions.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
          <h3>Definition of done</h3><div class="callout dod">${esc(t.definitionOfDone)}</div>
          ${t.risk?`<h3>Risk / implementation note</h3><div class="callout">${esc(t.risk)}</div>`:""}
          <h3>Regulatory basis</h3><p>${esc(t.regulatoryBasis)}</p>
          <div class="sources">${t.sources.map(s=>`<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("")}</div>
        </div>
        <div>
          <h3>Ownership & collaboration</h3>
          <div class="editbox">
            <div><div class="cell-label">Suggested lead</div><div class="cell-value">${esc(t.leadRole)}</div></div>
            <div><div class="cell-label">Involved</div><div class="cell-value">${esc(t.involved)}</div></div>
            <div class="full"><label class="cell-label">Named accountable owner</label><input class="small-input" data-owner="${esc(t.id)}" value="${esc(t.owner)}" placeholder="Assign a person / team" /></div>
          </div>
          <h3>Dependencies</h3><p>${esc(t.dependencies||"No explicit predecessor recorded.")}</p>
          <h3>Evidence checklist</h3>
          <div class="evidence">${t.evidenceChecklist.map((e,i)=>`<label class="ev"><input type="checkbox" data-evidence="${esc(t.id)}" data-index="${i}" ${e.done?"checked":""}/><span>${esc(e.text)}</span></label>`).join("")}</div>
          <div style="height:14px"></div>
          <h3>Working notes</h3><textarea class="small-input notes" data-notes="${esc(t.id)}" placeholder="Non-sensitive project notes only">${esc(t.notes)}</textarea>
        </div>
      </div>
    </div>
  </details>`).join("");
  bindTaskInputs();
}
function bindTaskInputs(){
  document.querySelectorAll("[data-status]").forEach(el=>el.addEventListener("change",e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.status); t.status=e.target.value; saveDraft(); renderKpis(); renderWorkstreams(); renderTasks();
  }));
  document.querySelectorAll("[data-owner]").forEach(el=>el.addEventListener("change",e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.owner);t.owner=e.target.value.trim();saveDraft();
  }));
  document.querySelectorAll("[data-notes]").forEach(el=>el.addEventListener("change",e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.notes);t.notes=e.target.value;saveDraft();
  }));
  document.querySelectorAll("[data-evidence]").forEach(el=>el.addEventListener("change",e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.evidence);t.evidenceChecklist[Number(e.target.dataset.index)].done=e.target.checked;saveDraft();renderKpis();renderWorkstreams();
  }));
}
function setActivePreset(){
  document.querySelectorAll("[data-preset]").forEach(x=>x.classList.toggle("active",x.dataset.preset===preset));
}
document.querySelectorAll("[data-preset]").forEach(el=>el.onclick=()=>{
  preset=el.dataset.preset; $("#workstreamFilter").value="";setActivePreset();renderTasks();
});
["search","statusFilter","workstreamFilter","priorityFilter"].forEach(id=>$("#"+id).addEventListener(id==="search"?"input":"change",renderTasks));

async function refreshShared(){
  if(dirty&&!confirm("Discard this browser's unpublished edits and reload the shared project?"))return;
  try{
    $("#syncState").textContent="Refreshing shared data…";
    const remote=await fetchShared();state=remote;baseRevision=remote.meta.revision||1;dirty=false;localStorage.removeItem(DRAFT_KEY);populateFilters();render();
    $("#syncState").textContent=`Shared revision ${baseRevision} · refreshed`;
  }catch(e){alert("Refresh failed: "+e.message)}
}
$("#refreshBtn").onclick=refreshShared;

function download(name,text,type="application/json"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function csvCell(v){return '"'+String(v??"").replace(/"/g,'""')+'"'}
$("#exportBtn").onclick=()=>{
  const choice=prompt("Export format: type JSON or CSV","CSV"); if(!choice)return;
  if(choice.toUpperCase()==="JSON") download("brazil-spsav-project.json",JSON.stringify(state,null,2));
  else {
    const rows=[["ID","Workstream","Title","Gate","Priority","Status","Owner","Suggested Lead","Due","Evidence %","Dependencies","Regulatory Basis","Notes"]];
    state.tasks.forEach(t=>rows.push([t.id,t.workstream,t.title,t.gate,t.priority,t.status,t.owner,t.leadRole,t.due,evidencePct(t),t.dependencies,t.regulatoryBasis,t.notes]));
    download("brazil-spsav-project.csv",rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv");
  }
};

function openSync(){
  $("#editorName").value=localStorage.getItem("brazil-vasp-editor")||"";
  $("#token").value=sessionStorage.getItem("brazil-vasp-gh-token")||"";
  $("#syncDialog").showModal();
}
$("#publishBtn").onclick=openSync; $("#cancelSync").onclick=()=>$("#syncDialog").close();

function utf8ToBase64(str){const bytes=new TextEncoder().encode(str);let binary="";bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary)}
async function publish(){
  const token=$("#token").value.trim(), editor=$("#editorName").value.trim()||"Dashboard editor";
  if(!token){alert("Enter a GitHub token with Contents write permission.");return}
  sessionStorage.setItem("brazil-vasp-gh-token",token);localStorage.setItem("brazil-vasp-editor",editor);
  $("#confirmSync").disabled=true;$("#confirmSync").textContent="Publishing…";
  try{
    const r=await fetch(API+"?ref="+encodeURIComponent(CONFIG.branch),{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28"}});
    if(!r.ok) throw new Error(`Could not read shared file (${r.status}). Check repository access and token permission.`);
    const file=await r.json();
    const remoteText=new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g,"")),c=>c.charCodeAt(0)));
    const remote=JSON.parse(remoteText), remoteRev=remote.revision||1;
    if(remoteRev!==baseRevision) throw new Error(`Shared project is now revision ${remoteRev}, but your edits are based on revision ${baseRevision}. Refresh first so another editor's work is not overwritten.`);
    const next=serializableState();
    next.revision=remoteRev+1;next.lastPublishedBy=editor;next.lastPublishedAt=new Date().toISOString();
    state.meta.revision=next.revision;state.meta.lastPublishedBy=editor;state.meta.lastPublishedAt=next.lastPublishedAt;
    const body={message:`Brazil SPSAV dashboard update by ${editor}`,content:utf8ToBase64(JSON.stringify(next,null,2)),sha:file.sha,branch:CONFIG.branch};
    const put=await fetch(API,{method:"PUT",headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!put.ok){const x=await put.text();throw new Error(`GitHub publish failed (${put.status}): ${x.slice(0,180)}`)}
    baseRevision=state.meta.revision;dirty=false;localStorage.removeItem(DRAFT_KEY);$("#syncDialog").close();render();
    $("#syncState").textContent=`Shared revision ${baseRevision} · published by ${editor}`;
    alert("Published. Teammates can refresh the dashboard to see the shared changes.");
  }catch(e){alert(e.message)}
  finally{$("#confirmSync").disabled=false;$("#confirmSync").textContent="Publish shared changes"}
}
$("#confirmSync").onclick=publish;
load();