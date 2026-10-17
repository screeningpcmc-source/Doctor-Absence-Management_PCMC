import { HolidayItem } from '../types';
import { GOOGLE_CALENDAR_THAILAND_HOLIDAYS } from './thailandHolidaysData';

export const THAILAND_HOLIDAY_CALENDAR_ID = 'th.th#holiday@group.v.calendar.google.com';
const LOCAL_STORAGE_HOLIDAYS_KEY = 'gcal_thailand_holidays_cache';

/**
 * Returns all public holidays in Thailand based on Google Calendar (th.th#holiday@group.v.calendar.google.com).
 * Includes official public holidays and substitution days (วันหยุดชดเชย).
 */
export function getHolidays(): HolidayItem[] {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_HOLIDAYS_KEY);
    if (cached) {
      const parsed: HolidayItem[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with built-in to guarantee full coverage
        const map = new Map<string, HolidayItem>();
        for (const item of GOOGLE_CALENDAR_THAILAND_HOLIDAYS) {
          map.set(item.start, item);
        }
        for (const item of parsed) {
          map.set(item.start, item);
        }
        return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
      }
    }
  } catch (err) {
    console.warn('Failed to read cached holidays from localStorage:', err);
  }

  return GOOGLE_CALENDAR_THAILAND_HOLIDAYS;
}

/**
 * Helper to get holiday for a specific date (YYYY-MM-DD)
 */
export function getHolidayForDate(dateStr: string): HolidayItem | undefined {
  const holidays = getHolidays();
  return holidays.find((h) => h.start === dateStr);
}

/**
 * Check if a given date string (YYYY-MM-DD) is a Thailand public holiday
 */
export function isThailandHoliday(dateStr: string): boolean {
  return Boolean(getHolidayForDate(dateStr));
}

/**
 * Parse raw ICS data safely preserving multi-byte UTF-8 Thai characters
 */
export function parseGoogleCalendarICS(icsText: string): HolidayItem[] {
  // Unfold folded lines in RFC 5545 format
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: Array<{ date?: string; summary?: string; desc?: string }> = [];
  let cur: { date?: string; summary?: string; desc?: string } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
    } else if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      if (line.startsWith('DTSTART;VALUE=DATE:')) {
        cur.date = line.substring(19).trim();
      } else if (line.startsWith('SUMMARY:')) {
        cur.summary = line
          .substring(8)
          .trim()
          .replace(/\u200B/g, '')
          .replace(/วันขื้นปีใหม่/g, 'วันขึ้นปีใหม่')
          .replace(/วันหยุดชดเชยวันขื้นปีใหม่/g, 'วันหยุดชดเชยวันขึ้นปีใหม่');
      } else if (line.startsWith('DESCRIPTION:')) {
        cur.desc = line.substring(12).trim();
      }
    }
  }

  // Filter for Thailand public holidays (วันหยุดนักขัตฤกษ์)
  const publicHolidays = events.filter((e) => e.desc && e.desc.includes('วันหยุดนักขัตฤกษ์'));
  publicHolidays.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return publicHolidays
    .filter((h) => h.date && h.date.length === 8)
    .map((h, i) => {
      const d = h.date!;
      const formattedDate = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
      return {
        id: `th_gcal_${d}_${i}`,
        title: h.summary || 'วันหยุดนักขัตฤกษ์',
        start: formattedDate,
      };
    });
}

/**
 * Synchronize live holidays from Google Calendar's official Thai holiday feed
 */
export async function syncGoogleCalendarHolidays(): Promise<{ success: boolean; count: number; holidays: HolidayItem[] }> {
  try {
    // Attempt through proxy route first, then direct public URL
    const urls = [
      '/api/gcal-holidays',
      `https://calendar.google.com/calendar/ical/${encodeURIComponent(THAILAND_HOLIDAY_CALENDAR_ID)}/public/basic.ics`,
    ];

    let icsText = '';
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          icsText = await res.text();
          if (icsText && icsText.includes('BEGIN:VCALENDAR')) {
            break;
          }
        }
      } catch {
        // try next url
      }
    }

    if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
      return { success: false, count: GOOGLE_CALENDAR_THAILAND_HOLIDAYS.length, holidays: getHolidays() };
    }

    const liveHolidays = parseGoogleCalendarICS(icsText);
    if (liveHolidays.length > 0) {
      // Merge with base list
      const map = new Map<string, HolidayItem>();
      for (const item of GOOGLE_CALENDAR_THAILAND_HOLIDAYS) {
        map.set(item.start, item);
      }
      for (const item of liveHolidays) {
        map.set(item.start, item);
      }
      const merged = Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
      localStorage.setItem(LOCAL_STORAGE_HOLIDAYS_KEY, JSON.stringify(merged));
      return { success: true, count: merged.length, holidays: merged };
    }
  } catch (err) {
    console.error('Error synchronizing Google Calendar holidays:', err);
  }

  return { success: false, count: GOOGLE_CALENDAR_THAILAND_HOLIDAYS.length, holidays: getHolidays() };
}
