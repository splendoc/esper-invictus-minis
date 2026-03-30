// floor/dispo.js — Disposition flow: จองเตียง (multi), ส่งเวร, ย้ายผู้ป่วย
// Flow: Decision to admit → Bed Request(s) → ส่งเวร (pick from beds) → auto รอขึ้นหอผู้ป่วย → ย้าย → finalized

// ══════════════════════════════════════════
// IN-MEMORY DISPOSITION STATE
// ══════════════════════════════════════════
const _dispo = {};

function getDispoState(id) {
  if (!_dispo[id]) _dispo[id] = {
    admitAt: null,       // Plan Admit timestamp — gate for admit flow
    referAt: null,       // Plan Refer timestamp — gate for refer flow
    beds: [],            // [{ ward, at, cancelled }]  — multiple bed requests
    handoverWard: null,  // { ward, at }  — which bed was handed over
    handoverReferAt: null,
    moveAt: null
  };
  return _dispo[id];
}

// ══════════════════════════════════════════
// STATUSES THAT TRIGGER ACTIONS
// ══════════════════════════════════════════
const ADMIT_WAIT_STATUSES = new Set(['รอขึ้นหอผู้ป่วย']);
const REFER_WAIT_STATUSES = new Set(['รอส่งตัวโรงพยาบาลอื่น']);
const REFER_CONTACT_STATUS = 'ติดต่อส่งตัวโรงพยาบาลอื่น';
const ADMIT_WARD_STATUSES = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา']);
// WARD_LIST is defined in data.js

