// floor/core.js — Supabase, auth, config, rendering, init
// ══════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://djsganssutgaoztvcrbg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqc2dhbnNzdXRnYW96dHZjcmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTgzNzQsImV4cCI6MjA4OTgzNDM3NH0.sb6Z6KQIvnrIFOzttE8d-IP-vF7dg19BcFwBtQxQweo';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════
// LOCK SCREEN
// ══════════════════════════════════════════
const lockEl = document.getElementById('lockscreen');
const lockPin = document.getElementById('lock-pin');
const lockErr = document.getElementById('lock-err');
const lockBtn = document.getElementById('lock-btn');

let APP_PIN = null;       // stored in memory after unlock — sent with every write
let APP_ROLE = null;      // 'staff' or 'master'
let idleTimer = null;
const IDLE_MS = 10 * 60 * 1000; // 10 minutes

// Check if already unlocked this session
const savedPin = sessionStorage.getItem('minis_pin');
const savedRole = sessionStorage.getItem('minis_role');
if (savedPin && savedRole) {
  APP_PIN = savedPin;
  APP_ROLE = savedRole;
  lockEl.style.display = 'none';
  startIdleWatch();
}

// Enter key submits
lockPin.addEventListener('keydown', e => { if (e.key === 'Enter') unlockApp(); });

async function unlockApp() {
  const pin = lockPin.value.trim();
  if (!pin) { lockErr.textContent = 'กรุณาใส่รหัส'; return; }

  lockBtn.disabled = true;
  lockBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CHECKING...';
  lockErr.textContent = '';

  try {
    const { data, error } = await sb.rpc('check_staff_pin', { input_pin: pin });
    if (error) throw error;
    if (data === 'staff' || data === 'master') {
      APP_PIN = pin;
      APP_ROLE = data;
      sessionStorage.setItem('minis_pin', pin);
      sessionStorage.setItem('minis_role', data);
      lockEl.style.opacity = '0';
      setTimeout(() => { lockEl.style.display = 'none'; }, 400);
      startIdleWatch();
    } else {
      lockErr.textContent = 'รหัสไม่ถูกต้อง';
      lockPin.value = '';
      lockPin.focus();
    }
  } catch (err) {
    lockErr.textContent = 'Connection error — try again';
    console.error('Lock check failed:', err);
  }

  lockBtn.disabled = false;
  lockBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> UNLOCK';
}

// ── Inactivity auto-lock (staff only) ──
function startIdleWatch() {
  if (APP_ROLE === 'master') return; // master never auto-locks
  resetIdle();
  ['mousemove','mousedown','keydown','touchstart','scroll'].forEach(evt =>
    document.addEventListener(evt, resetIdle, { passive: true })
  );
}

function resetIdle() {
  if (APP_ROLE === 'master') return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lockApp, IDLE_MS);
}

function lockApp() {
  APP_PIN = null;
  APP_ROLE = null;
  sessionStorage.removeItem('minis_pin');
  sessionStorage.removeItem('minis_role');
  clearTimeout(idleTimer);
  lockPin.value = '';
  lockErr.textContent = 'หมดเวลา — กรุณาใส่รหัสอีกครั้ง';
  lockEl.style.display = 'flex';
  lockEl.style.opacity = '1';
}

// ══════════════════════════════════════════
// SUPABASE HELPERS
// ══════════════════════════════════════════

