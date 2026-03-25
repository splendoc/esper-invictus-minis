// floor/reg.js — Registration panel, HN search, CC autocomplete, fast track
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
async function regSelectPatient(id){
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
  hnEl.style.color=document.documentElement.classList.contains('dark')?'#93c5fd':'#1d4ed8';

  // Show found card
  const found=document.getElementById('reg-found');
  document.getElementById('reg-found-esi').className='esi-c-'+p.esi;
  document.getElementById('reg-found-esi').textContent=p.esi;
  document.getElementById('reg-found-name').textContent=fullName(p);
  document.getElementById('reg-found-meta').textContent=`${p.sex} · ${fmtAge(p.age)}`;
  found.style.display='block';

  // ── Revisit check (24/48/72hr) ──
  checkRevisit(p.patientId || p.id);
}

async function checkRevisit(patientId) {
  const revisitEl = document.getElementById('reg-revisit');
  if (revisitEl) revisitEl.remove();

  try {
    const now = new Date();
    const h72 = new Date(now.getTime() - 72*60*60*1000).toISOString();
    const { data } = await sb
      .from('visits')
      .select('id, arrived_at, finalized_at, status, esi, chief_complaint')
      .eq('patient_id', patientId)
      .eq('tab', 'finalized')
      .gte('finalized_at', h72)
      .order('finalized_at', { ascending: false });

    if (!data || !data.length) return;

    const h24 = now.getTime() - 24*60*60*1000;
    const h48 = now.getTime() - 48*60*60*1000;

    const visits = data.map(v => {
      const ft = new Date(v.finalized_at).getTime();
      const hrs = Math.round((now.getTime() - ft) / (60*60*1000));
      const flag = ft > h24 ? '24hr' : ft > h48 ? '48hr' : '72hr';
      const color = flag === '24hr' ? '#ef4444' : flag === '48hr' ? '#f59e0b' : '#3b82f6';
      return { ...v, hrs, flag, color };
    });

    const html = `<div id="reg-revisit" style="margin:8px 0;padding:10px;border-radius:8px;border:2px solid ${visits[0].color};background:rgba(239,68,68,.08)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <i class="fas fa-exclamation-triangle" style="color:${visits[0].color};font-size:14px"></i>
        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;color:${visits[0].color}">
          ⚠ REVISIT ${visits[0].flag}
        </span>
        <span style="font-family:'Sarabun',sans-serif;font-size:12px;color:var(--text-sub)">${visits.length} visit(s) ใน 72 ชม.</span>
      </div>
      ${visits.map(v => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;border-top:1px solid var(--border-subtle)">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${v.hrs}hr ago</span>
        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:11px;color:${v.color}">${v.flag}</span>
        <span style="color:var(--text-sub)">${v.chief_complaint||''}</span>
        <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">ESI ${v.esi}</span>
      </div>`).join('')}
    </div>`;

    const foundEl = document.getElementById('reg-found');
    if (foundEl) foundEl.insertAdjacentHTML('afterend', html);
  } catch (err) {
    console.error('Revisit check error:', err);
  }
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
  hnEl.style.color=document.documentElement.classList.contains('dark')?'#86efac':'#16a34a';
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
  regValidateChildAge();
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

  // Child title (ด.ช./ด.ญ./เด็กชาย/เด็กหญิง) → validate age ≤ 15
  regValidateChildAge();
}

function regValidateChildAge(){
  const title=document.getElementById('reg-title').value;
  const ageY=parseInt(document.getElementById('reg-age-y').value)||0;
  const ageM=document.getElementById('reg-age-m').value;
  const ageD=document.getElementById('reg-age-d').value;
  const errEl=document.getElementById('reg-err');

  // No title or no age entered yet — skip validation
  if(!title || title==='other' || (!ageY && !ageM && !ageD)) {
    if(errEl.textContent.includes('อายุต้อง') || errEl.textContent.includes('อายุมากกว่า')) errEl.textContent='';
    return true;
  }

  const ADULT_TITLES=['นาย','นาง','นางสาว','พระภิกษุ','แม่ชี','Mr.','Ms.','Mrs.'];

  // Child title (ด.ช./ด.ญ./เด็กชาย/เด็กหญิง) → age must be ≤ 15
  if(CHILD_TITLES.includes(title)){
    if(ageY > CHILD_MAX_AGE){
      errEl.textContent='คำนำหน้า '+title+' อายุต้องไม่เกิน '+CHILD_MAX_AGE+' ปี';
      return false;
    }
  }

  // Adult title (นาย/นาง/นางสาว/etc.) → age must be > 15 (or in months/days = infant, also invalid)
  if(ADULT_TITLES.includes(title)){
    if(ageM || ageD || (ageY > 0 && ageY <= CHILD_MAX_AGE)){
      errEl.textContent='คำนำหน้า '+title+' อายุมากกว่า '+CHILD_MAX_AGE+' ปี';
      return false;
    }
  }

  if(errEl.textContent.includes('อายุต้อง') || errEl.textContent.includes('อายุมากกว่า')) errEl.textContent='';
  return true;
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
  if(!fp && !regValidateChildAge()) return;
  errEl.textContent='';

  // Build HN
  const hn = fp ? fp.hn : (hnRaw.startsWith('GEN') ? hnRaw : (hnRaw ? 'HN'+hnRaw.replace(/\D/g,'').slice(0,9) : 'GEN'+String(++_regHnCounter).padStart(6,'0')));
  if(!hnRaw && !fp) localStorage.setItem('hn_gen_counter',_regHnCounter);

  // Determine initial status — ESI 1 always กู้ชีพ regardless of fast track
  let status, tab;
  if(esi===1){ status='กู้ชีพ'; tab='active'; }
  else if(_regFtActive){ status='เข้าห้องตรวจ'; tab='active'; }
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
        highlightCard(newVisit.id, 5000);
      }
    });
    showToast(`<div style="line-height:1.3"><div style="font-family:'Sarabun',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary)">${fullName(newVisit)}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:2px">${fmtHN(newVisit.hn)}</div><div style="font-family:'Sarabun',sans-serif;font-size:12px;color:#22c55e;margin-top:3px">Registered → ${sc(status).label}</div></div>`, '#22c55e', 'fa-user-plus');
  }
}

