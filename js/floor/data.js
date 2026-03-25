// ══════════════════════════════════════════
// ESPER INVICTUS — Data Lists
// floor-data.js
// All suggestion lists, lookup tables, and reference data
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// DIAGNOSIS LIST (146 items + ICD-10)
// Usage: searchable autocomplete in finalization
// Custom/free-text entries have no ICD-10
// ══════════════════════════════════════════
const DX_LIST = [
  // ── Cardiac ──
  { text:'STEMI', icd:'I21.3', cat:'cardiac' },
  { text:'NSTEMI', icd:'I21.4', cat:'cardiac' },
  { text:'Heart failure', icd:'I50.9', cat:'cardiac' },
  { text:'Cardiac arrest', icd:'I46.9', cat:'cardiac' },
  { text:'AF with RVR', icd:'I48.91', cat:'cardiac' },
  { text:'Atrial fibrillation', icd:'I48.91', cat:'cardiac' },
  { text:'SVT', icd:'I47.1', cat:'cardiac' },
  { text:'Complete heart block', icd:'I44.2', cat:'cardiac' },
  { text:'Unstable bradycardia', icd:'R00.1', cat:'cardiac' },
  { text:'Sick sinus syndrome', icd:'I49.5', cat:'cardiac' },
  { text:'Chest discomfort', icd:'R07.9', cat:'cardiac' },
  { text:'Aortic dissection', icd:'I71.0', cat:'cardiac' },
  { text:'Pulmonary hypertension', icd:'I27.0', cat:'cardiac' },
  { text:'Pulmonary embolism (PE)', icd:'I26.9', cat:'cardiac' },
  { text:'Abdominal aortic aneurysm (AAA)', icd:'I71.4', cat:'cardiac' },
  { text:'Hypertension', icd:'I10', cat:'cardiac' },

  // ── Neuro ──
  { text:'Hemorrhagic stroke', icd:'I61.9', cat:'neuro' },
  { text:'Ischemic stroke', icd:'I63.9', cat:'neuro' },
  { text:'Stroke Fast Track', icd:'I64', cat:'neuro' },
  { text:'Seizure', icd:'R56.9', cat:'neuro' },
  { text:'Status epilepticus', icd:'G41.9', cat:'neuro' },
  { text:'Febrile convulsion', icd:'R56.0', cat:'neuro' },
  { text:'Dizziness', icd:'R42', cat:'neuro' },
  { text:'Vertigo', icd:'H81.3', cat:'neuro' },
  { text:'Syncope', icd:'R55', cat:'neuro' },
  { text:'Near Syncope', icd:'R55', cat:'neuro' },
  { text:'Alteration of consciousness', icd:'R40.4', cat:'neuro' },
  { text:'Severe head injury', icd:'S06.9', cat:'neuro' },
  { text:'Moderate head injury', icd:'S06.9', cat:'neuro' },
  { text:'Mild head injury', icd:'S06.0', cat:'neuro' },

  // ── Respiratory ──
  { text:'Pneumonia', icd:'J18.9', cat:'respiratory' },
  { text:'ARDS', icd:'J80', cat:'respiratory' },
  { text:'Respiratory failure', icd:'J96.0', cat:'respiratory' },
  { text:'COPD with acute exacerbation', icd:'J44.1', cat:'respiratory' },
  { text:'Acute asthmatic attack', icd:'J45.901', cat:'respiratory' },
  { text:'RSV pneumonia', icd:'J12.1', cat:'respiratory' },
  { text:'RSV', icd:'J06.9', cat:'respiratory' },
  { text:'TB', icd:'A15.0', cat:'respiratory' },
  { text:'Pneumothorax', icd:'J93.9', cat:'respiratory' },
  { text:'Pneumohemothorax', icd:'J94.2', cat:'respiratory' },
  { text:'Pleural effusion', icd:'J91.8', cat:'respiratory' },

  // ── GI / Surgical ──
  { text:'Acute Appendicitis', icd:'K35.9', cat:'gi_surgical' },
  { text:'Acute cholangitis', icd:'K83.0', cat:'gi_surgical' },
  { text:'Acute cholecystitis', icd:'K81.0', cat:'gi_surgical' },
  { text:'Massive UGIB', icd:'K92.2', cat:'gi_surgical' },
  { text:'UGIB', icd:'K92.2', cat:'gi_surgical' },
  { text:'Gut obstruction', icd:'K56.6', cat:'gi_surgical' },
  { text:'PU perforate', icd:'K27.1', cat:'gi_surgical' },
  { text:'Pancreatitis', icd:'K85.9', cat:'gi_surgical' },
  { text:'Alcoholic pancreatitis', icd:'K85.2', cat:'gi_surgical' },
  { text:'Hepatitis', icd:'K75.9', cat:'gi_surgical' },
  { text:'Alcoholic hepatitis', icd:'K70.1', cat:'gi_surgical' },
  { text:'Chronic Hepatitis', icd:'K73.9', cat:'gi_surgical' },
  { text:'Ascites', icd:'R18.8', cat:'gi_surgical' },
  { text:'Dyspepsia', icd:'K30', cat:'gi_surgical' },
  { text:'Abdominal pain', icd:'R10.4', cat:'gi_surgical' },
  { text:'AGE', icd:'A09', cat:'gi_surgical' },

  // ── Infectious ──
  { text:'Sepsis', icd:'A41.9', cat:'infectious' },
  { text:'Septic shock', icd:'R65.21', cat:'infectious' },
  { text:'UTI', icd:'N39.0', cat:'infectious' },
  { text:'Cystitis', icd:'N30.9', cat:'infectious' },
  { text:'Pyelonephritis', icd:'N10', cat:'infectious' },
  { text:'HAP', icd:'J18.8', cat:'infectious' },
  { text:'VAP', icd:'J95.851', cat:'infectious' },
  { text:'Influenza A', icd:'J09.X', cat:'infectious' },
  { text:'Influenza B', icd:'J10.1', cat:'infectious' },
  { text:'Tonsillitis', icd:'J03.9', cat:'infectious' },
  { text:'Pharyngitis', icd:'J02.9', cat:'infectious' },
  { text:'Common cold', icd:'J00', cat:'infectious' },
  { text:'Fever', icd:'R50.9', cat:'infectious' },
  { text:'Croup', icd:'J05.0', cat:'infectious' },
  { text:'UP (HIV)', icd:'B24', cat:'infectious' },
  { text:'Dengue Fever', icd:'A90', cat:'infectious' },
  { text:'Dengue Hemorrhagic Fever', icd:'A91', cat:'infectious' },
  { text:'Dengue Hemorrhagic Fever with Shock', icd:'A91', cat:'infectious' },

  // ── Metabolic / Endocrine ──
  { text:'DKA/HHS', icd:'E11.65', cat:'metabolic' },
  { text:'Simple hyperglycemia', icd:'R73.9', cat:'metabolic' },
  { text:'Hypoglycemia with coma', icd:'E15', cat:'metabolic' },
  { text:'Hyperkalemia', icd:'E87.5', cat:'metabolic' },
  { text:'Volume Overload with ESRD', icd:'N18.6', cat:'metabolic' },

  // ── Trauma ──
  { text:'Multiple trauma', icd:'T07', cat:'trauma' },
  { text:'Motorcycle accident', icd:'V29.9', cat:'trauma' },
  { text:'Car accident', icd:'V49.9', cat:'trauma' },
  { text:'จักรยานล้มเอง', icd:'V18.9', cat:'trauma' },
  { text:'เดินข้ามถนนถูกรถชน', icd:'V03.1', cat:'trauma' },
  { text:'รถล้ม', icd:'V29.9', cat:'trauma' },
  { text:'รถทับ', icd:'V09.2', cat:'trauma' },
  { text:'Fracture Femur', icd:'S72.9', cat:'trauma' },
  { text:'Rib fracture', icd:'S22.3', cat:'trauma' },
  { text:'Fast POSITIVE', icd:'S36.9', cat:'trauma' },

  // ── Wounds ──
  { text:'Open wound at leg', icd:'S81.9', cat:'wound' },
  { text:'Open wound at arm', icd:'S51.9', cat:'wound' },
  { text:'Open wound at scalp', icd:'S01.0', cat:'wound' },
  { text:'Open wound at hand', icd:'S61.9', cat:'wound' },
  { text:'Open wound at foot', icd:'S91.3', cat:'wound' },
  { text:'Open wound at back', icd:'S21.9', cat:'wound' },
  { text:'Open wound at thorax', icd:'S21.9', cat:'wound' },

  // ── Assault ──
  { text:'ถูกแทง', icd:'X99', cat:'assault' },
  { text:'ถูกยิง', icd:'X95', cat:'assault' },
  { text:'ถูกตีด้วยอาวุธ', icd:'X99', cat:'assault' },
  { text:'ถูกทำร้ายร่างกาย', icd:'Y04', cat:'assault' },
  { text:'OSCC (Sexual assault)', icd:'T74.2', cat:'assault' },

  // ── Psych ──
  { text:'Acute psychosis', icd:'F23', cat:'psych' },
  { text:'Schizophrenia', icd:'F20.9', cat:'psych' },
  { text:'Alcohol withdrawal seizure', icd:'F10.31', cat:'psych' },
  { text:'Alcohol withdrawal syndrome', icd:'F10.23', cat:'psych' },
  { text:'Drug overdosed', icd:'T50.9', cat:'psych' },
  { text:'Suicidal attempt', icd:'T14.91', cat:'psych' },

  // ── Allergy / Toxin / Bites ──
  { text:'Anaphylaxis', icd:'T78.2', cat:'allergy' },
  { text:'Urticaria', icd:'L50.9', cat:'allergy' },
  { text:'แพ้กุ้ง', icd:'T78.1', cat:'allergy' },
  { text:'แพ้ยา', icd:'T88.7', cat:'allergy' },
  { text:'หมากัด', icd:'W54', cat:'bite' },
  { text:'แมวกัด', icd:'W55.0', cat:'bite' },
  { text:'แมวข่วน', icd:'W55.0', cat:'bite' },
  { text:'งูเขียวหางไหม้กัด', icd:'T63.0', cat:'bite' },
  { text:'งูเห่ากัด', icd:'T63.0', cat:'bite' },
  { text:'งูไม่ทราบชนิดกัด', icd:'T63.0', cat:'bite' },
  { text:'หนูกัด', icd:'W53', cat:'bite' },
  { text:'ลูกหมูบาด', icd:'W55.4', cat:'bite' },
  { text:'สัตว์ไม่ทราบชนิดกัด', icd:'W55.9', cat:'bite' },
  { text:'ตะขาบกัด', icd:'T63.4', cat:'bite' },
  { text:'ตะปูตำ', icd:'W45.0', cat:'wound' },
  { text:'เบ็ดเกี่ยว', icd:'W45.0', cat:'wound' },

  // ── Drowning ──
  { text:'Near drowning', icd:'T75.1', cat:'trauma' },
  { text:'Drowning', icd:'T75.1', cat:'trauma' },

  // ── Eye ──
  { text:'ฝุ่นเข้าตา', icd:'T15.9', cat:'eye' },
  { text:'เหล็กเข้าตา', icd:'T15.0', cat:'eye' },
  { text:'Ruptured globe', icd:'S05.2', cat:'eye' },
  { text:'UV keratitis', icd:'H16.1', cat:'eye' },

  // ── ENT ──
  { text:'ก้างปลาติดคอ', icd:'T18.0', cat:'ent' },

  // ── GU ──
  { text:'Urinary retention', icd:'R33', cat:'gu' },
  { text:'UC (Urinary calculi)', icd:'N20.9', cat:'gu' },

  // ── OB-GYN ──
  { text:'Rupture ectopic pregnancy', icd:'O00.9', cat:'obgyn' },
  { text:'BBA', icd:'O80', cat:'obgyn' },
  { text:'Pre-eclampsia', icd:'O14.9', cat:'obgyn' },
  { text:'Eclampsia', icd:'O15.0', cat:'obgyn' },
  { text:'Hyperemesis gravidarum', icd:'O21.0', cat:'obgyn' },

  // ── MSK ──
  { text:'Low back pain', icd:'M54.5', cat:'msk' },
  { text:'Gout', icd:'M10.9', cat:'msk' },
  { text:'Haemarthrosis', icd:'M25.0', cat:'msk' },

  // ── Oncology ──
  { text:'Colon cancer', icd:'C18.9', cat:'oncology' },
  { text:'Brain cancer', icd:'C71.9', cat:'oncology' },
  { text:'Ovarian cancer', icd:'C56', cat:'oncology' },
  { text:'Liver cancer (Hepatoma)', icd:'C22.0', cat:'oncology' },
  { text:'Lung cancer', icd:'C34.9', cat:'oncology' },
  { text:'Leukemia', icd:'C95.9', cat:'oncology' },

  // ── Hematology ──
  { text:'Thalassemia', icd:'D56.9', cat:'hematology' },
  { text:'Anemia', icd:'D64.9', cat:'hematology' },

  // ── Chronic / Comorbid ──
  { text:'Congestive heart failure', icd:'I50.0', cat:'cardiac' },
  { text:'Asthma', icd:'J45.9', cat:'respiratory' },
  { text:'COPD', icd:'J44.9', cat:'respiratory' },
  { text:'Diabetes Type II', icd:'E11.9', cat:'metabolic' },
  { text:'Diabetes Type I', icd:'E10.9', cat:'metabolic' },
  { text:'Epilepsy', icd:'G40.9', cat:'neuro' },
];


