// floor/finalize.js — Finalization panel, field handlers, save
// ══════════════════════════════════════════
// DISPOSITION TYPE DETECTION
// ══════════════════════════════════════════
const DISCHARGE_STATUSES = new Set(['Discharge','ส่งแผนกผู้ป่วยนอก','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งห้องผ่าตัด']);
const REFER_STATUSES = new Set(['ส่งตัวโรงพยาบาลอื่น']);
const OTHER_FINAL = new Set(['ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']);

function getDispoType(status) {
  if (ADMIT_WARD_STATUSES.has(status)) return 'admit';
  if (REFER_STATUSES.has(status)) return 'refer';
  if (DISCHARGE_STATUSES.has(status)) return 'discharge';
  if (OTHER_FINAL.has(status)) return 'other';
  return 'unknown';
}

// ══════════════════════════════════════════
// FINALIZATION QV PANEL
// Builds the data-completion fields for finalized cards
// ══════════════════════════════════════════

// In-memory finalization data (until saved to Supabase)
const _finalData = {}; // { visitId: { finalEsi, diagnosis, diagnosisIcd, dept, doctor, ... } }

function getFinalData(id) {
  if (!_finalData[id]) _finalData[id] = {
    finalEsi: null, caseCategory: '', diagnosis: '', diagnosisIcd: '', department: '', doctor: '', doctorLicense: '',
    arrivalMode: '', arrivalModeSub: '', arrivalModeExtra: '', arrivalModeCustom: '',
    hospitalArrivalTime: '', treatmentOutcome: '',
    hadETT: false, hadCPR: false,
    consults: [], // [{ doctor, department, license }] — สาขาดูร่วม (multiple)
    referralHospital: '', referralReason: '', referralDoctor: '', referralDoctorLicense: '',
    referralReceivingDept: ''
  };
  return _finalData[id];
}