// ══════════════════════════════════════════
// BUILD DISPO ZONE (Zone 3 on patient cards)
// Called from buildCard() in core.js
// ══════════════════════════════════════════
function buildDispoZone(p) {
  if (p.tab === 'finalized') return buildFinalizedDispoZone(p);
  if (p.tab !== 'active') return '';

  const d = getDispoState(p.id);

  // ── Gate: must choose Plan Admit or Plan Refer first ──
  if (!d.admitAt && !d.referAt) {
    return `<div class="dispo-zone">
      <div class="dispo-actions">
        <button class="dispo-btn dispo-admit" onclick="event.stopPropagation();dispoDecideAdmit('${p.id}')">
          <i class="fas fa-file-medical"></i> Plan Admit
        </button>
        <button class="dispo-btn dispo-refer" onclick="event.stopPropagation();dispoDecideRefer('${p.id}')">
          <i class="fas fa-ambulance"></i> Plan Refer
        </button>
      </div>
    </div>`;
  }

  const rows = [];
  let buttons = '';
  const referLog = (typeof getReferLog === 'function') ? getReferLog(p.id) : [];
  const hasAccepted = referLog.some(e => e.result === 'รับ');

  // ══════ ADMIT FLOW ══════
  if (d.admitAt) {
    const admitTime = new Date(d.admitAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
    rows.push(`<div class="dispo-row dispo-row-hl">
      <i class="fas fa-file-medical" style="font-size:11px;color:#60a5fa;width:16px;text-align:center"></i>
      <span style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:600;color:#93c5fd;flex:1">Plan Admit</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#60a5fa">${admitTime}</span>
      <button class="dispo-row-x" onclick="event.stopPropagation();dispoUndoAdmit('${p.id}')" title="ยกเลิก"><i class="fas fa-times"></i></button>
    </div>`);

    const activeBeds = d.beds.filter(b => !b.cancelled);
    const cancelledBeds = d.beds.filter(b => b.cancelled);

    activeBeds.forEach(b => {
      const timeStr = new Date(b.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      const isHandover = d.handoverWard && d.handoverWard.ward === b.ward;
      rows.push(`<div class="dispo-row${isHandover ? ' dispo-row-hl' : ''}">
        <i class="fas fa-bed" style="font-size:11px;color:#86efac;width:16px;text-align:center"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:600;color:var(--text-primary);flex:1">จองเตียง ${b.ward}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${timeStr}</span>
        <button class="dispo-row-x" onclick="event.stopPropagation();cancelBed('${p.id}',${d.beds.indexOf(b)})" title="ยกเลิก"><i class="fas fa-times"></i></button>
      </div>`);
    });

    cancelledBeds.forEach(b => {
      const timeStr = new Date(b.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      rows.push(`<div class="dispo-row dispo-row-cancel">
        <i class="fas fa-bed" style="font-size:11px;width:16px;text-align:center"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;text-decoration:line-through;flex:1">${b.ward}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px">${timeStr}</span>
      </div>`);
    });

    if (d.handoverWard) {
      const hwTime = new Date(d.handoverWard.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      rows.push(`<div class="dispo-row dispo-row-hl">
        <i class="fas fa-people-arrows" style="font-size:11px;color:#86efac;width:16px;text-align:center"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:600;color:#86efac;flex:1">ส่งเวร ${d.handoverWard.ward}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#86efac">${hwTime}</span>
        <button class="dispo-row-x" onclick="event.stopPropagation();cancelHandover('${p.id}')" title="ยกเลิกส่งเวร"><i class="fas fa-times"></i></button>
      </div>`);
    }

    // Admit action buttons
    buttons += `<button class="dispo-btn" onclick="event.stopPropagation();openBedPicker('${p.id}',event)">
      <i class="fas fa-bed"></i> จองเตียง
    </button>`;
    if (activeBeds.length > 0 && !d.handoverWard) {
      buttons += `<button class="dispo-btn" onclick="event.stopPropagation();openHandoverPicker('${p.id}',event)">
        <i class="fas fa-people-arrows"></i> ส่งเวร
      </button>`;
    }
    if (d.handoverWard && !d.moveAt) {
      buttons += `<button class="dispo-btn dispo-move" onclick="event.stopPropagation();dispoMoveAdmit('${p.id}')">
        <i class="fas fa-person-walking-arrow-right"></i> ย้าย → ${d.handoverWard.ward}
      </button>`;
    }
  }
  // Show Plan Admit button if not yet decided
  if (!d.admitAt) {
    buttons += `<button class="dispo-btn dispo-admit" onclick="event.stopPropagation();dispoDecideAdmit('${p.id}')">
      <i class="fas fa-file-medical"></i> Plan Admit
    </button>`;
  }

  // ══════ REFER FLOW ══════
  if (d.referAt) {
    const referTime = new Date(d.referAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
    rows.push(`<div class="dispo-row dispo-row-hl">
      <i class="fas fa-ambulance" style="font-size:11px;color:#c084fc;width:16px;text-align:center"></i>
      <span style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:600;color:#d8b4fe;flex:1">Plan Refer</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c084fc">${referTime}</span>
      <button class="dispo-row-x" onclick="event.stopPropagation();dispoUndoRefer('${p.id}')" title="ยกเลิก"><i class="fas fa-times"></i></button>
    </div>`);

    // Show contact log entries as compact rows
    referLog.forEach(entry => {
      const timeStr = new Date(entry.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      const icon = entry.result === 'รับ' ? 'fa-check-circle' : entry.result === 'ไม่รับ' ? 'fa-times-circle' : entry.result === 'ยกเลิก' ? 'fa-ban' : 'fa-clock';
      const color = entry.result === 'รับ' ? '#86efac' : entry.result === 'ไม่รับ' ? '#fca5a5' : entry.result === 'ยกเลิก' ? 'var(--text-faint)' : '#fde047';
      const isCancelled = entry.result === 'ไม่รับ' || entry.result === 'ยกเลิก';
      rows.push(`<div class="dispo-row${entry.result === 'รับ' ? ' dispo-row-hl' : ''}${isCancelled ? ' dispo-row-cancel' : ''}">
        <i class="fas ${icon}" style="font-size:11px;color:${color};width:16px;text-align:center"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;${isCancelled ? 'text-decoration:line-through;' : ''}flex:1">${entry.hospital}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${timeStr}</span>
      </div>`);
    });

    if (d.handoverReferAt) {
      const hrTime = new Date(d.handoverReferAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      rows.push(`<div class="dispo-row dispo-row-hl">
        <i class="fas fa-people-arrows" style="font-size:11px;color:#d8b4fe;width:16px;text-align:center"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:600;color:#d8b4fe;flex:1">ส่งเวร Refer</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#d8b4fe">${hrTime}</span>
        <button class="dispo-row-x" onclick="event.stopPropagation();cancelHandoverRefer('${p.id}')" title="ยกเลิกส่งเวร"><i class="fas fa-times"></i></button>
      </div>`);
    }

    // Refer action buttons
    if (!hasAccepted) {
      buttons += `<button class="dispo-btn dispo-refer" onclick="event.stopPropagation();openQV('${p.id}')">
        <i class="fas fa-phone"></i> ติดต่อ Refer
      </button>`;
    }
    if (hasAccepted && !d.handoverReferAt) {
      buttons += `<button class="dispo-btn dispo-refer" onclick="event.stopPropagation();dispoHandoverRefer('${p.id}')">
        <i class="fas fa-people-arrows"></i> ส่งเวร Refer
      </button>`;
    }
    if (d.handoverReferAt && !d.moveAt) {
      buttons += `<button class="dispo-btn dispo-move" onclick="event.stopPropagation();dispoMoveRefer('${p.id}')">
        <i class="fas fa-ambulance"></i> ส่งแล้ว
      </button>`;
    }
  }
  // Show Plan Refer button if not yet decided
  if (!d.referAt) {
    buttons += `<button class="dispo-btn dispo-refer" onclick="event.stopPropagation();dispoDecideRefer('${p.id}')">
      <i class="fas fa-ambulance"></i> Plan Refer
    </button>`;
  }

  if (buttons) {
    rows.push(`<div class="dispo-actions">${buttons}</div>`);
  }

  if (!rows.length) return '';

  // Expandable if more than 6 rows
  const needExpand = rows.length > 6;
  const zoneId = 'dz-' + p.id;
  const collapsed = needExpand ? ' dispo-collapsed' : '';

  let html = `<div class="dispo-zone${collapsed}" id="${zoneId}">`;
  html += rows.join('');
  if (needExpand) {
    html += `<button class="dispo-expand-btn" onclick="event.stopPropagation();toggleDispoExpand('${zoneId}')">
      <span class="dispo-expand-more"><i class="fas fa-chevron-down" style="font-size:9px"></i> แสดงทั้งหมด (${rows.length})</span>
      <span class="dispo-expand-less"><i class="fas fa-chevron-up" style="font-size:9px"></i> ย่อ</span>
    </button>`;
  }
  html += '</div>';
  return html;
}

// ── Finalized card: timeline + completion badge ──
function buildFinalizedDispoZone(p) {
  const d = getDispoState(p.id);
  const tl = []; // timeline entries: { icon, color, label, time }

  function tf(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
  }

  // Arrived
  if (p.arrivedAt) tl.push({ icon:'fa-right-to-bracket', color:'var(--text-dim)', label:'Triage', time:tf(p.arrivedAt) });

  // Activated
  if (p.activatedAt) tl.push({ icon:'fa-play', color:'#60a5fa', label:'Active', time:tf(p.activatedAt) });

  // Plan Admit
  if (d.admitAt) tl.push({ icon:'fa-file-medical', color:'#93c5fd', label:'Plan Admit', time:tf(d.admitAt) });

  // Bed requests
  d.beds.filter(b => !b.cancelled).forEach(b => {
    tl.push({ icon:'fa-bed', color:'#86efac', label:'จองเตียง ' + b.ward, time:tf(b.at) });
  });

  // Plan Refer
  if (d.referAt) tl.push({ icon:'fa-ambulance', color:'#d8b4fe', label:'Plan Refer', time:tf(d.referAt) });

  // Refer accepted
  const referLog = (typeof getReferLog === 'function') ? getReferLog(p.id) : [];
  const accepted = referLog.find(e => e.result === 'รับ');
  if (accepted) tl.push({ icon:'fa-check-circle', color:'#86efac', label:'รับ — ' + accepted.hospital, time:tf(accepted.at) });

  // Handover ward
  if (d.handoverWard) tl.push({ icon:'fa-people-arrows', color:'#86efac', label:'ส่งเวร ' + d.handoverWard.ward, time:tf(d.handoverWard.at) });

  // Handover refer
  if (d.handoverReferAt) tl.push({ icon:'fa-people-arrows', color:'#d8b4fe', label:'ส่งเวร Refer', time:tf(d.handoverReferAt) });

  // Move
  if (d.moveAt) tl.push({ icon:'fa-person-walking-arrow-right', color:'#a78bfa', label:'ย้ายผู้ป่วย', time:tf(d.moveAt) });

  // Finalized
  if (p.finalizedAt) tl.push({ icon:'fa-flag-checkered', color:'var(--text-muted)', label:sc(p.status).label, time:tf(new Date(p.finalizedAt).toISOString()) });

  // Build timeline HTML
  let html = '<div class="dispo-zone">';

  if (tl.length) {
    html += '<div class="dispo-tl">';
    tl.forEach((e, i) => {
      const last = i === tl.length - 1;
      html += `<div class="dispo-tl-row">
        <div class="dispo-tl-dot" style="color:${e.color}"><i class="fas ${e.icon}" style="font-size:10px"></i></div>
        ${!last ? '<div class="dispo-tl-line"></div>' : ''}
        <span class="dispo-tl-label">${e.label}</span>
        <span class="dispo-tl-time">${e.time}</span>
      </div>`;
    });
    html += '</div>';
  }

  // Completion badge
  if (p.dataComplete) {
    html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
      <span class="dispo-badge-ok"><i class="fas fa-check-circle"></i> ข้อมูลครบ</span>
      <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)"><i class="fas fa-clock"></i> auto-remove</span>
    </div>`;
  } else {
    html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
      <span class="dispo-badge-inc"><i class="fas fa-exclamation-circle"></i> ข้อมูลไม่ครบ</span>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════
// DECISION TO ADMIT
// ══════════════════════════════════════════
function dispoDecideAdmit(visitId) {
  const d = getDispoState(visitId);
  d.admitAt = new Date().toISOString();
  renderCards();

  const p = patients.find(x => x.id === visitId);
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#93c5fd;margin-top:2px"><i class="fas fa-file-medical" style="margin-right:4px"></i>Plan Admit</div>
    </div>`, '#60a5fa', 'fa-file-medical');
  }
}

async function dispoDecideRefer(visitId) {
  const d = getDispoState(visitId);
  d.referAt = new Date().toISOString();

  const p = patients.find(x => x.id === visitId);
  if (p && p.tab === 'active') {
    p.status = 'ติดต่อส่งตัวโรงพยาบาลอื่น';
    await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);
  }

  renderSit();
  renderSFilter();
  renderCards();

  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#d8b4fe;margin-top:2px"><i class="fas fa-ambulance" style="margin-right:4px"></i>Plan Refer</div>
    </div>`, '#c084fc', 'fa-ambulance');
  }
}

function dispoUndoRefer(visitId) {
  showCancelReason(visitId, 'refer', async (reason) => {
    const d = getDispoState(visitId);
    d.referAt = null;
    d.handoverReferAt = null;
    d.lastReferCancelReason = reason;

    const p = patients.find(x => x.id === visitId);
    if (p && (p.status === 'ติดต่อส่งตัวโรงพยาบาลอื่น' || p.status === 'รอส่งตัวโรงพยาบาลอื่น')) {
      p.status = 'สังเกตอาการ';
      await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);
    }
    renderSit();
    renderSFilter();
    renderCards();
  });
}

function cancelHandoverRefer(visitId) {
  showCancelReason(visitId, 'handoverRefer', async (reason) => {
    const d = getDispoState(visitId);
    d.handoverReferAt = null;
    d.handoverReferCancelReason = reason;
    renderCards();
  });
}

function dispoUndoAdmit(visitId) {
  showCancelReason(visitId, 'admit', (reason) => {
    const d = getDispoState(visitId);
    d.admitAt = null;
    d.beds = [];
    d.handoverWard = null;
    d.moveAt = null;
    d.lastCancelReason = reason;
    renderCards();
  });
}

async function cancelHandover(visitId) {
  showCancelReason(visitId, 'handover', async (reason) => {
    const d = getDispoState(visitId);
    const p = patients.find(x => x.id === visitId);
    d.handoverWard = null;
    d.handoverCancelReason = reason;

    // Move patient back from รอขึ้นหอผู้ป่วย to previous active status
    if (p && p.status === 'รอขึ้นหอผู้ป่วย') {
      p.status = 'สังเกตอาการ';
      await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);
    }

    renderSit();
    renderSFilter();
    renderCards();
  });
}

// ══════════════════════════════════════════
// CANCEL REASON PICKER
// ══════════════════════════════════════════
const CANCEL_REASONS = [
  'เตียงไม่ว่าง',
  'ผู้ป่วยปฏิเสธ',
  'เปลี่ยนแผนการรักษา',
  'ย้ายไปวอร์ดอื่น',
  'แพทย์เปลี่ยนคำสั่ง',
  'อาการดีขึ้น ไม่ต้อง Admit',
  'อาการแย่ลง',
  'อื่นๆ',
];

let _cancelCallback = null;

function showCancelReason(visitId, type, callback) {
  closeCancelReason();
  _cancelCallback = callback;

  const div = document.createElement('div');
  div.className = 'kb-drop-picker';
  div.id = 'cancel-reason-picker';

  let html = `<div class="dp-hdr">เหตุผลการยกเลิก</div>`;
  CANCEL_REASONS.forEach(r => {
    html += `<div class="dp-item" onclick="event.stopPropagation();pickCancelReason('${r.replace(/'/g,"\\'")}')">
      <span class="dp-dot" style="background:#f59e0b"></span>
      <span class="dp-label">${r}</span>
    </div>`;
  });
  div.innerHTML = html;

  // Position centered on screen
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    const rect = div.getBoundingClientRect();
    div.style.left = ((window.innerWidth - rect.width) / 2) + 'px';
    div.style.top = ((window.innerHeight - rect.height) / 2) + 'px';
    div.style.visibility = '';
  });

  setTimeout(() => document.addEventListener('click', _cancelReasonOutside), 0);
}

function _cancelReasonOutside(e) {
  const picker = document.getElementById('cancel-reason-picker');
  if (picker && !picker.contains(e.target)) closeCancelReason();
}

function closeCancelReason() {
  const el = document.getElementById('cancel-reason-picker');
  if (el) el.remove();
  document.removeEventListener('click', _cancelReasonOutside);
  _cancelCallback = null;
}

function pickCancelReason(reason) {
  const cb = _cancelCallback;
  closeCancelReason();
  if (cb) cb(reason);
}

// ══════════════════════════════════════════
// EXPAND / COLLAPSE
// ══════════════════════════════════════════
function toggleDispoExpand(zoneId) {
  const el = document.getElementById(zoneId);
  if (el) el.classList.toggle('dispo-collapsed');
}

// ══════════════════════════════════════════
// FLOATING PICKER — reusable for bed/handover
// ══════════════════════════════════════════
let _floatingPickerId = null;

function showFloatingPicker(btnEl, id, title, items) {
  // items = [{ label, icon?, done?, onclick }]
  closeFloatingPicker();
  _floatingPickerId = id;

  const div = document.createElement('div');
  div.className = 'kb-drop-picker';
  div.id = 'floating-picker';

  let html = `<div class="dp-hdr">${title}</div>`;
  items.forEach(it => {
    const cls = it.done ? ' style="opacity:.4;cursor:default"' : '';
    const click = it.done ? '' : `onclick="event.stopPropagation();${it.onclick}"`;
    html += `<div class="dp-item"${cls} ${click}>
      ${it.done ? '<i class="fas fa-check" style="font-size:10px;color:#86efac;width:14px"></i>' : `<span class="dp-dot" style="background:${it.dot||'#22c55e'}"></span>`}
      <span class="dp-label">${it.label}</span>
    </div>`;
  });
  div.innerHTML = html;

  // Position near button
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const br = btnEl.getBoundingClientRect();
    const rect = div.getBoundingClientRect();
    const vw = window.innerWidth / z, vh = window.innerHeight / z;
    let left = br.left / z;
    let top = (br.bottom / z) + 4;
    if(left + rect.width > vw - 8) left = vw - rect.width - 8;
    if(left < 8) left = 8;
    if(top + rect.height > vh - 8) top = (br.top / z) - rect.height - 4;
    if(top < 8) top = 8;
    div.style.left = left+'px';
    div.style.top = top+'px';
    div.style.visibility = '';
  });

  setTimeout(() => document.addEventListener('click', _floatingPickerOutside), 0);
}

function _floatingPickerOutside(e) {
  const picker = document.getElementById('floating-picker');
  if (picker && !picker.contains(e.target)) closeFloatingPicker();
}

function closeFloatingPicker() {
  const el = document.getElementById('floating-picker');
  if (el) el.remove();
  document.removeEventListener('click', _floatingPickerOutside);
  _floatingPickerId = null;
}

// ══════════════════════════════════════════
// BED REQUEST (จองเตียง) — multiple
// ══════════════════════════════════════════
function openBedPicker(visitId, evt) {
  const btn = evt ? evt.currentTarget : document.getElementById('card-'+visitId);
  const d = getDispoState(visitId);
  const activeBedWards = new Set(d.beds.filter(b => !b.cancelled).map(b => b.ward));

  const items = WARD_LIST.map(w => ({
    label: w,
    dot: '#22c55e',
    done: activeBedWards.has(w),
    onclick: `selectBedWard('${visitId}','${w}')`
  }));

  showFloatingPicker(btn, visitId, 'จองเตียง — เลือกวอร์ด', items);
}

function selectBedWard(visitId, ward) {
  closeFloatingPicker();
  const d = getDispoState(visitId);
  d.beds.push({ ward, at: new Date().toISOString(), cancelled: false });
  renderCards();

  const p = patients.find(x => x.id === visitId);
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-bed" style="margin-right:4px"></i>จองเตียง ${ward}</div>
    </div>`, '#22c55e', 'fa-bed');
  }
}

function cancelBed(visitId, bedIndex) {
  showCancelReason(visitId, 'bed', (reason) => {
    const d = getDispoState(visitId);
    if (d.beds[bedIndex]) {
      d.beds[bedIndex].cancelled = true;
      d.beds[bedIndex].cancelReason = reason;
      if (d.handoverWard && d.handoverWard.ward === d.beds[bedIndex].ward) {
        d.handoverWard = null;
      }
    }
    renderCards();
  });
}

// ══════════════════════════════════════════
// HANDOVER (ส่งเวร) — pick from bed requests
// ══════════════════════════════════════════
function openHandoverPicker(visitId, evt) {
  // Open the admission detail modal instead of just a ward picker
  openAdmModal(visitId);
}

async function dispoHandoverWard(visitId, ward) {
  closeFloatingPicker();
  const d = getDispoState(visitId);
  const p = patients.find(x => x.id === visitId);
  if (!p) return;

  d.handoverWard = { ward, at: new Date().toISOString() };

  // Auto-cancel all other bed requests
  d.beds.forEach(b => {
    if (!b.cancelled && b.ward !== ward) {
      b.cancelled = true;
      b.cancelReason = 'ส่งเวร ' + ward;
    }
  });

  // Auto-move to รอขึ้นหอผู้ป่วย (Boarding lane)
  p.status = 'รอขึ้นหอผู้ป่วย';
  await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);

  renderSit();
  renderSFilter();
  renderCards();

  requestAnimationFrame(() => {
    const card = document.getElementById('card-' + visitId);
    if (card) {
      card.scrollIntoView({behavior:'smooth', block:'nearest'});
      highlightCard(visitId, 5000);
    }
  });

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-people-arrows" style="margin-right:4px"></i>ส่งเวร ${ward}</div>
  </div>`, '#22c55e', 'fa-people-arrows');
}

function dispoHandoverRefer(visitId) {
  const d = getDispoState(visitId);
  d.handoverReferAt = new Date().toISOString();

  renderCards();

  const p = patients.find(x => x.id === visitId);
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-people-arrows" style="margin-right:4px"></i>ส่งเวร Refer แล้ว</div>
    </div>`, '#22c55e', 'fa-people-arrows');
  }
}

