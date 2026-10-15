export interface Department {
  id: string;
  name: string;
  color: string;
  bg: string;
  text: string;
  order: number;
}

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

export interface HolidayItem {
  id: string;
  title: string;
  start: string;
}
