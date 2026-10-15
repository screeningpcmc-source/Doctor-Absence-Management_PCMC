import { AbsenceRecord, Department, QueueRecord, WalkInCountRecord, HolidayItem } from '../types';
import { getOperationalToday } from '../utils/absence-logic';

export const PIN_USERS: Record<string, string> = {
  '4000': 'หน่วยคัดกรอง',
  '4118': 'คลินิกหัวใจฯ',
  '4209': 'ห้องตรวจโรคทั่วไป',
  '4265': 'อายุรกรรม',
  '4355': 'ศัลยกรรม',
  '4357': 'จักษุวิทยา',
  '4318': 'โสต ศอ นาสิก',
  '4446': 'เวชศาสตร์ฟื้นฟู',
  '4451': 'ศัลยกรรม-กระดูก',
  '4800': 'กุมารเวชกรรม',
  '4850': 'สูติกรรม',
  '4852': 'นรีเวชกรรม',
  '3451': 'คลินิกภูมิแพ้ฯ',
  '1734': 'จิตเวช',
  '4804': 'ทันตกรรม',
  '1715': 'ทันตกรรม',
  '4217': 'หัวหน้าหน่วย (แอดมิน)',
  '4193': 'นิติเวช',
  '4266': 'คลินิกสานฝัน',
  '8110': 'คลินิกปัญญาภิรมย์',
};

export const ADMIN_PIN = '4217';
export const SCREENING_PIN = '4000';