// ══════════════════════════════════════════
// MOVE (ย้ายผู้ป่วย / ส่งแล้ว)
// ══════════════════════════════════════════
async function dispoMoveAdmit(visitId) {
  const d = getDispoState(visitId);
  const p = patients.find(x => x.id === visitId);
  if (!p || !d.handoverWard) return;

  const ward = d.handoverWard.ward;
  d.moveAt = new Date().toISOString();

  // Update status to the admit ward → finalized
  p.status = ward;
  p.tab = 'finalized';
  p.finalizedAt = Date.now();
  await updateVisitStatus(visitId, ward, 'finalized', p.activatedAt);

  renderSit();
  renderSFilter();

  // Switch to finalized tab and highlight
  const targetBtn = document.querySelector('.tab-btn[data-tab="finalized"]');
  if (targetBtn) switchTab(targetBtn);
  else renderCards();

  highlightCard(visitId, 5000);

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#a78bfa;margin-top:2px"><i class="fas fa-person-walking-arrow-right" style="margin-right:4px"></i>ย้ายไป ${ward}</div>
  </div>`, '#a78bfa', 'fa-person-walking-arrow-right');
}

async function dispoMoveRefer(visitId) {
  const d = getDispoState(visitId);
  const p = patients.find(x => x.id === visitId);
  if (!p) return;

  d.moveAt = new Date().toISOString();
  d.handoverWard = null;

  p.status = 'ส่งตัวโรงพยาบาลอื่น';
  p.tab = 'finalized';
  p.finalizedAt = Date.now();
  await updateVisitStatus(visitId, 'ส่งตัวโรงพยาบาลอื่น', 'finalized', p.activatedAt);

  renderSit();
  renderSFilter();

  const targetBtn = document.querySelector('.tab-btn[data-tab="finalized"]');
  if (targetBtn) switchTab(targetBtn);
  else renderCards();

  highlightCard(visitId, 5000);

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#a78bfa;margin-top:2px"><i class="fas fa-ambulance" style="margin-right:4px"></i>ส่งผู้ป่วยแล้ว</div>
  </div>`, '#a78bfa', 'fa-ambulance');
}