// ══════════════════════════════════════════
// CHIEF COMPLAINT SUGGESTIONS (~120 items)
// Usage: searchable autocomplete at registration
// ══════════════════════════════════════════
const CC_LIST = [
  // ── อาการปวด (Pain) ──
  'เจ็บหน้าอก',
  'แน่นหน้าอก',
  'ปวดท้อง',
  'ปวดท้องน้อย',
  'ปวดท้องด้านขวา',
  'ปวดท้องด้านซ้าย',
  'ปวดจุกแน่นลิ้นปี่',
  'ปวดหลัง',
  'ปวดหลังส่วนล่าง',
  'ปวดคอ',
  'ศีรษะกระแทก',
  'ศีรษะไม่กระแทก',
  'จำเหตุการณ์ได้',
  'จำเหตุการณ์ไม่ได้',
  'สลบ',
  'ไม่สลบ',
  'ตกต้นไม้',
  'ตกต้นมะม่วง',
  'ตกที่สูง',
  'ตกตึก',
  'ตกนั่งร้าน',
  'กระโดดตึก',
  'ขาดเหล้า',
  'ไม่ได้ดื่มเหล้า',
  'รักษาโรงพยาบาลอื่น',
  'รักษาโรงพยาบาลพระนั่งเกล้า',
  'รักษาคลินิก',
  'รักษาโรงพยาบาลต่างจังหวัด',
  'รักษาโรงพยาบาลศิริราช',
  'รักษาโรงพยาบาลเอกชน',
  'ปกปิดญาติ',
  'ข้อเท้าพลิก',
  'ข้อเท้าแพลง',
  'เล็บฉีก',
  'เล็บหลุด',
  'โดนต่อย',
  'โดนตบ',
  'ถูกตี',
  'ถูกตบ',
  'โดนกระทืบ',
  'ถูกกระทืบ',
  'ติดภายใน',
  'กู้ชีพนำส่ง',
  'อาสานำส่ง',
  'FR นำส่ง',
  'พลเมืองดีนำส่ง',
  'เอราวัณนำส่ง',
  'Basic นำส่ง',
  'เบสิคนำส่ง',
  'EMS ออกรับ',
  'ญาติแจ้งว่า',
  'ใช้ยาบ้า',
  'ใช้ยาเค',
  'ใช้ยาไอซ์',
  'ใช้ยาอี',
  'ใช้กัญชา',
  'ไม่มีญาติ',
  'สูบบุหรี่',
  'ยังไม่เลิกบุหรี่',
  'เสมหะมาก',
  'มีแผลกดทับ',
  'แผลที่เท้า',
  'ใส่สายสวนปัสสาวะ',
  'เปลี่ยนสายสวนปัสสาวะ',
  'เปลี่ยนสาย NG',
  'ถ่ายดำ',
  'กลับจากโรงพยาบาล',
  'เพิ่ง Discharge',
  'สำลักอาหาร',
  'เจาะคอ',
  'นอนติดเตียง',
  'ไม่มีคนดูแล',
  'ญาติไม่พร้อม',
  'สูบบุหรี่',
  'สูบกัญชา',
  'สูบยาบ้า',
  'ฉีดเฮโรอีน',
  'ใช้เฮโรอีน',
  'ใช้โคเคน',
  'ขอฉีดยา',
  'ทำแผล',
  'ฉีดวัคซีนบาดทะยัก',
  'ฉีดวัคซีนพิษสุนัขบ้า',
  'ไอเสียงก้อง',
  'ไอเหมือนเสียงหมาเห่า',
  'มีดบาด',
  'เลือดไหลไม่หยุด',
  'เลือดหยุดแล้ว',
  'เลือดพุ่ง',
  'ปวดศีรษะ',
  'ปวดขา',
  'ปวดแขน',
  'ปวดเข่า',
  'ปวดแผล',
  'ปวดสีข้าง (ปัสสาวะ)',

  // ── หายใจ (Respiratory) ──
  'หายใจเหนื่อย',
  'หายใจลำบาก',
  'หอบ',
  'หอบเหนื่อย',
  'ไอ',
  'ไอมีเสมหะ',
  'ไอเป็นเลือด',
  'แน่นหน้าอกหายใจไม่สะดวก',
  'นอนราบไม่ได้',

  // ── ระบบประสาท (Neuro) ──
  'หมดสติ',
  'ไม่รู้สึกตัว',
  'ชัก',
  'ชักเกร็ง',
  'ชักเกร็งกระตุก',
  'อ่อนแรงครึ่งซีก',
  'แขนขาอ่อนแรง',
  'พูดไม่ชัด',
  'ปากเบี้ยว',
  'เวียนศีรษะ',
  'วิงเวียน',
  'บ้านหมุน',
  'หน้ามืดเป็นลม',
  'เกือบเป็นลม',
  'วูบ',
  'เป็นลม',
  'พูดไม่รู้เรื่อง',
  'ปลุกไม่ตื่น',
  'ปลุกตื่นยาก',

  // ── ไข้ / ติดเชื้อ (Fever/Infection) ──
  'ไข้สูง',
  'ไข้',
  'ไข้หนาวสั่น',
  'ไข้ ไอ น้ำมูก',
  'เจ็บคอ',
  'ไข้ ปัสสาวะแสบขัด',

  // ── GI (ทางเดินอาหาร) ──
  'คลื่นไส้อาเจียน',
  'อาเจียนเป็นเลือด',
  'ท้องเสีย',
  'ถ่ายเหลว',
  'ถ่ายเป็นเลือด',
  'ถ่ายดำ',
  'กินไม่ได้',
  'กินได้น้อย',
  'กลืนลำบาก',
  'ก้างปลาติดคอ',

  // ── หัวใจ (Cardiac) ──
  'ใจสั่น',
  'ใจเต้นเร็ว',
  'ใจเต้นผิดจังหวะ',
  'เหนื่อยง่าย ขาบวม',
  'แน่นหน้าอก เหงื่อออก',

  // ── อุบัติเหตุ (Trauma) ──
  'อุบัติเหตุรถจักรยานยนต์',
  'อุบัติเหตุรถยนต์',
  'อุบัติเหตุจักรยานล้มเอง',
  'โดนรถชน',
  'รถล้ม',
  'รถทับ',
  'ล้มเอง',
  'ขาแพลง',
  'ตกจากที่สูง',
  'ตกจากนั่งร้าน',
  'ตกจากเพดาน',
  'ตกจากกำแพง',
  'ตกจากกระดานลื่น',
  'ตกจากของเล่น',
  'ตกจากหลังรถสิบล้อ',
  'ตกจากหลังรถมอเตอร์ไซค์',
  'ถูกแทง',
  'ถูกยิง',
  'ถูกตีด้วยอาวุธ',
  'ถูกทำร้ายร่างกาย',

  // ── แผล (Wound) ──
  'แผลเปิดที่ขา',
  'แผลเปิดที่แขน',
  'แผลเปิดที่ศีรษะ',
  'แผลเปิดที่มือ',
  'แผลเปิดที่เท้า',
  'แผลเปิดที่หลัง',
  'แผลเปิดที่หน้าอก',
  'แผลเปิดที่ข้อมือ',
  'แผลเปิดที่ข้อเท้า',
  'เล็บหลุด',
  'แขนผิดรูป',
  'ขาผิดรูป',
  'ข้อเท้าผิดรูป',
  'ข้อมือผิดรูป',
  'ตะปูตำ',
  'เบ็ดเกี่ยว',

  // ── สัตว์กัด / แมลง ──
  'หมากัด',
  'แมวกัด',
  'แมวข่วน',
  'งูกัด',
  'งูเขียวหางไหม้กัด',
  'งูเห่ากัด',
  'งูไม่ทราบชนิดกัด',
  'หนูกัด',
  'ลูกหมูบาด',
  'สัตว์กัด (ไม่ทราบชนิด)',
  'ตะขาบกัด',

  // ── ตา (Eye) ──
  'ฝุ่นเข้าตา',
  'เหล็กเข้าตา',
  'ตามัว',
  'ปวดตา',
  'ตาแดง',

  // ── หู จมูก คอ / สิ่งแปลกปลอม (ENT / Foreign body) ──
  'แมลงเข้าหู',
  'ลูกปัดเข้าหู',
  'ลูกปัดเข้าจมูก',
  'ของเล่นเข้าจมูก',
  'กลืนเหรียญ',
  'กลืนแบตเตอร์รี่',
  'กลืนถ่าน',
  'กลืนแม่เหล็ก',

  // ── แพ้ (Allergy) ──
  'ผื่นแพ้',
  'ผื่นคัน',
  'ปากบวม',
  'หน้าบวม',
  'ตาบวม',
  'ลมพิษ',
  'แพ้อาหาร',
  'แพ้กุ้ง',
  'แพ้ยา',

  // ── จิตเวช (Psych) ──
  'พูดจาสับสน',
  'ก้าวร้าว',
  'พยายามทำร้ายตัวเอง',
  'กินยาเกินขนาด',
  'เพ้อ สับสน',
  'ทำร้ายผู้อื่น',
  'โวยวายเสียงดัง',
  'หูแว่ว',
  'ประสาทหลอน',
  'เผาบ้าน',

  // ── สูติ-นรี (OB-GYN) ──
  'ปวดท้องน้อย ตั้งครรภ์',
  'เลือดออกทางช่องคลอด',
  'ตั้งครรภ์ ความดันสูง',

  // ── ระบบปัสสาวะ (GU) ──
  'ปัสสาวะไม่ออก',
  'ปัสสาวะเป็นเลือด',
  'ปัสสาวะแสบขัด',

  // ── อื่นๆ (General) ──
  'ความดันโลหิตสูง',
  'น้ำตาลในเลือดต่ำ',
  'น้ำตาลในเลือดสูง',
  'ขาบวม',
  'บวมทั้งตัว',
  'จมน้ำ',
  'เกือบจมน้ำ',
  'อ่อนเพลีย ไม่มีแรง',

  // ── ไข้ / หายใจ (additional) ──
  'มีไข้',
  'มีไข้สูง',
  'หายใจหอบ',
  'หายใจหอบเหนื่อย',
  'หอบเหนื่อย',

  // ── โรคเรื้อรัง / มะเร็ง ──
  'มะเร็งลำไส้',
  'มะเร็งปอด',
  'มะเร็งเม็ดเลือดขาว',
  'มะเร็งสมอง',
  'มะเร็งรังไข่',
  'มะเร็งตับ',
  'ฉายแสง',
  'ให้คีโม',
  'โรคเลือด',
  'ทาลัสซีเมีย',
  'โลหิตจาง',
  'น้ำท่วมปอด',
  'วัณโรค',
  'หอบหืด',
  'ถุงลมโป่งพอง',
  'ลมชัก',
  'ขาดยา',
  'กินยาไม่สม่ำเสมอ',
  'ไม่ขาดยา',
  'กินยาพาราเกินขนาด',
  'กินยานอนหลับเกินขนาด',
  'ทำร้ายตัวเอง',
  'พยายามฆ่าตัวตาย',
  'กินยาฆ่าแมลง',
  'กินน้ำยาล้างห้องน้ำ',
];


