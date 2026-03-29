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

// ── Finalized card: show completion badge ──
function buildFinalizedDispoZone(p) {
  if (p.dataComplete) {
    return `<div class="dispo-zone" style="padding:2px 12px 6px;display:flex;align-items:center;gap:6px">
      <span class="dispo-badge-ok"><i class="fas fa-check-circle"></i> ข้อมูลครบ</span>
      <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)"><i class="fas fa-clock"></i> auto-remove</span>
    </div>`;
  } else {
    return `<div class="dispo-zone" style="padding:2px 12px 6px;display:flex;align-items:center;gap:6px">
      <span class="dispo-badge-inc"><i class="fas fa-exclamation-circle"></i> ข้อมูลไม่ครบ</span>
    </div>`;
  }
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
  const btn = evt ? evt.currentTarget : document.getElementById('card-'+visitId);
  const d = getDispoState(visitId);
  const activeBeds = d.beds.filter(b => !b.cancelled);

  const items = activeBeds.map(b => ({
    label: b.ward,
    dot: '#a78bfa',
    done: false,
    onclick: `dispoHandoverWard('${visitId}','${b.ward}')`
  }));

  showFloatingPicker(btn, visitId, 'ส่งเวร — เลือกวอร์ด', items);
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