// ══════════════════════════════════════════
// ADMISSION DETAIL MODAL
// ══════════════════════════════════════════
let _admVisitId = null;
const _admData = {}; // { visitId: { doctor, doctorLicense, department, ward, consults:[{doctor,dept,license}] } }

function getAdmData(id) {
  if (!_admData[id]) _admData[id] = { doctor:'', doctorLicense:'', department:'', ward:'', consults:[] };
  return _admData[id];
}

function openAdmModal(visitId) {
  _admVisitId = visitId;
  const p = patients.find(x => x.id === visitId);
  if (!p) return;
  const d = getDispoState(visitId);
  const a = getAdmData(visitId);
  const activeBeds = d.beds.filter(b => !b.cancelled);

  // Pre-select ward if only one bed
  if (activeBeds.length === 1 && !a.ward) a.ward = activeBeds[0].ward;

  // Patient info
  document.getElementById('adm-pt').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px" class="esi-c-${p.esi}">${p.esi}</div>
      <div>
        <div style="font-family:'Sarabun',sans-serif;font-size:15px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-detail)">${fmtHN(p.hn)} · ${p.sex} · ${fmtAge(p.age)}</div>
      </div>
    </div>`;

  // Form body
  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const deptDisplay = a.department ? (deptLabels[a.department] || a.department) : '';

  let html = '';

  // Ward selector (if multiple beds)
  if (activeBeds.length > 1) {
    html += `<div class="adm-field">
      <div class="adm-lbl">WARD <span class="adm-req">*</span></div>
      <select class="fin-input" id="adm-ward" onchange="getAdmData('${visitId}').ward=this.value" style="cursor:pointer">
        <option value="">— เลือกวอร์ด —</option>
        ${activeBeds.map(b => `<option value="${b.ward}"${a.ward===b.ward?' selected':''}>${b.ward}</option>`).join('')}
      </select>
    </div>`;
  } else {
    html += `<div class="adm-field">
      <div class="adm-lbl">WARD</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary);padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px">${a.ward}</div>
    </div>`;
  }

  // Attending Physician
  html += `<div class="adm-field">
    <div class="adm-lbl">Attending Physician <span class="adm-req">*</span></div>
    <div style="position:relative">
      <input class="fin-input${a.doctor ? ' fin-input-selected' : ''}" id="adm-doc"
        placeholder="พิมพ์ชื่อแพทย์..." value="${a.doctor || ''}"
        oninput="admDocSearch(this.value)" onfocus="admDocSearch(this.value)"
        onkeydown="admDocKeydown(event)"
        onblur="setTimeout(()=>{const d=document.getElementById('adm-doc-drop');if(d)d.style.display='none'},150)">
      <div class="fin-dx-drop" id="adm-doc-drop"></div>
      ${a.doctorLicense ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);margin-top:2px">${a.doctorLicense}</div>` : ''}
    </div>
  </div>`;

  // Department
  html += `<div class="adm-field">
    <div class="adm-lbl">Department <span class="adm-req">*</span></div>
    <div style="position:relative">
      <input class="fin-input${a.department ? ' fin-input-selected' : ''}" id="adm-dept"
        placeholder="พิมพ์ชื่อแผนก..." value="${deptDisplay}"
        ${a.department && a.doctor ? 'readonly' : ''}
        oninput="admDeptSearch(this.value)" onfocus="admDeptSearch(this.value)"
        onkeydown="admDeptKeydown(event)"
        onblur="setTimeout(()=>{const d=document.getElementById('adm-dept-drop');if(d)d.style.display='none'},150)">
      <div class="fin-dx-drop" id="adm-dept-drop"></div>
    </div>
  </div>`;

  // สาขาดูร่วม
  html += `<div class="adm-field">
    <div class="adm-lbl" style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:700;letter-spacing:0;text-transform:none">สาขาดูร่วม</div>`;
  if (a.consults.length) {
    a.consults.forEach((c, i) => {
      html += `<div class="adm-consult-row">
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;color:var(--text-primary);flex:1">${c.doctor}</span>
        <span style="font-family:'Sarabun',sans-serif;font-size:11px;color:var(--text-dim)">${deptLabels[c.dept]||c.dept}</span>
        <button class="dispo-row-x" onclick="admConsultRemove(${i})" style="flex-shrink:0"><i class="fas fa-times"></i></button>
      </div>`;
    });
  }
  html += `<div style="display:flex;gap:6px;margin-top:4px">
    <div style="flex:1;position:relative">
      <input class="fin-input" id="adm-cdoc" placeholder="พิมพ์ชื่อแพทย์..."
        oninput="admConsultDocSearch(this.value)" onfocus="admConsultDocSearch(this.value)"
        onkeydown="admCDocKeydown(event)"
        onblur="setTimeout(()=>{const d=document.getElementById('adm-cdoc-drop');if(d)d.style.display='none'},150)">
      <div class="fin-dx-drop" id="adm-cdoc-drop"></div>
    </div>
    <input class="fin-input" id="adm-cdept" placeholder="แผนก..." readonly style="flex:0 0 120px;color:var(--text-dim)">
  </div>
  <div style="display:flex;justify-content:flex-end;margin-top:4px">
    <button class="dispo-btn" onclick="admConsultAdd()" style="font-size:11px">
      <i class="fas fa-plus"></i> เพิ่ม
    </button>
  </div>`;
  html += `</div>`;

  document.getElementById('adm-body').innerHTML = html;
  document.getElementById('adm-bd').style.display = 'block';
  document.getElementById('adm-modal').style.display = 'flex';
}

