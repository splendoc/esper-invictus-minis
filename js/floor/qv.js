// floor/qv.js — Quick View panel, inline editing, barcode scanner
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
  // Extra UI sections above status options for specific statuses
  const p_ctx = patients.find(x=>x.id===id);
  let extraHtml = '';

  // Refer contact log (ติดต่อ Refer + รอ Refer)
  if (p_ctx && typeof buildReferContactSection === 'function' &&
    (p_ctx.status === 'ติดต่อส่งตัวโรงพยาบาลอื่น' || p_ctx.status === 'รอส่งตัวโรงพยาบาลอื่น')) {
    extraHtml += buildReferContactSection(p_ctx);
  }

  // Consult log (ปรึกษาแพทย์เฉพาะทาง)
  if (p_ctx && typeof buildConsultSection === 'function' &&
    p_ctx.status === 'ปรึกษาแพทย์เฉพาะทาง') {
    extraHtml += buildConsultSection(p_ctx);
  }

  // Admit info (รอ Admit) — show จองเตียง + ส่งเวร summary
  if (p_ctx && p_ctx.status === 'รอขึ้นหอผู้ป่วย' && typeof getDispoState === 'function') {
    const d = getDispoState(p_ctx.id);
    if (d.bedWard) {
      const bedTime = d.bedAt ? new Date(d.bedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : '';
      extraHtml += `<div class="dispo-refer-section" onclick="event.stopPropagation()">
        <div class="rcl-title">ADMIT INFO</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:4px 0">
          <i class="fas fa-bed" style="color:#86efac;font-size:11px"></i>
          <span style="color:var(--text-sub)">จองเตียง ${d.bedWard}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${bedTime}</span>
        </div>
        ${d.handoverWardAt ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:4px 0">
          <i class="fas fa-people-arrows" style="color:#86efac;font-size:11px"></i>
          <span style="color:var(--text-sub)">ส่งเวรวอร์ดแล้ว</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${new Date(d.handoverWardAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})}</span>
        </div>` : ''}
      </div>`;
    }
  }

  const activeNotesHtml = (typeof buildNotesSection === 'function') ? buildNotesSection(id) : '';

  if (extraHtml) {
    document.getElementById('qv-opts').innerHTML = extraHtml +
      `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">` + html + `</div>` +
      activeNotesHtml;
  } else {
    document.getElementById('qv-opts').innerHTML = html + activeNotesHtml;
  }

  // Reset button to default state before updatePrev
  const initBtn = document.getElementById('confirm-btn');
  initBtn.textContent = 'Close';
  initBtn.className = 'no-change';
  initBtn.onclick = closeQV;

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
    btn.textContent='Close';
    btn.onclick=closeQV;
    return;
  }
  const sg=sc(qvSel);
  const changeLabel = isClosing && qvSel===p.status ? 'CLOSE CASE' : 'CHANGE TO';
  el.innerHTML=`<span style="font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-dim)">${changeLabel} <i class="fas fa-long-arrow-alt-right" style="margin:0 3px"></i></span><span class="sp ${sg.pill}">${sg.label}</span>`;
  btn.className='can-confirm';
  btn.textContent='Confirm';
  btn.onclick=confirmStatus;
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
      highlightCard(movedId, 5000);
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
      <span class="qv-edit-val" id="qv-sex-display" style="font-family:'Sarabun',sans-serif">${p.sex==='M'?'ชาย':p.sex==='F'?'หญิง':p.sex||'—'}</span>
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
        <input class="qv-fi" id="qv-name-first" type="text" value="${p.firstName||''}" placeholder="ชื่อจริง" autocomplete="off" style="flex:1;font-family:'Sarabun',sans-serif"
          onkeydown="if(event.key==='Enter')saveQVName();if(event.key==='Escape')cancelQVNameEdit()">
        <input class="qv-fi" id="qv-name-last" type="text" value="${p.lastName||''}" placeholder="นามสกุล" autocomplete="off" style="flex:1;font-family:'Sarabun',sans-serif"
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
          <input class="qv-fi" id="qv-age-y" type="number" min="0" max="150" value="${a.y||''}" placeholder="Y" autocomplete="off"
            oninput="qvAgeLock('y')" onkeydown="if(event.key==='Enter')saveQVAge();if(event.key==='Escape')cancelQVAgeEdit()">
          <span class="qv-age-unit">ปี</span>
          <input class="qv-fi" id="qv-age-m" type="number" min="1" max="11" value="${a.m||''}" placeholder="M" autocomplete="off"
            oninput="qvAgeLock('m')" onkeydown="if(event.key==='Enter')saveQVAge();if(event.key==='Escape')cancelQVAgeEdit()">
          <span class="qv-age-unit">เดือน</span>
          <input class="qv-fi" id="qv-age-d" type="number" min="1" max="30" value="${a.d||''}" placeholder="D" autocomplete="off"
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
const CHILD_TITLES=['เด็กชาย','เด็กหญิง','ด.ช.','ด.ญ.'];
const CHILD_MAX_AGE=15;
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

  // Finalization data panel (from dispo.js)
  const finPanel = (typeof buildFinalizationPanel === 'function') ? buildFinalizationPanel(p) : '';
  const notesHtml = (typeof buildNotesSection === 'function') ? buildNotesSection(p.id) : '';
  document.getElementById('qv-opts').innerHTML = finPanel + notesHtml;

  // Footer: hide confirm, show close only
  const prev=document.getElementById('qv-prev');
  prev.innerHTML='<span style="font-family:\'Rajdhani\',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-dim)">FINALIZED</span> <span style="font-family:\'Sarabun\',sans-serif;font-size:12px;font-weight:500;color:var(--text-sub)">— กรอกข้อมูลด้านล่าง</span>';
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

