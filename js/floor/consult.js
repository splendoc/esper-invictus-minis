// floor/consult.js — Consultation log (multiple consults per visit)
// Shows in QV when status = ปรึกษาแพทย์เฉพาะทาง

// ══════════════════════════════════════════
// IN-MEMORY CONSULT LOG
// ══════════════════════════════════════════
const _consultLogs = {};  // { visitId: [{ doctor, department, license, at }] }

function getConsultLog(visitId) {
  if (!_consultLogs[visitId]) _consultLogs[visitId] = [];
  return _consultLogs[visitId];
}

// ══════════════════════════════════════════
// BUILD CONSULT SECTION (for QV panel)
// ══════════════════════════════════════════
function buildConsultSection(p) {
  const log = getConsultLog(p.id);

  let html = `<div class="dispo-refer-section" onclick="event.stopPropagation()">
    <div class="rcl-title"><i class="fas fa-user-doctor" style="color:#60a5fa;margin-right:4px"></i> CONSULT LOG</div>`;

  // Existing consult entries (oldest on top)
  if (log.length) {
    log.forEach((entry, i) => {
      const timeStr = new Date(entry.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
      html += `<div class="rcl-entry">
        <span class="rcl-time">${timeStr}</span>
        <span class="rcl-name">${entry.doctor}</span>
        <span style="font-size:10px;color:var(--text-dim)">${deptLabels[entry.department] || entry.department}</span>
        ${entry.license ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text-faint)">${entry.license}</span>` : ''}
        <button class="rcl-change-btn" onclick="event.stopPropagation();consultDelete('${p.id}',${i})" title="ลบ" style="margin-left:auto"><i class="fas fa-trash" style="font-size:8px"></i></button>
      </div>`;
    });
  }

  // Add new consult form — doctor auto-suggest (locks department)
  html += `<div class="rcl-add" id="consult-add-${p.id}">
    <div style="position:relative">
      <input class="fin-input" id="consult-doc-${p.id}" placeholder="พิมพ์ชื่อแพทย์ที่ปรึกษา..."
        style="font-size:12px;padding:5px 8px"
        oninput="consultDocSearch('${p.id}',this.value)" onfocus="consultDocSearch('${p.id}',this.value)"
        onkeydown="consultDocKeydown(event,'${p.id}')"
        onblur="setTimeout(()=>{const d=document.getElementById('consult-doc-drop-${p.id}');if(d)d.style.display='none'},200)">
      <div class="fin-dx-drop" id="consult-doc-drop-${p.id}"></div>
    </div>
    <div style="display:flex;gap:4px;margin-top:4px;align-items:center">
      <span id="consult-dept-${p.id}" style="font-family:'Sarabun',sans-serif;font-size:11px;color:var(--text-dim);flex:1"></span>
      <button class="rcl-save-btn" style="margin-top:0;flex:0 0 auto;padding:5px 14px" onclick="event.stopPropagation();consultAdd('${p.id}')">
        <i class="fas fa-plus" style="margin-right:3px"></i> เพิ่ม Consult
      </button>
    </div>
  </div>`;

  html += `</div>`;
  return html;
}

// ══════════════════════════════════════════
// CONSULT DOCTOR SEARCH (all in-hospital doctors)
// ══════════════════════════════════════════
let _consultPick = {};  // { visitId: { name, license, dept } }
let _consultDropIdx = {};

function consultDocSearch(visitId, query) {
  const drop = document.getElementById('consult-doc-drop-' + visitId);
  if (!drop) return;
  _consultPick[visitId] = null;
  document.getElementById('consult-dept-' + visitId).textContent = '';

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const deptDocs = [];
  if (typeof DEPT_DOCTORS !== 'undefined') {
    for (const [dept, docs] of Object.entries(DEPT_DOCTORS)) {
      for (const d of docs) {
        deptDocs.push({ name: d.name, license: d.license, dept });
      }
    }
  }

  const matches = deptDocs.filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  if (!matches.length) { drop.style.display = 'none'; return; }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  drop.innerHTML = matches.map(d =>
    `<div class="fin-dx-item" onmousedown="consultDocPick('${visitId}','${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''} <span style="font-size:10px;color:var(--text-dim)">${deptLabels[d.dept] || d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

function consultDocPick(visitId, name, license, dept) {
  _consultPick[visitId] = { name, license, dept };
  const input = document.getElementById('consult-doc-' + visitId);
  if (input) { input.value = name; input.classList.add('fin-input-selected'); }
  const drop = document.getElementById('consult-doc-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const deptEl = document.getElementById('consult-dept-' + visitId);
  if (deptEl) deptEl.textContent = deptLabels[dept] || dept;
}

function consultDocKeydown(e, visitId) {
  const dropId = 'consult-doc-drop-' + visitId;
  if (typeof finDropKeydown === 'function') {
    finDropKeydown(e, dropId);
  }
}

// ══════════════════════════════════════════
// ADD / DELETE CONSULT
// ══════════════════════════════════════════
async function consultAdd(visitId) {
  const pick = _consultPick[visitId];
  const input = document.getElementById('consult-doc-' + visitId);

  if (!pick || !pick.name) {
    if (input) input.focus();
    return;
  }

  const log = getConsultLog(visitId);
  log.push({
    doctor: pick.name,
    department: pick.dept,
    license: pick.license || '',
    at: new Date().toISOString()
  });

  // Persist to Supabase
  try {
    await sb.from('consult_log').insert({
      visit_id: visitId,
      department: pick.dept,
      doctor: pick.name,
      doctor_license: pick.license || null
    });
  } catch (err) {
    console.error('Consult save error:', err);
  }

  // Clear
  _consultPick[visitId] = null;
  if (input) { input.value = ''; input.classList.remove('fin-input-selected'); }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  logAudit(visitId, 'consult_add', 'consult', { next:pick.name, detail:{ department:pick.dept, license:pick.license } });
  showToast(`<div style="line-height:1.3">
    <div style="font-size:12px;color:var(--text-sub)">Consult ${deptLabels[pick.dept] || pick.dept}</div>
    <div style="font-size:12px;color:#60a5fa;margin-top:2px"><i class="fas fa-user-doctor" style="margin-right:4px"></i>${pick.name}</div>
  </div>`, '#60a5fa', 'fa-user-doctor');

  // Refresh QV
  const p = patients.find(x => x.id === visitId);
  if (p) openQV(p.id);
}

function consultDelete(visitId, idx) {
  const log = getConsultLog(visitId);
  if (!log[idx]) return;
  log.splice(idx, 1);
  // TODO: delete from Supabase consult_log
  const p = patients.find(x => x.id === visitId);
  if (p) openQV(p.id);
  showToast('ลบ Consult แล้ว', '#ef4444', 'fa-trash');
}