function closeAdmModal() {
  document.getElementById('adm-bd').style.display = 'none';
  document.getElementById('adm-modal').style.display = 'none';
  _admVisitId = null;
}

// ── Doctor search (all doctors, auto-lock dept) ──
function admDocSearch(query) {
  const drop = document.getElementById('adm-doc-drop');
  if (!drop) return;
  const a = getAdmData(_admVisitId);
  a.doctor = query;
  a.doctorLicense = '';

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const deptDocs = [];
  if (typeof DEPT_DOCTORS !== 'undefined') {
    for (const [dept, docs] of Object.entries(DEPT_DOCTORS)) {
      for (const d of docs) deptDocs.push({ name:d.name, license:d.license, dept });
    }
  }
  const matches = deptDocs.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).slice(0,10);
  if (!matches.length) { drop.style.display = 'none'; return; }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  drop.innerHTML = matches.map(d =>
    `<div class="fin-dx-item" onmousedown="admDocPick('${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''} <span style="font-size:10px;color:var(--text-dim)">${deptLabels[d.dept]||d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

function admDocPick(name, license, dept) {
  const a = getAdmData(_admVisitId);
  a.doctor = name;
  a.doctorLicense = license;
  a.department = dept;
  // Refresh modal to show locked dept
  openAdmModal(_admVisitId);
}

function admDocKeydown(e) { finDropKeydown(e, 'adm-doc-drop'); }

// ── Department search ──
function admDeptSearch(query) {
  const drop = document.getElementById('adm-dept-drop');
  if (!drop) return;
  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const depts = typeof DEPT_DOCTORS !== 'undefined' ? Object.keys(DEPT_DOCTORS) : [];
  const matches = depts.filter(d => {
    const label = deptLabels[d] || d;
    return label.toLowerCase().includes(query.toLowerCase());
  }).slice(0,10);

  if (!matches.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = matches.map(d =>
    `<div class="fin-dx-item" onmousedown="admDeptPick('${d.replace(/'/g,"\\'")}')">${deptLabels[d]||d}</div>`
  ).join('');
  drop.style.display = 'block';
}

