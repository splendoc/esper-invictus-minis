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
    fastTrack: row.fast_track
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
      patients (
        id, hn, title, first_name, last_name, sex,
        age_y, age_m, age_d,
        phone_1, phone_1_label, phone_2, phone_2_label
      )
    `)
    .order('arrived_at', { ascending: true });

  if (error) { console.error('Load error:', error); return []; }

  return data.map(row => {
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
      arrived_at: row.arrived_at,
      activated_at: row.activated_at,
      updated_at: row.updated_at
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
    v_fast_track: visitData.fastTrack || null
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
const ESI_AMB  = {1:0,  2:10,  3:120, 4:240, 5:240};  // amber (min): ESI3=2h, ESI4/5=4h
const ESI_RED  = {1:0,  2:15,  3:180, 4:300, 5:300};  // red   (min): ESI3=3h, ESI4/5=5h

// status definitions — pub: what PublicView displays (omit = use label)
const SC = {
  // ── ACTIVE ──
  'กู้ชีพ'                        :{label:'กู้ชีพ',                       dot:'#ef4444', pill:'sp-resus'},
  'เข้าห้องตรวจ'                  :{label:'เข้าห้องตรวจ',                 dot:'#22c55e', pill:'sp-active'},
  'สังเกตอาการ'                   :{label:'สังเกตอาการ',                   dot:'#f59e0b', pill:'sp-observe'},
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
    {g:'สถานะรอ',            items:['รอตรวจ','เรียกไม่พบ']},
    {g:'ย้ายไป Active',      items:['กู้ชีพ','ส่งเอ็กซ์เรย์','รอผลตรวจ','เข้าห้องตรวจ']},
    {g:'ปิดเคส → Finalized', items:['เรียกไม่พบ']},
  ],
  active:[
    {g:'Active',                items:['กู้ชีพ','สังเกตอาการ','เข้าห้องตรวจ','ส่งเอ็กซ์เรย์','ส่งเอ็กซ์เรย์คอมพิวเตอร์','ทำหัตถการ']},
    {g:'Consult',               items:['ปรึกษาแพทย์เฉพาะทาง','ติดต่อส่งตัวโรงพยาบาลอื่น']},
    {g:'Wait',                  items:['รอผลตรวจ','รอขึ้นหอผู้ป่วย','รอส่งตัวโรงพยาบาลอื่น','รอทำหัตถการ','รอรับยา','รอเอกสาร','รอชำระเงิน']},
    {g:'Admit → Finalized',     items:['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา']},
    {g:'Discharge → Finalized', items:['Discharge','ส่งแผนกผู้ป่วยนอก','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งตัวโรงพยาบาลอื่น','ส่งห้องผ่าตัด','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']},
  ],
  disposition:[],
  finalized:[]
};

const WAITING_STATUSES   = new Set(['รอตรวจ','เรียกไม่พบ']);
const FINAL_FROM_WAITING = new Set(['เรียกไม่พบ']);
const DISPO_STATUSES     = new Set([]);
const FINAL_FROM_ACTIVE  = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา','Discharge','ส่งแผนกผู้ป่วยนอก','ส่งห้องผ่าตัด','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งตัวโรงพยาบาลอื่น','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']);
const FINAL_STATUSES     = new Set(['ICU','วอร์ดชาย','วอร์ดหญิง','วอร์ดพิเศษชั้น 6','วอร์ดพิเศษชั้น 7','วอร์ดตา','Discharge','ส่งแผนกผู้ป่วยนอก','ส่งห้องผ่าตัด','ส่งคลินิกโรคเรื้อรัง','ส่งแผนกตา','ส่งตัวโรงพยาบาลอื่น','ปฏิเสธการรักษา','เสียชีวิต','เรียกไม่พบ']);

// ══════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════
let patients = [
  /* ─── WAITING ─── */
  {id:'W1',hn:'HN123456789',title:'นาย',firstName:'สมชาย',lastName:'ใจดี',     sex:'M',age:45,esi:1,tab:'waiting',   status:'รอตรวจ',phone:'081-234-5678',
   cc:'ไข้สูง หายใจลำบาก เจ็บหน้าอก',waitMin:49,stayMin:49,
   v:{bt:38.2,sbp:140,dbp:90, hr:95, rr:22,spo2:94,src:'CNN',lpm:5,  dtx:null},trend:'w',upd:'12:00'},
  {id:'W2',hn:'HN345678901',title:'นาง',firstName:'สุดา',lastName:'รักดี',      sex:'F',age:62,esi:2,tab:'waiting',   status:'รอตรวจ',
   cc:'เจ็บหน้าอก ใจสั่น หายใจไม่อิ่ม',waitMin:12,stayMin:12,
   v:{bt:36.5,sbp:155,dbp:90, hr:100,rr:16,spo2:99,src:'RA', lpm:null,dtx:null},trend:'s',upd:'14:22'},
  {id:'W3',hn:'HN789012345',title:'นางสาว',firstName:'มาลี',lastName:'สวยงาม', sex:'F',age:28,esi:3,tab:'waiting',   status:'เรียกไม่พบ',
   cc:'ปวดท้องน้อยด้านขวา',waitMin:45,stayMin:45,
   v:{bt:36.6,sbp:115,dbp:76, hr:82, rr:15,spo2:100,src:'RA',lpm:null,dtx:null},trend:'s',upd:'12:00'},
  /* ─── ACTIVE ─── */
  {id:'A1',hn:'HN001001001',title:'นาย',firstName:'วิชัย',lastName:'ขยันดี',    sex:'M',age:55,esi:2,tab:'active',    status:'กู้ชีพ',
   cc:'ปวดท้องรุนแรง น้ำตาลสูง',waitMin:5,stayMin:120,
   v:{bt:37.8,sbp:95, dbp:60, hr:118,rr:26,spo2:92,src:'MCB',lpm:10, dtx:320},trend:'w',upd:'01:30'},
  {id:'A2',hn:'HN002002002',title:'นาง',firstName:'อรุณ',lastName:'แสงดาว',     sex:'F',age:72,esi:2,tab:'active',    status:'สังเกตอาการ',
   cc:'หายใจเหนื่อย ขาบวม',waitMin:10,stayMin:200,
   v:{bt:36.9,sbp:160,dbp:95, hr:102,rr:24,spo2:95,src:'CNN',lpm:4,  dtx:null},trend:'s',upd:'00:45'},
  {id:'A3',hn:'HN003003003',title:'นาย',firstName:'สมศักดิ์',lastName:'ดีใจ',   sex:'M',age:33,esi:3,tab:'active',    status:'ส่งเอ็กซ์เรย์',
   cc:'อุบัติเหตุ กระดูกแขนหัก',waitMin:15,stayMin:90,
   v:{bt:36.7,sbp:130,dbp:80, hr:88, rr:16,spo2:98,src:'RA', lpm:null,dtx:null},trend:'i',upd:'01:10'},
  {id:'A4',hn:'HN004004004',title:'นางสาว',firstName:'พิมพ์ใจ',lastName:'รักษ์ดี',sex:'F',age:19,esi:2,tab:'active',status:'ทำหัตถการ',
   cc:'แพ้ยา ผื่น หายใจเหนื่อย',waitMin:8,stayMin:60,
   v:{bt:37.1,sbp:110,dbp:70, hr:110,rr:20,spo2:97,src:'RA', lpm:null,dtx:null},trend:'i',upd:'01:35'},
  {id:'A5',hn:'HN005005005',title:'นาย',firstName:'ประเสริฐ',lastName:'สุขสัน', sex:'M',age:68,esi:2,tab:'active',   status:'ปรึกษาแพทย์เฉพาะทาง',
   cc:'เจ็บหน้าอก แน่นหน้าอก',waitMin:3,stayMin:180,
   v:{bt:36.5,sbp:145,dbp:88, hr:76, rr:18,spo2:96,src:'RA', lpm:null,dtx:null},trend:'s',upd:'00:30'},
  {id:'A6',hn:'HN006006006',title:'นาง',firstName:'ลัดดา',lastName:'มีสุข',     sex:'F',age:48,esi:3,tab:'active',   status:'รอผลตรวจ',
   cc:'ปวดหัวรุนแรง อาเจียน',waitMin:22,stayMin:150,
   v:{bt:36.8,sbp:170,dbp:100,hr:92, rr:17,spo2:98,src:'RA', lpm:null,dtx:null},trend:'s',upd:'00:55'},
  {id:'A7',hn:'HN007007007',title:'ด.ช.',firstName:'ธนา',lastName:'ใจงาม',      sex:'M',age:7, esi:1,tab:'active',   status:'กู้ชีพ',
   cc:'มีไข้สูง ชัก',waitMin:2,stayMin:45,
   v:{bt:39.5,sbp:90, dbp:55, hr:145,rr:32,spo2:91,src:'ETT',lpm:15, dtx:null},trend:'w',upd:'01:38'},
  {id:'A8',hn:'HN008008008',title:'นาย',firstName:'ก้องเกียรติ',lastName:'โชคดี',sex:'M',age:41,esi:3,tab:'active',  status:'สังเกตอาการ',
   cc:'เบาหวาน น้ำตาลต่ำ เป็นลม',waitMin:30,stayMin:85,
   v:{bt:36.6,sbp:118,dbp:72, hr:96, rr:16,spo2:99,src:'RA', lpm:null,dtx:42},trend:'i',upd:'01:20'},
  /* ─── ACTIVE (previously disposition) ─── */
  {id:'D1',hn:'HN009009009',title:'นาง',firstName:'รัตนา',lastName:'สวัสดี',    sex:'F',age:56,esi:2,tab:'active',status:'รอขึ้นหอผู้ป่วย',
   cc:'ปอดอักเสบ หายใจลำบาก',waitMin:5,stayMin:300,
   v:{bt:37.2,sbp:125,dbp:78, hr:88, rr:18,spo2:97,src:'CNN',lpm:3,  dtx:null},trend:'i',upd:'00:10'},
  {id:'D2',hn:'HN010010010',title:'นาย',firstName:'สุเมธ',lastName:'ชัยมงคล',   sex:'M',age:64,esi:2,tab:'active',status:'รอผลตรวจ',
   cc:'เจ็บหน้าอก ACS',waitMin:4,stayMin:240,
   v:{bt:36.4,sbp:100,dbp:65, hr:95, rr:20,spo2:95,src:'MCB',lpm:6,  dtx:null},trend:'s',upd:'23:55'},
  /* ─── FINALIZED ─── */
  {id:'F1',hn:'HN011011011',title:'นางสาว',firstName:'ดาวรุ่ง',lastName:'ฟ้าสีคราม',sex:'F',age:24,esi:4,tab:'finalized',status:'Discharge',
   cc:'ไมเกรน ปวดหัว',waitMin:30,stayMin:180,
   v:{bt:36.5,sbp:110,dbp:70, hr:80, rr:14,spo2:99,src:'RA', lpm:null,dtx:null},trend:'i',upd:'22:30'},
];

// ── Migrate legacy age (number) → {y,m,d} ──
patients.forEach(p=>{
  if(typeof p.age==='number'){p.age={y:p.age,m:0,d:0};}
});

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

// ── Migrate legacy phone field → phones:[{num,lbl},{num,lbl}] ──
patients.forEach(p=>{
  if(!p.phones){
    const old=p.phone||'';
    p.phones=[{num:old,lbl:''},{num:'',lbl:''}];
  }
  delete p.phone;
});

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
        ${cfg.label} <span class="sf-cnt">${counts[s]}</span>
      </button>`;
    });

    bar.innerHTML = html;
    return;
  }

  if(activeTab !== 'active' && activeTab !== 'waiting'){ bar.style.display='none'; statusFilter='all'; return; }

  const list = patients.filter(p=>p.tab===activeTab);
  const counts = {};
  list.forEach(p=>{ counts[p.status]=(counts[p.status]||0)+1; });
  const statuses = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);

  if(statuses.length < 1){ bar.style.display='none'; return; }

  bar.style.display='flex';
  let html = `<button class="sf-chip${statusFilter==='all'?' on':''}" onclick="setSFilter('all')">All <span class="sf-cnt">${list.length}</span></button>`;
  statuses.forEach(s=>{
    const cfg=sc(s);
    const on = statusFilter===s;
    html+=`<button class="sf-chip${on?' on':''}" onclick="setSFilter('${s.replace(/'/g,"\\'")}')">
      <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};flex-shrink:0;display:inline-block"></span>
      ${cfg.label} <span class="sf-cnt">${counts[s]}</span>
    </button>`;
  });
  bar.innerHTML=html;
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
}
(function(){
  const saved=localStorage.getItem('darkMode');
  const isDark=saved===null?true:saved==='true';
  document.documentElement.classList.toggle('dark',isDark);
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
      ah+=`<tr><td style="color:${ESI_CLR[e]}">ESI ${e}</td><td style="color:#86efac">${cnt}</td><td style="color:#c4b5fd">${avgLos}</td><td style="color:${ESI_CLR[e]};cursor:pointer;font-weight:700" onclick="goToPatient('${maxPt.id}','active')">${maxLos}</td></tr>`;
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
      wh+=`<tr><td style="color:${ESI_CLR[e]}">ESI ${e}</td><td style="color:#93c5fd">${cnt}</td><td class="${avgBreach?'bc-am':''}">${avgWait}</td><td class="${maxBreach?'bc-rd bc-pulse':''}" style="cursor:pointer;color:${ESI_CLR[e]};font-weight:700" onclick="goToPatient('${maxPt.id}','waiting')">${maxWait}</td></tr>`;
    });
    wh+=`</tbody></table>`;
    document.getElementById('sit-waiting').innerHTML=wh;
  }
}

