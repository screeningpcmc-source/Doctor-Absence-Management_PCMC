/**
 * Pure domain logic for Doctor Absence & Walk-In Queue Management
 * Decoupled from UI for high-speed calculation, zero memory leaks, and testability.
 */

export interface AbsenceRecord {
  ID: string;
  DepartmentId: string;
  DoctorName: string;
  AllDay: boolean;
  DateStart: string;
  TimeStart: string;
  DateEnd: string;
  TimeEnd: string;
  Reason: string;
  Note: string;
  CreatedAt: string;
  CalendarEventId?: string;
  TimeType: 'in' | 'out' | 'out_weekend' | 'both' | string;
  UpdatedBy: string;
  WalkInQuota?: string | number;
  AffectedPatients?: string | number;
  ReplacementDoc?: string;
  PatientManagement?: string;
  NotificationStatus?: string;
  Specialty?: string;
}

/**
 * Normalizes doctor name for robust cross-matching, eliminating spacing differences,
 * prefixes with/without spaces (e.g., 'พญ. นลินรัตน์ ศรีสวัสดิ์' vs 'พญ.นลินรัตน์ ศรีสวัสดิ์'),
 * and redundant prefixes.
 */
export function normalizeDoctorName(name?: string): string {
  if (!name || name === '-' || name.trim() === '') return '-';
  return name
    .trim()
    .replace(/^(นพ\.|พญ\.|ทพ\.|ทญ\.)\s*/, '$1')
    .replace(/\s+/g, ' ');
}

/**
 * Format canonical doctor name with prefix (consistent without spurious space)
 */
export function formatCanonicalDoctorName(prefix: string, name: string): string {
  const cleanPrefix = (prefix || '').trim();
  let cleanName = (name || '').trim();
  if (!cleanName || cleanName === '-') return '-';
  // Remove prefix if already typed in name input
  cleanName = cleanName.replace(/^(นพ\.|พญ\.|ทพ\.|ทญ\.)\s*/, '');
  return `${cleanPrefix}${cleanName}`;
}

export interface QueueRecord {
  KeyDateDeptDoc: string;
  Date: string;
  DepartmentId: string;
  DoctorName: string;
  MaxQuota: number;
  CurrentQuota: number;
  LastUpdatedBy: string;
}

export interface WalkInCountRecord {
  KeyDateDept: string;
  Date: string;
  DepartmentId: string;
  DepartmentName: string;
  Count: number;
  NurseName: string;
  LastUpdated: string;
  UpdatedBy: string;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  color: string;
  bg: string;
  text: string;
  order?: number;
}

export interface ProductivitySummary {
  nurse: string;
  total: number;
  days: number;
  average: number;
  share: number;
}

/**
 * Normalizes timeType with memoization friendly pure function
 */
export function normalizeTimeType(evt: Partial<AbsenceRecord>): 'in' | 'out' | 'out_weekend' | 'both' {
  const timeType = (evt.TimeType || '').trim();
  if (['in', 'out', 'out_weekend', 'both'].includes(timeType)) {
    return timeType as 'in' | 'out' | 'out_weekend' | 'both';
  }
  const allDay = evt.AllDay === true || String(evt.AllDay).toLowerCase() === 'true' || (evt.AllDay as unknown as string) === 'ทั้งวัน';
  if (allDay) return 'in';
  const startTime = (evt.TimeStart || '').substring(0, 5);
  const endTime = (evt.TimeEnd || '').substring(0, 5);
  if (startTime === '16:00' && endTime === '20:00') return 'out';
  if (startTime === '08:00' && endTime === '12:00') return 'out_weekend';
  if (startTime === '08:00' && endTime === '20:00') return 'both';
  return 'in';
}

/**
 * Deduct a quota safely with boundary checking
 */
export function deductQueueQuota(
  current: number,
  max: number
): { success: boolean; newQuota: number; error?: string } {
  if (current <= 0) {
    return { success: false, newQuota: 0, error: 'คิวเต็มแล้ว ไม่สามารถตัดลดสิทธิ์คนไข้ Walk-in เพิ่มเติมได้' };
  }
  return { success: true, newQuota: current - 1 };
}

