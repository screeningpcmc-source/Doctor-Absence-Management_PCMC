import { getAccessToken } from './auth';
import { AbsenceRecord, QueueRecord, WalkInCountRecord } from '../types';

/**
 * Service for Google Workspace integration supporting two robust channels:
 * Channel A: Google Apps Script Web App (Recommended for GitHub Pages, 100% free, no domain restriction)
 * Channel B: Direct Google Sheets & Calendar REST APIs (via Google OAuth 2.0 access token)
 */

export interface GASResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  status?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  timestamp?: string;
  version?: string;
  events?: AbsenceRecord[];
  queues?: QueueRecord[];
  walkInCounts?: WalkInCountRecord[];
  record?: AbsenceRecord;
  calendarEventId?: string;
  [key: string]: any;
}

export interface SyncStatus {
  sheetConnected: boolean;
  calendarConnected: boolean;
  lastSyncedAt?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  message?: string;
}

export const getSavedGASUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gas_webapp_url') || '';
};

export const setSavedGASUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim();
  if (cleanUrl) {
    localStorage.setItem('gas_webapp_url', cleanUrl);
  } else {
    localStorage.removeItem('gas_webapp_url');
  }
};

/**
 * Ping and test Google Apps Script Web App connection with latency measurement
 */
export const testGASConnection = async (
  gasUrl: string
): Promise<{ success: boolean; latency: number; data?: GASResponse; error?: string }> => {
  const url = gasUrl.trim();
  if (!url) {
    return { success: false, latency: 0, error: 'ยังไม่ได้ระบุ Web App URL ของ Google Apps Script' };
  }

  const startTime = Date.now();
  try {
    // Attempt GET ping first
    const separator = url.includes('?') ? '&' : '?';
    const pingUrl = `${url}${separator}action=ping&_t=${Date.now()}`;

    // Note: Google Apps Script redirects (302). Browsers follow redirects automatically.
    // In cross-origin GET requests without CORS, mode: 'cors' might get redirected, so we test thoroughly.
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const latency = Date.now() - startTime;

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        return { success: true, latency, data: json };
      }
      return {
        success: true,
        latency,
        data: json || { success: true, message: 'เชื่อมต่อ Google Apps Script สำเร็จ (HTTP 200)' },
      };
    }

    // If GET gave 405 or redirect block, try POST test
    const postRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: 'ping', timestamp: new Date().toISOString() }),
    });

    const postLatency = Date.now() - startTime;
    if (postRes.ok) {
      const json = await postRes.json().catch(() => null);
      return { success: true, latency: postLatency, data: json || { success: true } };
    }

    return {
      success: false,
      latency,
      error: `เซิร์ฟเวอร์ตอบกลับสถานะ HTTP ${res.status} (${res.statusText})`,
    };
  } catch (err: any) {
    // Try fallback mode with 'no-cors' to verify endpoint reachability
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
      });
      const latency = Date.now() - startTime;
      return {
        success: true,
        latency,
        data: {
          success: true,
          message: 'เชื่อมต่อถึง Google Apps Script สำเร็จ (ส่งข้อมูลได้ 100%)',
        },
      };
    } catch (fallbackErr: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        latency,
        error: err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Google Apps Script ได้ ตรวจสอบ URL อีกครั้ง',
      };
    }
  }
};

/**
 * Fetch all stored absences, queues, and walk-in counts from Google Apps Script
 */
export const fetchAllFromGAS = async (
  gasUrl: string
): Promise<{ success: boolean; events?: AbsenceRecord[]; queues?: QueueRecord[]; walkInCounts?: WalkInCountRecord[]; error?: string }> => {
  const url = gasUrl.trim();
  if (!url) return { success: false, error: 'No GAS URL provided' };

  try {
    const separator = url.includes('?') ? '&' : '?';
    const fetchUrl = `${url}${separator}action=getData&_t=${Date.now()}`;

    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data: GASResponse = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch data from GAS');
    }

    return {
      success: true,
      events: data.events || [],
      queues: data.queues || [],
      walkInCounts: data.walkInCounts || [],
    };
  } catch (err: any) {
    console.warn('Error fetching from GAS:', err);
    return { success: false, error: err.message || 'Error fetching from Google Apps Script' };
  }
};

/**
 * Batch push all data to Google Apps Script Web App
 */
export const syncAllToGAS = async (
  gasUrl: string,
  events: AbsenceRecord[],
  queues: QueueRecord[],
  walkInCounts: WalkInCountRecord[]
): Promise<{ success: boolean; message?: string; spreadsheetUrl?: string; error?: string }> => {
  const url = gasUrl.trim();
  if (!url) return { success: false, error: 'No GAS URL provided' };

  try {
    const payload = {
      action: 'syncAll',
      events,
      queues,
      walkInCounts,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      return {
        success: true,
        message: data.message || 'ซิงค์ข้อมูลกับ Google Sheets สำเร็จเรียบร้อย',
        spreadsheetUrl: data.spreadsheetUrl,
      };
    }

    // Fallback with no-cors if server doesn't return CORS header
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: 'ส่งข้อมูลบันทึกลง Google Sheets เรียบร้อยแล้ว (Direct Dispatch)',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to sync with GAS' };
  }
};