// Navigate to a specific patient card
function goToPatient(id, tab){
  const targetBtn=document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if(targetBtn && activeTab!==tab) switchTab(targetBtn);
  requestAnimationFrame(()=>{
    const card=document.getElementById('card-'+id);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('card-highlight');
      setTimeout(()=>card.classList.remove('card-highlight'),3500);
    }
  });
}

// ══════════════════════════════════════════
// CARDS  — uniform size, all tabs
// ══════════════════════════════════════════
function buildCard(p){
  const cfg     = sc(p.status);
  const editable = p.tab !== 'finalized';

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
      <div style="text-align:right;min-width:40px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:var(--text-dim);line-height:1">${p.arrivedAt ? new Date(p.arrivedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : p.upd||''}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:var(--text-dim);opacity:.8;margin-top:2px;letter-spacing:.12em">TRIAGE</div>
      </div>
      <div style="width:1px;height:24px;background:var(--border);flex-shrink:0"></div>
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

  return `<div class="pcard esi-b-${p.esi}" id="card-${p.id}"
    onclick="${editable ? `openQV('${p.id}')` : `openFinalizedQV('${p.id}')`}" style="cursor:pointer">
    ${Z1}${Z2}
  </div>`;
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
  if(activeTab==='finalized'){
    list=[...list].sort((a,b)=> finalizedSort==='asc'
      ? (a.finalizedAt||0)-(b.finalizedAt||0)
      : (b.finalizedAt||0)-(a.finalizedAt||0));
  } else if(sortOn){
    list=[...list].sort((a,b)=>a.esi-b.esi||(b.waitMin-a.waitMin));
  }

  document.getElementById('cards').innerHTML = list.length
    ? list.map(buildCard).join('')
    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:60px 0;color:var(--text-muted)">
        <i class="fas fa-inbox" style="font-size:28px"></i>
        <span class="raj font-600" style="font-size:14px;letter-spacing:.06em">No patients</span>
       </div>`;
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
// QUICK VIEW
// ══════════════════════════════════════════
function openQV(id,evt){
  if(evt) evt.stopPropagation();
  document.getElementById('reg').classList.remove('open');
  const p=patients.find(x=>x.id===id);
  if(!p||p.tab==='finalized') return;
  qvId=id; qvSel=p.status;

  document.getElementById('qv').classList.remove('edit-mode');
  const cfg=sc(p.status);
  document.getElementById('qv-pt').innerHTML=`
    <div style="display:flex;gap:12px;padding-bottom:10px">
      <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:20px;margin-top:2px" class="esi-c-${p.esi}">${p.esi}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Sarabun',sans-serif;font-size:16px;font-weight:600;color:var(--text-primary);line-height:1.2">${fullName(p)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--text-detail);margin-top:4px">${fmtHN(p.hn)} <span style="color:var(--text-detail)">· ${p.sex} · ${fmtAge(p.age)}</span></div>
        <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:400;color:var(--text-sub);margin-top:4px">${p.cc}</div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="sp ${cfg.pill}">${cfg.label}</span>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted)">${p.tab==='waiting'?'Wait '+fm(p.waitMin):'Stay '+fm(p.stayMin)}</div>
        <button class="qv-toggle-edit" onclick="toggleQVEditMode()"><i class="fas fa-pen" style="font-size:9px"></i> Edit</button>
      </div>
    </div>
    ${_renderQVEditRows(p)}`;

  // Status options
  const groups=OPT[p.tab]||[];
  let html='';
  groups.forEach(grp=>{
    html+=`<div class="qv-grp">${grp.g}</div>`;
    grp.items.forEach(s=>{
      const sg=sc(s), isSel=s===p.status;
      const isResus = s==='กู้ชีพ';
      const itemStyle = isResus ? 'border-left:2px solid rgba(239,68,68,0.3)' : '';
      html+=`<div class="qv-item${isSel?' sel':''}" data-s="${s}" data-g="${grp.g}" onclick="selStatus('${s}','${grp.g}')" style="${itemStyle}">
        <span class="qv-dot" style="background:${sg.dot}"></span>
        <span style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:${isSel?600:400};color:${isResus?'#ef4444':isSel?'var(--text-primary)':'var(--text-sub)'}">${sg.label}</span>
        ${isSel?'<i class="fas fa-check ml-auto" style="font-size:14px;color:var(--accent)"></i>':''}
      </div>`;
    });
  });
  document.getElementById('qv-opts').innerHTML=html;
  updatePrev();

  document.querySelectorAll('.pcard').forEach(c=>c.classList.remove('pcard-sel'));
  const selCard = document.getElementById('card-'+id);
  if(selCard) selCard.classList.add('pcard-sel');
  document.getElementById('qv').classList.add('open');
  document.getElementById('bd').classList.add('on');
}

function selStatus(s,g){
  qvSel=s; qvGrp=g||null;
  document.querySelectorAll('.qv-item').forEach(el=>{
    const isSel=el.dataset.s===s && el.dataset.g===g;
    el.classList.toggle('sel',isSel);
    const lbl=el.querySelector('span:nth-child(2)');
    if(lbl){ lbl.style.color=isSel?'var(--text-primary)':'var(--text-sub)'; lbl.style.fontWeight=isSel?600:400; }
    const chk=el.querySelector('.fa-check');
    if(isSel&&!chk){ const i=document.createElement('i'); i.className='fas fa-check ml-auto'; i.style.cssText='font-size:14px;color:var(--accent)'; el.appendChild(i); }
    if(!isSel&&chk) chk.remove();
  });
  updatePrev();
}

function updatePrev(){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  const el=document.getElementById('qv-prev');
  const btn=document.getElementById('confirm-btn');
  const isClosing = qvGrp && qvGrp.includes('ปิดเคส');
  if(qvSel===p.status && !isClosing){
    el.innerHTML='<span style="font-family:\'Rajdhani\',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-faint)">NO CHANGE</span>';
    btn.className='no-change';
    return;
  }
  const sg=sc(qvSel);
  const changeLabel = isClosing && qvSel===p.status ? 'CLOSE CASE' : 'CHANGE TO';
  el.innerHTML=`<span style="font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-dim)">${changeLabel} <i class="fas fa-long-arrow-alt-right" style="margin:0 3px"></i></span><span class="sp ${sg.pill}">${sg.label}</span>`;
  btn.className='can-confirm';
}

async function confirmStatus(){
  const p=patients.find(x=>x.id===qvId);
  if(!p||!qvSel) return;
  const isClosing = qvGrp && qvGrp.includes('ปิดเคส');
  if(qvSel===p.status && !isClosing){ closeQV(); return; }

  p.status=qvSel;
  if(['active','waiting'].includes(p.tab) && (FINAL_FROM_ACTIVE.has(qvSel) || (isClosing && FINAL_FROM_WAITING.has(qvSel)))){
    p.finalizedAt = Date.now();
  }

  // auto tab transition
  if(p.tab==='waiting' && isClosing && FINAL_FROM_WAITING.has(qvSel)){
    p.tab='finalized';
  } else if(p.tab==='waiting' && !WAITING_STATUSES.has(qvSel)){
    p.tab='active';
  } else if(p.tab==='active' && DISPO_STATUSES.has(qvSel)){
    p.tab='disposition';
  } else if(p.tab==='active' && FINAL_FROM_ACTIVE.has(qvSel)){
    p.tab='finalized';
  } else if(p.tab==='disposition' && FINAL_STATUSES.has(qvSel)){
    p.tab='finalized';
  }

  // Write to Supabase
  await updateVisitStatus(p.id, p.status, p.tab, p.activatedAt);

  const nm = [p.firstName,p.lastName].filter(Boolean).join(' ')||fullName(p);
  const movedTo = p.tab;
  const movedId = p.id;
  closeQV();
  renderSit();
  renderSFilter();

  // follow patient to new tab if they moved
  if(movedTo !== activeTab){
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${movedTo}"]`);
    if(targetBtn) switchTab(targetBtn);
  } else {
    renderCards();
  }

  // flash-highlight the updated card — always, whether tab changed or not
  requestAnimationFrame(()=>{
    const card = document.getElementById('card-'+movedId);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'nearest'});
      card.classList.add('card-highlight');
      setTimeout(()=>{
        card.classList.remove('card-highlight');
      },3500);
    }
  });

  showToast(`<div style="line-height:1.3"><div style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:2px">${fmtHN(p.hn)}</div><div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#22c55e;margin-top:3px">→ ${sc(qvSel).label}</div></div>`, '#22c55e', 'fa-check-circle');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — HN
