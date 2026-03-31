// floor/notes.js — Notes timeline per visit
// Oldest on top (chronological like medical chart)
// Available at every stage: waiting → active → finalized
// Delete requires Supabase-style random PIN confirmation

// ══════════════════════════════════════════
// IN-MEMORY NOTES
// ══════════════════════════════════════════
const _notes = {};  // { visitId: [{ id, content, createdAt }] }

function getNotes(visitId) {
  if (!_notes[visitId]) _notes[visitId] = [];
  return _notes[visitId];
}

// ══════════════════════════════════════════
// BUILD COMPACT NOTES (Zone 4 on patient card)
// Shows note count, last 2 notes, and add input
// ══════════════════════════════════════════
function buildCompactNotes(visitId) {
  const notes = getNotes(visitId);
  const count = notes.length;

  // Last 2 notes (newest first for display)
  const recent = notes.slice(-2).reverse();

  let html = `<div class="compact-notes" onclick="event.stopPropagation()">
    <div class="compact-notes-hdr" onclick="event.stopPropagation();toggleCompactNotes('cn-${visitId}')">
      <i class="fas fa-sticky-note" style="font-size:10px;color:var(--accent)"></i>
      <span style="font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-dim)">NOTES</span>
      ${count ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--accent);background:rgba(14,165,233,.12);padding:1px 5px;border-radius:8px">${count}</span>` : ''}
      <i class="fas fa-chevron-down compact-notes-chevron" id="cn-chev-${visitId}" style="font-size:8px;color:var(--text-faint);margin-left:auto;transition:transform .2s"></i>
    </div>
    <div class="compact-notes-body" id="cn-${visitId}" style="display:none">`;

  // Recent notes
  if (recent.length) {
    recent.forEach(n => {
      const timeStr = new Date(n.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      const truncated = n.content.length > 60 ? n.content.slice(0, 60) + '...' : n.content;
      html += `<div class="compact-note-entry">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);flex-shrink:0">${timeStr}</span>
        <span style="font-family:'Sarabun',sans-serif;font-size:11px;color:var(--text-sub);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(truncated)}</span>
      </div>`;
    });
    if (count > 2) {
      html += `<div style="text-align:center;padding:2px 0">
        <a href="javascript:void(0)" onclick="event.stopPropagation();openQV('${visitId}')" style="font-family:'Sarabun',sans-serif;font-size:11px;color:var(--accent);text-decoration:none">ดูทั้งหมด (${count})</a>
      </div>`;
    }
  }

  // Add note input
  html += `<div style="display:flex;gap:4px;margin-top:4px">
    <input class="fin-input" id="cn-input-${visitId}" placeholder="เพิ่มบันทึก..."
      style="font-size:11px;padding:4px 8px;flex:1"
      onkeydown="if(event.key==='Enter'){event.stopPropagation();addNote('${visitId}');}">
    <button class="rcl-save-btn" style="margin:0;padding:4px 10px;font-size:11px" onclick="event.stopPropagation();addNote('${visitId}')">
      <i class="fas fa-plus"></i>
    </button>
  </div>`;

  html += `</div></div>`;
  return html;
}

function toggleCompactNotes(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const vis = body.style.display !== 'none';
  body.style.display = vis ? 'none' : '';
  // Rotate chevron
  const visitId = bodyId.replace('cn-', '');
  const chev = document.getElementById('cn-chev-' + visitId);
  if (chev) chev.style.transform = vis ? '' : 'rotate(180deg)';
}

// ══════════════════════════════════════════
// BUILD NOTES SECTION (for QV panel)
// Called from openQV / openFinalizedQV
// ══════════════════════════════════════════
function buildNotesSection(visitId) {
  const notes = getNotes(visitId);

  let html = `<div class="notes-section">
    <div class="notes-title">
      <i class="fas fa-sticky-note" style="color:var(--accent);margin-right:4px"></i> NOTES
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);margin-left:4px">${notes.length}</span>
    </div>`;

  // Notes list (oldest on top)
  if (notes.length) {
    html += `<div class="notes-list">`;
    notes.forEach(n => {
      const timeStr = new Date(n.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      html += `<div class="note-entry">
        <span class="note-time">${timeStr}</span>
        <span class="note-content">${escHtml(n.content)}</span>
        <button class="note-del-btn" onclick="event.stopPropagation();confirmDeleteNote('${visitId}','${n.id}')" title="ลบ">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
    });
    html += `</div>`;
  }

  // Add note input
  html += `<div class="note-add-wrap">
    <input class="fin-input note-add-input" id="note-input-${visitId}"
      placeholder="เพิ่มบันทึก..."
      style="font-size:12px;padding:6px 8px;flex:1"
      onkeydown="if(event.key==='Enter'){event.stopPropagation();addNote('${visitId}');}" >
    <button class="note-add-btn" onclick="event.stopPropagation();addNote('${visitId}')">
      <i class="fas fa-plus" style="margin-right:3px"></i> เพิ่ม
    </button>
  </div>`;

  html += `</div>`;
  return html;
}