// Convert DB row to patient object (unified model)
function dbToPatient(row) {
  // row = joined visits + patients data
  return {
    id: row.visit_id || row.id,
    patientId: row.patient_id,
    hn: row.hn,
    title: row.title || '',
    firstName: row.first_name,
    lastName: row.last_name,
    sex: row.sex,
    age: { y: row.age_y || 0, m: row.age_m || 0, d: row.age_d || 0 },
    esi: row.esi,
    tab: row.tab,
    status: row.status,
    cc: row.chief_complaint || '',
    phones: [
      { num: row.phone_1 || '', lbl: row.phone_1_label || '' },
      { num: row.phone_2 || '', lbl: row.phone_2_label || '' }
    ],
    waitMin: row.arrived_at ? Math.floor((Date.now() - new Date(row.arrived_at).getTime()) / 60000) : 0,
    stayMin: row.activated_at ? Math.floor((Date.now() - new Date(row.activated_at).getTime()) / 60000) : 0,
    v: { bt:null, sbp:null, dbp:null, hr:null, rr:null, spo2:null, src:'RA', lpm:null, dtx:null },
    trend: 's',
    upd: row.updated_at ? new Date(row.updated_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : '—',
    arrivedAt: row.arrived_at,
    activatedAt: row.activated_at,
    finalizedAt: row.finalized_at ? new Date(row.finalized_at).getTime() : null,
    fastTrack: row.fast_track,
    caseCat: row.case_category || null,
    arrivalMode: row.arrival_mode || null,
    dataComplete: row.data_complete || false
  };
}

// Load all active visits with patient data
async function loadPatients() {
  const { data, error } = await sb
    .from('visits')
    .select(`
      id,
      patient_id,
      esi,
      chief_complaint,
      status,
      tab,
      fast_track,
      arrived_at,
      activated_at,
      finalized_at,
      updated_at,
      case_category,
      arrival_mode,
      data_complete,
      data_completed_at,
      admit_decided_at,
      refer_decided_at,
      handover_ward_at,
      handover_refer_at,
      actual_move_at,
      bed_requested_ward,
      patients (
        id, hn, title, first_name, last_name, sex,
        age_y, age_m, age_d,
        phone_1, phone_1_label, phone_2, phone_2_label
      )
    `)
    .order('arrived_at', { ascending: true });

  if (error) { console.error('Load error:', error); return []; }

  // Filter out finalized patients:
  // - Incomplete data: keep forever (until completed)
  // - Complete data: hide after 2 hours from data_completed_at
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const filtered = data.filter(row => {
    if (row.tab !== 'finalized') return true;
    if (!row.data_complete) return true; // Incomplete — keep on board
    if (!row.data_completed_at) return true;
    return (now - new Date(row.data_completed_at).getTime()) < TWO_HOURS;
  });

  return filtered.map(row => {
    const p = row.patients;
    return dbToPatient({
      visit_id: row.id,
      patient_id: row.patient_id,
      hn: p.hn,
      title: p.title,
      first_name: p.first_name,
      last_name: p.last_name,
      sex: p.sex,
      age_y: p.age_y,
      age_m: p.age_m,
      age_d: p.age_d,
      phone_1: p.phone_1,
      phone_1_label: p.phone_1_label,
      phone_2: p.phone_2,
      phone_2_label: p.phone_2_label,
      esi: row.esi,
      chief_complaint: row.chief_complaint,
      status: row.status,
      tab: row.tab,
      fast_track: row.fast_track,
      case_category: row.case_category,
      arrival_mode: row.arrival_mode,
      arrived_at: row.arrived_at,
      activated_at: row.activated_at,
      updated_at: row.updated_at,
      finalized_at: row.finalized_at,
      data_complete: row.data_complete,
      admit_decided_at: row.admit_decided_at,
      refer_decided_at: row.refer_decided_at,
      handover_ward_at: row.handover_ward_at,
      handover_refer_at: row.handover_refer_at,
      actual_move_at: row.actual_move_at,
      bed_requested_ward: row.bed_requested_ward
    });
  });
}

// Register new patient to Supabase
async function registerPatient(patientData, visitData) {
  if (!APP_PIN) { lockApp(); return null; }

  const { data, error } = await sb.rpc('rpc_register_patient', {
    pin: APP_PIN,
    p_hn: patientData.hn,
    p_title: patientData.title || '',
    p_first_name: patientData.firstName,
    p_last_name: patientData.lastName,
    p_sex: patientData.sex,
    p_age_y: patientData.age.y || 0,
    p_age_m: patientData.age.m || 0,
    p_age_d: patientData.age.d || 0,
    v_esi: visitData.esi,
    v_cc: visitData.cc || '',
    v_status: visitData.status,
    v_tab: visitData.tab,
    v_fast_track: visitData.fastTrack || null,
    v_case_category: visitData.caseCategory || null,
    v_arrival_mode: visitData.arrivalMode || null
  });

  if (error) { console.error('Register error:', error); return null; }
  if (data?.error === 'invalid_pin') { lockApp(); return null; }
  return { patientId: data.patient_id, visitId: data.visit_id };
}

// Update visit status
async function updateVisitStatus(visitId, newStatus, newTab, activatedAt) {
  if (!APP_PIN) { lockApp(); return; }

  const { data, error } = await sb.rpc('rpc_update_visit', {
    pin: APP_PIN,
    visit_id: visitId,
    new_status: newStatus,
    new_tab: newTab
  });

  if (error) console.error('Update status error:', error);
  if (data?.error === 'invalid_pin') lockApp();
}

// Update patient info (name, age, title, HN, phones)
async function updatePatientInfo(patientId, fields) {
  if (!APP_PIN) { lockApp(); return; }

  const { data, error } = await sb.rpc('rpc_update_patient', {
    pin: APP_PIN,
    patient_id: patientId,
    p_title: fields.title ?? null,
    p_first_name: fields.first_name ?? null,
    p_last_name: fields.last_name ?? null,
    p_sex: fields.sex ?? null,
    p_age_y: fields.age_y ?? null,
    p_age_m: fields.age_m ?? null,
    p_age_d: fields.age_d ?? null,
    p_phone_1: fields.phone_1 ?? null,
    p_phone_1_label: fields.phone_1_label ?? null,
    p_phone_2: fields.phone_2 ?? null,
    p_phone_2_label: fields.phone_2_label ?? null
  });

  if (error) console.error('Update patient error:', error);
  if (data?.error === 'invalid_pin') lockApp();
}

// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const ESI_CLR  = {1:'#ef4444',2:'#ec4899',3:'#eab308',4:'#22c55e',5:'#3b82f6'};
const ESI_AMB  = {1:0,  2:10,  3:180, 4:240, 5:Infinity};  // amber: ESI3=3h, ESI4=4h, ESI5=never
const ESI_RED  = {1:0,  2:15,  3:240, 4:300, 5:Infinity};  // red: ESI3=4h, ESI4=5h, ESI5=never

// status definitions — pub: what PublicView displays (omit = use label)
const SC = {
  // ── ACTIVE ──
  'Resuscitate'                   :{label:'Resuscitate',                   dot:'#ef4444', pill:'sp-resus'},
  'เข้าห้องตรวจ'                  :{label:'เข้าห้องตรวจ',                 dot:'#22c55e', pill:'sp-active'},
  'สังเกตอาการ'                   :{label:'Observe',                       dot:'#f59e0b', pill:'sp-observe'},
  'ส่งเอ็กซ์เรย์'                 :{label:'ส่ง X-Rays',                   dot:'#60a5fa', pill:'sp-lab',     pub:'ส่งเอ็กซ์เรย์ (X-Rays)'},
  'ส่งเอ็กซ์เรย์คอมพิวเตอร์'     :{label:'ส่ง CT',                       dot:'#818cf8', pill:'sp-lab',     pub:'ส่งเอ็กซ์เรย์คอมพิวเตอร์ (CT)'},
  'ทำหัตถการ'                     :{label:'ทำหัตถการ',                     dot:'#f59e0b', pill:'sp-observe'},
  // ── CONSULT ──
  'ปรึกษาแพทย์เฉพาะทาง'          :{label:'Consult',                      dot:'#60a5fa', pill:'sp-lab',     pub:'ปรึกษาแพทย์เฉพาะทาง'},
  'ติดต่อส่งตัวโรงพยาบาลอื่น'    :{label:'ติดต่อ Refer',                 dot:'#60a5fa', pill:'sp-lab',     pub:'ติดต่อส่งตัวโรงพยาบาลอื่น'},
  // ── WAIT ──
  'รอผลตรวจ'                      :{label:'รอผลตรวจ',                     dot:'#818cf8', pill:'sp-lab'},
  'รอส่งตัวโรงพยาบาลอื่น'        :{label:'รอ Refer',                     dot:'#a78bfa', pill:'sp-dispo',   pub:'รอส่งตัวโรงพยาบาลอื่น'},
  'รอขึ้นหอผู้ป่วย'               :{label:'รอ Admit',                     dot:'#a78bfa', pill:'sp-dispo',   pub:'รอขึ้นหอผู้ป่วย'},
  'รอทำหัตถการ'                   :{label:'รอทำหัตถการ',                  dot:'#f59e0b', pill:'sp-observe'},
  'รอเอกสาร'                      :{label:'รอเอกสาร',                     dot:'#6b8ba4', pill:'sp-default'},
  'รอชำระเงิน'                    :{label:'รอชำระเงิน',                   dot:'#6b8ba4', pill:'sp-default'},
  'รอรับยา'                       :{label:'รอรับยา',                      dot:'#6b8ba4', pill:'sp-default'},
  // ── ADMIT → FINALIZED ──
  'ICU'                           :{label:'Admit ICU',                    dot:'#a78bfa', pill:'sp-dispo',   pub:'ขึ้นหอผู้ป่วย'},
  'วอร์ดชาย'                      :{label:'Admit วอร์ดชาย',               dot:'#22c55e', pill:'sp-active',  pub:'ขึ้นหอผู้ป่วย'},
  'วอร์ดหญิง'                     :{label:'Admit วอร์ดหญิง',              dot:'#22c55e', pill:'sp-active',  pub:'ขึ้นหอผู้ป่วย'},
  'วอร์ดพิเศษชั้น 6'             :{label:'Admit วอร์ดพิเศษชั้น 6',       dot:'#22c55e', pill:'sp-active',  pub:'ขึ้นหอผู้ป่วย'},
  'วอร์ดพิเศษชั้น 7'             :{label:'Admit วอร์ดพิเศษชั้น 7',       dot:'#22c55e', pill:'sp-active',  pub:'ขึ้นหอผู้ป่วย'},
  'วอร์ดตา'                       :{label:'Admit วอร์ดตา',                dot:'#22c55e', pill:'sp-active',  pub:'ขึ้นหอผู้ป่วย'},
  // ── DISCHARGE → FINALIZED ──
  'Discharge'                     :{label:'Discharge',                    dot:'#22c55e', pill:'sp-active',  pub:'สิ้นสุดการรักษา'},
  'ส่งแผนกผู้ป่วยนอก'            :{label:'ส่ง OPD',                      dot:'#60a5fa', pill:'sp-lab',     pub:'ส่งแผนกผู้ป่วยนอก'},
  'ส่งห้องผ่าตัด'                 :{label:'ส่ง OR',                       dot:'#818cf8', pill:'sp-lab',     pub:'ส่งห้องผ่าตัด'},
  'ส่งคลินิกโรคเรื้อรัง'         :{label:'ส่ง NCD',                      dot:'#60a5fa', pill:'sp-lab',     pub:'ส่งคลินิกโรคเรื้อรัง'},
  'ส่งแผนกตา'                     :{label:'ส่ง OPD ตา',                   dot:'#60a5fa', pill:'sp-lab',     pub:'ส่งแผนกตา'},
  'ส่งตัวโรงพยาบาลอื่น'          :{label:'Refer',                        dot:'#a78bfa', pill:'sp-dispo',   pub:'ส่งตัวโรงพยาบาลอื่น'},
  'ปฏิเสธการรักษา'               :{label:'ปฏิเสธการรักษา',               dot:'#f59e0b', pill:'sp-observe', pub:'สิ้นสุดการรักษา'},
  'เสียชีวิต'                     :{label:'เสียชีวิต',                    dot:'#6b8ba4', pill:'sp-default', pub:'สิ้นสุดการรักษา'},
  // ── WAITING ──
  'รอตรวจ'                        :{label:'รอเข้าห้องตรวจ',               dot:'#60a5fa', pill:'sp-waiting'},
  'เรียกไม่พบ'                    :{label:'เรียกไม่พบ',                   dot:'#f59e0b', pill:'sp-notfound'},
};
function sc(s){return SC[s]||{label:s||'—',dot:'#6b8ba4',pill:'sp-default'};}

const OPT = {
  waiting:[
    {g:'สถานะรอ',            items:['รอตรวจ','เรียกไม่พบ','ปฏิเสธการรักษา']},
    {g:'ย้ายไป Active',      items:['Resuscitate','ส่งเอ็กซ์เรย์','ส่งเอ็กซ์เรย์คอมพิวเตอร์','รอผลตรวจ','รอทำหัตถการ','เข้าห้องตรวจ']},
    {g:'ปิดเคส → Finalized', items:['เรียกไม่พบ']},
  ],
  active:[
    {g:'Active',                items:['Resuscitate','สังเกตอาการ','เข้าห้องตรวจ','ส่งเอ็กซ์เรย์','ส่งเอ็กซ์เรย์คอมพิวเตอร์','ทำหัตถการ']},
    {g:'Consult',               items:['ปรึกษาแพทย์เฉพาะทาง']},
    // ติดต่อส่งตัวโรงพยาบาลอื่น removed — must go through Plan Refer flow
    {g:'Wait',                  items:['รอผลตรวจ','รอทำหัตถการ','รอรับยา','รอเอกสาร','รอชำระเงิน']},
    // Admit wards removed — must go through dispo flow (Decision to Admit → จองเตียง → ส่งเวร → ย้าย)
    {g:'Discharge → Finalized', items:['Discharge','ส่งแผนกผู้ป่วยนอก','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งห้องผ่าตัด','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']},
  ],
  disposition:[],
  finalized:[]
};

// ── Kanban Lanes (Active tab only) ──
const LANES = [
  { id:'treatment', label:'ตรวจ',       labelEn:'Treatment',  icon:'fa-stethoscope',
    statuses:['Resuscitate','เข้าห้องตรวจ','สังเกตอาการ','ส่งเอ็กซ์เรย์','ส่งเอ็กซ์เรย์คอมพิวเตอร์'] },
  { id:'pending',   label:'รอผล',       labelEn:'Pending',    icon:'fa-hourglass-half',
    statuses:['รอผลตรวจ','ปรึกษาแพทย์เฉพาะทาง','ติดต่อส่งตัวโรงพยาบาลอื่น','รอทำหัตถการ','ทำหัตถการ'] },
  { id:'boarding',  label:'รอจำหน่าย',  labelEn:'Boarding',   icon:'fa-clock',
    statuses:['รอขึ้นหอผู้ป่วย','รอส่งตัวโรงพยาบาลอื่น','รอรับยา','รอเอกสาร','รอชำระเงิน'] },
  { id:'dispo',     label:'จำหน่าย',    labelEn:'Dispo',      icon:'fa-right-from-bracket',
    statuses:['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา',
              'Discharge','ส่งแผนกผู้ป่วยนอก','ส่งห้องผ่าตัด','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา',
              'ส่งตัวโรงพยาบาลอื่น','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ'] },
];
// Reverse lookup: status → lane id
const STATUS_TO_LANE = {};
LANES.forEach(l => l.statuses.forEach(s => STATUS_TO_LANE[s] = l.id));

// ── ESI Lanes (Waiting tab) — collapse when empty ──
const ESI_LANES = [
  { esi:1, label:'ESI 1', labelTh:'Resuscitate',    color:'#ef4444', icon:'fa-heart-pulse' },
  { esi:2, label:'ESI 2', labelTh:'ฉุกเฉินวิกฤต',   color:'#ec4899', icon:'fa-bolt' },
  { esi:3, label:'ESI 3', labelTh:'กึ่งฉุกเฉิน',    color:'#eab308', icon:'fa-triangle-exclamation' },
  { esi:4, label:'ESI 4', labelTh:'ไม่ฉุกเฉิน',     color:'#22c55e', icon:'fa-clipboard' },
  { esi:5, label:'ESI 5', labelTh:'ทั่วไป',         color:'#3b82f6', icon:'fa-user' },
];

const WAITING_STATUSES   = new Set(['รอตรวจ','เรียกไม่พบ','ปฏิเสธการรักษา']);
const FINAL_FROM_WAITING = new Set(['เรียกไม่พบ','ปฏิเสธการรักษา']);
const DISPO_STATUSES     = new Set([]);
const FINAL_FROM_ACTIVE  = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา','Discharge','ส่งแผนกผู้ป่วยนอก','ส่งห้องผ่าตัด','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งตัวโรงพยาบาลอื่น','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']);
const FINAL_STATUSES     = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา','Discharge','ส่งแผนกผู้ป่วยนอก','ส่งห้องผ่าตัด','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งตัวโรงพยาบาลอื่น','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']);

// ══════════════════════════════════════════
// PATIENT DATA — loaded from Supabase
// ══════════════════════════════════════════
let patients = [];

// ── Format age for display ──
function fmtAge(a){
  if(!a||typeof a==='number') return a+'y';
  const parts=[];
  if(a.y) parts.push(a.y+'y');
  if(a.m) parts.push(a.m+'m');
  if(a.d) parts.push(a.d+'d');
  return parts.length?parts.join(' '):'0d';
}

// ── Build display name from parts ──
function fullName(p){ return [p.title,p.firstName,p.lastName].filter(Boolean).join(' '); }

let activeTab    = 'waiting';
let sortOn       = true;
let esiFilter    = 'all';
let statusFilter = 'all';
let finalizedSort = 'desc'; // 'desc' = newest first, 'asc' = oldest first

function renderSFilter(){
  const bar = document.getElementById('sfilter');

  // ── Finalized: sort toggle + status filter chips ──
  if(activeTab === 'finalized'){
    const list = patients.filter(p=>p.tab==='finalized');
    const counts = {};
    list.forEach(p=>{ counts[p.status]=(counts[p.status]||0)+1; });
    const statuses = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
    const asc = finalizedSort === 'asc';

    bar.style.display = 'flex';

    let html = `
      <button class="sf-chip${!asc?' on':''}" onclick="setFinalizedSort('desc')" style="gap:4px">
        <i class="fas fa-arrow-down" style="font-size:9px"></i> Newest
      </button>
      <button class="sf-chip${asc?' on':''}" onclick="setFinalizedSort('asc')" style="gap:4px">
        <i class="fas fa-arrow-up" style="font-size:9px"></i> Oldest
      </button>
      <span style="width:1px;height:18px;background:var(--border);flex-shrink:0;margin:0 2px"></span>
      <button class="sf-chip${statusFilter==='all'?' on':''}" onclick="setSFilter('all')">All <span class="sf-cnt">${list.length}</span></button>`;

    statuses.forEach(s=>{
      const cfg=sc(s);
      const on=statusFilter===s;
      html+=`<button class="sf-chip${on?' on':''}" onclick="setSFilter('${s.replace(/'/g,"\\'")}')">
        <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};flex-shrink:0;display:inline-block"></span>
        ${cfg.label} <span class="sf-cnt" style="background:${cfg.dot};color:#fff">${counts[s]}</span>
      </button>`;
    });

    bar.innerHTML = html;
    return;
  }

  // Active + Waiting tabs use kanban lanes — no filter chips needed
  bar.style.display='none'; statusFilter='all'; return;
}

function setFinalizedSort(dir){
  finalizedSort = dir;
  renderSFilter();
  renderCards();
}

function setSFilter(val){
  statusFilter=val;
  renderSFilter();
  renderCards();
}

function toggleEsiDD(){
  const dd=document.getElementById('esi-dd');
  dd.style.display=dd.style.display==='none'?'block':'none';
}
document.addEventListener('click',e=>{
  if(!document.getElementById('esi-dd-wrap').contains(e.target))
    document.getElementById('esi-dd').style.display='none';
});

function clearSearch(){
  const s=document.getElementById('srch');
  s.value='';
  s.style.borderColor='var(--border)';
  s.style.color='var(--text-muted)';
  document.getElementById('srch-clr').style.display='none';
  renderCards();
}

function setEsiFilter(val){
  esiFilter=val;
  document.getElementById('esi-dd').style.display='none';
  document.querySelectorAll('.esi-filter-row').forEach(row=>{
    const chk=row.querySelector('.esi-chk');
    const isActive = row.dataset.esi===String(val);
    chk.style.display=isActive?'inline':'none';
    row.querySelector('span:nth-child(2)').style.color=isActive?'var(--text-primary)':'var(--text-sub)';
  });
  const btn = document.getElementById('esi-dd-btn');
  const lbl = document.getElementById('esi-dd-label');
  const clr = document.getElementById('esi-clr');
  if(val==='all'){
    lbl.textContent='Filter';
    btn.style.color='var(--text-muted)';
    btn.style.borderColor='var(--border)';
    btn.style.background='transparent';
    clr.style.display='none';
  } else {
    lbl.textContent='ESI '+val;
    btn.style.color='var(--accent)';
    btn.style.borderColor='var(--accent)';
    btn.style.background='rgba(14,165,233,.08)';
    clr.style.display='inline';
  }
  renderCards();
}

// ══════════════════════════════════════════
let qvId      = null;
let qvSel     = null;
let qvGrp     = null;  // tracks which group the selected status came from

// ══════════════════════════════════════════
// THEME TOGGLE
// ══════════════════════════════════════════
function toggleTheme(){
  const isDark=!document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark',isDark);
  localStorage.setItem('darkMode',isDark);
  updateHospIcon(isDark);
}
function updateHospIcon(isDark){
  const cross=document.getElementById('hosp-cross');
  const rect=document.getElementById('hosp-rect');
  const icon=cross?.closest('.hosp-icon');
  // Show opposite theme as hint of what you'll switch to
  if(cross) cross.setAttribute('stroke', isDark ? '#1e3a5f' : '#60a5fa');
  if(rect)  rect.setAttribute('stroke', isDark ? '#94a3b8' : '#1e4a80');
  if(icon){
    icon.style.background = isDark
      ? 'linear-gradient(135deg,#f0f0f3,#e8e8ec)'  // light bg in dark mode
      : 'linear-gradient(135deg,#0a1e38,#0d2a50)';  // dark bg in light mode
    icon.style.borderColor = isDark ? '#d9d9de' : '#1a3a60';
  }
}
(function(){
  const saved=localStorage.getItem('darkMode');
  const isDark=saved===null?true:saved==='true';
  document.documentElement.classList.toggle('dark',isDark);
  document.addEventListener('DOMContentLoaded',()=>updateHospIcon(isDark));
})();

// ══════════════════════════════════════════
// LOGO POPOVER
// ══════════════════════════════════════════
function toggleLogoPop(){
  document.getElementById('logo-pop').classList.toggle('open');
}
document.addEventListener('click',function(e){
  var wrap=document.getElementById('logo-wrap');
  if(wrap&&!wrap.contains(e.target)) document.getElementById('logo-pop').classList.remove('open');
});

// ══════════════════════════════════════════
// HOSPITAL NAV DROPDOWN
// ══════════════════════════════════════════
function toggleHospNav(){
  const nav=document.getElementById('hosp-nav');
  if(nav) nav.style.display=nav.style.display==='none'?'block':'none';
}
document.addEventListener('click',function(e){
  const wrap=document.getElementById('hosp-nav-wrap');
  const nav=document.getElementById('hosp-nav');
  if(wrap&&nav&&!wrap.contains(e.target)) nav.style.display='none';
});

// ══════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════
function tick(){
  const n = new Date();
  const p = v => String(v).padStart(2,'0');
  document.getElementById('clock').textContent = p(n.getHours())+':'+p(n.getMinutes());
  document.getElementById('dateD').textContent = n.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'});
}
setInterval(tick,1000); tick();

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
const fm = m => { if(m==null||isNaN(m))return'—'; const h=Math.floor(m/60),mn=Math.round(m%60); return h?`${h}h ${mn}m`:`${mn}m`; };
const map = (s,d) => (s!=null&&d!=null)?Math.round((s+2*d)/3):null;
const mapCls = v => !v?'':(v<65?'map-lo':v>100?'map-hi':'map-ok');
const vtCls  = (v,lo,hi) => v==null?'':(v<lo?'v-lo':v>hi?'v-hi':'v-ok');
const spo2Cls= v => v==null?'':(v<90?'v-lo':v<95?'v-hi':'v-gn');
const sbpCls = v => v==null?'':(v>140?'v-hi':v<90?'v-lo':'v-ok');
const dbpCls = v => v==null?'':(v>90?'v-hi':v<60?'v-lo':'v-ok');

function breachCls(esi,min){
  if(min==null)return'bc-ok';
  if(min>=ESI_RED[esi]) return'bc-rd bc-pulse';
  if(min>=ESI_AMB[esi]) return'bc-am';
  return'bc-ok';
}

function trendIcon(t){
  if(t==='w')return'<i class="fas fa-arrow-down tr-w" style="font-size:11px"></i>';
  if(t==='i')return'<i class="fas fa-arrow-up tr-i" style="font-size:11px"></i>';
  return'<i class="fas fa-minus tr-s" style="font-size:11px"></i>';
}

// ══════════════════════════════════════════
// SITUATION BAR
// ══════════════════════════════════════════
function renderSit(){
  const W = patients.filter(p=>p.tab==='waiting');
  const A = patients.filter(p=>p.tab==='active');
  const F = patients.filter(p=>p.tab==='finalized');

  document.getElementById('cnt-w').textContent = W.length;
  document.getElementById('cnt-a').textContent = A.length;
  document.getElementById('tc-w').textContent  = W.length;
  document.getElementById('tc-a').textContent  = A.length;
  document.getElementById('tc-f').textContent  = F.length;

  // Active table
  const aEsis = [1,2,3,4,5].filter(e=>A.some(p=>p.esi===e));
  if(!aEsis.length){
    document.getElementById('sit-active').innerHTML=`<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-faint)">—</span>`;
  } else {
    let ah=`<table class="sit-tbl"><thead><tr><th></th><th>Pts</th><th>Avg LOS</th><th>Max LOS</th></tr></thead><tbody>`;
    aEsis.forEach(e=>{
      const as=A.filter(p=>p.esi===e);
      const cnt=as.length;
      const avgLos=fm(Math.round(as.reduce((s,p)=>s+p.stayMin,0)/cnt));
      const maxPt=as.reduce((a,b)=>a.stayMin>b.stayMin?a:b);
      const maxLos=fm(maxPt.stayMin);
      ah+=`<tr><td style="color:${ESI_CLR[e]}">ESI ${e}</td><td style="color:var(--sit-pts-active)">${cnt}</td><td style="color:var(--sit-avg)">${avgLos}</td><td style="color:${ESI_CLR[e]};cursor:pointer;font-weight:700" onclick="goToPatient('${maxPt.id}','active')">${maxLos}</td></tr>`;
    });
    ah+=`</tbody></table>`;
    document.getElementById('sit-active').innerHTML=ah;
  }

  // Waiting table
  const wEsis = [1,2,3,4,5].filter(e=>W.some(p=>p.esi===e));
  if(!wEsis.length){
    document.getElementById('sit-waiting').innerHTML=`<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-faint)">—</span>`;
  } else {
    let wh=`<table class="sit-tbl"><thead><tr><th></th><th>Pts</th><th>Avg Wait</th><th>Max Wait</th></tr></thead><tbody>`;
    wEsis.forEach(e=>{
      const ws=W.filter(p=>p.esi===e);
      const cnt=ws.length;
      const avgWait=fm(Math.round(ws.reduce((s,p)=>s+p.waitMin,0)/cnt));
      const maxPt=ws.reduce((a,b)=>a.waitMin>b.waitMin?a:b);
      const maxWait=fm(maxPt.waitMin);
      const maxBreach=ws.some(p=>p.waitMin>=ESI_RED[p.esi]);
      const avgBreach=(ws.reduce((s,p)=>s+p.waitMin,0)/cnt)>=ESI_AMB[e];
      wh+=`<tr><td style="color:${ESI_CLR[e]}">ESI ${e}</td><td style="color:var(--sit-pts-waiting)">${cnt}</td><td class="${avgBreach?'bc-am':''}">${avgWait}</td><td class="${maxBreach?'bc-rd bc-pulse':''}" style="cursor:pointer;color:${ESI_CLR[e]};font-weight:700" onclick="goToPatient('${maxPt.id}','waiting')">${maxWait}</td></tr>`;
    });
    wh+=`</tbody></table>`;
    document.getElementById('sit-waiting').innerHTML=wh;
  }
}

// Navigate to a specific patient card
function goToPatient(id, tab){
  const targetBtn=document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if(targetBtn && activeTab!==tab) switchTab(targetBtn);
  setTimeout(()=>{
    const card=document.getElementById('card-'+id);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      highlightCard(id, 5000);

    }
  }, 100);
}