// ══════════════════════════════════════════
function qvHNOnInput(el){
  // Strip any non-digit, cap at 9
  el.value = el.value.replace(/\D/g,'').slice(0,9);
  const cnt = document.getElementById('qv-hn-cnt');
  const n   = el.value.length;
  cnt.textContent = n+'/9';
  cnt.className   = 'qv-hn-cnt' + (n===9?' full':n>0&&n<9?' err':'');
}

function toggleQVHNEdit(){
  const wrap = document.getElementById('qv-hn-field-wrap');
  const disp = document.getElementById('qv-hn-display');
  const btn  = document.getElementById('qv-hn-edit-btn');
  const open = wrap.classList.toggle('open');
  disp.style.display = open ? 'none' : '';
  btn.style.display  = open ? 'none' : '';
  if(open){
    const p   = patients.find(x=>x.id===qvId);
    const inp = document.getElementById('qv-hn-input');
    const cnt = document.getElementById('qv-hn-cnt');
    // GEN → empty (user must enter fresh 9 digits)
    // HN###### → extract the digits after "HN"
    // anything else → digits only from whatever is there
    const isGEN = p && p.hn.toUpperCase().startsWith('GEN');
    if(isGEN){
      inp.value = '';
    } else {
      // pull only digits (strips "HN" prefix automatically)
      inp.value = (p ? p.hn.replace(/\D/g,'') : '').slice(0,9);
    }
    const n = inp.value.length;
    cnt.textContent = n+'/9';
    cnt.className   = 'qv-hn-cnt' + (n===9?' full':n>0?' err':'');
    inp.focus();
  }
}

function cancelQVHNEdit(){
  const wrap = document.getElementById('qv-hn-field-wrap');
  wrap.classList.remove('open');
  document.getElementById('qv-hn-display').style.display = '';
  document.getElementById('qv-hn-edit-btn').style.display = '';
  // reset counter
  const cnt = document.getElementById('qv-hn-cnt');
  if(cnt){ cnt.textContent='0/9'; cnt.className='qv-hn-cnt'; }
}

function saveQVHN(){
  const p   = patients.find(x=>x.id===qvId);
  if(!p) return;
  const inp = document.getElementById('qv-hn-input');
  const digits = inp.value.replace(/\D/g,'');
  if(digits.length !== 9){
    // flash error on counter + shake input
    const cnt = document.getElementById('qv-hn-cnt');
    cnt.className = 'qv-hn-cnt err';
    cnt.textContent = digits.length+'/9';
    inp.style.color = '#ef4444';
    setTimeout(()=>{ inp.style.color=''; }, 1000);
    inp.focus();
    return;
  }
  const newHN = 'HN' + digits;
  p.hn = newHN;
  document.getElementById('qv-hn-display').textContent = fmtHN(newHN);
  cancelQVHNEdit();
  renderCards();
  showToast('HN → ' + fmtHN(newHN), '#0ea5e9', 'fa-id-card');
}

// ══════════════════════════════════════════
// PHONE FORMAT HELPER
// ══════════════════════════════════════════
function fmtPhone(raw){
  const d=String(raw||'').replace(/\D/g,'').slice(0,10);
  if(d.length<=3)      return d;
  if(d.length<=6)      return d.slice(0,3)+'-'+d.slice(3);
  return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
}
function fmtHN(hn){
  // Accepts 'HN123456789' or 'GENxxxxxx' — formats digit part as XXX-XXX-XXX
  if(!hn) return '—';
  const prefix = hn.replace(/\d.*$/,'') || '';   // e.g. 'HN' or 'GEN'
  const d = hn.replace(/\D/g,'').slice(0,9);
  if(!d) return hn;
  let fmt = d;
  if(d.length>6)      fmt = d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  else if(d.length>3) fmt = d.slice(0,3)+'-'+d.slice(3);
  return prefix+' '+fmt;
}
function qvPhoneFormat(el){ el.value=fmtPhone(el.value); }

