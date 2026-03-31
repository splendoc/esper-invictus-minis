// floor/refer.js — Refer contact log, hospital search, entry CRUD
// ══════════════════════════════════════════
// REFER CONTACT LOG
// Multiple hospital contacts per visit
// ══════════════════════════════════════════
const _referLogs = {};  // { visitId: [{ hospital, type, result, reason, at, dbId }] }

function getReferLog(id) {
  if (!_referLogs[id]) _referLogs[id] = [];
  return _referLogs[id];
}

// Load refer contact logs from Supabase
async function loadReferLogs(visitIds) {
  if (!visitIds.length) return;
  const { data } = await sb
    .from('refer_contact_log')
    .select('id, visit_id, hospital_name, hospital_type, result, reason, contacted_at')
    .in('visit_id', visitIds)
    .order('contacted_at', { ascending: true });

  if (data) {
    data.forEach(r => {
      if (!_referLogs[r.visit_id]) _referLogs[r.visit_id] = [];
      _referLogs[r.visit_id].push({
        hospital: r.hospital_name,
        type: r.hospital_type,
        result: r.result,
        reason: r.reason || '',
        at: r.contacted_at,
        dbId: r.id
      });
    });
  }
}

function buildReferContactSection(p) {
  const log = getReferLog(p.id);
  const hasAccepted = log.some(e => e.result === 'รับ');
  const reasons = typeof REFERRAL_REASONS !== 'undefined' ? REFERRAL_REASONS : ['เกินศักยภาพ','ตามสิทธิ์','ตามความประสงค์ของผู้ป่วย','Emergency PCI'];

  let html = `<div class="dispo-refer-section" onclick="event.stopPropagation()">`;

  // Contact log entries (oldest on top)
  if (log.length) {
    html += `<div class="rcl-title">CONTACT LOG</div>`;
    log.forEach((entry, i) => {
      const timeStr = new Date(entry.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      let actions = '';

      if (entry.result === 'รับ') {
        actions = '<span class="rcl-ok"><i class="fas fa-check-circle"></i> รับ</span>';
      } else if (entry.result === 'ไม่รับ') {
        actions = `<span class="rcl-no"><i class="fas fa-times-circle"></i> ไม่รับ</span>
          <button class="rcl-change-btn" onclick="event.stopPropagation();rclDeleteEntry('${p.id}',${i})" title="ลบ"><i class="fas fa-trash" style="font-size:8px"></i></button>`;
      } else if (entry.result === 'ยกเลิก') {
        actions = '<span class="rcl-cancel"><i class="fas fa-ban"></i> ยกเลิก</span>';
      } else {
        // รอตอบ — show รับ, ไม่รับ, แก้ไข, ลบ
        actions = `<span class="rcl-wait"><i class="fas fa-clock"></i> รอตอบ</span>
          <button class="rcl-change-btn rcl-res-ok" onclick="event.stopPropagation();rclUpdateResult('${p.id}',${i},'รับ')" title="รับ"><i class="fas fa-check"></i></button>
          <button class="rcl-change-btn rcl-res-no" onclick="event.stopPropagation();rclUpdateResult('${p.id}',${i},'ไม่รับ')" title="ไม่รับ"><i class="fas fa-times"></i></button>
          <button class="rcl-change-btn" onclick="event.stopPropagation();rclEditEntry('${p.id}',${i})" title="แก้ไข"><i class="fas fa-pen" style="font-size:8px"></i></button>
          <button class="rcl-change-btn" onclick="event.stopPropagation();rclDeleteEntry('${p.id}',${i})" title="ลบ"><i class="fas fa-trash" style="font-size:8px"></i></button>`;
      }

      html += `<div class="rcl-entry" id="rcl-entry-${p.id}-${i}">
        <span class="rcl-time">${timeStr}</span>
        <span class="rcl-name">${entry.hospital}</span>
        ${entry.reason ? `<span class="rcl-reason">${entry.reason}</span>` : ''}
        <div style="margin-left:auto;display:flex;align-items:center;gap:3px">${actions}</div>
      </div>`;
    });
  }

  // Add new contact form — hospital + reason dropdown + SAVE
  if (!hasAccepted) {
    html += `<div class="rcl-add" id="rcl-add-${p.id}">
      <div class="rcl-add-row">
        <input class="fin-input" id="rcl-hosp-${p.id}" placeholder="ชื่อโรงพยาบาล..."
          style="flex:1;font-size:12px;padding:5px 8px"
          oninput="rclHospSearch('${p.id}',this.value)" onfocus="rclHospSearch('${p.id}',this.value)"
          onkeydown="if(typeof finDropKeydown==='function')finDropKeydown(event,'rcl-hosp-drop-${p.id}')">
        <div class="rcl-hosp-drop" id="rcl-hosp-drop-${p.id}"></div>
      </div>
      <select class="fin-select" id="rcl-reason-${p.id}" style="font-size:12px;padding:5px 8px;margin-top:4px">
        <option value="">— เหตุผลส่งต่อ —</option>
        ${reasons.map(r => `<option value="${r}">${r}</option>`).join('')}
      </select>
      <div style="display:flex;gap:4px;margin-top:4px;align-items:center">
        <select class="fin-select" style="font-size:12px;padding:5px 8px;flex:0 0 auto;width:120px;color:var(--text-dim)" disabled>
          <option>รอตอบ</option>
        </select>
        <button class="rcl-save-btn" style="margin-top:0;flex:1" onclick="event.stopPropagation();rclAddEntry('${p.id}')">
          <i class="fas fa-plus" style="margin-right:4px"></i> บันทึก
        </button>
      </div>
    </div>`;
  }

  html += `</div>`;
  return html;
}

// Hospital search for refer contact log
function rclHospSearch(visitId, query) {
  const drop = document.getElementById('rcl-hosp-drop-' + visitId);
  if (!drop) return;
  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const hospitals = typeof HOSPITAL_LIST !== 'undefined' ? HOSPITAL_LIST : [];
  const matches = hospitals.filter(h => h.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(h =>
    `<div class="fin-dx-item" onmousedown="rclHospPick('${visitId}','${h.name.replace(/'/g,"\\'")}')">${h.name}</div>`
  ).join('');
  drop.style.display = 'block';
}

function rclHospPick(visitId, name) {
  const input = document.getElementById('rcl-hosp-' + visitId);
  if (input) input.value = name;
  const drop = document.getElementById('rcl-hosp-drop-' + visitId);
  if (drop) drop.style.display = 'none';
}

// Add a contact log entry — always saves as รอตอบ
async function rclAddEntry(visitId) {
  const hospInput = document.getElementById('rcl-hosp-' + visitId);
  const reasonSelect = document.getElementById('rcl-reason-' + visitId);
  const hospital = hospInput?.value?.trim();
  const result = 'รอตอบ';
  if (!hospital) {
    hospInput?.focus();
    return;
  }

  const log = getReferLog(visitId);
  const hospitals = typeof HOSPITAL_LIST !== 'undefined' ? HOSPITAL_LIST : [];
  const match = hospitals.find(h => h.name === hospital);

  const at = new Date().toISOString();
  const reasonVal = reasonSelect?.value || '';
  const typeVal = match?.type || 'unknown';

  const { data: inserted } = await sb.from('refer_contact_log').insert({
    visit_id: visitId,
    hospital_name: hospital,
    hospital_type: typeVal,
    result,
    reason: reasonVal,
    contacted_at: at
  }).select('id').single();

  log.push({
    hospital,
    type: typeVal,
    result,
    reason: reasonVal,
    at,
    dbId: inserted?.id || null
  });

  // Clear inputs
  if (hospInput) hospInput.value = '';
  if (reasonSelect) reasonSelect.value = '';

  const p = patients.find(x => x.id === visitId);
  const icon = result === 'รับ' ? 'fa-check-circle' : result === 'ไม่รับ' ? 'fa-times-circle' : 'fa-clock';
  const color = result === 'รับ' ? '#22c55e' : result === 'ไม่รับ' ? '#ef4444' : '#f59e0b';
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-size:12px;color:var(--text-sub)">${hospital}</div>
      <div style="font-size:12px;color:${color};margin-top:2px"><i class="fas ${icon}" style="margin-right:4px"></i>${result}</div>
    </div>`, color, icon);
  }

  // Re-open QV to refresh the contact log
  if (p) openQV(p.id);
}

// Update a รอตอบ entry to รับ or ไม่รับ
async function rclUpdateResult(visitId, entryIndex, newResult) {
  const log = getReferLog(visitId);
  if (!log[entryIndex]) return;

  log[entryIndex].result = newResult;

  // If accepted → auto-cancel all other รอตอบ + set referral hospital + change status to รอ Refer
  if (newResult === 'รับ') {
    const f = getFinalData(visitId);
    f.referralHospital = log[entryIndex].hospital;
    if (log[entryIndex].hospital.includes('ศรีธัญญา')) {
      f.referralReason = 'เกินศักยภาพ';
    }

    // Auto-cancel all other รอตอบ entries
    for (let i = 0; i < log.length; i++) {
      if (i !== entryIndex && log[i].result === 'รอตอบ') {
        log[i].result = 'ยกเลิก';
        if (log[i].dbId) await sb.from('refer_contact_log').update({ result:'ยกเลิก' }).eq('id', log[i].dbId);
      }
    }

    // Change status to รอ Refer
    const p = patients.find(x => x.id === visitId);
    if (p && p.status !== 'รอส่งตัวโรงพยาบาลอื่น') {
      await updateVisitStatus(visitId, 'รอส่งตัวโรงพยาบาลอื่น', 'active', p.activatedAt);
      const fresh = await loadPatients();
      patients.length = 0;
      fresh.forEach(px => patients.push(px));
      renderSit();
      renderSFilter();
    }
  }

  // Persist result update
  if (log[entryIndex].dbId) await sb.from('refer_contact_log').update({ result:newResult }).eq('id', log[entryIndex].dbId);

  // Re-open QV to refresh
  const p = patients.find(x => x.id === visitId);
  if (p) openQV(p.id);

  const color = newResult === 'รับ' ? '#22c55e' : '#ef4444';
  const icon = newResult === 'รับ' ? 'fa-check-circle' : 'fa-times-circle';
  showToast(`<div style="line-height:1.3">
    <div style="font-size:12px;color:var(--text-sub)">${log[entryIndex].hospital}</div>
    <div style="font-size:12px;color:${color};margin-top:2px"><i class="fas ${icon}" style="margin-right:4px"></i>${newResult}</div>
  </div>`, color, icon);
}

// Delete a contact log entry
async function rclDeleteEntry(visitId, entryIndex) {
  const log = getReferLog(visitId);
  if (!log[entryIndex]) return;
  const name = log[entryIndex].hospital;
  const dbId = log[entryIndex].dbId;
  log.splice(entryIndex, 1);

  if (dbId) await sb.from('refer_contact_log').delete().eq('id', dbId);

  const p = patients.find(x => x.id === visitId);
  if (p) openQV(p.id);
  showToast(`ลบ ${name}`, '#ef4444', 'fa-trash');
}

// Edit a contact log entry — re-populate the add form with existing data
function rclEditEntry(visitId, entryIndex) {
  const log = getReferLog(visitId);
  if (!log[entryIndex]) return;
  const entry = log[entryIndex];

  // Remove old entry
  log.splice(entryIndex, 1);

  // Re-open QV — the add form will be empty, populate it
  const p = patients.find(x => x.id === visitId);
  if (p) {
    openQV(p.id);
    // Fill in the form with old values after render
    setTimeout(() => {
      const hospInput = document.getElementById('rcl-hosp-' + visitId);
      const reasonSelect = document.getElementById('rcl-reason-' + visitId);
      if (hospInput) hospInput.value = entry.hospital;
      if (reasonSelect) reasonSelect.value = entry.reason || '';
    }, 50);
  }
}
