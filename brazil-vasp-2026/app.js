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
let state=null, baseRevision=null, dirty=false, view="phase1";

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=s=>new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(s+"T12:00:00"));
const daysUntil=s=>Math.ceil((new Date(s+"T23:59:59")-new Date())/86400000);
const slug=s=>String(s).replace(/\s+/g,"-");
const complete=t=>["Complete","Not Applicable"].includes(t.status);
const evidencePct=t=>t.evidenceChecklist?.length?Math.round(100*t.evidenceChecklist.filter(x=>x.done).length/t.evidenceChecklist.length):100;

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
  return {
    meta:{...manifest.meta,revision:sharedState.revision,lastPublishedBy:sharedState.lastPublishedBy,lastPublishedAt:sharedState.lastPublishedAt},
    statusOptions:manifest.statusOptions,
    tasks
  };
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
        if(draft.dirty&&draft.baseRevision===baseRevision){state=draft.project;dirty=true}
        else {state=remote;localStorage.removeItem(DRAFT_KEY)}
      }catch{state=remote}
    } else state=remote;
    populateFilters();
    render();
    $("#syncState").textContent=`Shared revision ${baseRevision} · ${state.meta.lastPublishedBy||"initial build"}`;
  }catch(e){
    $("#syncState").textContent="Could not load shared data";
    $("#taskRows").innerHTML=`<tr><td colspan="6" class="empty">Could not load project data: ${esc(e.message)}</td></tr>`;
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
}

const VIEW_GATES={
  phase1:"Before Phase 1 filing",
  reporting:"Starts on filing",
  phase2:"Phase 2 readiness",
  "2027":"Effective 1 Jan 2027"
};

function inView(t){
  return view==="all"?true:t.gate===VIEW_GATES[view];
}

function phase1Step(t){
  if(["P1-01","P1-02"].includes(t.id)) return 1;
  if(["P1-03","P1-04","P1-05"].includes(t.id)) return 6;
  if(/^2 ·/.test(t.workstream)) return 2;
  if(/^3 ·|^4 ·/.test(t.workstream)) return 3;
  if(/^5 ·/.test(t.workstream)) return 4;
  if(/^6 ·/.test(t.workstream)) return 5;
  return 3;
}

const STEP_NAMES={
  1:"Confirm scope & transition eligibility",
  2:"Company, directors & capital",
  3:"AML, risk, cyber & control framework",
  4:"Custody, segregation & outsourcing",
  5:"Accounting & reporting readiness",
  6:"Application pack, QA & submission"
};

function filtered(){
  const q=$("#search").value.trim().toLowerCase();
  const sf=$("#statusFilter").value;
  const pf=$("#priorityFilter").value;
  const openOnly=$("#openOnly").checked;
  return state.tasks.filter(t=>{
    const hay=JSON.stringify(t).toLowerCase();
    return inView(t)&&(!q||hay.includes(q))&&(!sf||t.status===sf)&&(!pf||t.priority===pf)&&(!openOnly||!complete(t));
  }).sort((a,b)=>{
    if(view==="phase1"){
      const stepDiff=phase1Step(a)-phase1Step(b);
      if(stepDiff) return stepDiff;
    }
    return a.due.localeCompare(b.due)||a.id.localeCompare(b.id);
  });
}

function dueClass(t){
  if(complete(t)) return "";
  const d=daysUntil(t.due);
  if(d<0) return "overdue";
  if(d<=7) return "soon";
  return "";
}