// ══════════════════════════════════════════
// SHARED: HN + 2 Tel rows
// ══════════════════════════════════════════
function _renderQVEditRows(p){
  if(!p.phones) p.phones=[{num:'',lbl:''},{num:'',lbl:''}];
  const ph = i => p.phones[i]||{num:'',lbl:''};

  function telRow(i){
    const {num,lbl} = ph(i);
    const formatted  = fmtPhone(num);
    const tel1Empty  = !ph(0).num;
    const rowDisabled= (i===1 && tel1Empty) ? ' qv-ph-row-disabled' : '';
    const hasNum     = !!num;
    return `<div class="qv-edit-row${rowDisabled}" id="qv-ph-row-${i}">
      <span class="qv-edit-lbl" style="font-size:9px;letter-spacing:.08em">TEL ${i+1}</span>
      <span class="qv-edit-val${hasNum?'':' empty'}" id="qv-ph-display-${i}">${hasNum?formatted:'— add'}</span>
      ${hasNum&&lbl ? `<span class="qv-ph-lbl-tag" id="qv-ph-lbl-tag-${i}">${lbl}</span>` : `<span class="qv-ph-lbl-tag" id="qv-ph-lbl-tag-${i}" style="display:none">${lbl}</span>`}
      <button class="qv-edit-btn" id="qv-ph-edit-btn-${i}" onclick="toggleQVPhoneEdit(${i})" style="margin-left:auto">
        <i class="fas fa-${hasNum?'pen-to-square':'plus'}"></i>
      </button>
      <div class="qv-field-wrap" id="qv-ph-field-wrap-${i}">
        <input class="qv-fi" style="width:108px;flex-shrink:0" id="qv-ph-num-${i}" type="tel" value="${formatted}" placeholder="000-000-0000" maxlength="12" autocomplete="off"
          oninput="qvPhoneFormat(this)"
          onkeydown="if(event.key==='Enter')saveQVPhone(${i});if(event.key==='Escape')cancelQVPhoneEdit(${i})">
        <input class="qv-fi qv-lbl-fi" id="qv-ph-lbl-${i}" type="text" value="${lbl}" placeholder="ระบุ…" maxlength="10" autocomplete="off"
          onkeydown="if(event.key==='Enter')saveQVPhone(${i});if(event.key==='Escape')cancelQVPhoneEdit(${i})">
        <button class="qv-save-btn" onclick="saveQVPhone(${i})">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVPhoneEdit(${i})"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
  }

  const a = p.age||{y:0,m:0,d:0};
  const titleOpts = TITLE_OPTIONS.map(t=>`<option value="${t}"${t===p.title?' selected':''}>${t||'— ไม่ระบุ'}</option>`).join('')
    + `<option value="other"${!p.title||TITLE_OPTIONS.includes(p.title)?'':' selected'}>อื่นๆ</option>`;
  const isCustomTitle = p.title && !TITLE_OPTIONS.includes(p.title);
  const sexLocked = M_TITLES.includes(p.title)||F_TITLES.includes(p.title);

  return `
    <div class="qv-edit-row" id="qv-title-row">
      <span class="qv-edit-lbl">TITLE</span>
      <span class="qv-edit-val${p.title?'':' empty'}" id="qv-title-display" style="font-family:'Sarabun',sans-serif">${p.title||'— none'}</span>
      <button class="qv-edit-btn" id="qv-title-edit-btn" onclick="toggleQVTitleEdit()" style="margin-left:auto"><i class="fas fa-pen-to-square"></i></button>
      <div class="qv-field-wrap" id="qv-title-field-wrap">
        <select class="qv-fi" id="qv-title-select" style="flex:1;font-family:'Sarabun',sans-serif;cursor:pointer"
          onchange="qvTitleChanged()" onkeydown="if(event.key==='Escape')cancelQVTitleEdit()">
          ${titleOpts}
        </select>
        <input type="text" class="qv-fi" id="qv-title-other" placeholder="ระบุคำนำหน้า" autocomplete="off" style="display:${isCustomTitle?'':'none'};flex:1;font-family:'Sarabun',sans-serif" value="${isCustomTitle?p.title:''}">
        <button class="qv-save-btn" onclick="saveQVTitle()">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVTitleEdit()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="qv-edit-row" id="qv-sex-row">
      <span class="qv-edit-lbl">SEX</span>
      <span class="qv-edit-val" id="qv-sex-display">${p.sex==='M'?'ชาย':p.sex==='F'?'หญิง':p.sex||'—'}</span>
      <span id="qv-sex-lock" style="color:var(--accent);font-size:10px;display:${sexLocked?'':'none'}"><i class="fas fa-lock"></i></span>
      <button class="qv-edit-btn" id="qv-sex-edit-btn" onclick="toggleQVSexEdit()" style="margin-left:auto"><i class="fas fa-pen-to-square"></i></button>
      <div class="qv-field-wrap" id="qv-sex-field-wrap">
        <select class="qv-fi" id="qv-sex-select" style="flex:1;font-family:'Sarabun',sans-serif;cursor:pointer"
          onkeydown="if(event.key==='Escape')cancelQVSexEdit()">
          <option value="">-- เลือก --</option>
          <option value="M"${p.sex==='M'?' selected':''}>ชาย</option>
          <option value="F"${p.sex==='F'?' selected':''}>หญิง</option>
          <option value="X"${p.sex==='X'?' selected':''}>X</option>
        </select>
        <button class="qv-cancel-btn" id="qv-sex-clr" onclick="qvSexClear()" style="display:${sexLocked?'':'none'};font-size:14px"><i class="fas fa-times"></i></button>
        <button class="qv-save-btn" onclick="saveQVSex()">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVSexEdit()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="qv-edit-row" id="qv-name-row">
      <span class="qv-edit-lbl">NAME</span>
      <span class="qv-edit-val" id="qv-name-display" style="font-family:'Sarabun',sans-serif">${[p.firstName,p.lastName].filter(Boolean).join(' ')}</span>
      <button class="qv-edit-btn" id="qv-name-edit-btn" onclick="toggleQVNameEdit()" style="margin-left:auto"><i class="fas fa-pen-to-square"></i></button>
      <div class="qv-field-wrap" id="qv-name-field-wrap">
        <input class="qv-fi" id="qv-name-first" type="text" value="${p.firstName||''}" placeholder="ชื่อจริง" autocomplete="off" style="flex:1"
          onkeydown="if(event.key==='Enter')saveQVName();if(event.key==='Escape')cancelQVNameEdit()">
        <input class="qv-fi" id="qv-name-last" type="text" value="${p.lastName||''}" placeholder="นามสกุล" autocomplete="off" style="flex:1"
          onkeydown="if(event.key==='Enter')saveQVName();if(event.key==='Escape')cancelQVNameEdit()">
        <button class="qv-save-btn" onclick="saveQVName()">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVNameEdit()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="qv-edit-row" id="qv-age-row">
      <span class="qv-edit-lbl">AGE</span>
      <span class="qv-edit-val mono" id="qv-age-display">${fmtAge(p.age)}</span>
      <button class="qv-edit-btn" id="qv-age-edit-btn" onclick="toggleQVAgeEdit()" style="margin-left:auto"><i class="fas fa-pen-to-square"></i></button>
      <div class="qv-field-wrap" id="qv-age-field-wrap">
        <div class="qv-age-inputs">
          <input class="qv-fi" id="qv-age-y" type="number" min="0" max="150" value="${a.y||''}" placeholder="ปี" autocomplete="off"
            oninput="qvAgeLock('y')" onkeydown="if(event.key==='Enter')saveQVAge();if(event.key==='Escape')cancelQVAgeEdit()">
          <span class="qv-age-unit">ปี</span>
          <input class="qv-fi" id="qv-age-m" type="number" min="1" max="11" value="${a.m||''}" placeholder="ด." autocomplete="off"
            oninput="qvAgeLock('m')" onkeydown="if(event.key==='Enter')saveQVAge();if(event.key==='Escape')cancelQVAgeEdit()">
          <span class="qv-age-unit">เดือน</span>
          <input class="qv-fi" id="qv-age-d" type="number" min="1" max="30" value="${a.d||''}" placeholder="ว." autocomplete="off"
            oninput="qvAgeLock('d')" onkeydown="if(event.key==='Enter')saveQVAge();if(event.key==='Escape')cancelQVAgeEdit()">
          <span class="qv-age-unit">วัน</span>
          <button type="button" class="qv-cancel-btn" onclick="qvAgeClear()" id="qv-age-clr" style="display:none;font-size:14px"><i class="fas fa-times"></i></button>
        </div>
        <button class="qv-save-btn" onclick="saveQVAge()">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVAgeEdit()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="qv-edit-row" id="qv-hn-row">
      <span class="qv-edit-lbl">HN</span>
      <span class="qv-edit-val" id="qv-hn-display">${fmtHN(p.hn)}</span>
      <button class="qv-edit-btn" id="qv-hn-edit-btn" onclick="toggleQVHNEdit()" title="Edit HN" style="margin-left:auto"><i class="fas fa-pen-to-square"></i></button>
      <div class="qv-field-wrap" id="qv-hn-field-wrap">
        <div class="qv-hn-combo">
          <span class="qv-hn-pfx">HN</span>
          <input class="qv-hn-digits" id="qv-hn-input" type="text" inputmode="numeric" maxlength="9" placeholder="000000000" autocomplete="off"
            oninput="qvHNOnInput(this)"
            onkeydown="if(event.key==='Enter')saveQVHN();if(event.key==='Escape')cancelQVHNEdit()">
        </div>
        <span class="qv-hn-cnt" id="qv-hn-cnt">0/9</span>
        <button class="qv-save-btn" onclick="saveQVHN()">Save</button>
        <button class="qv-cancel-btn" onclick="cancelQVHNEdit()"><i class="fas fa-times"></i></button>
      </div>
    </div>
    ${telRow(0)}
    ${telRow(1)}`;
}

// ══════════════════════════════════════════
// QV EDIT MODE TOGGLE
// ══════════════════════════════════════════
function toggleQVEditMode(){
  document.getElementById('qv').classList.toggle('edit-mode');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — TITLE
// ══════════════════════════════════════════
const TITLE_OPTIONS=['','นาย','นาง','นางสาว','เด็กชาย','เด็กหญิง','ด.ช.','ด.ญ.','Mr.','Ms.','Mrs.','พระภิกษุ','แม่ชี'];
const M_TITLES=['นาย','เด็กชาย','ด.ช.','พระภิกษุ','Mr.'];
const F_TITLES=['นาง','นางสาว','เด็กหญิง','ด.ญ.','แม่ชี','Ms.','Mrs.'];
function toggleQVTitleEdit(){
  const wrap=document.getElementById('qv-title-field-wrap');
  const disp=document.getElementById('qv-title-display');
  const btn =document.getElementById('qv-title-edit-btn');
  const open=wrap.classList.toggle('open');
  disp.style.display=open?'none':'';
  btn.style.display =open?'none':'';
  if(open){
    const p=patients.find(x=>x.id===qvId);
    if(p){
      const isCustom = p.title && !TITLE_OPTIONS.includes(p.title);
      document.getElementById('qv-title-select').value = isCustom ? 'other' : (p.title||'');
      document.getElementById('qv-title-other').style.display = isCustom ? '' : 'none';
      document.getElementById('qv-title-other').value = isCustom ? p.title : '';
    }
  }
}
function cancelQVTitleEdit(){
  const wrap=document.getElementById('qv-title-field-wrap');
  wrap.classList.remove('open');
  document.getElementById('qv-title-display').style.display='';
  document.getElementById('qv-title-edit-btn').style.display='';
}
// Title changed → auto-select sex
function qvTitleChanged(){
  const sel=document.getElementById('qv-title-select');
  const otherInput=document.getElementById('qv-title-other');
  if(sel.value==='other'){
    otherInput.style.display='';
    otherInput.focus();
  } else {
    otherInput.style.display='none';
    otherInput.value='';
  }
  // Auto-set sex in the sex select (if sex edit is open)
  const sexSel=document.getElementById('qv-sex-select');
  const sexClr=document.getElementById('qv-sex-clr');
  const sexLock=document.getElementById('qv-sex-lock');
  if(M_TITLES.includes(sel.value)){
    sexSel.value='M'; sexSel.disabled=true; sexClr.style.display=''; sexLock.style.display='';
  } else if(F_TITLES.includes(sel.value)){
    sexSel.value='F'; sexSel.disabled=true; sexClr.style.display=''; sexLock.style.display='';
  } else {
    sexSel.disabled=false; sexClr.style.display='none'; sexLock.style.display='none';
  }
}
function qvGetTitle(){
  const sel=document.getElementById('qv-title-select');
  if(sel.value==='other') return document.getElementById('qv-title-other').value.trim();
  return sel.value;
}
function saveQVTitle(){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  const newTitle=qvGetTitle();
  p.title=newTitle;

  // Auto-update sex if title implies it
  if(M_TITLES.includes(newTitle)){ p.sex='M'; }
  else if(F_TITLES.includes(newTitle)){ p.sex='F'; }

  // Update displays
  document.getElementById('qv-title-display').textContent=p.title||'— none';
  document.getElementById('qv-title-display').className=p.title?'qv-edit-val':'qv-edit-val empty';
  document.getElementById('qv-sex-display').textContent=p.sex==='M'?'ชาย':p.sex==='F'?'หญิง':p.sex||'—';
  const sexLocked=M_TITLES.includes(p.title)||F_TITLES.includes(p.title);
  document.getElementById('qv-sex-lock').style.display=sexLocked?'':'none';

  const hdrName=document.querySelector('#qv-pt div[style*="font-size:15px"]');
  if(hdrName) hdrName.textContent=fullName(p);
  cancelQVTitleEdit();
  renderCards();
  updatePatientInfo(p.patientId, { title: p.title, sex: p.sex });
  showToast('Title → '+(p.title||'none'),'#0ea5e9','fa-user');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — SEX
// ══════════════════════════════════════════
function toggleQVSexEdit(){
  const wrap=document.getElementById('qv-sex-field-wrap');
  const disp=document.getElementById('qv-sex-display');
  const btn =document.getElementById('qv-sex-edit-btn');
  const lock=document.getElementById('qv-sex-lock');
  const open=wrap.classList.toggle('open');
  disp.style.display=open?'none':'';
  btn.style.display =open?'none':'';
  lock.style.display=open?'none':lock.style.display;
  if(open){
    const p=patients.find(x=>x.id===qvId);
    if(p){
      const sexSel=document.getElementById('qv-sex-select');
      sexSel.value=p.sex||'';
      const locked=M_TITLES.includes(p.title)||F_TITLES.includes(p.title);
      sexSel.disabled=locked;
      document.getElementById('qv-sex-clr').style.display=locked?'':'none';
    }
  }
}
function cancelQVSexEdit(){
  const wrap=document.getElementById('qv-sex-field-wrap');
  wrap.classList.remove('open');
  document.getElementById('qv-sex-display').style.display='';
  document.getElementById('qv-sex-edit-btn').style.display='';
  const p=patients.find(x=>x.id===qvId);
  if(p){
    const locked=M_TITLES.includes(p.title)||F_TITLES.includes(p.title);
    document.getElementById('qv-sex-lock').style.display=locked?'':'none';
  }
}
function qvSexClear(){
  document.getElementById('qv-sex-select').value='';
  document.getElementById('qv-sex-select').disabled=false;
  document.getElementById('qv-sex-clr').style.display='none';
  document.getElementById('qv-sex-lock').style.display='none';
  // Also clear title since sex is now unlocked
  const p=patients.find(x=>x.id===qvId);
  if(p){ p.title=''; }
  document.getElementById('qv-title-display').textContent='— none';
  document.getElementById('qv-title-display').className='qv-edit-val empty';
}
function saveQVSex(){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  const newSex=document.getElementById('qv-sex-select').value;
  if(!newSex){ showToast('กรุณาเลือกเพศ','#ef4444','fa-exclamation-triangle'); return; }
  p.sex=newSex;
  document.getElementById('qv-sex-display').textContent=p.sex==='M'?'ชาย':p.sex==='F'?'หญิง':p.sex;
  cancelQVSexEdit();
  renderCards();
  updatePatientInfo(p.patientId, { sex: p.sex });
  showToast('Sex → '+(p.sex==='M'?'ชาย':p.sex==='F'?'หญิง':p.sex),'#0ea5e9','fa-venus-mars');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — NAME
// ══════════════════════════════════════════
function toggleQVNameEdit(){
  const wrap=document.getElementById('qv-name-field-wrap');
  const disp=document.getElementById('qv-name-display');
  const btn =document.getElementById('qv-name-edit-btn');
  const open=wrap.classList.toggle('open');
  disp.style.display=open?'none':'';
  btn.style.display =open?'none':'';
  if(open){
    const p=patients.find(x=>x.id===qvId);
    if(p){
      document.getElementById('qv-name-first').value=p.firstName||'';
      document.getElementById('qv-name-last').value=p.lastName||'';
    }
    document.getElementById('qv-name-first').focus();
  }
}
function cancelQVNameEdit(){
  const wrap=document.getElementById('qv-name-field-wrap');
  wrap.classList.remove('open');
  document.getElementById('qv-name-display').style.display='';
  document.getElementById('qv-name-edit-btn').style.display='';
}
function saveQVName(){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  const first=document.getElementById('qv-name-first').value.trim();
  const last =document.getElementById('qv-name-last').value.trim();
  if(!first){ document.getElementById('qv-name-first').focus(); return; }
  p.firstName=first;
  p.lastName=last;
  document.getElementById('qv-name-display').textContent=[first,last].filter(Boolean).join(' ');
  const hdrName=document.querySelector('#qv-pt div[style*="font-size:15px"]');
  if(hdrName) hdrName.textContent=fullName(p);
  cancelQVNameEdit();
  renderCards();
  showToast('Name → '+display,'#0ea5e9','fa-user');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — AGE
// ══════════════════════════════════════════
function toggleQVAgeEdit(){
  const wrap=document.getElementById('qv-age-field-wrap');
  const disp=document.getElementById('qv-age-display');
  const btn =document.getElementById('qv-age-edit-btn');
  const open=wrap.classList.toggle('open');
  disp.style.display=open?'none':'';
  btn.style.display =open?'none':'';
  if(open){
    const p=patients.find(x=>x.id===qvId);
    if(p){
      const a=p.age||{y:0,m:0,d:0};
      document.getElementById('qv-age-y').value=a.y||'';
      document.getElementById('qv-age-m').value=a.m||'';
      document.getElementById('qv-age-d').value=a.d||'';
      // Restore lock state
      const yEl=document.getElementById('qv-age-y'), mEl=document.getElementById('qv-age-m'), dEl=document.getElementById('qv-age-d');
      yEl.disabled=false; mEl.disabled=false; dEl.disabled=false;
      document.getElementById('qv-age-clr').style.display='none';
      if(a.y){ mEl.disabled=true; dEl.disabled=true; document.getElementById('qv-age-clr').style.display=''; }
      else if(a.m){ yEl.disabled=true; dEl.disabled=true; document.getElementById('qv-age-clr').style.display=''; }
      else if(a.d){ yEl.disabled=true; mEl.disabled=true; document.getElementById('qv-age-clr').style.display=''; }
    }
    document.getElementById('qv-age-y').focus();
  }
}
function cancelQVAgeEdit(){
  const wrap=document.getElementById('qv-age-field-wrap');
  wrap.classList.remove('open');
  document.getElementById('qv-age-display').style.display='';
  document.getElementById('qv-age-edit-btn').style.display='';
}
// QV age lock — same logic as registration
function qvAgeLock(which){
  const y=document.getElementById('qv-age-y');
  const m=document.getElementById('qv-age-m');
  const d=document.getElementById('qv-age-d');
  const clr=document.getElementById('qv-age-clr');
  if(which==='y' && y.value){ y.value=Math.min(Math.max(parseInt(y.value)||0,0),150); }
  if(which==='m' && m.value){ m.value=Math.min(Math.max(parseInt(m.value)||1,1),11); }
  if(which==='d' && d.value){ d.value=Math.min(Math.max(parseInt(d.value)||1,1),30); }
  const hasValue = y.value || m.value || d.value;
  if(hasValue){
    if(which==='y'||y.value){ m.disabled=true; d.disabled=true; y.disabled=false; }
    if(which==='m'||m.value){ y.disabled=true; d.disabled=true; m.disabled=false; }
    if(which==='d'||d.value){ y.disabled=true; m.disabled=true; d.disabled=false; }
    clr.style.display='';
  } else {
    y.disabled=false; m.disabled=false; d.disabled=false;
    clr.style.display='none';
  }
}
function qvAgeClear(){
  const y=document.getElementById('qv-age-y');
  const m=document.getElementById('qv-age-m');
  const d=document.getElementById('qv-age-d');
  y.value=''; m.value=''; d.value='';
  y.disabled=false; m.disabled=false; d.disabled=false;
  document.getElementById('qv-age-clr').style.display='none';
}
function saveQVAge(){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  const y=parseInt(document.getElementById('qv-age-y').value)||0;
  const m=parseInt(document.getElementById('qv-age-m').value)||0;
  const d=parseInt(document.getElementById('qv-age-d').value)||0;
  if(!y&&!m&&!d){ document.getElementById('qv-age-y').focus(); return; }
  p.age={y,m,d};
  document.getElementById('qv-age-display').textContent=fmtAge(p.age);
  cancelQVAgeEdit();
  renderCards();
  updatePatientInfo(p.patientId, { age_y: y, age_m: m, age_d: d });
  showToast('Age → '+fmtAge(p.age),'#0ea5e9','fa-calendar');
}

// ══════════════════════════════════════════
// QV INLINE EDIT — PHONE (slot-indexed)
// ══════════════════════════════════════════
function toggleQVPhoneEdit(slot){
  const wrap=document.getElementById(`qv-ph-field-wrap-${slot}`);
  const disp=document.getElementById(`qv-ph-display-${slot}`);
  const btn =document.getElementById(`qv-ph-edit-btn-${slot}`);
  const tag =document.getElementById(`qv-ph-lbl-tag-${slot}`);
  const open=wrap.classList.toggle('open');
  disp.style.display=open?'none':'';
  btn.style.display =open?'none':'';
  if(tag) tag.style.display=open?'none':'';
  if(open) document.getElementById(`qv-ph-num-${slot}`).focus();
}

function cancelQVPhoneEdit(slot){
  const p=patients.find(x=>x.id===qvId);
  const wrap=document.getElementById(`qv-ph-field-wrap-${slot}`);
  wrap.classList.remove('open');
  const s=(p&&p.phones&&p.phones[slot])||{num:'',lbl:''};
  document.getElementById(`qv-ph-num-${slot}`).value=fmtPhone(s.num||'');
  document.getElementById(`qv-ph-lbl-${slot}`).value=s.lbl||'';
  document.getElementById(`qv-ph-display-${slot}`).style.display='';
  document.getElementById(`qv-ph-edit-btn-${slot}`).style.display='';
  const tag=document.getElementById(`qv-ph-lbl-tag-${slot}`);
  if(tag) tag.style.display='';
}

function saveQVPhone(slot){
  const p=patients.find(x=>x.id===qvId);
  if(!p) return;
  if(!p.phones) p.phones=[{num:'',lbl:''},{num:'',lbl:''}];
  const num=fmtPhone(document.getElementById(`qv-ph-num-${slot}`).value);
  const lbl=document.getElementById(`qv-ph-lbl-${slot}`).value.trim();
  p.phones[slot]={num,lbl};

  const disp   =document.getElementById(`qv-ph-display-${slot}`);
  const editBtn=document.getElementById(`qv-ph-edit-btn-${slot}`);
  const tag    =document.getElementById(`qv-ph-lbl-tag-${slot}`);

  if(num){
    disp.textContent=num; disp.className='qv-edit-val';
    editBtn.innerHTML='<i class="fas fa-pen-to-square"></i>';
    if(tag){ tag.textContent=lbl; tag.style.display=lbl?'':'none'; }
  } else {
    disp.textContent='— add'; disp.className='qv-edit-val empty';
    editBtn.innerHTML='<i class="fas fa-plus"></i>';
    if(tag){ tag.textContent=''; tag.style.display='none'; }
  }

  // Enable / disable Tel 2 based on Tel 1 having a number
  if(slot===0){
    const row1=document.getElementById('qv-ph-row-1');
    if(row1) row1.className=row1.className.replace(' qv-ph-row-disabled','')+(num?'':' qv-ph-row-disabled');
  }

  cancelQVPhoneEdit(slot);
  showToast(num?`Tel ${slot+1} → ${num}`:`Tel ${slot+1} cleared`,'#22c55e','fa-phone');
}

// ══════════════════════════════════════════
// FINALIZED QUICK VIEW (HN + Phone edit only)
// ══════════════════════════════════════════
function openFinalizedQV(id){
  const p=patients.find(x=>x.id===id);
  if(!p) return;
  qvId=id; qvSel=null; qvGrp=null;

  document.getElementById('qv').classList.remove('edit-mode');
  const cfg=sc(p.status);
  // Header: change title to "Edit Details"
  document.querySelector('#qv .flex.items-center.justify-between span').textContent='Edit Details';

  document.getElementById('qv-pt').innerHTML=`
    <div style="display:flex;gap:12px;padding-bottom:10px">
      <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:20px;margin-top:2px" class="esi-c-${p.esi}">${p.esi}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Sarabun',sans-serif;font-size:16px;font-weight:600;color:var(--text-primary);line-height:1.2">${fullName(p)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--text-detail);margin-top:4px">${fmtHN(p.hn)} <span style="color:var(--text-detail)">· ${p.sex} · ${fmtAge(p.age)}</span></div>
        <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:400;color:var(--text-sub);margin-top:4px">${p.cc}</div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="sp ${cfg.pill}">${cfg.label}</span>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:4px">
          <i class="fas fa-lock" style="font-size:9px"></i> Finalized
        </div>
        <button class="qv-toggle-edit" onclick="toggleQVEditMode()"><i class="fas fa-pen" style="font-size:9px"></i> Edit</button>
      </div>
    </div>
    ${_renderQVEditRows(p)}`;

  document.getElementById('qv-opts').innerHTML='';

  // Footer: hide confirm, show close only
  const prev=document.getElementById('qv-prev');
  prev.innerHTML='<span style="font-family:\'Rajdhani\',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-faint)">FINALIZED — STATUS LOCKED</span>';
  const btn=document.getElementById('confirm-btn');
  btn.className='no-change';
  btn.textContent='Close';
  btn.onclick=closeQV;

  document.querySelectorAll('.pcard').forEach(c=>c.classList.remove('pcard-sel'));
  const selCard=document.getElementById('card-'+id);
  if(selCard) selCard.classList.add('pcard-sel');
  document.getElementById('qv').classList.add('open');
  document.getElementById('bd').classList.add('on');
}

function closeQV(){
  document.getElementById('qv').classList.remove('open','edit-mode');
  document.getElementById('bd').classList.remove('on');
  document.getElementById('bd').onclick = closeQV;
  document.querySelectorAll('.pcard').forEach(c=>c.classList.remove('pcard-sel'));
  qvId=null;
}

// ══════════════════════════════════════════
// QUICK SAVE (placeholder)
// ══════════════════════════════════════════
function openQS(id,evt){
  evt.stopPropagation();
  showToast('Quick Save — vitals entry module coming soon','#0ea5e9','fa-bolt');
}

// ══════════════════════════════════════════
// BARCODE SCANNER
// ══════════════════════════════════════════
let _scanStream = null;
let _scanDetector = null;
let _scanActive = false;

async function openScanner(){
  const overlay = document.getElementById('scan-overlay');
  overlay.style.display = 'flex';
  _scanActive = true;

  // Check BarcodeDetector support
  if(!('BarcodeDetector' in window)){
    document.getElementById('scan-status').textContent = 'Camera scan not supported in this browser — use a USB scanner instead';
    document.getElementById('scan-status').style.color = '#f59e0b';
    return;
  }

  try {
    _scanStream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}
    });
    const video = document.getElementById('scan-video');
    video.srcObject = _scanStream;
    await video.play();

    _scanDetector = new BarcodeDetector({formats:['code_128','code_39','ean_13','ean_8','qr_code','data_matrix']});
    document.getElementById('scan-status').textContent = 'SCANNING FOR BARCODE…';
    document.getElementById('scan-status').style.color = 'var(--text-muted)';
    _scanLoop();
  } catch(e) {
    document.getElementById('scan-status').textContent = 'Camera access denied — use a USB scanner instead';
    document.getElementById('scan-status').style.color = '#f59e0b';
  }
}

async function _scanLoop(){
  if(!_scanActive) return;
  const video = document.getElementById('scan-video');
  if(video.readyState === video.HAVE_ENOUGH_DATA){
    try {
      const codes = await _scanDetector.detect(video);
      if(codes.length > 0){
        const val = codes[0].rawValue.trim();
        closeScanner();
        const srch = document.getElementById('srch');
        srch.value = val;
        srch.style.borderColor = 'var(--accent)';
        srch.style.color = 'var(--text-primary)';
        renderCards();
        showToast(`Scanned: ${val}`, '#0ea5e9', 'fa-barcode');
        return;
      }
    } catch(e){}
  }
  if(_scanActive) requestAnimationFrame(_scanLoop);
}

function closeScanner(){
  _scanActive = false;
  if(_scanStream) _scanStream.getTracks().forEach(t=>t.stop());
  _scanStream = null;
  document.getElementById('scan-overlay').style.display = 'none';
  document.getElementById('scan-video').srcObject = null;
}
// ══════════════════════════════════════════
let _tt=null;
function showToast(msg,color,icon){
  const t=document.getElementById('toast');
  document.getElementById('t-msg').innerHTML=msg;
  document.getElementById('t-icon').className=`fas ${icon}`;
  document.getElementById('t-icon').style.color=color;
  t.style.borderColor=color+'55';
  t.classList.add('on');
  if(_tt) clearTimeout(_tt);
  _tt=setTimeout(()=>t.classList.remove('on'),3000);
}

// ══════════════════════════════════════════
// REGISTRATION PANEL
// ══════════════════════════════════════════
let _regHnCounter = parseInt(localStorage.getItem('hn_gen_counter')||'0');
let _regFtActive = false;
let _regFoundPatient = null; // selected returning patient

function openReg(){
  closeQV();
  resetRegForm();
  document.getElementById('reg').classList.add('open');
  document.getElementById('bd').classList.add('on');
  document.getElementById('bd').onclick = closeReg;
}

function closeReg(){
  document.getElementById('reg').classList.remove('open');
  document.getElementById('bd').classList.remove('on');
  document.getElementById('bd').onclick = closeQV;
  document.getElementById('reg-hn-results').style.display='none';
}

function resetRegForm(){
  ['reg-hn','reg-fname','reg-lname','reg-cc','reg-age-y','reg-age-m','reg-age-d'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('reg-title').value='';
  document.getElementById('reg-title-other').value='';
  document.getElementById('reg-title-other').style.display='none';
  document.getElementById('reg-sex').disabled=false;
  document.getElementById('reg-sex-clr').style.display='none';
  regAgeClear();
  document.getElementById('reg-sex').value='';
  document.getElementById('reg-esi').value='';
  document.getElementById('reg-esi').className='qv-fi';
  document.getElementById('reg-esi').disabled=false;
  document.getElementById('reg-err').textContent='';
  document.getElementById('reg-hn-results').style.display='none';
  document.getElementById('reg-badge').style.display='none';
  document.getElementById('reg-found').style.display='none';
  document.getElementById('reg-info-section').style.display='';
  document.getElementById('reg-hn').readOnly=false;
  document.getElementById('reg-hn').style.color='';
  document.getElementById('reg-gen-btn').style.display='';
  document.getElementById('reg-hn-clr').style.display='none';
  _regFtActive=false;
  _regFoundPatient=null;
  document.querySelectorAll('.reg-ft-btn').forEach(b=>b.classList.remove('active'));
}

// HN input — format + search after pause
let _hnSearchTimer=null;
function regHNInput(el){
  // Format as XXX-XXX-XXX
  const digits=el.value.replace(/\D/g,'').slice(0,9);
  if(digits.length<=3) el.value=digits;
  else if(digits.length<=6) el.value=digits.slice(0,3)+'-'+digits.slice(3);
  else el.value=digits.slice(0,3)+'-'+digits.slice(3,6)+'-'+digits.slice(6);

  const dd=document.getElementById('reg-hn-results');

  // If less than 3 digits, hide dropdown
  if(digits.length<3){ dd.style.display='none'; return; }

  // Debounce — wait 500ms after last keystroke
  clearTimeout(_hnSearchTimer);
  _hnSearchTimer=setTimeout(()=>regHNSearch(digits,dd),500);
}

function regHNSearch(digits,dd){

  // Search existing patients by HN digits
  const matches=patients.filter(p=>{
    const hnDigits=p.hn.replace(/\D/g,'');
    return hnDigits.includes(digits);
  }).slice(0,5); // max 5 results

  if(!matches.length){
    dd.innerHTML=`<div style="padding:12px;text-align:center;font-size:12px">
      <i class="fas fa-user-slash" style="font-size:14px;color:#f59e0b;display:block;margin-bottom:4px"></i>
      <span style="color:var(--text-muted)">ไม่พบ — กรอกข้อมูลผู้ป่วยใหม่ด้านล่าง</span>
    </div>`;
    dd.style.display='block';
    setTimeout(()=>{ dd.style.display='none'; }, 2000);
    return;
  }

  dd.innerHTML=matches.map(p=>`
    <div class="reg-hn-item" onclick="regSelectPatient('${p.id}')">
      <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:12px;flex-shrink:0" class="esi-c-${p.esi}">${p.esi}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;color:var(--text-primary)">${fullName(p)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-muted)">${fmtHN(p.hn)} · ${p.sex} · ${fmtAge(p.age)}</div>
      </div>
      <span class="reg-badge-return"><i class="fas fa-rotate" style="font-size:8px"></i> เลือก</span>
    </div>`).join('');
  dd.style.display='block';
}

// Select a returning patient from dropdown
function regSelectPatient(id){
  const p=patients.find(x=>x.id===id);
  if(!p) return;
  _regFoundPatient=p;

  // Hide dropdown and info section
  document.getElementById('reg-hn-results').style.display='none';
  document.getElementById('reg-info-section').style.display='none';

  // Show badge
  const badge=document.getElementById('reg-badge');
  badge.innerHTML='<span class="reg-badge-return"><i class="fas fa-rotate" style="font-size:8px"></i> ผู้ป่วยเดิม</span>';
  badge.style.display='';

  // Lock HN
  const hnEl=document.getElementById('reg-hn');
  hnEl.value=fmtHN(p.hn).replace(/^HN\s*/,'');
  hnEl.readOnly=true;
  hnEl.style.color='#93c5fd';

  // Show found card
  const found=document.getElementById('reg-found');
  document.getElementById('reg-found-esi').className='esi-c-'+p.esi;
  document.getElementById('reg-found-esi').textContent=p.esi;
  document.getElementById('reg-found-name').textContent=fullName(p);
  document.getElementById('reg-found-meta').textContent=`${p.sex} · ${fmtAge(p.age)}`;
  found.style.display='block';
}

// Clear found patient, go back to manual entry
function regClearFound(){
  _regFoundPatient=null;
  document.getElementById('reg-found').style.display='none';
  document.getElementById('reg-info-section').style.display='';
  document.getElementById('reg-badge').style.display='none';
  const hnEl=document.getElementById('reg-hn');
  hnEl.value='';
  hnEl.readOnly=false;
  hnEl.style.color='';
  hnEl.focus();
}

function regGenHN(){
  _regHnCounter++;
  localStorage.setItem('hn_gen_counter',_regHnCounter);
  const hnEl=document.getElementById('reg-hn');
  hnEl.value='GEN'+String(_regHnCounter).padStart(6,'0');
  hnEl.readOnly=true;
  hnEl.style.color='#86efac';
  document.getElementById('reg-hn-results').style.display='none';
  document.getElementById('reg-gen-btn').style.display='none';
  document.getElementById('reg-hn-clr').style.display='';
  // Show new patient badge
  const badge=document.getElementById('reg-badge');
  badge.innerHTML='<span class="reg-badge-new"><i class="fas fa-user-plus" style="font-size:8px"></i> ผู้ป่วยใหม่</span>';
  badge.style.display='';
  // Clear any found patient
  _regFoundPatient=null;
  document.getElementById('reg-found').style.display='none';
  document.getElementById('reg-info-section').style.display='';
}

function regClearHN(){
  const hnEl=document.getElementById('reg-hn');
  hnEl.value='';
  hnEl.readOnly=false;
  hnEl.style.color='';
  hnEl.focus();
  document.getElementById('reg-gen-btn').style.display='';
  document.getElementById('reg-hn-clr').style.display='none';
  document.getElementById('reg-badge').style.display='none';
  document.getElementById('reg-hn-results').style.display='none';
  _regFoundPatient=null;
  document.getElementById('reg-found').style.display='none';
  document.getElementById('reg-info-section').style.display='';
}

function regScanHN(){
  showToast('Barcode scanner — จะเชื่อมต่อเร็วๆ นี้','#0ea5e9','fa-barcode');
}

// Age — lock other boxes when one is filled
function regAgeLock(which){
  const y=document.getElementById('reg-age-y');
  const m=document.getElementById('reg-age-m');
  const d=document.getElementById('reg-age-d');
  const clr=document.getElementById('reg-age-clr');
  if(which==='y' && y.value){ y.value=Math.min(Math.max(parseInt(y.value)||0,0),150); }
  if(which==='m' && m.value){ m.value=Math.min(Math.max(parseInt(m.value)||1,1),11); }
  if(which==='d' && d.value){ d.value=Math.min(Math.max(parseInt(d.value)||1,1),30); }
  const hasValue = y.value || m.value || d.value;
  if(hasValue){
    if(which==='y'||y.value){ m.disabled=true; d.disabled=true; y.disabled=false; }
    if(which==='m'||m.value){ y.disabled=true; d.disabled=true; m.disabled=false; }
    if(which==='d'||d.value){ y.disabled=true; m.disabled=true; d.disabled=false; }
    clr.style.display='';
  } else {
    y.disabled=false; m.disabled=false; d.disabled=false;
    clr.style.display='none';
  }
  // Lock ACS/Stroke for patients ≤15 years (or age in months/days)
  regEnforceFtAge();
}
function regAgeClear(){
  const y=document.getElementById('reg-age-y');
  const m=document.getElementById('reg-age-m');
  const d=document.getElementById('reg-age-d');
  y.value=''; m.value=''; d.value='';
  y.disabled=false; m.disabled=false; d.disabled=false;
  document.getElementById('reg-age-clr').style.display='none';
  regEnforceFtAge();
}
// Disable ACS/Stroke if age ≤15 or age is in months/days
function regEnforceFtAge(){
  const yVal=parseInt(document.getElementById('reg-age-y').value)||0;
  const mVal=document.getElementById('reg-age-m').value;
  const dVal=document.getElementById('reg-age-d').value;
  const isChild = mVal || dVal || (yVal > 0 && yVal <= 15);
  document.querySelectorAll('.reg-ft-btn').forEach(btn=>{
    const text=btn.textContent.trim().replace(/\s+/g,' ');
    if(text.includes('ACS')||text.includes('STROKE')||text.includes('Stroke')){
      btn.disabled=isChild;
      btn.style.opacity=isChild?'0.3':'1';
      btn.style.cursor=isChild?'not-allowed':'pointer';
      if(isChild && btn.classList.contains('active')){
        btn.classList.remove('active');
        _regFtActive=false;
        document.getElementById('reg-esi').disabled=false;
        document.getElementById('reg-esi').value='';
        regEsiChange();
      }
    }
  });
}

function regTitleChange(){
  const sel=document.getElementById('reg-title');
  const other=document.getElementById('reg-title-other');
  const sexEl=document.getElementById('reg-sex');
  if(sel.value==='other'){
    other.style.display='';
    other.focus();
  } else {
    other.style.display='none';
    other.value='';
  }
  // Auto-select sex based on title and lock
  const sexClr=document.getElementById('reg-sex-clr');
  if(M_TITLES.includes(sel.value)){ sexEl.value='M'; sexEl.disabled=true; sexClr.style.display=''; }
  else if(F_TITLES.includes(sel.value)){ sexEl.value='F'; sexEl.disabled=true; sexClr.style.display=''; }
  else { sexEl.value=''; sexEl.disabled=false; sexClr.style.display='none'; }
}

function regSexClear(){
  document.getElementById('reg-sex').value='';
  document.getElementById('reg-sex').disabled=false;
  document.getElementById('reg-sex-clr').style.display='none';
  document.getElementById('reg-title').value='';
  document.getElementById('reg-title-other').value='';
  document.getElementById('reg-title-other').style.display='none';
}

function regGetTitle(){
  const sel=document.getElementById('reg-title');
  if(sel.value==='other') return document.getElementById('reg-title-other').value.trim();
  return sel.value;
}

function regEsiChange(){
  const sel=document.getElementById('reg-esi');
  sel.className='qv-fi';
  if(sel.value) sel.classList.add('reg-esi-'+sel.value);
}

// Fast track buttons
document.getElementById('reg-ft').addEventListener('click',(e)=>{
  const btn=e.target.closest('.reg-ft-btn');
  if(!btn || btn.disabled) return;
  _regFtActive=true;
  document.querySelectorAll('.reg-ft-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const sel=document.getElementById('reg-esi');
  sel.value=btn.dataset.esi;
  sel.disabled=true;
  regEsiChange();
});

document.getElementById('reg-ft-clr').addEventListener('click',()=>{
  _regFtActive=false;
  document.querySelectorAll('.reg-ft-btn').forEach(b=>b.classList.remove('active'));
  const sel=document.getElementById('reg-esi');
  sel.disabled=false;
  sel.value='';
  regEsiChange();
});

async function submitReg(){
  const fp=_regFoundPatient; // returning patient or null
  const hnRaw=document.getElementById('reg-hn').value.replace(/[-\s]/g,'').trim();
  const title=fp ? fp.title : regGetTitle();
  const fname=fp ? fp.firstName : document.getElementById('reg-fname').value.trim();
  const lname=fp ? fp.lastName : document.getElementById('reg-lname').value.trim();
  const sex=fp ? fp.sex : document.getElementById('reg-sex').value;
  const ay=fp ? (fp.age.y||0) : (parseInt(document.getElementById('reg-age-y').value)||0);
  const am=fp ? (fp.age.m||0) : (parseInt(document.getElementById('reg-age-m').value)||0);
  const ad=fp ? (fp.age.d||0) : (parseInt(document.getElementById('reg-age-d').value)||0);
  const cc=document.getElementById('reg-cc').value.trim();
  const esi=parseInt(document.getElementById('reg-esi').value);
  const errEl=document.getElementById('reg-err');

  // Validate HN — must be 9 digits or GEN or returning patient
  const hnDigits=hnRaw.replace(/\D/g,'');
  if(!fp && !hnRaw.startsWith('GEN') && hnDigits.length!==9){
    errEl.textContent=hnDigits.length?'HN ต้อง 9 หลัก (ขณะนี้ '+hnDigits.length+' หลัก)':'กรุณากรอก HN หรือกด GEN'; return;
  }

  // Validate — skip name/sex/age for returning patients
  if(!fp){
    if(!fname){ errEl.textContent='กรุณากรอกชื่อจริง'; return; }
    if(!lname){ errEl.textContent='กรุณากรอกนามสกุล'; return; }
    if(!sex){ errEl.textContent='กรุณาเลือกเพศ'; return; }
    if(!ay&&!am&&!ad){ errEl.textContent='กรุณากรอกอายุอย่างน้อย 1 ช่อง'; return; }
  }
  if(!cc){ errEl.textContent='กรุณากรอก Chief Complaint'; return; }
  if(!esi){ errEl.textContent='กรุณาเลือก ESI Level'; return; }
  errEl.textContent='';

  // Build HN
  const hn = fp ? fp.hn : (hnRaw.startsWith('GEN') ? hnRaw : (hnRaw ? 'HN'+hnRaw.replace(/\D/g,'').slice(0,9) : 'GEN'+String(++_regHnCounter).padStart(6,'0')));
  if(!hnRaw && !fp) localStorage.setItem('hn_gen_counter',_regHnCounter);

  // Determine initial status
  let status, tab;
  if(_regFtActive){ status='เข้าห้องตรวจ'; tab='active'; }
  else if(esi===1){ status='กู้ชีพ'; tab='active'; }
  else { status='รอตรวจ'; tab='waiting'; }

  // Build patient data for Supabase
  const ftName = _regFtActive ? document.querySelector('.reg-ft-btn.active')?.textContent?.trim() : null;

  const result = await registerPatient(
    { hn, title, firstName:fname, lastName:lname, sex, age:{y:ay,m:am,d:ad} },
    { esi, cc, status, tab, fastTrack:ftName }
  );

  if (!result) {
    errEl.textContent='เกิดข้อผิดพลาด กรุณาลองใหม่';
    return;
  }

  // Reload from Supabase to get the new patient
  const fresh = await loadPatients();
  patients.length = 0;
  fresh.forEach(p => patients.push(p));

  closeReg();
  renderSit();
  renderSFilter();

  // Switch to the right tab and highlight
  const targetBtn=document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if(targetBtn) switchTab(targetBtn);
  else renderCards();

  // Find the new visit to highlight
  const newVisit = patients.find(p => p.hn === hn && p.tab === tab);
  if(newVisit){
    requestAnimationFrame(()=>{
      const card=document.getElementById('card-'+newVisit.id);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'nearest'});
        card.classList.add('card-highlight');
        setTimeout(()=>card.classList.remove('card-highlight'),3500);
      }
    });
    showToast(`<div style="line-height:1.3"><div style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary)">${fullName(newVisit)}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:2px">${fmtHN(newVisit.hn)}</div><div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#22c55e;margin-top:3px">Registered → ${sc(status).label}</div></div>`, '#22c55e', 'fa-user-plus');
  }
}

// ══════════════════════════════════════════
// INIT — Load from Supabase
// ══════════════════════════════════════════
async function initApp() {
  // Load patients from Supabase
  const dbPatients = await loadPatients();
  if (dbPatients.length) {
    // Replace seed data with real data
    patients.length = 0;
    dbPatients.forEach(p => patients.push(p));
  }
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
}
initApp();