// ══════════════════════════════════════════
// HOSPITAL LIST (for referral)
// type: 'public' | 'private' — hidden from UI, used for stats
// locked: auto-rules (e.g. ศรีธัญญา = psych only)
// ══════════════════════════════════════════
const HOSPITAL_LIST = [
  // ── รัฐ (Public) ──
  { name:'โรงพยาบาลพระนั่งเกล้า', type:'public' },
  { name:'โรงพยาบาลศิริราช', type:'public' },
  { name:'St.Carlos', type:'public' },
  { name:'โรงพยาบาลศรีธัญญา', type:'public', psychDefault:true, lockReason:'เกินศักยภาพ', skipReceivingDept:true },
  // psychDefault: auto-suggested first for psych cases (but can be rejected)
  // lockReason: when ศรีธัญญา is selected, reason locks to เกินศักยภาพ
  // skipReceivingDept: no need to specify receiving dept (always psych)
  { name:'โรงพยาบาลบางใหญ่', type:'public' },
  { name:'โรงพยาบาลไทรน้อย', type:'public' },
  { name:'โรงพยาบาลปากเกร็ด', type:'public' },
  { name:'โรงพยาบาลบางกรวย', type:'public' },
  { name:'โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ', type:'public' },
  { name:'วชิรพยาบาล', type:'public' },
  { name:'โรงพยาบาลราชวิถี', type:'public' },
  { name:'โรงพยาบาลจุฬาลงกรณ์', type:'public' },

  // ── เอกชน (Private) ──
  { name:'โรงพยาบาลเกษมราษฎร์รัตนาธิเบศ', type:'private' },
  { name:'โรงพยาบาลมงกุฏวัฒนะ', type:'private' },
  { name:'โรงพยาบาลกรุงสยาม', type:'private' },
];