// ══════════════════════════════════════════
// CARDS  — uniform size, all tabs
// ══════════════════════════════════════════
function buildCard(p, kanban){
  const cfg     = sc(p.status);
  const editable = p.tab !== 'finalized';

  // Append accepted hospital name to รอ Refer label
  if (p.status === 'รอส่งตัวโรงพยาบาลอื่น' && typeof getReferLog === 'function') {
    const accepted = getReferLog(p.id).find(e => e.result === 'รับ');
    if (accepted) cfg.label = 'รอ Refer ' + accepted.hospital.replace(/^โรงพยาบาล/,'');
  }

  // Wait/Stay time — breach-aware color for waiting patients
  const isWaiting = p.tab === 'waiting';
  const timeMin   = isWaiting ? p.waitMin : p.stayMin;
  const timeLabel = isWaiting ? `Wait ${fm(timeMin)}` : `Stay ${fm(timeMin)}`;
  let   timeColor = 'var(--text-primary)';
  if(isWaiting){
    if(timeMin >= ESI_RED[p.esi])       timeColor = '#ef4444';
    else if(timeMin >= ESI_AMB[p.esi])  timeColor = '#f59e0b';
    else                                 timeColor = '#22c55e';
  }

  // Zone 1 — compact: ESI · name+HN+age · CC · time
  const Z1 = `<div class="flex items-center gap-3 px-3 py-2">

    <!-- ESI circle -->
    <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;line-height:1" class="esi-c-${p.esi}">${p.esi}</div>

    <!-- Identity -->
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="pt-name" style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.3">${fullName(p)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--text-detail)">${fmtHN(p.hn)}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-detail)"> · ${p.sex} · ${fmtAge(p.age)}</span>
      </div>
      <div style="font-family:'Sarabun',sans-serif;font-size:12px;font-weight:400;color:var(--text-sub);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.cc}</div>
    </div>

    <!-- Time -->
    <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
      ${isWaiting ? `<div style="text-align:right;min-width:40px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:var(--text-dim);line-height:1">${p.arrivedAt ? new Date(p.arrivedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : p.upd||''}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:var(--text-dim);opacity:.8;margin-top:2px;letter-spacing:.12em">TRIAGE</div>
      </div>
      <div style="width:1px;height:24px;background:var(--border);flex-shrink:0"></div>` : ''}
      <div style="text-align:right;min-width:50px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${timeColor};line-height:1;${isWaiting && timeMin>=ESI_RED[p.esi]?'animation:blink 1.4s ease-in-out infinite':''}">${fm(timeMin)}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:${timeColor};opacity:.8;margin-top:2px;letter-spacing:.12em">${isWaiting?'WAIT':'STAY'}</div>
      </div>
    </div>

  </div>`;

  // Zone 2 — strip: status + action + Upd time
  let Z2;
  if(p.tab==='finalized'){
    Z2 = `<div style="padding:4px 12px 7px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border-card)">
      <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};display:inline-block;flex-shrink:0"></span>
      <span class="${cfg.pill} sp" style="border:none;background:transparent;padding:0;font-size:12px">${cfg.label}</span>
      <i class="fas fa-lock" style="font-size:9px;color:var(--text-faint);margin-left:2px"></i>
      <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted)">${p.upd||'—'}</span>
    </div>`;
  } else {
    Z2 = `<div style="padding:4px 12px 7px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border-card)">
      <button class="st-btn" style="height:26px;font-size:12px" onclick="openQV('${p.id}',event)">
        <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};display:inline-block;flex-shrink:0"></span>
        <span class="${cfg.pill} sp" style="border:none;background:transparent;padding:0;font-size:12px">${cfg.label}</span>
        <i class="fas fa-chevron-down" style="font-size:8px;color:var(--text-muted);margin-left:2px"></i>
      </button>
      <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted)">Upd ${p.upd||'—'}</span>
    </div>`;
  }

  // Zone 3 — disposition actions (จองเตียง, ส่งเวร, etc.) — from dispo.js
  const Z3 = (typeof buildDispoZone === 'function') ? buildDispoZone(p) : '';

  const finalClass = p.tab === 'finalized' ? ' pcard-final' : '';
  const dragAttr = kanban && editable ? ` draggable="true" ondragstart="kbDragStart(event,'${p.id}')" ondragend="kbDragEnd(event)"` : '';
  return `<div class="pcard esi-b-${p.esi}${finalClass}" id="card-${p.id}"${dragAttr}
    onclick="${editable ? `openQV('${p.id}')` : `openFinalizedQV('${p.id}')`}" style="cursor:pointer">
    ${Z1}${Z2}${Z3}
  </div>`;
}

// Track highlighted cards so glow survives re-renders
const _highlightedCards = {};  // { patientId: expiresAt }

function highlightCard(id, durationMs) {
  const ms = durationMs || 5000;
  _highlightedCards[id] = Date.now() + ms;
  // Auto-remove after duration
  setTimeout(() => {
    delete _highlightedCards[id];
    const card = document.getElementById('card-' + id);
    if (card) card.classList.remove('card-highlight');
  }, ms);
}

function renderCards(){
  const q = (document.getElementById('srch').value||'').toLowerCase();
  let list = patients.filter(p=>p.tab===activeTab);
  if(esiFilter!=='all') list=list.filter(p=>p.esi===Number(esiFilter));
  if(statusFilter!=='all') list=list.filter(p=>p.status===statusFilter);
  if(q) list=list.filter(p=>
    fullName(p).toLowerCase().includes(q)||
    p.hn.toLowerCase().includes(q)||
    p.cc.toLowerCase().includes(q)
  );

  const container = document.getElementById('cards');

  // ── KANBAN MODE for Active tab ──
  if(activeTab==='active'){
    container.classList.add('kanban');
    if(sortOn) list=[...list].sort((a,b)=>a.esi-b.esi||(b.stayMin-a.stayMin));

    // Bucket patients into lanes
    const buckets = {};
    LANES.forEach(l => buckets[l.id] = []);
    list.forEach(p => {
      const lane = STATUS_TO_LANE[p.status] || 'treatment';
      buckets[lane].push(p);
    });

    let html = '';
    LANES.forEach(lane => {
      const cards = buckets[lane.id];
      const body = cards.length
        ? cards.map(p => buildCard(p, true)).join('')
        : '<div class="kb-empty">ไม่มีผู้ป่วย</div>';
      html += `<div class="kb-lane" data-lane="${lane.id}">
        <div class="kb-hdr">
          <i class="fas ${lane.icon} kb-hdr-icon"></i>
          <div>
            <div class="kb-hdr-label">${lane.label}</div>
            <div class="kb-hdr-en">${lane.labelEn}</div>
          </div>
          <div class="kb-hdr-cnt">${cards.length}</div>
        </div>
        <div class="kb-body" data-lane="${lane.id}"
          ondragover="kbDragOver(event)" ondragleave="kbDragLeave(event)" ondrop="kbDrop(event)">
          ${body}
        </div>
      </div>`;
    });
    container.innerHTML = html;

  } else if(activeTab==='waiting'){
    // ── ESI KANBAN for Waiting tab — collapse empty lanes ──
    container.classList.add('kanban');
    if(sortOn) list=[...list].sort((a,b)=>b.waitMin-a.waitMin); // longest wait first within each lane

    const buckets = {};
    ESI_LANES.forEach(l => buckets[l.esi] = []);
    list.forEach(p => {
      if(buckets[p.esi]) buckets[p.esi].push(p);
      else buckets[5].push(p); // fallback
    });

    // Only show lanes that have patients (collapse empty)
    const visibleLanes = ESI_LANES.filter(l => buckets[l.esi].length > 0);

    if(!visibleLanes.length){
      container.classList.remove('kanban');
      container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:1;color:var(--text-muted)">
        <i class="fas fa-inbox" style="font-size:28px"></i>
        <span style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600">ไม่มีผู้ป่วยรอตรวจ</span>
       </div>`;
    } else {
      let html = '';
      visibleLanes.forEach(lane => {
        const cards = buckets[lane.esi];
        html += `<div class="kb-lane" data-lane="esi-${lane.esi}" style="border-top:2px solid ${lane.color}">
          <div class="kb-hdr">
            <i class="fas ${lane.icon} kb-hdr-icon" style="color:${lane.color}"></i>
            <div>
              <div class="kb-hdr-label" style="color:${lane.color}">${lane.label}</div>
              <div class="kb-hdr-en" style="font-family:'Sarabun',sans-serif;text-transform:none;margin-top:6px">${lane.labelTh}</div>
            </div>
            <div class="kb-hdr-cnt" style="color:${lane.color}">${cards.length}</div>
          </div>
          <div class="kb-body">
            ${cards.map(p => buildCard(p, false)).join('')}
          </div>
        </div>`;
      });
      container.innerHTML = html;
    }

  } else if(activeTab==='finalized'){
    // ── 2-COLUMN KANBAN for Finalized ──
    container.classList.add('kanban');
    const sortFn = (a,b) => finalizedSort==='asc'
      ? (a.finalizedAt||0)-(b.finalizedAt||0)
      : (b.finalizedAt||0)-(a.finalizedAt||0);

    const pending  = list.filter(p => !p.dataComplete).sort(sortFn);
    const complete = list.filter(p => p.dataComplete).sort(sortFn);

    let html = '';
    // Left — รอบันทึกข้อมูล
    html += `<div class="kb-lane" data-lane="fin-pending" style="border-top:2px solid #f59e0b">
      <div class="kb-hdr">
        <i class="fas fa-file-pen kb-hdr-icon" style="color:#f59e0b"></i>
        <div>
          <div class="kb-hdr-label" style="color:#f59e0b">รอบันทึกข้อมูล</div>
          <div class="kb-hdr-en">Pending</div>
        </div>
        <div class="kb-hdr-cnt" style="color:#f59e0b">${pending.length}</div>
      </div>
      <div class="kb-body">
        ${pending.length ? pending.map(p => buildCard(p, false)).join('') : '<div class="kb-empty">ไม่มีผู้ป่วย</div>'}
      </div>
    </div>`;
    // Right — บันทึกครบแล้ว
    html += `<div class="kb-lane" data-lane="fin-complete" style="border-top:2px solid #22c55e">
      <div class="kb-hdr">
        <i class="fas fa-circle-check kb-hdr-icon" style="color:#22c55e"></i>
        <div>
          <div class="kb-hdr-label" style="color:#22c55e">บันทึกครบแล้ว</div>
          <div class="kb-hdr-en">Complete</div>
        </div>
        <div class="kb-hdr-cnt" style="color:#22c55e">${complete.length}</div>
      </div>
      <div class="kb-body">
        ${complete.length ? complete.map(p => buildCard(p, false)).join('') : '<div class="kb-empty">ไม่มีผู้ป่วย</div>'}
      </div>
    </div>`;
    container.innerHTML = html;

  } else {
    // ── FLAT LIST fallback ──
    container.classList.remove('kanban');
    container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:60px 0;color:var(--text-muted)">
        <i class="fas fa-inbox" style="font-size:28px"></i>
        <span class="raj font-600" style="font-size:14px;letter-spacing:.06em">No patients</span>
       </div>`;
  }

  // Re-apply highlight to cards that are still within their glow duration
  const now = Date.now();
  for (const [id, expires] of Object.entries(_highlightedCards)) {
    if (now < expires) {
      const card = document.getElementById('card-' + id);
      if (card) card.classList.add('card-highlight');
    } else {
      delete _highlightedCards[id];
    }
  }
}

// ══════════════════════════════════════════
// KANBAN DRAG & DROP
// ══════════════════════════════════════════
let _kbDragId = null;

function kbDragStart(e, id){
  _kbDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
  requestAnimationFrame(() => {
    const card = document.getElementById('card-'+id);
    if(card) card.classList.add('dragging');
  });
}

function kbDragEnd(e){
  const card = document.getElementById('card-'+_kbDragId);
  if(card) card.classList.remove('dragging');
  _kbDragId = null;
  document.querySelectorAll('.kb-body.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function kbDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function kbDragLeave(e){
  // Only remove if leaving the lane body itself, not a child
  if(!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.classList.remove('drag-over');
  }
}

function kbDrop(e){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain') || _kbDragId;
  const targetLaneId = e.currentTarget.dataset.lane;
  if(!id || !targetLaneId) return;

  const p = patients.find(x=>x.id===id);
  if(!p) return;

  const currentLane = STATUS_TO_LANE[p.status];
  if(currentLane === targetLaneId) return; // same lane, no-op

  // Show mini-picker with target lane's statuses
  const lane = LANES.find(l=>l.id===targetLaneId);
  if(!lane) return;

  showDropPicker(e.clientX, e.clientY, id, lane);
}

function showDropPicker(x, y, patientId, lane){
  closeDropPicker(); // close any existing
  const div = document.createElement('div');
  div.className = 'kb-drop-picker';
  div.id = 'kb-drop-picker';

  // Filter out statuses that must go through their own flow
  const FLOW_LOCKED = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา',
    'รอขึ้นหอผู้ป่วย','รอส่งตัวโรงพยาบาลอื่น','ส่งตัวโรงพยาบาลอื่น','ติดต่อส่งตัวโรงพยาบาลอื่น']);
  const filtered = lane.statuses.filter(s => !FLOW_LOCKED.has(s));

  if(!filtered.length){ closeDropPicker(); return; }

  let html = `<div class="dp-hdr">${lane.label} — ${lane.labelEn}</div>`;
  filtered.forEach(s => {
    const cfg = sc(s);
    html += `<div class="dp-item" data-status="${s}" onclick="pickDropStatus('${patientId}','${s.replace(/'/g,"\\'")}')">
      <span class="dp-dot" style="background:${cfg.dot}"></span>
      <span class="dp-label">${cfg.label}</span>
    </div>`;
  });
  div.innerHTML = html;

  // Position near cursor, keep on-screen (zoom-aware)
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const rect = div.getBoundingClientRect();
    const vw = window.innerWidth / z, vh = window.innerHeight / z;
    const cx = x / z, cy = y / z;
    let left = cx - rect.width/2;
    let top = cy + 8;
    if(left < 8) left = 8;
    if(left + rect.width > vw - 8) left = vw - rect.width - 8;
    if(top + rect.height > vh - 8) top = cy - rect.height - 8;
    if(top < 8) top = 8;
    div.style.left = left+'px';
    div.style.top = top+'px';
    div.style.visibility = '';
  });

  // Click outside to close
  setTimeout(() => document.addEventListener('click', _dropPickerOutside), 0);
}