// ══════════════════════════════════════════
// CC AUTOCOMPLETE (uses CC_LIST from floor-data.js)
// ══════════════════════════════════════════
let _ccSelIdx = -1;

function ccAutocomplete(val) {
  const ta = document.getElementById('reg-cc');
  if (!ta) return;

  // Create or get dropdown (appended to body to escape overflow:auto)
  let drop = document.getElementById('cc-dropdown-float');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'cc-dropdown-float';
    drop.className = 'cc-dropdown';
    drop.style.cssText = 'position:fixed;z-index:9999;display:none';
    document.body.appendChild(drop);
  }

  // Search last phrase being typed (after last space, comma, or newline)
  const full = val;
  let lastSep = -1;
  for (let i = full.length - 1; i >= 0; i--) {
    if (full[i] === ' ' || full[i] === ',' || full[i] === '\n' || full[i] === '\t') { lastSep = i; break; }
  }
  const query = lastSep >= 0 ? full.substring(lastSep + 1).trim() : full.trim();
  if (!query || query.length < 1) { drop.style.display = 'none'; return; }

  const matches = (typeof CC_LIST !== 'undefined' ? CC_LIST : []).filter(cc =>
    cc.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  if (matches.length === 0) { drop.style.display = 'none'; return; }

  _ccSelIdx = -1;
  _ccQuery = query;

  // Position below textarea
  const rect = ta.getBoundingClientRect();
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.width = rect.width + 'px';
  drop.innerHTML = matches.map((cc, i) => {
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    const highlighted = cc.replace(re, '<span class="cc-match">$1</span>');
    return `<div class="cc-item" data-idx="${i}" onmousedown="ccPick('${cc.replace(/'/g, "\\'")}')">${highlighted}</div>`;
  }).join('');
  drop.style.display = 'block';
}

let _ccQuery = '';
let _ccCursorPos = 0;

function ccPick(text) {
  const ta = document.getElementById('reg-cc');
  const drop = document.getElementById('cc-dropdown-float');
  if (!ta || !drop) return;

  // Replace only the last word/phrase with the picked text
  const val = ta.value;
  let lastSep = -1;
  for (let i = val.length - 1; i >= 0; i--) {
    if (val[i] === ' ' || val[i] === ',' || val[i] === '\n' || val[i] === '\t') { lastSep = i; break; }
  }
  if (lastSep >= 0) {
    ta.value = val.substring(0, lastSep + 1) + text;
  } else {
    ta.value = text;
  }

  drop.style.display = 'none';
  ta.focus();
}

// Keyboard navigation for CC dropdown
document.getElementById('reg-cc')?.addEventListener('keydown', function(e) {
  const drop = document.getElementById('cc-dropdown-float');
  if (!drop || drop.style.display === 'none') return;
  const items = drop.querySelectorAll('.cc-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _ccSelIdx = Math.min(_ccSelIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('cc-sel', i === _ccSelIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _ccSelIdx = Math.max(_ccSelIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('cc-sel', i === _ccSelIdx));
  } else if (e.key === 'Enter' && _ccSelIdx >= 0) {
    e.preventDefault();
    const sel = items[_ccSelIdx];
    if (sel) {
      const md = sel.getAttribute('onmousedown');
      if (md) eval(md);
    }
    _ccSelIdx = -1;
  } else if (e.key === 'Escape') {
    drop.style.display = 'none';
  }
});

// Close dropdown on blur
document.getElementById('reg-cc')?.addEventListener('blur', function() {
  setTimeout(() => {
    const drop = document.getElementById('cc-dropdown-float');
    if (drop) drop.style.display = 'none';
  }, 250);
});

// ══════════════════════════════════════════
// FAST TRACK → CASE CATEGORY AUTO-ASSIGN
// ══════════════════════════════════════════
(function() {
  const ftContainer = document.getElementById('reg-ft');
  const catSel = document.getElementById('reg-case-cat');
  if (!ftContainer || !catSel) return;

  // When fast track button is clicked, auto-assign case category
  const origClick = ftContainer.onclick;
  ftContainer.addEventListener('click', function() {
    setTimeout(() => {
      const activeBtn = document.querySelector('.reg-ft-btn.active');
      if (activeBtn && typeof FAST_TRACK_TO_CATEGORY !== 'undefined') {
        const ftName = activeBtn.textContent.trim();
        const cat = FAST_TRACK_TO_CATEGORY[ftName];
        if (cat) {
          catSel.value = cat;
          catSel.disabled = true;
        }
      }
    }, 10);
  });

  // When fast track is cleared, re-enable case category
  const ftClr = document.getElementById('reg-ft-clr');
  if (ftClr) {
    ftClr.addEventListener('click', function() {
      catSel.disabled = false;
      catSel.value = '';
    });
  }
})();