// ══════════════════════════════════════════
// REFERRAL REASONS
// ══════════════════════════════════════════
const REFERRAL_REASONS = [
  'เกินศักยภาพ',
  'ตามสิทธิ์',
  'ตามความประสงค์ของผู้ป่วย',
  'Emergency PCI',
];


// ══════════════════════════════════════════
// REFERRING DOCTORS (EP who refers the patient out)
// Shown when status = ติดต่อส่งตัวโรงพยาบาลอื่น
// ══════════════════════════════════════════
// Referring doctor = any doctor in the hospital (searchable)
// Combines all DEPT_DOCTORS + EPs. Also allows free text (อื่นๆ).
const REFERRING_DOCTORS = [
  // ── Emergency Physicians ──
  { name:'พญ.เฌอมาลย์ จันทนโรจ', license:'ว.62947', dept:'EP' },
  { name:'พญ.ดิฏฐาพร ธรรมมะ', license:'ว.50965', dept:'EP' },
  // Other doctors are pulled from DEPT_DOCTORS at runtime via getAllDoctors()
];

// Helper: get ALL doctors (EPs + all dept doctors) for referring doctor picker
function getAllDoctors() {
  const all = [...REFERRING_DOCTORS];
  for (const [dept, docs] of Object.entries(DEPT_DOCTORS)) {
    for (const d of docs) {
      all.push({ name:d.name, license:d.license, dept });
    }
  }
  return all;
}