/**
 * Restore a quota safely with boundary checking
 */
export function restoreQueueQuota(
  current: number,
  max: number
): { success: boolean; newQuota: number; error?: string } {
  if (current >= max) {
    return { success: false, newQuota: current, error: 'ไม่สามารถคืนคิวได้เนื่องจากคิวเต็มตามจำนวนสูงสุดแล้ว' };
  }
  return { success: true, newQuota: current + 1 };
}

/**
 * Adjust quota with admin actions ('increment' | 'reset')
 */
export function adjustAdminQueue(
  current: number,
  max: number,
  action: 'increment' | 'reset'
): { success: boolean; newQuota: number; error?: string } {
  if (action === 'reset') {
    return { success: true, newQuota: max };
  }
  if (action === 'increment') {
    return restoreQueueQuota(current, max);
  }
  return { success: false, newQuota: current, error: 'คำสั่งปรับปรุงคิวไม่ถูกต้อง' };
}

/**
 * Categorize reasons into strategic executive buckets
 */
export function getReasonCategory(reason: string): 'emergency' | 'planned' | 'academic' {
  if (reason === 'ลาป่วย' || reason === 'เหตุสุดวิสัย' || reason === 'อื่นๆโปรดระบุ') return 'emergency';
  if (reason === 'ไปประชุม/อบรม' || reason === 'ศึกษาดูงาน') return 'academic';
  return 'planned';
}

/**
 * Check if event is critical for service delivery
 */
export function isCriticalEvent(evt: Partial<AbsenceRecord>): boolean {
  return (
    evt.Reason === 'คลินิกปิดให้บริการ' ||
    evt.Reason === 'งดรับ walk-in' ||
    evt.Reason === 'จำกัดเคส walk-in' ||
    evt.Reason === 'ระบบโควตา Walk-in'
  );
}

/**
 * Calculate nurse productivity without creating excess garbage objects
 */
export function calculateNurseProductivity(records: WalkInCountRecord[]): {
  rows: ProductivitySummary[];
  totalPatients: number;
  topNurse: string;
  topNurseCount: number;
  topNurseShare: number;
} {
  const map = new Map<string, { total: number; daysSet: Set<string> }>();
  let totalPatients = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const nurse = (r.NurseName || '').trim();
    if (!nurse) continue;
    const count = Number(r.Count) || 0;
    totalPatients += count;

    let entry = map.get(nurse);
    if (!entry) {
      entry = { total: 0, daysSet: new Set() };
      map.set(nurse, entry);
    }
    entry.total += count;
    if (r.Date) {
      entry.daysSet.add(r.Date);
    }
  }

  const rows: ProductivitySummary[] = [];
  map.forEach((value, nurse) => {
    const days = value.daysSet.size;
    const average = days > 0 ? Math.round((value.total / days) * 10) / 10 : 0;
    const share = totalPatients > 0 ? Math.round((value.total / totalPatients) * 1000) / 10 : 0;
    rows.push({ nurse, total: value.total, days, average, share });
  });

  rows.sort((a, b) => b.total - a.total);

  const top = rows[0] || { nurse: '-', total: 0, share: 0 };
  return {
    rows,
    totalPatients,
    topNurse: top.nurse,
    topNurseCount: top.total,
    topNurseShare: top.share,
  };
}

/**
 * Bangkok Operational Date Helper
 */
export function getBangkokDateParts(nowMs: number = Date.now()): { dateStr: string; hour: number } {
  const bangkokDate = new Date(nowMs + 7 * 60 * 60 * 1000);
  const year = bangkokDate.getUTCFullYear();
  const month = String(bangkokDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bangkokDate.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    hour: bangkokDate.getUTCHours(),
  };
}

export function getOperationalToday(nowMs: number = Date.now()): string {
  const { dateStr, hour } = getBangkokDateParts(nowMs);
  if (hour < 1) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    const prevY = dateObj.getUTCFullYear();
    const prevM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const prevD = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${prevY}-${prevM}-${prevD}`;
  }
  return dateStr;
}