function admDeptPick(dept) {
  const a = getAdmData(_admVisitId);
  a.department = dept;
  openAdmModal(_admVisitId);
}

function admDeptKeydown(e) { finDropKeydown(e, 'adm-dept-drop'); }

// ── สาขาดูร่วม search ──
let _admConsultPick = null;

function admConsultDocSearch(query) {
  const drop = document.getElementById('adm-cdoc-drop');
  if (!drop) return;
  _admConsultPick = null;
  const deptInput = document.getElementById('adm-cdept');
  if (deptInput) deptInput.value = '';

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const deptDocs = [];
  if (typeof DEPT_DOCTORS !== 'undefined') {
    for (const [dept, docs] of Object.entries(DEPT_DOCTORS)) {
      for (const d of docs) deptDocs.push({ name:d.name, license:d.license, dept });
    }
  }
  const matches = deptDocs.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).slice(0,10);
  if (!matches.length) { drop.style.display = 'none'; return; }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  drop.innerHTML = matches.map(d =>
    `<div class="fin-dx-item" onmousedown="admConsultDocPick('${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name} <span style="font-size:10px;color:var(--text-dim)">${deptLabels[d.dept]||d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

function admConsultDocPick(name, license, dept) {
  _admConsultPick = { name, license, dept };
  const input = document.getElementById('adm-cdoc');
  if (input) { input.value = name; input.classList.add('fin-input-selected'); }
  const drop = document.getElementById('adm-cdoc-drop');
  if (drop) drop.style.display = 'none';
  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const deptInput = document.getElementById('adm-cdept');
  if (deptInput) deptInput.value = deptLabels[dept] || dept;
}

function admCDocKeydown(e) { finDropKeydown(e, 'adm-cdoc-drop'); }

function admConsultAdd() {
  if (!_admConsultPick || !_admConsultPick.name) return;
  const a = getAdmData(_admVisitId);
  a.consults.push({ doctor:_admConsultPick.name, dept:_admConsultPick.dept, license:_admConsultPick.license||'' });
  _admConsultPick = null;
  openAdmModal(_admVisitId);
}

function admConsultRemove(idx) {
  const a = getAdmData(_admVisitId);
  a.consults.splice(idx, 1);
  openAdmModal(_admVisitId);
}

// ── Submit: complete handover ──
async function submitAdmModal() {
  const id = _admVisitId;
  if (!id) return;
  const a = getAdmData(id);

  if (!a.ward) { showToast('เลือกวอร์ดก่อน','#f59e0b','fa-exclamation-triangle'); return; }
  if (!a.doctor) { showToast('ระบุ Attending Physician','#f59e0b','fa-exclamation-triangle'); return; }
  if (!a.department) { showToast('ระบุ Department','#f59e0b','fa-exclamation-triangle'); return; }

  closeAdmModal();

  // Store admission detail in finalize data for later
  const f = getFinalData(id);
  f.doctor = a.doctor;
  f.doctorLicense = a.doctorLicense;
  f.department = a.department;
  if (a.consults.length) {
    f.consults = [...a.consults];
  }

  // Complete handover with selected ward
  await dispoHandoverWard(id, a.ward);
}