// ══════════════════════════════════════════
// DEPARTMENTS + DOCTORS (in-hospital admission)
// Filtered: pick department → shows only that dept's doctors
// ══════════════════════════════════════════
const DEPT_DOCTORS = {
  'GP': [
    { name:'พญ.อภิสรา', license:'ว.78157' },
    { name:'นพ.ธนดล', license:'ว.77777' },
    { name:'นพ.ธรรศภณ', license:'ว.75034' },
    { name:'พญ.ภัทรพร', license:'ว.770420' },
    { name:'นพ.ศิลป์', license:'ว.77560' },
    { name:'พญ.วิรากานต์', license:'ว.73775' },
    { name:'พญ.ณัฐธิดา', license:null },  // ว. TBD
  ],
  'GEN MED': [
    { name:'นพ.มนัส', license:null },
    { name:'นพ.พงศกร', license:null },
    { name:'นพ.จีรัฏฐ์', license:null },
  ],
  'GEN SX': [
    { name:'นพ.ปิยะเทพ', license:null },
  ],
  'Ortho': [
    { name:'พญ.ธัญธีรา', license:null },
    { name:'นพ.นพรุจ', license:null },
    { name:'นพ.ยศวัจน์', license:null },
  ],
  'OB-GYN': [
    { name:'นพ.สุรพล', license:null },
    { name:'พญ.ผณิธรา', license:null },
  ],
  'PED': [
    { name:'พญ.ศิริธิดา', license:null },
    { name:'นพ.ปฏิพัทธ์', license:null },
    { name:'พญ.นุชนารถ', license:null },
  ],
  'EYE': [
    { name:'นพ.พีรณัฐ', license:null },
  ],
  'Psych': [
    { name:'พญ.อนิตา', license:null },
  ],
  'Maxillofacial': [
    { name:'ทันตแพทย์ชัยยศ', license:null },
  ],
};