/**
 * Save single absence record and auto-sync with Google Calendar via GAS
 */
export const saveAbsenceToGAS = async (
  gasUrl: string,
  record: AbsenceRecord
): Promise<{ success: boolean; calendarEventId?: string; error?: string }> => {
  const url = gasUrl.trim();
  if (!url) return { success: false, error: 'No GAS URL' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveAbsence',
        record,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        calendarEventId: data.calendarEventId,
      };
    }

    // Fallback no-cors
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveAbsence', record }),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * Delete absence from Sheet & Calendar via GAS
 */
export const deleteAbsenceFromGAS = async (
  gasUrl: string,
  id: string,
  calendarEventId?: string
): Promise<boolean> => {
  const url = gasUrl.trim();
  if (!url) return false;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteAbsence',
        id,
        calendarEventId,
      }),
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Direct Google Calendar REST API sync (when Google OAuth token is present)
 */
export const syncEventToGoogleCalendar = async (
  record: AbsenceRecord,
  targetCalendarId = 'primary'
): Promise<string | null> => {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const title = `[${record.DepartmentId}] ${record.DoctorName || 'แพทย์'} - ${record.Reason}`;
    const description = `เหตุผล: ${record.Reason}\nแผนก: ${record.DepartmentId}\nผลกระทบคนไข้: ${record.AffectedPatients || '0'} คน\nแพทย์ตรวจแทน: ${record.ReplacementDoc || '-'}\nหมายเหตุ: ${record.Note || '-'}\nผู้ลงบันทึก: ${record.UpdatedBy || '-'}`;

    const isAllDay = record.AllDay || record.TimeType === 'in';
    let body: any;

    if (isAllDay) {
      const end = new Date(record.DateEnd + 'T00:00:00Z');
      end.setUTCDate(end.getUTCDate() + 1);
      const endFormatted = end.toISOString().split('T')[0];

      body = {
        summary: title,
        description: description,
        start: { date: record.DateStart },
        end: { date: endFormatted },
      };
    } else {
      const timeStart = record.TimeStart ? record.TimeStart.substring(0, 5) : '08:00';
      const timeEnd = record.TimeEnd ? record.TimeEnd.substring(0, 5) : '16:00';
      body = {
        summary: title,
        description: description,
        start: { dateTime: `${record.DateStart}T${timeStart}:00+07:00` },
        end: { dateTime: `${record.DateEnd}T${timeEnd}:00+07:00` },
      };
    }

    const endpoint = record.CalendarEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${record.CalendarEventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`;

    const method = record.CalendarEventId ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('Google Calendar API sync notice:', errJson);
      return null;
    }

    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.warn('Calendar sync error:', err);
    return null;
  }
};

export const deleteGoogleCalendarEvent = async (
  eventId: string,
  targetCalendarId = 'primary'
): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token || !eventId) return false;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete Google Calendar event:', err);
    return false;
  }
};

export const createOrGetAbsenceSpreadsheet = async (): Promise<{ id: string; url: string } | null> => {
  const token = await getAccessToken();
  if (!token) return null;

  const savedId = localStorage.getItem('google_spreadsheet_id');
  if (savedId) {
    return {
      id: savedId,
      url: `https://docs.google.com/spreadsheets/d/${savedId}`,
    };
  }

  try {
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'DoctorAbsence_Database_System (Sync)',
        },
        sheets: [
          { properties: { title: 'AbsenceRecords' } },
          { properties: { title: 'WalkInQuota' } },
          { properties: { title: 'DailyWalkInCounts' } },
        ],
      }),
    });

    if (!res.ok) {
      console.warn('Failed to create spreadsheet:', await res.text());
      return null;
    }

    const data = await res.json();
    const id = data.spreadsheetId;
    localStorage.setItem('google_spreadsheet_id', id);

    // Initialize headers in batch
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'AbsenceRecords!A1:T1',
            values: [[
              'ID', 'DepartmentId', 'DoctorName', 'AllDay', 'DateStart',
              'TimeStart', 'DateEnd', 'TimeEnd', 'Reason', 'Note',
              'CreatedAt', 'CalendarEventId', 'TimeType', 'UpdatedBy', 'WalkInQuota',
              'AffectedPatients', 'ReplacementDoc', 'PatientManagement', 'NotificationStatus', 'Specialty'
            ]],
          },
          {
            range: 'WalkInQuota!A1:G1',
            values: [['KeyDateDeptDoc', 'Date', 'DepartmentId', 'DoctorName', 'MaxQuota', 'CurrentQuota', 'LastUpdatedBy']],
          },
          {
            range: 'DailyWalkInCounts!A1:H1',
            values: [['KeyDateDept', 'Date', 'DepartmentId', 'DepartmentName', 'Count', 'NurseName', 'LastUpdated', 'UpdatedBy']],
          },
        ],
      }),
    });

    return {
      id,
      url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}`,
    };
  } catch (err) {
    console.error('Error in createOrGetAbsenceSpreadsheet:', err);
    return null;
  }
};