function _dropPickerOutside(e){
  const picker = document.getElementById('kb-drop-picker');
  if(picker && !picker.contains(e.target)) closeDropPicker();
}

function closeDropPicker(){
  const el = document.getElementById('kb-drop-picker');
  if(el) el.remove();
  document.removeEventListener('click', _dropPickerOutside);
}

async function pickDropStatus(patientId, status){
  closeDropPicker();
  const p = patients.find(x=>x.id===patientId);
  if(!p) return;

  p.status = status;

  // Resuscitate → auto-override ESI to 1
  if(status==='Resuscitate' && p.esi!==1){
    const oldEsi = p.esi;
    p.esi = 1;
    await sb.from('visits').update({ esi:1 }).eq('id',p.id);
    console.log(`[AUDIT] ESI override: ${oldEsi}→1 (Resuscitate) visit=${p.id} at=${new Date().toISOString()}`);
  }

  // Check if this status finalizes the patient
  if(FINAL_FROM_ACTIVE.has(status)){
    p.tab = 'finalized';
    p.finalizedAt = Date.now();
  }

  // Auto data_complete for ปฏิเสธการรักษา
  if(status==='ปฏิเสธการรักษา' && p.tab==='finalized'){
    p.dataComplete = true;
    await sb.from('visits').update({ data_complete:true, data_completed_at:new Date().toISOString() }).eq('id',p.id);
  }

  await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);

  const movedTo = p.tab;
  renderSit();
  renderSFilter();

  if(movedTo !== activeTab){
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${movedTo}"]`);
    if(targetBtn) switchTab(targetBtn);
  } else {
    renderCards();
  }

  requestAnimationFrame(()=>{
    const card = document.getElementById('card-'+patientId);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'nearest'});
      highlightCard(patientId, 5000);
    }
  });

  showToast(`<div style="line-height:1.3"><div style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div><div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#22c55e;margin-top:3px">→ ${sc(status).label}</div></div>`, '#22c55e', 'fa-arrows-alt');
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function switchTab(btn){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  activeTab=btn.dataset.tab;
  esiFilter='all';
  statusFilter='all';
  const filterBtn=document.getElementById('esi-dd-btn');
  document.getElementById('esi-dd-label').textContent='Filter';
  filterBtn.style.color='var(--text-muted)';
  filterBtn.style.borderColor='var(--border)';
  filterBtn.style.background='transparent';
  document.getElementById('esi-clr').style.display='none';
  renderSFilter();
  renderCards();
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
// INIT — Load from Supabase
// ══════════════════════════════════════════
async function initApp() {
  // Load patients from Supabase
  const dbPatients = await loadPatients();
  patients.length = 0;
  dbPatients.forEach(p => patients.push(p));

  // Hydrate dispo + refer state from DB
  const visitIds = patients.map(p => p.id);
  if (typeof loadDispoState === 'function') await loadDispoState(patients);
  if (typeof loadReferLogs === 'function') await loadReferLogs(visitIds);

  renderSit();
  renderSFilter();
  renderCards();

  // Real-time subscription — update when other computers change data
  sb
    .channel('visits-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, async () => {
      const fresh = await loadPatients();
      patients.length = 0;
      fresh.forEach(p => patients.push(p));
      renderSit();
      renderSFilter();
      renderCards();
      recordGedwinSnapshot('event');
    })
    .subscribe();

  // Recalculate wait/stay times every 30 seconds
  setInterval(() => {
    patients.forEach(p => {
      if (p.arrivedAt) p.waitMin = Math.floor((Date.now() - new Date(p.arrivedAt).getTime()) / 60000);
      if (p.activatedAt) p.stayMin = Math.floor((Date.now() - new Date(p.activatedAt).getTime()) / 60000);
    });
    renderSit();
    renderCards();
  }, 30000);

  // GEDWIN snapshot every hour
  recordGedwinSnapshot('hourly');
  setInterval(() => recordGedwinSnapshot('hourly'), 60 * 60 * 1000);
}

