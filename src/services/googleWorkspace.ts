import { getAccessToken } from './auth';
import { AbsenceRecord } from '../types';

/**
 * Service for direct Google Sheets and Google Calendar API integration
 * using user-authorized OAuth tokens without server-side bottlenecks.
 */

export interface SyncStatus {
  sheetConnected: boolean;
  calendarConnected: boolean;
  lastSyncedAt?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  message?: string;
}

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
      // All day event: end date is exclusive in Google Calendar
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