// Department display names (Thai)
const DEPT_LABELS = {
  'GP':            'GP (เวชปฏิบัติทั่วไป)',
  'GEN MED':       'GEN MED (อายุรกรรม)',
  'GEN SX':        'GEN SX (ศัลยกรรม)',
  'Ortho':         'Ortho (กระดูก)',
  'OB-GYN':        'OB-GYN (สูติ-นรี)',
  'PED':           'PED (กุมาร)',
  'EYE':           'EYE (จักษุ)',
  'Psych':         'Psych (จิตเวช)',
  'Maxillofacial': 'Maxillofacial (ศัลยกรรมช่องปาก)',
  'อื่นๆ':         'อื่นๆ (ระบุ)',
};


// ══════════════════════════════════════════
// RECEIVING DEPARTMENTS (for Refer Out)
// What department at the receiving hospital
// ══════════════════════════════════════════
const RECEIVING_DEPTS = [
  'อายุรกรรม (Medicine)',
  'ศัลยกรรม (Surgery)',
  'กระดูก (Ortho)',
  'สูติ-นรี (OB-GYN)',
  'กุมาร (Pediatrics)',
  'จักษุ (Eye)',
  'จิตเวช (Psych)',
  'ENT',
  'Cardiology',
  'Neurology',
  'Neurosurgery',
  'ICU',
  'อื่นๆ',
];


