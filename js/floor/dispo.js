// floor/dispo.js — Bed request, handover, move, card zone
// floor/dispo.js — Disposition flow: จองเตียง, ส่งเวร, ย้ายผู้ป่วย, finalization

// ══════════════════════════════════════════
// IN-MEMORY DISPOSITION STATE
// (persisted to Supabase when available)
// ══════════════════════════════════════════
const _dispo = {};  // { visitId: { bedWard, bedAt, bedHistory[], handoverWardAt, handoverReferAt, referContacts[] } }

function getDispoState(id) {
  if (!_dispo[id]) _dispo[id] = { bedWard:null, bedAt:null, bedHistory:[], handoverWardAt:null, handoverReferAt:null, moveAt:null };
  return _dispo[id];
}

// ══════════════════════════════════════════
// STATUSES THAT TRIGGER ACTIONS
// ══════════════════════════════════════════
const ADMIT_WAIT_STATUSES = new Set(['รอขึ้นหอผู้ป่วย']);
const REFER_WAIT_STATUSES = new Set(['รอส่งตัวโรงพยาบาลอื่น']);
const REFER_CONTACT_STATUS = 'ติดต่อส่งตัวโรงพยาบาลอื่น';
const ADMIT_WARD_STATUSES = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา']);

// ══════════════════════════════════════════
// BUILD DISPO ZONE (Zone 3 on patient cards)
// Called from buildCard() in core.js
// ══════════════════════════════════════════
function buildDispoZone(p) {
  if (p.tab === 'finalized') return buildFinalizedDispoZone(p);
  if (p.tab !== 'active') return '';

  const d = getDispoState(p.id);
  let html = '';

  // ── จองเตียง tag ──
  if (d.bedWard) {
    const timeStr = d.bedAt ? new Date(d.bedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : '';
    const historyStr = d.bedHistory.length
      ? d.bedHistory.map(h => `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);text-decoration:line-through;margin-left:6px">${h.ward} ${new Date(h.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})}</span>`).join('')
      : '';
    html += `<div class="dispo-bed-tag" onclick="event.stopPropagation();openBedPicker('${p.id}')" title="คลิกเพื่อเปลี่ยนวอร์ด">
      <i class="fas fa-bed" style="font-size:11px"></i>
      <span>จองเตียง ${d.bedWard}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;opacity:.7">${timeStr}</span>
      ${historyStr}
    </div>`;
  }

  // ── Action buttons row ──
  let buttons = '';

  // Bed Request button (always available if no bed yet)
  if (!d.bedWard) {
    buttons += `<button class="dispo-btn" onclick="event.stopPropagation();openBedPicker('${p.id}')">
      <i class="fas fa-bed"></i> BED REQUEST
    </button>`;
  }

  // ส่งเวรวอร์ด (appears at รอ Admit)
  if (ADMIT_WAIT_STATUSES.has(p.status) || d.bedWard) {
    if (d.handoverWardAt) {
      const hwTime = new Date(d.handoverWardAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      buttons += `<button class="dispo-btn dispo-done">
        <i class="fas fa-people-arrows"></i> ส่งเวรวอร์ด <span class="dispo-time">${hwTime}</span>
      </button>`;
      // ย้ายผู้ป่วย button
      if (!d.moveAt) {
        buttons += `<button class="dispo-btn dispo-move" onclick="event.stopPropagation();dispoMoveAdmit('${p.id}')">
          <i class="fas fa-person-walking-arrow-right"></i> ย้ายผู้ป่วย
        </button>`;
      }
    } else if (ADMIT_WAIT_STATUSES.has(p.status)) {
      buttons += `<button class="dispo-btn" onclick="event.stopPropagation();dispoHandoverWard('${p.id}')">
        <i class="fas fa-people-arrows"></i> ส่งเวรวอร์ด
      </button>`;
    }
  }

  // Refer contact log moved to QV panel (not on card)

  // ส่งเวร Refer (appears at รอ Refer or ติดต่อ Refer)
  if (REFER_WAIT_STATUSES.has(p.status) || p.status === REFER_CONTACT_STATUS) {
    if (d.handoverReferAt) {
      const hrTime = new Date(d.handoverReferAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      buttons += `<button class="dispo-btn dispo-done">
        <i class="fas fa-people-arrows"></i> ส่งเวร Refer <span class="dispo-time">${hrTime}</span>
      </button>`;
      // ส่งแล้ว button
      if (!d.moveAt) {
        buttons += `<button class="dispo-btn dispo-move" onclick="event.stopPropagation();dispoMoveRefer('${p.id}')">
          <i class="fas fa-ambulance"></i> ส่งแล้ว
        </button>`;
      }
    } else {
      buttons += `<button class="dispo-btn" onclick="event.stopPropagation();dispoHandoverRefer('${p.id}')">
        <i class="fas fa-people-arrows"></i> ส่งเวร Refer
      </button>`;
    }
  }

  if (buttons) {
    html += `<div class="dispo-actions">${buttons}</div>`;
  }

  return html ? `<div class="dispo-zone">${html}</div>` : '';
}

// ── Finalized card: show completion badge ──
function buildFinalizedDispoZone(p) {
  const d = getDispoState(p.id);
  const isComplete = p.diagnosis && p.finalEsi;
  // TODO: check all required fields based on disposition type

  if (isComplete) {
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
// BED REQUEST (จองเตียง)
// ══════════════════════════════════════════
let _bedPickerVisitId = null;

function openBedPicker(visitId) {
  // Close any existing picker
  closeBedPicker();
  _bedPickerVisitId = visitId;

  const card = document.getElementById('card-' + visitId);
  if (!card) return;

  // Build ward picker dropdown
  const wards = (typeof WARD_LIST !== 'undefined') ? WARD_LIST : ['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา'];
  const pickerHtml = `<div class="dispo-ward-picker" id="bed-picker">
    <div class="dispo-wp-title">เลือกวอร์ด</div>
    ${wards.map(w => `<div class="dispo-wp-item" onclick="event.stopPropagation();selectBedWard('${w}')">${w}</div>`).join('')}
  </div>`;

  // Insert after dispo-zone or at end of card
  const zone = card.querySelector('.dispo-zone');
  if (zone) {
    zone.insertAdjacentHTML('beforeend', pickerHtml);
  } else {
    card.insertAdjacentHTML('beforeend', `<div class="dispo-zone">${pickerHtml}</div>`);
  }
}

function closeBedPicker() {
  const picker = document.getElementById('bed-picker');
  if (picker) picker.remove();
  _bedPickerVisitId = null;
}

function selectBedWard(ward) {
  const id = _bedPickerVisitId;
  if (!id) return;

  const d = getDispoState(id);

  // Save old ward to history if changing
  if (d.bedWard && d.bedWard !== ward) {
    d.bedHistory.push({ ward: d.bedWard, at: d.bedAt });
  }

  d.bedWard = ward;
  d.bedAt = new Date().toISOString();

  closeBedPicker();

  // TODO: persist to Supabase bed_request_log + visits.bed_requested_at/bed_requested_ward

  // Re-render to show the tag
  renderCards();

  // Toast
  const p = patients.find(x => x.id === id);
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-bed" style="margin-right:4px"></i>จองเตียง ${ward}</div>
    </div>`, '#22c55e', 'fa-bed');
  }
}

// Close picker when clicking elsewhere
document.addEventListener('click', function(e) {
  if (_bedPickerVisitId && !e.target.closest('#bed-picker') && !e.target.closest('.dispo-btn')) {
    closeBedPicker();
  }
});

// ══════════════════════════════════════════
// HANDOVER (ส่งเวร)
// ══════════════════════════════════════════
function dispoHandoverWard(visitId) {
  const d = getDispoState(visitId);
  d.handoverWardAt = new Date().toISOString();

  // TODO: persist to Supabase visits.handover_ward_at

  renderCards();

  const p = patients.find(x => x.id === visitId);
  if (p) {
    showToast(`<div style="line-height:1.3">
      <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-people-arrows" style="margin-right:4px"></i>ส่งเวรวอร์ดแล้ว</div>
    </div>`, '#22c55e', 'fa-people-arrows');
  }
}

function dispoHandoverRefer(visitId) {
  const d = getDispoState(visitId);
  d.handoverReferAt = new Date().toISOString();

  // TODO: persist to Supabase visits.handover_refer_at

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
  if (!p) return;

  const ward = d.bedWard || 'วอร์ดชาย'; // fallback
  d.moveAt = new Date().toISOString();

  // Auto-cancel refer handover
  d.handoverReferAt = null;

  // Update status to the admit ward → finalized
  await updateVisitStatus(visitId, ward, 'finalized', p.activatedAt);

  // TODO: persist actual_move_at to Supabase

  // Reload
  const fresh = await loadPatients();
  patients.length = 0;
  fresh.forEach(px => patients.push(px));
  renderSit();
  renderSFilter();

  // Switch to finalized tab and highlight
  const targetBtn = document.querySelector('.tab-btn[data-tab="finalized"]');
  if (targetBtn) switchTab(targetBtn);
  else renderCards();

  highlightCard(visitId, 5000);

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#a78bfa;margin-top:2px"><i class="fas fa-person-walking-arrow-right" style="margin-right:4px"></i>ย้ายผู้ป่วยไป ${ward}</div>
  </div>`, '#a78bfa', 'fa-person-walking-arrow-right');
}

async function dispoMoveRefer(visitId) {
  const d = getDispoState(visitId);
  const p = patients.find(x => x.id === visitId);
  if (!p) return;

  d.moveAt = new Date().toISOString();

  // Auto-cancel ward handover
  d.handoverWardAt = null;

  // Update status to refer out → finalized
  await updateVisitStatus(visitId, 'ส่งตัวโรงพยาบาลอื่น', 'finalized', p.activatedAt);

  // TODO: persist actual_move_at to Supabase

  // Reload
  const fresh = await loadPatients();
  patients.length = 0;
  fresh.forEach(px => patients.push(px));
  renderSit();
  renderSFilter();

  // Switch to finalized tab and highlight
  const targetBtn = document.querySelector('.tab-btn[data-tab="finalized"]');
  if (targetBtn) switchTab(targetBtn);
  else renderCards();

  highlightCard(visitId, 5000);

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#a78bfa;margin-top:2px"><i class="fas fa-ambulance" style="margin-right:4px"></i>ส่งผู้ป่วยแล้ว</div>
  </div>`, '#a78bfa', 'fa-ambulance');
}