export const DEFAULT_REASONS = [
  'คลินิกปิดให้บริการ',
  'งดรับ walk-in',
  'จำกัดเคส walk-in',
  'งด consult',
  'ลาป่วย',
  'ลาพักผ่อนส่วนตัว',
  'ไปประชุม/อบรม',
  'ศึกษาดูงาน',
  'เหตุสุดวิสัย',
  'อื่นๆโปรดระบุ',
];

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'internal', name: 'อายุรกรรม', color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', order: 1 },
  { id: 'surgery', name: 'ศัลยกรรม', color: '#ef4444', bg: '#fef2f2', text: '#b91c1c', order: 2 },
  { id: 'ophth', name: 'จักษุวิทยา', color: '#ec4899', bg: '#fdf2f8', text: '#be185d', order: 3 },
  { id: 'ent', name: 'โสต ศอ นาสิก', color: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', order: 4 },
  { id: 'ortho', name: 'ศัลยกรรม-กระดูก', color: '#f97316', bg: '#fff7ed', text: '#c2410c', order: 5 },
  { id: 'rehab', name: 'เวชศาสตร์ฟื้นฟู', color: '#10b981', bg: '#ecfdf5', text: '#047857', order: 6 },
  { id: 'pediatric', name: 'กุมารเวชกรรม', color: '#22c55e', bg: '#f0fdf4', text: '#15803d', order: 7 },
  { id: 'obs', name: 'สูติกรรม', color: '#f59e0b', bg: '#fffbeb', text: '#b45309', order: 8 },
  { id: 'gyn', name: 'นรีเวชกรรม', color: '#f43f5e', bg: '#fff1f2', text: '#be123c', order: 9 },
  { id: 'cardio', name: 'คลินิกหัวใจฯ', color: '#ef4444', bg: '#fef2f2', text: '#b91c1c', order: 10 },
  { id: 'allergy', name: 'คลินิกภูมิแพ้ฯ', color: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1', order: 11 },
  { id: 'sanfan', name: 'สานฝัน', color: '#f59e0b', bg: '#fffbeb', text: '#b45309', order: 12 },
  { id: 'tb', name: 'TB', color: '#92400e', bg: '#fffbeb', text: '#78350f', order: 13 },
  { id: 'forensic', name: 'นิติเวช', color: '#64748b', bg: '#f8fafc', text: '#334155', order: 14 },
  { id: 'psych', name: 'จิตเวช', color: '#d946ef', bg: '#fdf4ff', text: '#a21caf', order: 15 },
  { id: 'internal-Premium', name: 'อายุรกรรม-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 16 },
  { id: 'surgery-Premium', name: 'ศัลยกรรม-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 17 },
  { id: 'ophth-Premium', name: 'จักษุวิทยา-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 18 },
  { id: 'ent-Premium', name: 'โสต ศอ นาสิก-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 19 },
  { id: 'ortho-Premium', name: 'ศัลยกรรม-กระดูก-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 20 },
  { id: 'rehab-Premium', name: 'เวชศาสตร์ฟื้นฟู-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 21 },
  { id: 'pediatric-Premium', name: 'กุมารเวชกรรม-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 22 },
  { id: 'obs_gyn-Premium', name: 'สูติ-นรีเวชกรรม-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 23 },
  { id: 'cardio-Premium', name: 'คลินิกหัวใจฯ-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 24 },
  { id: 'allergy-Premium', name: 'คลินิกภูมิแพ้ฯ-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 25 },
  { id: 'psych-Premium', name: 'จิตเวช-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 26 },
  { id: 'Family Medicine-Premium', name: 'เวชศาสตร์ครอบครัว-Premium', color: '#0891b2', bg: '#ecfeff', text: '#155e75', order: 27 },
];

export const INITIAL_WALKIN_DEPARTMENTS: Department[] = [
  { id: 'internal', name: 'อายุรกรรม', color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', order: 1 },
  { id: 'general', name: 'ตรวจโรคทั่วไป', color: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1', order: 2 },
  { id: 'surgery', name: 'ศัลยกรรม', color: '#ef4444', bg: '#fef2f2', text: '#b91c1c', order: 3 },
  { id: 'ophth', name: 'จักษุวิทยา', color: '#ec4899', bg: '#fdf2f8', text: '#be185d', order: 4 },
  { id: 'ent', name: 'โสต ศอ นาสิก', color: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', order: 5 },
  { id: 'ortho', name: 'ศัลยกรรม-กระดูก', color: '#f97316', bg: '#fff7ed', text: '#c2410c', order: 6 },
  { id: 'rehab', name: 'เวชศาสตร์ฟื้นฟู', color: '#10b981', bg: '#ecfdf5', text: '#047857', order: 7 },
  { id: 'pediatric', name: 'กุมารเวชกรรม', color: '#22c55e', bg: '#f0fdf4', text: '#15803d', order: 8 },
  { id: 'obs', name: 'สูติกรรม', color: '#f59e0b', bg: '#fffbeb', text: '#b45309', order: 9 },
  { id: 'gyn', name: 'นรีเวชกรรม', color: '#f43f5e', bg: '#fff1f2', text: '#be123c', order: 10 },
  { id: 'social', name: 'ประกันสังคม', color: '#4f46e5', bg: '#eef2ff', text: '#3730a3', order: 11 },
  { id: 'cardio', name: 'คลินิกหัวใจฯ', color: '#ef4444', bg: '#fef2f2', text: '#b91c1c', order: 12 },
  { id: 'allergy', name: 'คลินิกภูมิแพ้ฯ', color: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1', order: 13 },
  { id: 'sanfan', name: 'สานฝัน', color: '#f59e0b', bg: '#fffbeb', text: '#b45309', order: 14 },
  { id: 'tb', name: 'TB', color: '#92400e', bg: '#fffbeb', text: '#78350f', order: 15 },
  { id: 'infectious', name: 'แยกโรค', color: '#64748b', bg: '#f8fafc', text: '#334155', order: 16 },
  { id: 'lab_no_doc', name: 'Lab ไม่พบแพทย์', color: '#475569', bg: '#f1f5f9', text: '#1e293b', order: 17 },
  { id: 'med_no_doc', name: 'รับยาไม่พบแพทย์', color: '#475569', bg: '#f1f5f9', text: '#1e293b', order: 18 },
  { id: 'xray_no_doc', name: 'X-ray ไม่พบแพทย์', color: '#475569', bg: '#f1f5f9', text: '#1e293b', order: 19 },
  { id: 'psych', name: 'จิตเวช', color: '#d946ef', bg: '#fdf4ff', text: '#a21caf', order: 20 },
  { id: 'forensic', name: 'นิติเวช', color: '#64748b', bg: '#f8fafc', text: '#334155', order: 21 },
];

export const SUB_SPECIALTIES: Record<string, string[]> = {
  surgery: ['ทั่วไป', 'Uro', 'Neuro', 'Plastic', 'Colorectal', 'Vascular', 'Breast', 'Hepato-Biliary', 'Pediatric Surgery'],
  'surgery-Premium': ['ทั่วไป', 'Uro', 'Neuro', 'Plastic', 'Colorectal', 'Vascular', 'Breast', 'Hepato-Biliary', 'Pediatric Surgery'],
  internal: ['ทั่วไป', 'Neuro', 'GI', 'Skin', 'Cardio', 'Chest', 'Nephro', 'Endo', 'Onco', 'Rheum', 'Hemato'],
  'internal-Premium': ['ทั่วไป', 'Neuro', 'GI', 'Skin', 'Cardio', 'Chest', 'Nephro', 'Endo', 'Onco', 'Rheum', 'Hemato'],
  pediatric: ['ทั่วไป', 'Neuro', 'GI', 'Cardio', 'Allergy', 'Endo', 'Nephro', 'Developmental'],
  'pediatric-Premium': ['ทั่วไป', 'Neuro', 'GI', 'Cardio', 'Allergy', 'Endo', 'Nephro', 'Developmental'],
  ortho: ['ทั่วไป', 'Spine', 'Arthroplasty', 'Sports', 'Hand', 'Pediatric Ortho', 'Trauma', 'Tumor', 'Foot & Ankle'],
  'ortho-Premium': ['ทั่วไป', 'Spine', 'Arthroplasty', 'Sports', 'Hand', 'Pediatric Ortho', 'Trauma', 'Tumor', 'Foot & Ankle'],
  obs_gyn: ['ทั่วไป', 'MFM', 'Oncology', 'Reproductive', 'Urogyn', 'Menopause'],
  'obs_gyn-Premium': ['ทั่วไป', 'MFM', 'Oncology', 'Reproductive', 'Urogyn', 'Menopause'],
  obs: ['ทั่วไป', 'MFM'],
  'obs-Premium': ['ทั่วไป', 'MFM'],
  gyn: ['ทั่วไป', 'Oncology', 'Reproductive', 'Urogyn', 'Menopause'],
  'gyn-Premium': ['ทั่วไป', 'Oncology', 'Reproductive', 'Urogyn', 'Menopause'],
};

// Seed deterministic demo records so journeys work instantly
export function getInitialAbsenceRecords(): AbsenceRecord[] {
  const today = getOperationalToday();
  const [y, m, d] = today.split('-').map(Number);
  const tomorrowObj = new Date(Date.UTC(y, m - 1, d + 1));
  const dayAfterObj = new Date(Date.UTC(y, m - 1, d + 2));
  const tomorrow = tomorrowObj.toISOString().split('T')[0];
  const dayAfter = dayAfterObj.toISOString().split('T')[0];

  return [
    {
      ID: 'ABS-A101',
      DepartmentId: 'internal',
      DoctorName: 'นพ.สมชาย พิทักษ์ธรรม',
      AllDay: true,
      DateStart: today,
      TimeStart: '08:00',
      DateEnd: today,
      TimeEnd: '16:00',
      Reason: 'ไปประชุม/อบรม',
      Note: 'ประชุมวิชาการประจำปีสมาคมแพทย์โรคหัวใจ',
      CreatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      TimeType: 'in',
      UpdatedBy: 'อายุรกรรม',
      WalkInQuota: '',
      AffectedPatients: '18',
      ReplacementDoc: 'นพ.ประจักษ์ เกียรติคุณ',
      PatientManagement: 'โอนให้แพทย์ตรวจแทน',
      NotificationStatus: 'โทรแจ้งสำเร็จทั้งหมด',
      Specialty: 'Cardio',
    },
    {
      ID: 'ABS-A102',
      DepartmentId: 'surgery',
      DoctorName: 'พญ.นลินรัตน์ ศรีสวัสดิ์',
      AllDay: false,
      DateStart: today,
      TimeStart: '16:00',
      DateEnd: today,
      TimeEnd: '20:00',
      Reason: 'จำกัดเคส walk-in',
      Note: 'ห้องผ่าตัดฉุกเฉินมีคิวต่อเนื่อง รับ Walk-in ได้จำกัด',
      CreatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      TimeType: 'out',
      UpdatedBy: 'ศัลยกรรม',
      WalkInQuota: '6',
      AffectedPatients: '8',
      ReplacementDoc: 'ไม่มี',
      PatientManagement: 'ประสานติดต่อจัดสรรคิวใหม่',
      NotificationStatus: 'ส่ง SMS แล้วกำลังติดตาม',
      Specialty: 'Colorectal',
    },
    {
      ID: 'ABS-A103',
      DepartmentId: 'pediatric',
      DoctorName: 'นพ.กิตติพงษ์ สุขเจริญ',
      AllDay: true,
      DateStart: today,
      TimeStart: '08:00',
      DateEnd: tomorrow,
      TimeEnd: '16:00',
      Reason: 'ลาป่วย',
      Note: 'ไข้หวัดใหญ่สายพันธุ์ A แพทย์สั่งพักรักษาตัว 2 วัน',
      CreatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      TimeType: 'in',
      UpdatedBy: 'กุมารเวชกรรม',
      WalkInQuota: '',
      AffectedPatients: '25',
      ReplacementDoc: 'พญ.ชลิดา ธรรมสถิตย์',
      PatientManagement: 'โอนให้แพทย์ตรวจแทน',
      NotificationStatus: 'โทรแจ้งสำเร็จทั้งหมด',
      Specialty: 'ทั่วไป',
    },
    {
      ID: 'ABS-A104',
      DepartmentId: 'ophth',
      DoctorName: 'พญ.วิมลมาศ สัจจา',
      AllDay: true,
      DateStart: tomorrow,
      TimeStart: '08:00',
      DateEnd: dayAfter,
      TimeEnd: '16:00',
      Reason: 'ลาพักผ่อนส่วนตัว',
      Note: 'ลาพักผ่อนต่างจังหวัดตามสิทธิ์ที่ได้รับอนุมัติ',
      CreatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      TimeType: 'in',
      UpdatedBy: 'จักษุวิทยา',
      WalkInQuota: '',
      AffectedPatients: '30',
      ReplacementDoc: 'นพ.อนันต์ สายธาร',
      PatientManagement: 'เลื่อนนัดทั้งหมด',
      NotificationStatus: 'โทรแจ้งสำเร็จทั้งหมด',
      Specialty: 'ทั่วไป',
    },
  ];
}

export function getInitialQueues(): QueueRecord[] {
  const today = getOperationalToday();
  return [
    {
      KeyDateDeptDoc: `${today}_surgery_พญ.นลินรัตน์ ศรีสวัสดิ์`,
      Date: today,
      DepartmentId: 'surgery',
      DoctorName: 'พญ.นลินรัตน์ ศรีสวัสดิ์',
      MaxQuota: 6,
      CurrentQuota: 4,
      LastUpdatedBy: 'หน่วยคัดกรอง',
    },
  ];
}

export function getInitialWalkInCounts(): WalkInCountRecord[] {
  const today = getOperationalToday();
  return [
    {
      KeyDateDept: `${today}_internal`,
      Date: today,
      DepartmentId: 'internal',
      DepartmentName: 'อายุรกรรม',
      Count: 28,
      NurseName: 'พยาบาลนารี รักษ์ดี',
      LastUpdated: new Date(Date.now() - 1800000).toISOString(),
      UpdatedBy: 'หน่วยคัดกรอง',
    },
    {
      KeyDateDept: `${today}_surgery`,
      Date: today,
      DepartmentId: 'surgery',
      DepartmentName: 'ศัลยกรรม',
      Count: 14,
      NurseName: 'พยาบาลนารี รักษ์ดี',
      LastUpdated: new Date(Date.now() - 3600000).toISOString(),
      UpdatedBy: 'หน่วยคัดกรอง',
    },
    {
      KeyDateDept: `${today}_pediatric`,
      Date: today,
      DepartmentId: 'pediatric',
      DepartmentName: 'กุมารเวชกรรม',
      Count: 19,
      NurseName: 'พยาบาลสมศรี ชื่นบาน',
      LastUpdated: new Date(Date.now() - 5400000).toISOString(),
      UpdatedBy: 'หน่วยคัดกรอง',
    },
  ];
}

export function getHolidays(): HolidayItem[] {
  return [
    { id: 'hol_1', title: 'วันขึ้นปีใหม่', start: '2026-01-01' },
    { id: 'hol_2', title: 'วันมาฆบูชา', start: '2026-03-03' },
    { id: 'hol_3', title: 'วันจักรี', start: '2026-04-06' },
    { id: 'hol_4', title: 'วันสงกรานต์', start: '2026-04-13' },
    { id: 'hol_5', title: 'วันสงกรานต์', start: '2026-04-14' },
    { id: 'hol_6', title: 'วันสงกรานต์', start: '2026-04-15' },
    { id: 'hol_7', title: 'วันแรงงานแห่งชาติ', start: '2026-05-01' },
    { id: 'hol_8', title: 'วันวิสาขบูชา', start: '2026-05-31' },
    { id: 'hol_9', title: 'วันเฉลิมพระชนมพรรษา', start: '2026-07-28' },
    { id: 'hol_10', title: 'วันแม่แห่งชาติ', start: '2026-08-12' },
    { id: 'hol_11', title: 'วันนวมินทรมหาราช', start: '2026-10-13' },
    { id: 'hol_12', title: 'วันปิยมหาราช', start: '2026-10-23' },
    { id: 'hol_13', title: 'วันพ่อแห่งชาติ', start: '2026-12-05' },
    { id: 'hol_14', title: 'วันรัฐธรรมนูญ', start: '2026-12-10' },
    { id: 'hol_15', title: 'วันสิ้นปี', start: '2026-12-31' },
  ];
}