// ══════════════════════════════════════════
// WARD LIST (for bed request)
// ══════════════════════════════════════════
const WARD_LIST = [
  'ICU',
  'วอร์ดชาย',
  'วอร์ดหญิง',
  'วอร์ดพิเศษชั้น 6',
  'วอร์ดพิเศษชั้น 7',
  'วอร์ดตา',
];


// ══════════════════════════════════════════
// CASE CATEGORIES
// Auto-assign from fast track:
//   Trauma fast track → 'trauma'
//   ACS / Stroke / Sepsis → 'non_trauma'
//   No fast track → nurse picks
// ══════════════════════════════════════════
const CASE_CATEGORIES = [
  { value:'trauma',     label:'Trauma' },
  { value:'non_trauma', label:'Non-Trauma' },
  { value:'psych',      label:'Psychiatric Emergency' },
];

// Fast track → case category auto-mapping
const FAST_TRACK_TO_CATEGORY = {
  'Trauma':      'trauma',
  'ACS':         'non_trauma',
  'Stroke':      'non_trauma',
  'Sepsis':      'non_trauma',
  'Anaphylaxis': 'non_trauma',
};


// ══════════════════════════════════════════
// ARRIVAL MODES
// ══════════════════════════════════════════
// Arrival modes — flat list. Items with subText:true show optional free-text input
// Items with referHosp:true show hospital auto-suggest (same list as refer out)
const ARRIVAL_MODES = [
  { label:'Walk-in' },
  { label:'อาสานำส่ง', subOptions:['ปอเต๊กตึ๊ง','ร่วมกตัญญู','อื่นๆ'], subText:true, subPlaceholder:'คันที่...' },
  { label:'BLS นำส่ง', subOptions:['บางคูลัด','ละหาร','บางบัวทอง','บางรักษ์ใหญ่','บางรักษ์พัฒนา','พิมลราช','อื่นๆ'] },
  { label:'ALS นำส่ง', subOptions:['ปากเกร็ด','ไทรน้อย','บางใหญ่พิมลราช','ชลประทาน','กู้ชีพเอราวัณ','กู้ชีพนเรนทร','อื่นๆ'] },
  { label:'พัฒนาสังคมนำส่ง' },
  { label:'พลเมืองดีนำส่ง' },
  { label:'Refer in', referHosp:true },
  { label:'ส่งจาก รพ.ชลดา' },
  { label:'ส่งจาก NCD', alias:'โรคเรื้อรัง' },
  { label:'ส่งจาก OPD' },
  { label:'ส่งจากคลินิกตา' },
  { label:'ส่งจากทันตกรรม' },
  { label:'ส่งจากกายภาพบำบัด' },
  { label:'ส่งจากแพทย์แผนไทย' },
  { label:'ส่งจากคลินิกหอบหืด' },
  { label:'ส่งจากปฐมภูมิ' },
  { label:'ส่งจากคลินิกจิตเวช' },
  { label:'ส่งจากคลินิกวัณโรค' },
  { label:'ส่งจากคลินิกนภา' },
  { label:'ส่งจากรพสต.', subText:true },
  { label:'ส่งจากคลินิกบ้านอบอุ่น', subText:true, subPlaceholder:'สาขา...' },
  { label:'ส่งจากคลินิกรักสุข', subText:true, subPlaceholder:'สาขา...' },
  { label:'ส่งจากคลินิกมิตรไมตรี', subText:true, subPlaceholder:'สาขา...' },
  { label:'ส่งจากอื่นๆ', subText:true },
  { label:'ตำรวจ' },
];