// Escape HTML to prevent XSS
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ══════════════════════════════════════════
// ADD NOTE
// ══════════════════════════════════════════
async function addNote(visitId) {
  // Try QV input first, then compact card input
  let input = document.getElementById('note-input-' + visitId);
  if (!input || !input.value.trim()) input = document.getElementById('cn-input-' + visitId);
  if (!input) return;
  const content = input.value.trim();
  if (!content) { input.focus(); return; }

  const notes = getNotes(visitId);
  const noteId = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

  notes.push({
    id: noteId,
    content,
    createdAt: new Date().toISOString()
  });

  // Persist to Supabase
  try {
    await sb.from('notes').insert({
      visit_id: visitId,
      content
    });
  } catch (err) {
    console.error('Note save error:', err);
  }

  // Clear input
  input.value = '';

  logAudit(visitId, 'note_add', 'notes', { next:content });

  // Re-render the QV panel to show the new note + re-render cards for compact notes
  const p = patients.find(x => x.id === visitId);
  if (p) {
    // Check if QV is open for this patient
    if (typeof qvId !== 'undefined' && qvId === visitId) {
      if (p.tab === 'finalized') openFinalizedQV(p.id);
      else openQV(p.id);
    }
  }
  renderCards();
}

// ══════════════════════════════════════════
// DELETE NOTE (Supabase-style PIN confirmation)
// ══════════════════════════════════════════
let _deleteNoteTarget = null;  // { visitId, noteId }
let _deleteNoteCode = '';

function confirmDeleteNote(visitId, noteId) {
  _deleteNoteTarget = { visitId, noteId };
  _deleteNoteCode = String(Math.floor(1000 + Math.random() * 9000));  // 4-digit random code

  const note = getNotes(visitId).find(n => n.id === noteId);
  const preview = note ? note.content.slice(0, 40) : '';

  // Build modal
  const modalHtml = `<div class="note-confirm-overlay" id="note-confirm-modal" onclick="if(event.target===this)closeNoteConfirm()">
    <div class="note-confirm-box">
      <div style="font-size:28px;color:#ef4444;margin-bottom:10px"><i class="fas fa-exclamation-triangle"></i></div>
      <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;margin-bottom:6px">ยืนยันการลบ</div>
      <div style="font-size:12px;color:var(--text-sub);margin-bottom:12px;line-height:1.4">
        คุณกำลังจะลบบันทึก:<br>
        <strong>"${escHtml(preview)}${preview.length >= 40 ? '...' : ''}"</strong><br>
        กรุณาพิมพ์รหัสด้านล่างเพื่อยืนยัน
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;letter-spacing:.2em;color:var(--accent);background:var(--accent-bg);padding:6px 16px;border-radius:6px;display:inline-block;margin-bottom:10px">${_deleteNoteCode.split('').join(' ')}</div>
      <input class="note-confirm-input" id="note-confirm-pin" placeholder="พิมพ์รหัส 4 หลัก" maxlength="4"
        oninput="checkNoteConfirmPin()" autofocus>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="note-confirm-cancel" onclick="closeNoteConfirm()">ยกเลิก</button>
        <button class="note-confirm-delete" id="note-confirm-del-btn" disabled onclick="executeDeleteNote()">ยืนยันการลบ</button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('note-confirm-pin').focus();
}

function checkNoteConfirmPin() {
  const input = document.getElementById('note-confirm-pin');
  const btn = document.getElementById('note-confirm-del-btn');
  if (!input || !btn) return;
  btn.disabled = input.value !== _deleteNoteCode;
}

function closeNoteConfirm() {
  const modal = document.getElementById('note-confirm-modal');
  if (modal) modal.remove();
  _deleteNoteTarget = null;
  _deleteNoteCode = '';
}

async function executeDeleteNote() {
  if (!_deleteNoteTarget) return;
  const { visitId, noteId } = _deleteNoteTarget;

  // Remove from memory
  const notes = getNotes(visitId);
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx >= 0) notes.splice(idx, 1);

  // TODO: Delete from Supabase notes table by note UUID
  // (in-memory notes use local IDs, DB notes use UUIDs — need mapping)

  closeNoteConfirm();

  logAudit(visitId, 'note_delete', 'notes', { prev:noteId });

  // Re-render QV + cards
  const p = patients.find(x => x.id === visitId);
  if (p) {
    if (typeof qvId !== 'undefined' && qvId === visitId) {
      if (p.tab === 'finalized') openFinalizedQV(p.id);
      else openQV(p.id);
    }
  }
  renderCards();

  showToast('ลบบันทึกแล้ว', '#ef4444', 'fa-trash');
}