// ══════════════════════════════════════════
// GEDWIN RECORDING
// ══════════════════════════════════════════
const ER_CAPACITY = 8;
const GEDWIN_WEIGHTS = {1:10, 2:6, 3:3, 4:2, 5:1};
const GEDWIN_LEVELS = [
  {max:0.0, level:'Normal'}, {max:0.5, level:'Medium'}, {max:0.9, level:'Crowded'},
  {max:1.2, level:'Very Crowded'}, {max:Infinity, level:'Critical'}
];

function calcGedwinScore() {
  const active = patients.filter(p => p.tab === 'active');
  const waiting = patients.filter(p => p.tab === 'waiting');
  const all = [...waiting, ...active];
  const total = all.length;
  if (!total) return { score:0, level:'Normal', total:0, active:active.length, waiting:waiting.length, or:0, ar:0 };

  const OR = Math.min(total / ER_CAPACITY, 0.99);
  const AR = all.reduce((s, p) => s + (GEDWIN_WEIGHTS[p.esi] || 3), 0) / total;
  const score = Math.log(OR / (1 - OR)) + Math.log(AR);
  const lvl = GEDWIN_LEVELS.find(l => score < l.max) || GEDWIN_LEVELS[GEDWIN_LEVELS.length - 1];

  return { score: Math.round(score * 100) / 100, level: lvl.level, total, active: active.length, waiting: waiting.length, or: Math.round(OR * 100) / 100, ar: Math.round(AR * 100) / 100 };
}

async function recordGedwinSnapshot(type) {
  const g = calcGedwinScore();
  try {
    await sb.from('gedwin_snapshots').insert({
      score: g.score,
      level: g.level,
      total_patients: g.total,
      active_patients: g.active,
      waiting_patients: g.waiting,
      occupancy_ratio: g.or,
      acuity_ratio: g.ar,
      snapshot_type: type
    });
  } catch (err) {
    console.error('GEDWIN snapshot error:', err);
  }
}

// initApp() is called from inline <script> in HTML after all modules load