// ══════════════════════════════════════════
// TREATMENT OUTCOMES (Discharge + Refer only)
// ══════════════════════════════════════════
const TREATMENT_OUTCOMES = [
  'ดีขึ้น',
  'คงเดิม',
  'ไม่ดีขึ้น',
];


// ══════════════════════════════════════════
// HELPER: Searchable filter for any list
// Usage: filterList(DX_LIST, 'nste', 'text') → [{text:'NSTEMI', icd:'I21.4', ...}]
// Usage: filterList(CC_LIST, 'เจ็บ') → ['เจ็บหน้าอก', 'เจ็บคอ']
// ══════════════════════════════════════════
function filterList(list, query, key) {
  if (!query || !query.trim()) return list;
  const q = query.trim().toLowerCase();
  return list.filter(item => {
    const text = key ? item[key] : item;
    return text.toLowerCase().includes(q);
  });
}

// Helper: filter hospitals by search
function filterHospitals(query) {
  return filterList(HOSPITAL_LIST, query, 'name');
}

// Helper: get doctors for a department
function getDoctorsForDept(dept) {
  return DEPT_DOCTORS[dept] || [];
}

// Helper: auto-assign case category from fast track
function getCategoryFromFastTrack(fastTrack) {
  return FAST_TRACK_TO_CATEGORY[fastTrack] || null;
}

// Helper: check if hospital is locked for psych
function isHospitalPsychLocked(hospitalName) {
  const h = HOSPITAL_LIST.find(h => h.name === hospitalName);
  return h?.lockPsych || false;
}

// Helper: get ICD-10 for a diagnosis text
function getIcdForDx(dxText) {
  const dx = DX_LIST.find(d => d.text === dxText);
  return dx?.icd || null;
}