function render(){
  $("#subtitle").textContent=`${state.meta.entity} · ${state.meta.group}`;
  $("#publicNotice").textContent=state.meta.publicNotice;
  $("#dirtyBanner").style.display=dirty?"block":"none";
  $("#daysLeft").textContent=Math.max(0,daysUntil(state.meta.phase1StatutoryDeadline));
  $("#phase1Guide").style.display=view==="phase1"?"block":"none";
  $$(".phase-tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  renderKpis();
  renderTable();
}

function renderKpis(){
  const items=state.tasks.filter(inView);
  const total=items.length;
  const done=items.filter(complete).length;
  const criticalOpen=items.filter(t=>t.priority==="Critical"&&!complete(t)).length;
  const blocked=items.filter(t=>["Blocked","At Risk"].includes(t.status)).length;
  const ev=items.flatMap(t=>t.evidenceChecklist||[]), evDone=ev.filter(x=>x.done).length;
  const progress=total?Math.round(done/total*100):100;
  const readiness=ev.length?Math.round(evDone/ev.length*100):100;
  const labels={phase1:"Phase 1",reporting:"Post-filing",phase2:"Phase 2","2027":"1 Jan 2027",all:"Overall"};
  $("#kpis").innerHTML=[
    `<div class="kpi"><div class="label">${labels[view]} progress</div><div class="value">${progress}%</div><div class="hint">${done} of ${total} items complete</div></div>`,
    `<div class="kpi"><div class="label">Critical items open</div><div class="value">${criticalOpen}</div><div class="hint">priority items still requiring action</div></div>`,
    `<div class="kpi"><div class="label">Blocked / at risk</div><div class="value">${blocked}</div><div class="hint">needs decision or dependency resolved</div></div>`,
    `<div class="kpi"><div class="label">Evidence readiness</div><div class="value">${readiness}%</div><div class="hint">${evDone} of ${ev.length} evidence checks done</div></div>`
  ].join("");
}

function sourcesHtml(t){
  return (t.sources||[]).map(s=>`<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("");
}

function rowHtml(t){
  const evidenceDone=(t.evidenceChecklist||[]).filter(x=>x.done).length;
  const evidenceTotal=(t.evidenceChecklist||[]).length;
  return `<tr class="task-row" data-id="${esc(t.id)}">
    <td>
      <div class="req-head"><span class="id">${esc(t.id)}</span><div><div class="req-title">${esc(t.title)}</div></div></div>
      <div class="badges"><span class="badge ${t.priority==="Critical"?"critical":"high"}">${esc(t.priority)}</span></div>
      <div class="basis">${esc(t.regulatoryBasis)}</div>
      <div class="sources">${sourcesHtml(t)}</div>
    </td>
    <td>
      <ol class="action-list">${(t.actions||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
      <div class="done-box"><strong>Done when:</strong> ${esc(t.definitionOfDone)}</div>
      ${t.risk?`<div class="risk-note"><strong>Watch:</strong> ${esc(t.risk)}</div>`:""}
    </td>
    <td class="people-block">
      <strong>Lead function</strong><p>${esc(t.leadRole)}</p>
      <strong>Support</strong><p>${esc(t.involved)}</p>
      ${t.dependencies?`<strong>Dependencies</strong><p class="dependency">${esc(t.dependencies)}</p>`:""}
      <strong>Named owner</strong><input class="owner-input" data-owner="${esc(t.id)}" value="${esc(t.owner)}" placeholder="Assign person / team" />
    </td>
    <td><div class="due ${dueClass(t)}">${fmtDate(t.due)}</div>${!complete(t)&&daysUntil(t.due)<0?`<div class="due-note">overdue</div>`:""}</td>
    <td><select class="status ${slug(t.status)}" data-status="${esc(t.id)}">${state.statusOptions.map(x=>`<option ${x===t.status?"selected":""}>${esc(x)}</option>`).join("")}</select></td>
    <td>
      <div class="evidence">${(t.evidenceChecklist||[]).map((e,i)=>`<label class="ev"><input type="checkbox" data-evidence="${esc(t.id)}" data-index="${i}" ${e.done?"checked":""}/><span>${esc(e.text)}</span></label>`).join("")}</div>
      <div class="evidence-score">${evidenceDone}/${evidenceTotal} evidence items complete</div>
      <textarea class="notes-input" data-notes="${esc(t.id)}" placeholder="Short project note">${esc(t.notes)}</textarea>
    </td>
  </tr>`;
}

function renderTable(){
  const list=filtered();
  const totalInView=state.tasks.filter(inView).length;
  $("#resultCount").textContent=`${list.length} of ${totalInView} items shown`;
  $("#emptyState").hidden=!!list.length;
  if(!list.length){$("#taskRows").innerHTML="";return}

  let html="";
  if(view==="phase1"){
    let currentStep=null;
    for(const t of list){
      const step=phase1Step(t);
      if(step!==currentStep){
        currentStep=step;
        const count=list.filter(x=>phase1Step(x)===step).length;
        html+=`<tr class="group-row"><td colspan="6">Step ${step} · ${STEP_NAMES[step]} <small>${count} item${count===1?"":"s"}</small></td></tr>`;
      }
      html+=rowHtml(t);
    }
  } else {
    html=list.map(rowHtml).join("");
  }
  $("#taskRows").innerHTML=html;
  bindInputs();
}

function bindInputs(){
  $$('[data-status]').forEach(el=>el.addEventListener('change',e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.status);
    t.status=e.target.value;
    saveDraft();renderKpis();renderTable();
  }));
  $$('[data-owner]').forEach(el=>el.addEventListener('change',e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.owner);
    t.owner=e.target.value.trim();saveDraft();
  }));
  $$('[data-notes]').forEach(el=>el.addEventListener('change',e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.notes);
    t.notes=e.target.value;saveDraft();
  }));
  $$('[data-evidence]').forEach(el=>el.addEventListener('change',e=>{
    const t=state.tasks.find(x=>x.id===e.target.dataset.evidence);
    t.evidenceChecklist[Number(e.target.dataset.index)].done=e.target.checked;
    saveDraft();renderKpis();renderTable();
  }));
}

$$('.phase-tab').forEach(el=>el.onclick=()=>{
  view=el.dataset.view;
  $("#search").value="";$("#statusFilter").value="";$("#priorityFilter").value="";$("#openOnly").checked=false;
  render();
});
['search','statusFilter','priorityFilter','openOnly'].forEach(id=>$("#"+id).addEventListener(id==='search'?'input':'change',renderTable));

async function refreshShared(){
  if(dirty&&!confirm("Discard this browser's unpublished edits and reload the shared project?")) return;
  try{
    $("#syncState").textContent="Refreshing shared data…";
    const remote=await fetchShared();
    state=remote;baseRevision=remote.meta.revision||1;dirty=false;localStorage.removeItem(DRAFT_KEY);
    populateFilters();render();
    $("#syncState").textContent=`Shared revision ${baseRevision} · refreshed`;
  }catch(e){alert("Refresh failed: "+e.message)}
}
$("#refreshBtn").onclick=refreshShared;

function download(name,text,type="application/json"){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function csvCell(v){return '"'+String(v??"").replace(/"/g,'""')+'"'}
$("#exportBtn").onclick=()=>{
  const choice=prompt("Export format: type JSON or CSV","CSV");if(!choice)return;
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
$("#publishBtn").onclick=openSync;
$("#cancelSync").onclick=()=>$("#syncDialog").close();

function utf8ToBase64(str){
  const bytes=new TextEncoder().encode(str);let binary="";bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary)
}
async function publish(){
  const token=$("#token").value.trim(),editor=$("#editorName").value.trim()||"Dashboard editor";
  if(!token){alert("Enter a GitHub token with Contents write permission.");return}
  sessionStorage.setItem("brazil-vasp-gh-token",token);localStorage.setItem("brazil-vasp-editor",editor);
  $("#confirmSync").disabled=true;$("#confirmSync").textContent="Publishing…";
  try{
    const r=await fetch(API+"?ref="+encodeURIComponent(CONFIG.branch),{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28"}});
    if(!r.ok) throw new Error(`Could not read shared file (${r.status}). Check repository access and token permission.`);
    const file=await r.json();
    const remoteText=new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g,"")),c=>c.charCodeAt(0)));
    const remote=JSON.parse(remoteText),remoteRev=remote.revision||1;
    if(remoteRev!==baseRevision) throw new Error(`Shared project is now revision ${remoteRev}, but your edits are based on revision ${baseRevision}. Refresh first.`);
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