function buildFinalizationPanel(p) {
  const d = getDispoState(p.id);
  const f = getFinalData(p.id);
  const type = getDispoType(p.status);

  // ปฏิเสธการรักษา — no finalization panel at all
  if (p.status === 'ปฏิเสธการรักษา') {
    return `<div class="fin-panel">
      <div class="fin-section-title"><i class="fas fa-clipboard-check" style="color:var(--accent);margin-right:4px"></i> FINALIZE DATA</div>
      <div style="padding:12px 0;font-family:'Sarabun',sans-serif;font-size:13px;color:#86efac"><i class="fas fa-check-circle" style="margin-right:4px"></i>ไม่ต้องกรอกข้อมูลเพิ่ม</div>
    </div>`;
  }

  // เรียกไม่พบ — only case type
  if (p.status === 'เรียกไม่พบ') {
    const cats = typeof CASE_CATEGORIES !== 'undefined' ? CASE_CATEGORIES : [];
    const ftCat = p.fastTrack && typeof FAST_TRACK_TO_CATEGORY !== 'undefined' ? FAST_TRACK_TO_CATEGORY[p.fastTrack] : null;
    if (!f.caseCategory && ftCat) f.caseCategory = ftCat;
    const complete = !!(f.caseCategory || p.caseCat);
    return `<div class="fin-panel">
      <div class="fin-section-title"><i class="fas fa-clipboard-check" style="color:var(--accent);margin-right:4px"></i> FINALIZE DATA</div>
      <div class="fin-row">
        <span class="fin-lbl">CASE TYPE <span class="fin-req">*</span></span>
        <div style="display:flex;gap:6px">
          ${cats.map(c => `<button class="fin-toggle-btn${f.caseCategory===c.value?' on':''}" onclick="setFinalField('${p.id}','caseCategory','${c.value}');this.parentElement.querySelectorAll('.fin-toggle-btn').forEach(b=>b.classList.remove('on'));this.classList.add('on')" style="flex:1">${c.label}</button>`).join('')}
        </div>
      </div>
      <div style="padding:8px 0;text-align:right">
        <button class="fin-save-btn${complete?'':' disabled'}" ${complete?`onclick="completeFinalization('${p.id}')"`:'disabled'}>
          <i class="fas fa-check"></i> บันทึก
        </button>
      </div>
    </div>`;
  }

  // Visit info (read-only)
  const arrivedStr = p.arrivedAt
    ? new Date(p.arrivedAt).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'})
    : '—';

  let html = `<div class="fin-panel">
    <div class="fin-section-title"><i class="fas fa-clipboard-check" style="color:var(--accent);margin-right:4px"></i> FINALIZE DATA</div>

    <!-- Visit info (read-only) -->
    <div class="fin-row">
      <span class="fin-lbl">VISIT DATE</span>
      <span class="fin-val-ro">${arrivedStr}</span>
    </div>
    <div class="fin-row">
      <span class="fin-lbl">TRIAGE ESI</span>
      <span class="fin-val-ro" style="font-family:'IBM Plex Mono',monospace">${p.esi}</span>
    </div>
    <div class="fin-row">
      <span class="fin-lbl">STATUS</span>
      <span class="fin-val-ro">${sc(p.status).label}</span>
    </div>`;

  // Timestamps (read-only)
  if (d.bedAt || d.handoverWardAt || d.handoverReferAt || d.moveAt) {
    html += `<div class="fin-row fin-col"><span class="fin-lbl">TIMESTAMPS</span><div class="fin-ts-wrap">`;
    if (d.bedAt) {
      const t = new Date(d.bedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      html += `<span class="fin-ts"><span class="fin-ts-lbl">BED REQ</span> ${d.bedWard} ${t}</span>`;
    }
    if (d.handoverWardAt) {
      const t = new Date(d.handoverWardAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      html += `<span class="fin-ts"><span class="fin-ts-lbl">ส่งเวรวอร์ด</span> ${t}</span>`;
    }
    if (d.handoverReferAt) {
      const t = new Date(d.handoverReferAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      html += `<span class="fin-ts"><span class="fin-ts-lbl">ส่งเวร Refer</span> ${t}</span>`;
    }
    if (d.moveAt) {
      const t = new Date(d.moveAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
      html += `<span class="fin-ts"><span class="fin-ts-lbl">${type==='refer'?'ส่งแล้ว':'ย้าย'}</span> ${t}</span>`;
    }
    html += `</div></div>`;
  }

  // ── EDITABLE FIELDS ──

  // Case Category — pre-fill from triage or fast track
  const cats = typeof CASE_CATEGORIES !== 'undefined' ? CASE_CATEGORIES : [];
  if (!f.caseCategory && p.caseCat) f.caseCategory = p.caseCat;
  const ftCat = p.fastTrack && typeof FAST_TRACK_TO_CATEGORY !== 'undefined' ? FAST_TRACK_TO_CATEGORY[p.fastTrack] : null;
  if (!f.caseCategory && ftCat) f.caseCategory = ftCat;
  const catFromTriage = !!p.caseCat;
  html += `<div class="fin-row">
    <span class="fin-lbl">CASE TYPE <span class="fin-req">*</span></span>
    <div style="display:flex;gap:6px">
      ${cats.map(c => `<button class="fin-toggle-btn${f.caseCategory===c.value?' on':''}" onclick="setFinalField('${p.id}','caseCategory','${c.value}');this.parentElement.querySelectorAll('.fin-toggle-btn').forEach(b=>b.classList.remove('on'));this.classList.add('on')" style="flex:1">${c.label}</button>`).join('')}
    </div>
    ${catFromTriage ? `<div class="fin-hint">จาก Triage</div>` : ftCat ? `<div class="fin-hint">Auto จาก Fast Track: ${p.fastTrack}</div>` : ''}
  </div>`;

  // Final ESI (all cases)
  html += `<div class="fin-row">
    <span class="fin-lbl">FINAL ESI <span class="fin-req">*</span></span>
    <div style="flex:1">
      <div class="fin-hint" style="margin:0 0 6px 0;white-space:nowrap">Initial ESI: <span style="font-family:'IBM Plex Mono',monospace;font-weight:600">${p.esi}</span> — กรุณากดยืนยัน Final ESI</div>
      <div class="fin-esi-row">
        ${[1,2,3,4,5].map(n => `<div class="fin-esi-btn esi-c-${n}${f.finalEsi===n?' sel':''}" onclick="setFinalEsi('${p.id}',${n})">${n}</div>`).join('')}
      </div>
    </div>
  </div>`;

  // ETT + CPR toggle buttons (optional)
  html += `<div class="fin-row">
    <span class="fin-lbl">PROCEDURE</span>
    <div style="display:flex;gap:6px">
      <button class="fin-toggle-btn${f.hadETT?' on':''}" onclick="toggleFinFlag('${p.id}','hadETT',this)">
        <i class="fas fa-lungs"></i> ETT
      </button>
      <button class="fin-toggle-btn${f.hadCPR?' on':''}" onclick="toggleFinFlag('${p.id}','hadCPR',this)">
        <i class="fas fa-heart-pulse"></i> CPR
      </button>
    </div>
  </div>`;

  // Diagnosis (searchable — all cases)
  html += `<div class="fin-row fin-col">
    <span class="fin-lbl">DIAGNOSIS <span class="fin-req">*</span></span>
    <div class="fin-dx-wrap">
      <input class="fin-input" id="fin-dx-${p.id}" placeholder="พิมพ์เพื่อค้นหา Dx..."
        value="${f.diagnosis}" oninput="finDxSearch('${p.id}',this.value)" onfocus="finDxSearch('${p.id}',this.value)" onkeydown="finDxKeydown(event,'${p.id}')">
      ${f.diagnosisIcd ? `<div class="fin-icd">ICD-10: ${f.diagnosisIcd}</div>` : ''}
      <div class="fin-dx-drop" id="fin-dx-drop-${p.id}"></div>
    </div>
  </div>`;

  // Arrival Mode — pre-fill from triage if set
  if (!f.arrivalMode && p.arrivalMode) f.arrivalMode = p.arrivalMode;
  const arrModes = typeof ARRIVAL_MODES !== 'undefined' ? ARRIVAL_MODES : [];
  const selectedMode = arrModes.find(m => m.label === f.arrivalMode);
  const needSubText = selectedMode?.subText;
  const needReferHosp = selectedMode?.referHosp;

  html += `<div class="fin-row fin-col">
    <span class="fin-lbl">ARRIVAL MODE <span class="fin-req">*</span></span>
    <div style="position:relative">
      <input class="fin-input" id="fin-arr-${p.id}" placeholder="พิมพ์เพื่อค้นหา..."
        value="${f.arrivalMode||''}" style="font-size:12px;padding:5px 8px"
        oninput="finArrModeSearch('${p.id}',this.value)" onfocus="finArrModeSearch('${p.id}',this.value)"
        onkeydown="finArrKeydown(event,'${p.id}')"
        onblur="setTimeout(()=>{const d=document.getElementById('fin-arr-drop-${p.id}');if(d)d.style.display='none'},150)">
      <div class="fin-dx-drop" id="fin-arr-drop-${p.id}"></div>
    </div>
    ${selectedMode?.subOptions ? `<div style="display:flex;gap:4px;margin-top:4px">
      <select class="fin-select" style="font-size:12px;padding:5px 8px;flex:1"
        onchange="setFinalField('${p.id}','arrivalModeSub',this.value);if(this.value==='อื่นๆ'){document.getElementById('fin-arr-custom-${p.id}').style.display=''}else{document.getElementById('fin-arr-custom-${p.id}').style.display='none'}">
        <option value="">— เลือก —</option>
        ${selectedMode.subOptions.map(o => `<option value="${o}"${f.arrivalModeSub===o?' selected':''}>${o}</option>`).join('')}
      </select>
      ${selectedMode.subPlaceholder ? `<input class="fin-input" id="fin-arr-extra-${p.id}" placeholder="${selectedMode.subPlaceholder}"
        value="${f.arrivalModeExtra||''}" oninput="setFinalField('${p.id}','arrivalModeExtra',this.value)"
        style="font-size:12px;padding:5px 8px;flex:0 0 100px">` : ''}
    </div>
    <input class="fin-input" id="fin-arr-custom-${p.id}" placeholder="ระบุชื่อ..."
      value="${f.arrivalModeSub==='อื่นๆ' ? (f.arrivalModeCustom||'') : ''}"
      oninput="setFinalField('${p.id}','arrivalModeCustom',this.value)"
      style="font-size:12px;padding:5px 8px;margin-top:4px;display:${f.arrivalModeSub==='อื่นๆ'?'':'none'}">` :
    needSubText ? `<input class="fin-input" id="fin-arr-sub-${p.id}" placeholder="ระบุสาขา/ชื่อ..."
      value="${f.arrivalModeSub||''}" oninput="setFinalField('${p.id}','arrivalModeSub',this.value)"
      style="font-size:12px;padding:5px 8px;margin-top:4px">` : ''}
    ${needReferHosp ? `<div style="position:relative;margin-top:4px">
      <input class="fin-input" id="fin-arr-hosp-${p.id}" placeholder="จากโรงพยาบาล..."
        value="${f.arrivalModeSub||''}" style="font-size:12px;padding:5px 8px"
        oninput="finArrHospSearch('${p.id}',this.value)" onfocus="finArrHospSearch('${p.id}',this.value)"
        onkeydown="finDropKeydown(event,'fin-arr-hosp-drop-${p.id}')"
        onblur="setTimeout(()=>{const d=document.getElementById('fin-arr-hosp-drop-${p.id}');if(d)d.style.display='none'},150)">
      <div class="fin-dx-drop" id="fin-arr-hosp-drop-${p.id}"></div>
    </div>` : ''}
  </div>`;

  // Hospital Arrival Time
  html += `<div class="fin-row">
    <span class="fin-lbl">ARRIVAL TIME</span>
    <input class="fin-input" type="time" value="${f.hospitalArrivalTime}"
      onchange="setFinalField('${p.id}','hospitalArrivalTime',this.value)"
      style="font-family:'IBM Plex Mono',monospace;max-width:140px">
  </div>`;

  // ── ADMISSION DETAIL ──
  if (type === 'admit') {
    const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
    const deptDisplay = f.department ? (deptLabels[f.department] || f.department) : '';
    const deptDocList = f.department && typeof DEPT_DOCTORS !== 'undefined' ? DEPT_DOCTORS[f.department] : null;

    if (deptDocList && deptDocList.length === 1 && !f.doctor) {
      f.doctor = deptDocList[0].name;
      f.doctorLicense = deptDocList[0].license || '';
    }

    const docSelected = f.doctor && (deptDocList ? deptDocList.some(d => d.name === f.doctor) : true);

    html += `<div class="fin-section-title" style="margin-top:8px"><i class="fas fa-bed" style="color:#a78bfa;margin-right:4px"></i> ADMISSION DETAIL</div>`;

    // Attending Physician first — search all doctors, auto-lock dept
    html += `<div class="fin-row fin-col">
      <span class="fin-lbl">ATTENDING PHYSICIAN <span class="fin-req">*</span></span>
      <div style="position:relative">
        <input class="fin-input${docSelected ? ' fin-input-selected' : ''}" id="fin-doc-${p.id}"
          placeholder="พิมพ์ชื่อแพทย์..."
          value="${f.doctor || ''}" style="font-size:12px;padding:5px 8px"
          oninput="finDocSearch('${p.id}',this.value)" onfocus="finDocSearch('${p.id}',this.value)"
          onkeydown="finDocKeydown(event,'${p.id}')"
          onblur="setTimeout(()=>{const d=document.getElementById('fin-doc-drop-${p.id}');if(d)d.style.display='none'},150)"
          ${deptDocList && deptDocList.length === 1 ? 'readonly' : ''}>
        <div class="fin-dx-drop" id="fin-doc-drop-${p.id}"></div>
        ${f.doctorLicense ? `<div class="fin-icd">${f.doctorLicense}</div>` : ''}
      </div>
    </div>`;

    // Department — locked when doctor is picked
    html += `<div class="fin-row fin-col">
      <span class="fin-lbl">DEPARTMENT <span class="fin-req">*</span></span>
      <div style="position:relative">
        <input class="fin-input${f.department && docSelected ? ' fin-input-selected' : ''}" id="fin-dept-${p.id}" placeholder="พิมพ์ชื่อแผนก..."
          value="${deptDisplay}" style="font-size:12px;padding:5px 8px"
          oninput="finDeptSearch('${p.id}',this.value)" onfocus="finDeptSearch('${p.id}',this.value)" onkeydown="finDeptKeydown(event,'${p.id}')"
          onblur="setTimeout(()=>{const d=document.getElementById('fin-dept-drop-${p.id}');if(d)d.style.display='none'},150)"
          ${f.department && docSelected ? 'readonly' : ''}>
        <div class="fin-dx-drop" id="fin-dept-drop-${p.id}"></div>
      </div>
    </div>`;
  }

  // ── REFER-SPECIFIC FIELDS ──
  if (type === 'refer') {
    // Pre-fill from contact log
    const referLog = typeof getReferLog === 'function' ? getReferLog(p.id) : [];
    const accepted = referLog.find(e => e.result === 'รับ');
    if (accepted && !f.referralHospital) f.referralHospital = accepted.hospital;
    if (accepted && !f.referralReason && accepted.reason) f.referralReason = accepted.reason;
    const isShriThanya = f.referralHospital && f.referralHospital.includes('ศรีธัญญา');

    html += `<div class="fin-row fin-col">
      <span class="fin-lbl">REFERRAL INFO</span>
      <div class="fin-ref-box">
        <div class="fin-ref-row">
          <span class="fin-ref-lbl">รพ.ปลายทาง</span>
          <span class="fin-val-ro" style="flex:1;font-size:13px">${f.referralHospital || '—'}</span>
        </div>
        <div class="fin-ref-row">
          <span class="fin-ref-lbl">เหตุผล</span>
          <span class="fin-val-ro" style="flex:1;font-size:13px">${f.referralReason || '—'}</span>
        </div>
        <div class="fin-ref-row">
          <span class="fin-ref-lbl">แพทย์ Refer <span class="fin-req">*</span></span>
          <div style="flex:1;position:relative">
            <input class="fin-input" id="fin-refdoc-${p.id}" placeholder="พิมพ์ชื่อแพทย์..."
              value="${f.referralDoctor || ''}" style="font-size:12px;padding:5px 8px"
              oninput="finReferDocSearch('${p.id}',this.value)" onfocus="finReferDocSearch('${p.id}',this.value)"
              onkeydown="finRefDocKeydown(event,'${p.id}')"
              onblur="setTimeout(()=>{const d=document.getElementById('fin-refdoc-drop-${p.id}');if(d)d.style.display='none'},150)">
            <div class="fin-dx-drop" id="fin-refdoc-drop-${p.id}"></div>
            ${f.referralDoctorLicense ? `<div class="fin-icd">${f.referralDoctorLicense}</div>` : ''}
          </div>
        </div>
        ${!isShriThanya ? `<div class="fin-ref-row">
          <span class="fin-ref-lbl">แผนกปลายทาง</span>
          <select class="fin-select" style="flex:1;font-size:12px;padding:5px 8px" onchange="setFinalField('${p.id}','referralReceivingDept',this.value)">
            <option value="">— optional —</option>
            ${(typeof RECEIVING_DEPTS!=='undefined'?RECEIVING_DEPTS:[]).map(d =>
              `<option${f.referralReceivingDept===d?' selected':''}>${d}</option>`
            ).join('')}
          </select>
        </div>` : ''}
      </div>
    </div>`;
  }

  // ── สาขาดูร่วม (Co-managing — optional, multiple entries) ──
  const cLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};

  html += `<div class="fin-row fin-col">
    <span class="fin-lbl">สาขาดูร่วม</span>`;

  // Existing entries
  if (f.consults.length) {
    f.consults.forEach((c, i) => {
      html += `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border-subtle)">
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;color:var(--text-primary);flex:1">${c.doctor}</span>
        <span style="font-family:'Sarabun',sans-serif;font-size:11px;color:var(--text-dim)">${cLabels[c.department]||c.department}</span>
        ${c.license ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${c.license}</span>` : ''}
        <button style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 4px;font-size:10px" onclick="event.stopPropagation();finConsultRemove('${p.id}',${i})"><i class="fas fa-times"></i></button>
      </div>`;
    });
  }

  // Add new entry — doctor first, dept auto-locks
  html += `<div style="margin-top:6px">
    <div style="display:flex;gap:6px">
      <div style="position:relative;flex:1">
        <input class="fin-input" id="fin-cdoc-${p.id}" placeholder="พิมพ์ชื่อแพทย์..."
          style="font-size:12px;padding:5px 8px"
          oninput="finConsultDocSearch('${p.id}',this.value)" onfocus="finConsultDocSearch('${p.id}',this.value)"
          onkeydown="finDropKeydown(event,'fin-cdoc-drop-${p.id}')"
          onblur="setTimeout(()=>{const d=document.getElementById('fin-cdoc-drop-${p.id}');if(d)d.style.display='none'},200)">
        <div class="fin-dx-drop" id="fin-cdoc-drop-${p.id}"></div>
      </div>
      <div style="position:relative;flex:1">
        <input class="fin-input" id="fin-cdept-${p.id}" placeholder="แผนก..." readonly
          style="font-size:12px;padding:5px 8px;color:var(--text-dim)">
      </div>
    </div>
    <div style="text-align:right;margin-top:4px">
      <button class="fin-toggle-btn" onclick="event.stopPropagation();finConsultAdd('${p.id}')" style="font-size:11px;padding:4px 10px">
        <i class="fas fa-plus" style="margin-right:3px"></i> เพิ่ม
      </button>
    </div>
  </div>
  </div>`;

  // ── TREATMENT OUTCOME (Discharge + Refer only) ──
  if (type === 'discharge' || type === 'refer') {
    html += `<div class="fin-row">
      <span class="fin-lbl">OUTCOME <span class="fin-req">*</span></span>
      <select class="fin-select" onchange="setFinalField('${p.id}','treatmentOutcome',this.value)">
        <option value="">— เลือก —</option>
        ${(typeof TREATMENT_OUTCOMES!=='undefined'?TREATMENT_OUTCOMES:[]).map(o =>
          `<option${f.treatmentOutcome===o?' selected':''}>${o}</option>`
        ).join('')}
      </select>
    </div>`;
  }

  // ── COMPLETE BUTTON ──
  const canComplete = checkFinalizationComplete(p.id, type);
  html += `<div style="margin-top:12px">
    <button class="fin-complete-btn${canComplete?'':' disabled'}" onclick="${canComplete?`completeFinalization('${p.id}')`:''}">
      <i class="fas fa-check-circle" style="margin-right:6px"></i> COMPLETE FINALIZATION
    </button>
    ${!canComplete ? '<div class="fin-hint" style="text-align:center;margin-top:4px">กรุณากรอกข้อมูลที่จำเป็นให้ครบ</div>' : ''}
  </div>`;

  html += `</div>`;
  return html;
}

// ══════════════════════════════════════════
// FINALIZATION FIELD HANDLERS
// ══════════════════════════════════════════
function setFinalEsi(visitId, esi) {
  getFinalData(visitId).finalEsi = esi;
  // Re-render the ESI buttons
  document.querySelectorAll(`#fin-esi-wrap-${visitId} .fin-esi-btn`).forEach(btn => {
    btn.classList.toggle('sel', parseInt(btn.textContent) === esi);
  });
  // Refresh the whole finalized QV to update button state
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

function setFinalField(visitId, field, value) {
  getFinalData(visitId)[field] = value;
}

function finDeptChange(visitId, dept) {
  const f = getFinalData(visitId);
  f.department = dept;
  f.doctor = '';
  f.doctorLicense = '';
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

function finDocChange(visitId, name) {
  const f = getFinalData(visitId);
  f.doctor = name;
  const doctors = typeof getDoctorsForDept==='function' ? getDoctorsForDept(f.department) : [];
  const doc = doctors.find(d => d.name === name);
  f.doctorLicense = doc?.license || '';
}

// Department auto-suggest
function finDeptSearch(visitId, query) {
  const drop = document.getElementById('fin-dept-drop-' + visitId);
  if (!drop) return;
  const f = getFinalData(visitId);

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const matches = Object.entries(deptLabels).filter(([k, v]) =>
    k.toLowerCase().includes(query.toLowerCase()) || v.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(([k, v]) =>
    `<div class="fin-dx-item" onmousedown="finDeptPick('${visitId}','${k}')">${v}</div>`
  ).join('');
  drop.style.display = 'block';
}

function finDeptPick(visitId, dept) {
  const f = getFinalData(visitId);
  f.department = dept;
  f.doctor = '';
  f.doctorLicense = '';
  const drop = document.getElementById('fin-dept-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// Doctor auto-suggest (all in-hospital doctors, auto-locks department)
function finDocSearch(visitId, query) {
  const drop = document.getElementById('fin-doc-drop-' + visitId);
  if (!drop) return;
  const f = getFinalData(visitId);

  // If department is selected and has a doctor list, restrict to that list (no free text)
  const hasDeptList = f.department && typeof DEPT_DOCTORS !== 'undefined' && DEPT_DOCTORS[f.department];

  if (hasDeptList) {
    // Locked to department's doctors only
    const deptDocs = DEPT_DOCTORS[f.department].map(d => ({ name: d.name, license: d.license, dept: f.department }));
    const matches = query ? deptDocs.filter(d => d.name.toLowerCase().includes(query.toLowerCase())) : deptDocs;
    f.doctor = query;
    f.doctorLicense = '';

    // Don't allow free text — only show matches
    drop.innerHTML = matches.map(d =>
      `<div class="fin-dx-item" onmousedown="finDocPick('${visitId}','${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''}</div>`
    ).join('');
    drop.style.display = matches.length ? 'block' : 'none';
    return;
  }

  // No department selected — show all doctors, auto-lock dept on pick
  f.doctor = query;
  f.doctorLicense = '';

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
    `<div class="fin-dx-item" onmousedown="finDocPick('${visitId}','${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''} <span style="font-size:10px;color:var(--text-dim)">${deptLabels[d.dept] || d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

// Universal keyboard navigation for any fin-dx-drop dropdown
const _finDropIdx = {};
function finDropKeydown(e, dropId) {
  const drop = document.getElementById(dropId);
  if (!drop || drop.style.display === 'none') return;
  const items = drop.querySelectorAll('.fin-dx-item');
  if (!items.length) return;
  if (!_finDropIdx[dropId]) _finDropIdx[dropId] = -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _finDropIdx[dropId] = Math.min(_finDropIdx[dropId] + 1, items.length - 1);
    items.forEach((el, i) => el.style.background = i === _finDropIdx[dropId] ? 'var(--item-hover-bg)' : '');
    items[_finDropIdx[dropId]].scrollIntoView({block:'nearest'});
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _finDropIdx[dropId] = Math.max(_finDropIdx[dropId] - 1, 0);
    items.forEach((el, i) => el.style.background = i === _finDropIdx[dropId] ? 'var(--item-hover-bg)' : '');
    items[_finDropIdx[dropId]].scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter' && _finDropIdx[dropId] >= 0 && items[_finDropIdx[dropId]]) {
    e.preventDefault();
    const sel = items[_finDropIdx[dropId]];
    const md = sel.getAttribute('onmousedown');
    if (md) eval(md);
    _finDropIdx[dropId] = -1;
  } else {
    _finDropIdx[dropId] = -1;
  }
}
// Shortcut for specific fields
function finDocKeydown(e, visitId) { finDropKeydown(e, 'fin-doc-drop-' + visitId); }
function finDeptKeydown(e, visitId) { finDropKeydown(e, 'fin-dept-drop-' + visitId); }
function finDxKeydown(e, visitId) { finDropKeydown(e, 'fin-dx-drop-' + visitId); }
function finArrKeydown(e, visitId) { finDropKeydown(e, 'fin-arr-drop-' + visitId); }
function finRefDocKeydown(e, visitId) { finDropKeydown(e, 'fin-refdoc-drop-' + visitId); }

function finDocPick(visitId, name, license, dept) {
  const f = getFinalData(visitId);
  f.doctor = name;
  f.doctorLicense = license;
  if (dept) f.department = dept; // Auto-lock department
  const drop = document.getElementById('fin-doc-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// ── สาขาดูร่วม — multi-entry, doctor-first search ──
let _finConsultPick = {}; // { visitId: { name, license, dept } }

function finConsultDocSearch(visitId, query) {
  const drop = document.getElementById('fin-cdoc-drop-' + visitId);
  if (!drop) return;
  _finConsultPick[visitId] = null;
  const deptInput = document.getElementById('fin-cdept-' + visitId);
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
    `<div class="fin-dx-item" onmousedown="finConsultDocPick('${visitId}','${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''} <span style="font-size:10px;color:var(--text-dim)">${deptLabels[d.dept]||d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

function finConsultDocPick(visitId, name, license, dept) {
  _finConsultPick[visitId] = { name, license, dept };
  const input = document.getElementById('fin-cdoc-' + visitId);
  if (input) { input.value = name; input.classList.add('fin-input-selected'); }
  const drop = document.getElementById('fin-cdoc-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  const deptLabels = typeof DEPT_LABELS !== 'undefined' ? DEPT_LABELS : {};
  const deptInput = document.getElementById('fin-cdept-' + visitId);
  if (deptInput) deptInput.value = deptLabels[dept] || dept;
}

function finConsultAdd(visitId) {
  const pick = _finConsultPick[visitId];
  if (!pick || !pick.name) return;
  const f = getFinalData(visitId);
  f.consults.push({ doctor: pick.name, department: pick.dept, license: pick.license || '' });
  _finConsultPick[visitId] = null;
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

function finConsultRemove(visitId, idx) {
  const f = getFinalData(visitId);
  f.consults.splice(idx, 1);
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

function toggleFinFlag(visitId, flag, btn) {
  const f = getFinalData(visitId);
  f[flag] = !f[flag];
  btn.classList.toggle('on', f[flag]);
}

function finArrivalModeChange(visitId, value) {
  const f = getFinalData(visitId);
  f.arrivalMode = value;
  f.arrivalModeSub = '';
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// Arrival mode auto-suggest
function finArrModeSearch(visitId, query) {
  const drop = document.getElementById('fin-arr-drop-' + visitId);
  if (!drop) return;
  const f = getFinalData(visitId);

  const arrModes = typeof ARRIVAL_MODES !== 'undefined' ? ARRIVAL_MODES : [];

  if (!query || query.length < 1) {
    // Show all on focus
    drop.innerHTML = arrModes.map(m =>
      `<div class="fin-dx-item" onmousedown="finArrModePick('${visitId}','${m.label.replace(/'/g,"\\'")}')">${m.label}</div>`
    ).join('');
    drop.style.display = 'block';
    return;
  }

  const matches = arrModes.filter(m => m.label.toLowerCase().includes(query.toLowerCase()) || (m.alias && m.alias.toLowerCase().includes(query.toLowerCase()))).slice(0, 10);
  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(m =>
    `<div class="fin-dx-item" onmousedown="finArrModePick('${visitId}','${m.label.replace(/'/g,"\\'")}')">${m.label}</div>`
  ).join('');
  drop.style.display = 'block';
}

function finArrModePick(visitId, label) {
  const f = getFinalData(visitId);
  f.arrivalMode = label;
  f.arrivalModeSub = '';
  f.arrivalModeExtra = '';
  f.arrivalModeCustom = '';
  const drop = document.getElementById('fin-arr-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// Hospital auto-suggest for Refer in arrival mode (same list as refer out + อื่นๆ)
function finArrHospSearch(visitId, query) {
  const drop = document.getElementById('fin-arr-hosp-drop-' + visitId);
  if (!drop) return;
  const f = getFinalData(visitId);
  f.arrivalModeSub = query;

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const hospitals = typeof HOSPITAL_LIST !== 'undefined' ? HOSPITAL_LIST : [];
  const matches = hospitals.filter(h => h.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(h =>
    `<div class="fin-dx-item" onmousedown="finArrHospPick('${visitId}','${h.name.replace(/'/g,"\\'")}')">${h.name}</div>`
  ).join('');
  drop.style.display = 'block';
}

function finArrHospPick(visitId, name) {
  const f = getFinalData(visitId);
  f.arrivalModeSub = name;
  const input = document.getElementById('fin-arr-hosp-' + visitId);
  if (input) input.value = name;
  const drop = document.getElementById('fin-arr-hosp-drop-' + visitId);
  if (drop) drop.style.display = 'none';
}

function finReferDocChange(visitId, name) {
  const f = getFinalData(visitId);
  f.referralDoctor = name;
  const allDocs = typeof getAllDoctors==='function' ? getAllDoctors() : [];
  const doc = allDocs.find(d => d.name === name);
  f.referralDoctorLicense = doc?.license || '';
}

// Auto-suggest referring doctor — in-hospital doctors only (no EP)
function finReferDocSearch(visitId, query) {
  const drop = document.getElementById('fin-refdoc-drop-' + visitId);
  if (!drop) return;

  const f = getFinalData(visitId);
  f.referralDoctor = query;
  f.referralDoctorLicense = '';

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  // Get all dept doctors (exclude EP)
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
  ).slice(0, 8);

  if (!matches.length) {
    // No match = free text (อื่นๆ)
    drop.style.display = 'none';
    return;
  }

  drop.innerHTML = matches.map(d =>
    `<div class="fin-dx-item" onmousedown="finReferDocPick('${visitId}','${d.name.replace(/'/g,"\\'")}','${(d.license||'').replace(/'/g,"\\'")}','${d.dept.replace(/'/g,"\\'")}')">${d.name}${d.license ? ` <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${d.license}</span>` : ''} <span style="font-size:10px;color:var(--text-dim)">${d.dept}</span></div>`
  ).join('');
  drop.style.display = 'block';
}

function finReferDocPick(visitId, name, license, dept) {
  const f = getFinalData(visitId);
  f.referralDoctor = name;
  f.referralDoctorLicense = license;
  // Auto-lock department from doctor's dept
  if (dept) f.department = dept;
  const input = document.getElementById('fin-refdoc-' + visitId);
  if (input) input.value = name;
  const drop = document.getElementById('fin-refdoc-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  // Refresh to show license + locked dept
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// ── Diagnosis search ──
function finDxSearch(visitId, query) {
  const drop = document.getElementById('fin-dx-drop-' + visitId);
  if (!drop) return;

  const f = getFinalData(visitId);
  f.diagnosis = query;
  f.diagnosisIcd = '';

  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const matches = (typeof DX_LIST !== 'undefined' ? DX_LIST : []).filter(dx =>
    dx.text.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 12);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(dx =>
    `<div class="fin-dx-item" onmousedown="finDxPick('${visitId}','${dx.text.replace(/'/g,"\\'")}','${dx.icd||''}')">
      ${dx.text} <span style="float:right;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${dx.icd||''}</span>
    </div>`
  ).join('');
  drop.style.display = 'block';
}

function finDxPick(visitId, text, icd) {
  const f = getFinalData(visitId);
  f.diagnosis = text;
  f.diagnosisIcd = icd;
  const input = document.getElementById('fin-dx-' + visitId);
  if (input) input.value = text;
  const drop = document.getElementById('fin-dx-drop-' + visitId);
  if (drop) drop.style.display = 'none';
  // Refresh to show ICD and update button state
  const p = patients.find(x => x.id === visitId);
  if (p) openFinalizedQV(p.id);
}

// ── Check if all required fields are filled ──
function checkFinalizationComplete(visitId, type) {
  const f = getFinalData(visitId);
  const p = patients.find(x => x.id === visitId);
  // ปฏิเสธการรักษา — always complete (no fields needed)
  if (p?.status === 'ปฏิเสธการรักษา') return true;
  // เรียกไม่พบ — only needs case type
  if (p?.status === 'เรียกไม่พบ') return !!(f.caseCategory || p.caseCat);
  if (!f.finalEsi) return false;
  if (!f.diagnosis) return false;
  if (!f.arrivalMode) return false;
  if (!p?.caseCat && !f.caseCategory) return false; // Case category required
  if (type === 'admit' && (!f.department || !f.doctor)) return false;
  // If department has a doctor list, doctor must be from that list
  if (type === 'admit' && f.department && typeof DEPT_DOCTORS !== 'undefined' && DEPT_DOCTORS[f.department]) {
    const validDocs = DEPT_DOCTORS[f.department].map(d => d.name);
    if (!validDocs.includes(f.doctor)) return false;
  }
  if (type === 'refer' && !f.referralDoctor) return false; // Referring doctor required
  if ((type === 'discharge' || type === 'refer') && !f.treatmentOutcome) return false;
  return true;
}

// ── Save finalization to Supabase ──
async function completeFinalization(visitId) {
  const p = patients.find(x => x.id === visitId);
  if (!p) return;
  const f = getFinalData(visitId);
  const type = getDispoType(p.status);

  // Build update payload
  const updates = {
    final_esi: f.finalEsi || p.esi,
    case_category: f.caseCategory || null,
    diagnosis: f.diagnosis,
    diagnosis_icd10: f.diagnosisIcd || null,
    arrival_mode: f.arrivalMode || null,
    hospital_arrival_time: f.hospitalArrivalTime ? new Date().toISOString().split('T')[0]+'T'+f.hospitalArrivalTime+':00+07:00' : null,
    had_ett: f.hadETT || false,
    had_cpr: f.hadCPR || false,
    data_complete: true,
    data_completed_at: new Date().toISOString(),
  };

  if (type === 'admit') {
    updates.department = f.department;
    updates.doctor = f.doctor;
    updates.doctor_license = f.doctorLicense || null;
  }
  if (type === 'refer') {
    updates.referral_hospital = f.referralHospital || null;
    updates.referral_reason = f.referralReason || null;
    updates.referral_doctor = f.referralDoctor || null;
    updates.referral_doctor_license = f.referralDoctorLicense || null;
    updates.referral_receiving_dept = f.referralReceivingDept || null;
  }
  if (type === 'discharge' || type === 'refer') {
    updates.treatment_outcome = f.treatmentOutcome || null;
  }

  // Save to Supabase
  const { error } = await sb.from('visits').update(updates).eq('id', visitId);
  if (error) {
    console.error('Finalization save error:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก','#ef4444','fa-exclamation-triangle');
    return;
  }

  logAudit(visitId, 'data_complete', 'finalize', { next:'complete', detail:{ type, diagnosis:f.diagnosis, finalEsi:f.finalEsi }, patientId:p.patientId });

  // Save สาขาดูร่วม entries to consult_log
  if (f.consults && f.consults.length) {
    for (const c of f.consults) {
      await sb.from('consult_log').insert({
        visit_id: visitId,
        department: c.department,
        doctor: c.doctor,
        doctor_license: c.license || null
      });
    }
  }

  closeQV();

  showToast(`<div style="line-height:1.3">
    <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
    <div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#86efac;margin-top:2px"><i class="fas fa-check-circle" style="margin-right:4px"></i>ข้อมูลครบ — บันทึกแล้ว</div>
  </div>`, '#22c55e', 'fa-check-circle');

  // Reload
  const fresh = await loadPatients();
  patients.length = 0;
  fresh.forEach(px => patients.push(px));
  renderSit();
  renderSFilter();
  renderCards();
}

