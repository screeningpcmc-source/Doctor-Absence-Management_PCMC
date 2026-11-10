import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  AlertCircle,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Smile,
  Filter,
  Calendar,
  ClipboardList,
} from 'lucide-react';
import { AbsenceRecord, Department, QueueRecord, HolidayItem } from '../types';
import { normalizeTimeType, normalizeDoctorName } from '../utils/absence-logic';

interface CalendarViewProps {
  events: AbsenceRecord[];
  departments: Department[];
  deptMap: Map<string, Department>;
  queues: QueueRecord[];
  holidays: HolidayItem[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onOpenEventDetail: (event: AbsenceRecord) => void;
  onDeductQueue: (date: string, deptId: string, doctorName: string) => void;
  onRestoreQueue: (date: string, deptId: string, doctorName: string) => void;
  onCancelQueue?: (date: string, deptId: string, doctorName: string) => void;
  authPin: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  departments,
  deptMap,
  queues,
  holidays,
  selectedDate,
  onSelectDate,
  onOpenEventDetail,
  onDeductQueue,
  onRestoreQueue,
}) => {
  // Mobile / Tablet Tab view mode: defaults to 'agenda-quota' so daily agenda and doctor quotas appear first
  const [mobileTab, setMobileTab] = useState<'agenda-quota' | 'calendar'>('agenda-quota');

  // Calendar navigation state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d || 1);
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleTodayClick = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    onSelectDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  // Day navigation for Mobile/Tablet
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 1);
    const py = dt.getFullYear();
    const pm = String(dt.getMonth() + 1).padStart(2, '0');
    const pd = String(dt.getDate()).padStart(2, '0');
    const newDate = `${py}-${pm}-${pd}`;
    onSelectDate(newDate);
    if (dt.getMonth() !== month || dt.getFullYear() !== year) {
      setCurrentMonthDate(new Date(py, dt.getMonth(), 1));
    }
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    const newDate = `${ny}-${nm}-${nd}`;
    onSelectDate(newDate);
    if (dt.getMonth() !== month || dt.getFullYear() !== year) {
      setCurrentMonthDate(new Date(ny, dt.getMonth(), 1));
    }
  };

  // Build grid days for the month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSat: boolean;
      isSun: boolean;
    }> = [];

    const pad = (n: number) => String(n).padStart(2, '0');

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevLastDate - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(d)}`;
      const dayOfWeek = new Date(prevY, prevM - 1, d).getDay();
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isSat: dayOfWeek === 6,
        isSun: dayOfWeek === 0,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isSat: dayOfWeek === 6,
        isSun: dayOfWeek === 0,
      });
    }

    // Next month padding to reach multiple of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${pad(nextM)}-${pad(d)}`;
      const dayOfWeek = new Date(nextY, nextM - 1, d).getDay();
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isSat: dayOfWeek === 6,
        isSun: dayOfWeek === 0,
      });
    }

    return days;
  }, [year, month]);

  // Department filter state
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Filtered events based on department selection
  const filteredEventsForCalendar = useMemo(() => {
    if (selectedDeptFilter === 'all') return events;
    return events.filter((e) => e.DepartmentId === selectedDeptFilter);
  }, [events, selectedDeptFilter]);

  // Index events by date for O(1) cell lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AbsenceRecord[]>();
    for (const evt of filteredEventsForCalendar) {
      const start = evt.DateStart;
      const end = evt.DateEnd || evt.DateStart;
      const [sy, sm, sd] = start.split('-').map(Number);
      const [ey, em, ed] = end.split('-').map(Number);
      const cur = new Date(Date.UTC(sy, sm - 1, sd));
      const stop = new Date(Date.UTC(ey, em - 1, ed));

      while (cur <= stop) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cur.getUTCDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        let list = map.get(key);
        if (!list) {
          list = [];
          map.set(key, list);
        }
        list.push(evt);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    return map;
  }, [filteredEventsForCalendar]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HolidayItem>();
    for (const h of holidays) {
      map.set(h.start, h);
    }
    return map;
  }, [holidays]);

  // Active queues for selectedDate (Strict de-duplication to prevent duplicate cards + auto-include doctor walk-in restrictions from events)
  const activeQueues = useMemo(() => {
    const map = new Map<string, QueueRecord>();

    // 1. Add explicitly recorded queues for selectedDate
    for (const q of queues) {
      if (q.Date !== selectedDate) continue;
      if (selectedDeptFilter !== 'all' && q.DepartmentId !== selectedDeptFilter) continue;
      const key = `${q.Date}_${q.DepartmentId}_${normalizeDoctorName(q.DoctorName)}`;
      if (!map.has(key)) {
        map.set(key, q);
      } else {
        const existing = map.get(key)!;
        if (q.CurrentQuota < existing.CurrentQuota) {
          map.set(key, q);
        } else if (existing.CurrentQuota < q.CurrentQuota) {
          // keep existing with counted quota
        } else if (q.MaxQuota > existing.MaxQuota) {
          map.set(key, q);
        }
      }
    }

    // 2. Also ensure every doctor/department event on selectedDate with a walk-in quota limit is represented
    for (const evt of events) {
      const inRange = evt.DateStart <= selectedDate && (evt.DateEnd || evt.DateStart) >= selectedDate;
      if (!inRange) continue;
      if (selectedDeptFilter !== 'all' && evt.DepartmentId !== selectedDeptFilter) continue;

      const isWalkIn =
        evt.Reason === 'จำกัดเคส walk-in' ||
        evt.Reason === 'ระบบโควตา Walk-in' ||
        Boolean(evt.WalkInQuota && Number(evt.WalkInQuota) > 0);
      if (!isWalkIn) continue;

      const normDoc = normalizeDoctorName(evt.DoctorName);
      const key = `${selectedDate}_${evt.DepartmentId}_${normDoc}`;

      if (!map.has(key)) {
        const quotaLimit =
          evt.WalkInQuota && Number(evt.WalkInQuota) > 0 ? Number(evt.WalkInQuota) : 8;
        map.set(key, {
          KeyDateDeptDoc: key,
          Date: selectedDate,
          DepartmentId: evt.DepartmentId,
          DoctorName: evt.DoctorName || '-',
          MaxQuota: quotaLimit,
          CurrentQuota: quotaLimit,
          LastUpdatedBy: evt.UpdatedBy || 'ระบบโควตา',
        });
      }
    }

    return Array.from(map.values());
  }, [queues, selectedDate, selectedDeptFilter, events]);

  // Fallback departments to show in queue bar
  const defaultTrackedDeptIds = ['internal', 'surgery', 'pediatric', 'obs', 'ortho', 'cardio'];

  // Events on selectedDate filtered by department
  const agendaEvents = useMemo(() => {
    return events.filter((e) => {
      const inRange = e.DateStart <= selectedDate && (e.DateEnd || e.DateStart) >= selectedDate;
      if (!inRange) return false;
      if (selectedDeptFilter !== 'all' && e.DepartmentId !== selectedDeptFilter) return false;
      return true;
    });
  }, [events, selectedDate, selectedDeptFilter]);

  const monthNamesThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '';
    const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const [y, mon, d] = dStr.split('-').map(Number);
    return `${d} ${m[mon - 1]} ${y + 543}`;
  };

  const getThaiDayOfWeek = (dStr: string) => {
    if (!dStr) return '';
    const [y, mon, d] = dStr.split('-').map(Number);
    const dt = new Date(y, mon - 1, d);
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    return days[dt.getDay()];
  };

  // Helper renderer for Quota Cards
  const renderQuotaCard = (q: QueueRecord, isMobileGrid?: boolean) => {
    const dpt = deptMap.get(q.DepartmentId) || {
      name: q.DepartmentId,
      color: '#0d9488',
      bg: '#f0fdfa',
      text: '#0f766e',
    };
    const currentQ = q.CurrentQuota;
    const docLabel =
      q.DoctorName && q.DoctorName.trim() !== '' && q.DoctorName !== '-'
        ? q.DoctorName
        : `ระดับแผนก (${dpt.name})`;

    const matchingEvt = events.find((e) => {
      const inRange = e.DateStart <= q.Date && (e.DateEnd || e.DateStart) >= q.Date;
      const sameDept = e.DepartmentId === q.DepartmentId;
      const sameDoc =
        !q.DoctorName ||
        q.DoctorName === '-' ||
        normalizeDoctorName(e.DoctorName) === normalizeDoctorName(q.DoctorName);
      return inRange && sameDept && sameDoc;
    });

    const deptDisplayLabel =
      matchingEvt?.Specialty && matchingEvt.Specialty !== 'ทั่วไป'
        ? `${dpt.name}-${matchingEvt.Specialty}`
        : dpt.name;

    return (
      <div
        key={q.KeyDateDeptDoc}
        className={`w-full border border-teal-200 bg-gradient-to-b from-teal-50/50 to-white shadow-2xs rounded-xl p-2.5 flex flex-col items-center justify-between text-center select-none hover:border-teal-400 hover:shadow-xs transition-all relative group ${
          isMobileGrid ? 'min-h-[140px]' : ''
        }`}
      >
        <div
          onClick={() => matchingEvt && onOpenEventDetail(matchingEvt)}
          className="text-[11px] font-bold w-full py-0.5 rounded px-1.5 truncate text-center cursor-pointer hover:opacity-90 shadow-2xs mb-1"
          style={{ backgroundColor: dpt.bg, color: dpt.text }}
          title={matchingEvt ? 'คลิกดูรายละเอียดรายการ' : deptDisplayLabel}
        >
          {deptDisplayLabel}
        </div>

        <div
          onClick={() => matchingEvt && onOpenEventDetail(matchingEvt)}
          className="text-[11px] text-slate-700 font-semibold truncate max-w-full my-0.5 cursor-pointer hover:text-teal-700"
          title={`${docLabel} ${matchingEvt ? '(คลิกดูรายละเอียด)' : ''}`}
        >
          {docLabel}
        </div>

        <div className="flex items-center justify-center gap-2.5 my-1.5">
          <button
            onClick={() => onDeductQueue(q.Date, q.DepartmentId, q.DoctorName)}
            className={`text-3xl font-black tracking-tight leading-none transition-transform active:scale-95 cursor-pointer ${
              currentQ === 0 ? 'text-rose-500' : 'text-teal-700 hover:text-teal-800'
            }`}
            title="คลิกเพื่อตัดหักยอดคิว (-1)"
          >
            {currentQ}
          </button>
          <button
            onClick={() => onRestoreQueue(q.Date, q.DepartmentId, q.DoctorName)}
            className="w-7 h-7 flex items-center justify-center bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 rounded-md hover:border-teal-300 font-bold active:scale-95 shadow-2xs cursor-pointer transition-all"
            title="คืนคิว (+1)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full flex items-center justify-center pt-1 border-t border-teal-100/60 mt-1">
          <span className="text-[10px] font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full">
            จำกัด: {q.MaxQuota} คิว
          </span>
        </div>
      </div>
    );
  };

  // Helper renderer for Agenda Event Cards
  const renderAgendaCard = (evt: AbsenceRecord) => {
    const dpt = deptMap.get(evt.DepartmentId) || {
      name: evt.DepartmentId,
      color: '#64748b',
      bg: '#f8fafc',
      text: '#334155',
    };

    const specLabel = evt.Specialty && evt.Specialty !== 'ทั่วไป' && evt.Specialty !== '-' ? `-${evt.Specialty}` : '';
    const deptDisplayName = `${dpt.name}${specLabel}`;
    const shift = normalizeTimeType(evt);
    const shiftLabel =
      shift === 'out'
        ? 'นอกเวลา 16:00-20:00'
        : shift === 'out_weekend'
        ? 'นอกเวลา ส.-อ. 8:00-12:00'
        : shift === 'both'
        ? 'ใน/นอกเวลา 8:00-20:00'
        : 'ในเวลา 8:00-16:00';

    return (
      <div
        key={evt.ID}
        onClick={() => onOpenEventDetail(evt)}
        className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs relative overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all select-none"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: dpt.color }}></div>

        <div className="pl-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: dpt.bg, color: dpt.text }}
            >
              {deptDisplayName}
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> {shiftLabel}
            </span>
          </div>

          <div className="font-bold text-slate-800 text-sm leading-tight">
            {evt.Reason === 'คลินิกปิดให้บริการ'
              ? evt.Reason
              : evt.DoctorName && evt.DoctorName.trim() !== '' && evt.DoctorName !== '-'
              ? evt.DoctorName
              : `โควตา Walk-in แผนก${dpt.name}`}
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">เหตุผล:</span>
            <span className="font-semibold text-slate-700">{evt.Reason}</span>
          </div>

          {Boolean(evt.WalkInQuota && Number(evt.WalkInQuota) > 0) && (
            <div className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 w-fit flex items-center gap-1.5 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>โควตา Walk-in: {evt.WalkInQuota} เคส</span>
            </div>
          )}

          {evt.Note && (
            <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 truncate flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{evt.Note}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full h-full bg-slate-50">
      {/* =========================================================================
          📱 TABLET & MOBILE VIEW (< lg: 0px - 1023px)
          Designed specifically to show:
          1. รายการประจำวัน & โควตาคิวแพทย์ FIRST (by default on mobile & tablet)
          2. Easy Day-by-Day navigator (< วันก่อน, วันถัดไป >, วันนี้, date picker)
          3. Quick switcher to full monthly calendar grid whenever needed
          ========================================================================= */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden w-full h-full bg-slate-50">
        {/* Top Mobile/Tablet Mode Switcher */}
        <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-lg mx-auto shadow-inner">
            <button
              onClick={() => setMobileTab('agenda-quota')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mobileTab === 'agenda-quota'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
              <span>รายการประจำวัน & โควตา</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  mobileTab === 'agenda-quota'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {agendaEvents.length}
              </span>
            </button>
            <button
              onClick={() => setMobileTab('calendar')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mobileTab === 'calendar'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>ปฏิทินทั้งเดือน</span>
            </button>
          </div>
        </div>

        {/* Selected Date Navigator Bar (Always visible on mobile & tablet for instant day hopping) */}
        <div className="bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
              title="วันถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleTodayClick}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 active:scale-95 cursor-pointer"
            >
              วันนี้
            </button>
            <div className="ml-1">
              <span className="text-xs font-black text-slate-800 block leading-tight">
                {formatThaiDate(selectedDate)}
              </span>
              <span className="text-[10px] text-teal-700 font-semibold block leading-none mt-0.5">
                {getThaiDayOfWeek(selectedDate)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Native Date Picker button */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectDate(e.target.value);
                    const [y, m] = e.target.value.split('-').map(Number);
                    setCurrentMonthDate(new Date(y, m - 1, 1));
                  }
                }}
                className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer z-10"
                title="เลือกวันที่จากปฏิทินย่อ"
              />
              <div className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                <CalendarDays className="w-4 h-4 text-teal-600" />
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-700 outline-none max-w-[130px] sm:max-w-[160px] truncate cursor-pointer"
              >
                <option value="all">ทุกแผนก</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Public Holiday Banner for Selected Date */}
        {holidaysByDate.get(selectedDate) && (
          <div
            className="bg-rose-50 border-b border-rose-200 px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs text-rose-800 font-bold shrink-0 shadow-2xs"
            title="วันหยุดนักขัตฤกษ์ตาม Google Calendar ประเทศไทย"
          >
            <span>🎌</span>
            <span className="truncate">{holidaysByDate.get(selectedDate)!.title}</span>
            <span className="text-[10px] text-rose-600 font-normal hidden sm:inline">(Google Calendar ไทย)</span>
          </div>
        )}

        {/* TAB 1: AGENDA & QUOTA VIEW (DEFAULT on Tablet & Mobile) */}
        {mobileTab === 'agenda-quota' && (
          <div className="flex-1 overflow-y-auto p-3 bg-slate-50/70">
            {/* Tablet Layout (md breakpoint 768px-1023px): Two balanced columns */}
            {/* Mobile Layout (< 768px): Stacked sections */}
            <div className="flex flex-col md:flex-row md:items-start gap-4 max-w-5xl mx-auto">
              {/* Column 1: โควตาคิวแพทย์/หน่วย (Doctor Quotas) */}
              <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      โควตาคิวแพทย์ / หน่วยตรวจ
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    {activeQueues.length} คิว
                  </span>
                </div>

                {activeQueues.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400">
                    <Smile className="w-7 h-7 mx-auto mb-1 text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">ไม่มีรายการจำกัดโควตาในวันนี้</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">คลินิกและแพทย์ออกตรวจเปิดรับคิวปกติ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-1 gap-2.5">
                    {activeQueues.map((q) => renderQuotaCard(q, true))}
                  </div>
                )}

                {/* Fallback Tracked Departments Summary */}
                <div className="pt-1">
                  <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <summary className="text-[11px] font-bold text-slate-600 hover:text-slate-800 cursor-pointer list-none flex items-center justify-between p-2.5 bg-slate-50/50 group-open:border-b group-open:border-slate-100">
                      <span>สถานะแผนกทั่วไป (เปิดปกติ)</span>
                      <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform text-slate-400" />
                    </summary>
                    <div className="p-2.5 grid grid-cols-2 gap-2 bg-white">
                      {defaultTrackedDeptIds.map((deptId) => {
                        if (activeQueues.some((q) => q.DepartmentId === deptId)) return null;
                        const dpt = deptMap.get(deptId);
                        if (!dpt) return null;
                        return (
                          <div
                            key={deptId}
                            className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center text-[10px]"
                          >
                            <div className="font-bold truncate" style={{ color: dpt.text }}>
                              {dpt.name}
                            </div>
                            <div className="text-emerald-700 font-bold mt-0.5">เปิดปกติ</div>
                            <div className="text-[9px] text-slate-400">โควตา: ไม่จำกัด</div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>

              {/* Column 2: รายการแพทย์งดออกตรวจประจำวัน (Daily Absence Agenda) */}
              <div className="w-full flex-1 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      รายการแพทย์งดออกตรวจประจำวัน
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {agendaEvents.length} รายการ
                  </span>
                </div>

                {agendaEvents.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-2xs">
                    {holidaysByDate.get(selectedDate) ? (
                      <>
                        <div className="text-3xl mb-2">🎌</div>
                        <p className="text-xs font-bold text-rose-700">
                          วันหยุดนักขัตฤกษ์ (Google Calendar ไทย)
                        </p>
                        <p className="text-sm font-black text-rose-900 mt-1">
                          {holidaysByDate.get(selectedDate)!.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-[260px] mx-auto">
                          วันหยุดราชการตามปฏิทิน Google Calendar / แผนกเปิดตรวจตามเวรวันหยุด
                        </p>
                      </>
                    ) : (
                      <>
                        <Smile className="w-10 h-10 mb-2 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">
                          {selectedDeptFilter !== 'all'
                            ? `ไม่มีรายงานแพทย์งดออกตรวจของแผนก ${deptMap.get(selectedDeptFilter)?.name || ''}`
                            : 'คลินิกเปิดทำการตามปกติ'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedDeptFilter !== 'all'
                            ? 'ในวันที่เลือกนี้เปิดให้บริการตามปกติ'
                            : 'ไม่มีรายงานแพทย์งดออกตรวจในวันนี้'}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {agendaEvents.map((evt) => renderAgendaCard(evt))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FULL MONTH CALENDAR GRID (For Mobile/Tablet) */}
        {mobileTab === 'calendar' && (
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto flex flex-col">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 sm:p-3 flex flex-col flex-1">
              {/* Calendar Toolbar */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
                    title="เดือนก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
                    title="เดือนถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleTodayClick}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    วันนี้
                  </button>
                </div>

                <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight text-center">
                  {monthNamesThai[month]} {year + 543}
                </h2>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 py-1 border-b border-slate-100 shrink-0">
                <div className="text-rose-500">อา.</div>
                <div>จ.</div>
                <div>อ.</div>
                <div>พ.</div>
                <div>พฤ.</div>
                <div>ศ.</div>
                <div className="text-indigo-500">ส.</div>
              </div>

              {/* Monthly Days Grid */}
              <div className="grid grid-cols-7 gap-1 flex-1 py-1">
                {calendarDays.map((cell) => {
                  const dayEvents = eventsByDate.get(cell.dateStr) || [];
                  const holiday = holidaysByDate.get(cell.dateStr);
                  const isSelected = cell.dateStr === selectedDate;
                  const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => {
                        onSelectDate(cell.dateStr);
                      }}
                      className={`min-h-[56px] sm:min-h-[70px] p-1 rounded-lg border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-200'
                          : holiday
                          ? 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/60'
                          : cell.isCurrentMonth
                          ? 'border-slate-150 bg-white hover:bg-slate-50'
                          : 'border-slate-100 bg-slate-50/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between leading-none">
                        <span
                          className={`text-xs font-black rounded-full w-5 h-5 flex items-center justify-center ${
                            isToday
                              ? 'bg-teal-600 text-white'
                              : isSelected
                              ? 'bg-teal-100 text-teal-800 font-black'
                              : holiday
                              ? 'text-rose-600 font-black'
                              : cell.isSun
                              ? 'text-rose-500'
                              : cell.isSat
                              ? 'text-indigo-500'
                              : cell.isCurrentMonth
                              ? 'text-slate-700'
                              : 'text-slate-300'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {holiday && (
                          <span className="text-[10px]" title={holiday.title}>
                            🎌
                          </span>
                        )}
                      </div>

                      {/* Day Badges count */}
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 1).map((evt) => {
                          const dpt = deptMap.get(evt.DepartmentId) || { bg: '#f1f5f9', text: '#334155' };
                          const hasDoc = evt.DoctorName && evt.DoctorName !== '-';
                          const label = hasDoc ? evt.DoctorName : evt.Reason;
                          return (
                            <div
                              key={evt.ID}
                              className="text-[9px] font-bold px-1 py-0.2 rounded truncate"
                              style={{ backgroundColor: dpt.bg, color: dpt.text }}
                            >
                              {label}
                            </div>
                          );
                        })}
                        {dayEvents.length > 1 && (
                          <div className="text-[8px] text-slate-500 font-bold leading-none pl-0.5">
                            +{dayEvents.length - 1} รายการ
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Docked Quick Action for Selected Date */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-teal-50/50 p-2 rounded-xl border border-teal-100">
                <div className="truncate">
                  <span className="text-xs font-black text-slate-800 block truncate">
                    {formatThaiDate(selectedDate)}
                  </span>
                  <span className="text-[10px] text-teal-700 font-bold">
                    {agendaEvents.length} รายการงด · {activeQueues.length} โควตา
                  </span>
                </div>
                <button
                  onClick={() => setMobileTab('agenda-quota')}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1"
                >
                  <span>ดูรายการวันนี้</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          🖥️ DESKTOP / PC VIEW (>= lg: 1024px and wider)
          100% UNCHANGED AND IDENTICAL to the original PC design.
          Preserves the exact 3-column layout:
          Left (โควตาคิวแพทย์ 200px) + Center (ปฏิทิน 1 เดือน) + Right (รายการประจำวัน 340px)
          ========================================================================= */}
      <div className="hidden lg:flex flex-1 overflow-hidden w-full h-full bg-slate-50">
        {/* 1. LEFT SIDEBAR: QUEUE COUNTERS */}
        <div className="w-[200px] border-r border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-xs overflow-y-auto p-3">
          <div className="text-center pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">โควตาคิวแพทย์/หน่วย</div>
            <div className="text-[10px] text-teal-700 font-semibold mt-0.5">{formatThaiDate(selectedDate)}</div>
            {holidaysByDate.get(selectedDate) && (
              <div
                className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded border border-rose-200 mt-1 inline-block text-center max-w-full truncate shadow-2xs"
                title={`วันหยุดนักขัตฤกษ์ตาม Google Calendar: ${holidaysByDate.get(selectedDate)!.title}`}
              >
                🎌 {holidaysByDate.get(selectedDate)!.title}
              </div>
            )}
          </div>

          <div className="space-y-3 flex flex-col items-center w-full">
            {activeQueues.map((q) => {
              const dpt = deptMap.get(q.DepartmentId) || {
                name: q.DepartmentId,
                color: '#0d9488',
                bg: '#f0fdfa',
                text: '#0f766e',
              };
              const currentQ = q.CurrentQuota;
              const docLabel =
                q.DoctorName && q.DoctorName.trim() !== '' && q.DoctorName !== '-'
                  ? q.DoctorName
                  : `ระดับแผนก (${dpt.name})`;

              const matchingEvt = events.find((e) => {
                const inRange = e.DateStart <= q.Date && (e.DateEnd || e.DateStart) >= q.Date;
                const sameDept = e.DepartmentId === q.DepartmentId;
                const sameDoc =
                  !q.DoctorName ||
                  q.DoctorName === '-' ||
                  normalizeDoctorName(e.DoctorName) === normalizeDoctorName(q.DoctorName);
                return inRange && sameDept && sameDoc;
              });

              const deptDisplayLabel =
                matchingEvt?.Specialty && matchingEvt.Specialty !== 'ทั่วไป'
                  ? `${dpt.name}-${matchingEvt.Specialty}`
                  : dpt.name;

              return (
                <div
                  key={q.KeyDateDeptDoc}
                  className="w-full border border-teal-200 bg-gradient-to-b from-teal-50/50 to-white shadow-2xs rounded-xl p-2.5 flex flex-col items-center justify-between text-center select-none hover:border-teal-400 hover:shadow-xs transition-all relative group"
                >
                  <div
                    onClick={() => matchingEvt && onOpenEventDetail(matchingEvt)}
                    className="text-[11px] font-bold w-full py-0.5 rounded px-2 truncate text-center cursor-pointer hover:opacity-90 shadow-2xs mb-1"
                    style={{ backgroundColor: dpt.bg, color: dpt.text }}
                    title={matchingEvt ? 'คลิกดูรายละเอียดรายการ' : deptDisplayLabel}
                  >
                    {deptDisplayLabel}
                  </div>

                  <div
                    onClick={() => matchingEvt && onOpenEventDetail(matchingEvt)}
                    className="text-[11px] text-slate-700 font-semibold truncate max-w-full my-0.5 cursor-pointer hover:text-teal-700"
                    title={`${docLabel} ${matchingEvt ? '(คลิกดูรายละเอียด)' : ''}`}
                  >
                    {docLabel}
                  </div>

                  <div className="flex items-center justify-center gap-2.5 my-1.5">
                    <button
                      onClick={() => onDeductQueue(q.Date, q.DepartmentId, q.DoctorName)}
                      className={`text-3xl font-black tracking-tight leading-none transition-transform active:scale-95 cursor-pointer ${
                        currentQ === 0 ? 'text-rose-500' : 'text-teal-700 hover:text-teal-800'
                      }`}
                      title="คลิกเพื่อตัดหักยอดคิว (-1)"
                    >
                      {currentQ}
                    </button>
                    <button
                      onClick={() => onRestoreQueue(q.Date, q.DepartmentId, q.DoctorName)}
                      className="w-6 h-6 flex items-center justify-center bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 rounded-md hover:border-teal-300 font-bold active:scale-95 shadow-2xs cursor-pointer transition-all"
                      title="คืนคิว (+1)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-center pt-1 border-t border-teal-100/60 mt-1">
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100/70 px-2.5 py-0.5 rounded-full">
                      จำกัด: {q.MaxQuota} คิว
                    </span>
                  </div>
                </div>
              );
            })}

            {defaultTrackedDeptIds.map((deptId) => {
              if (activeQueues.some((q) => q.DepartmentId === deptId)) return null;
              const dpt = deptMap.get(deptId);
              if (!dpt) return null;

              return (
                <div
                  key={deptId}
                  className="w-full border border-slate-200 bg-white shadow-2xs rounded-xl p-2.5 flex flex-col items-center justify-between text-center select-none hover:border-slate-300 transition-all"
                >
                  <div
                    className="text-[11px] font-bold w-full py-0.5 rounded px-1 truncate"
                    style={{ backgroundColor: dpt.bg, color: dpt.text }}
                  >
                    {dpt.name}
                  </div>
                  <div className="text-xs font-bold text-emerald-700 my-2 py-0.5 px-2 bg-emerald-50 rounded-full border border-emerald-100">
                    เปิดปกติ
                  </div>
                  <div className="text-[9px] text-slate-400">โควตา: ไม่จำกัด</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. CENTER: MONTHLY CALENDAR GRID */}
        <div className="flex-1 h-full p-2 md:p-3 overflow-hidden flex flex-col">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 flex-1 p-3 flex flex-col overflow-hidden">
            {/* Calendar Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 mb-3 shrink-0">
              {/* Left: Month Navigation */}
              <div className="flex items-center gap-2 justify-start">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="เดือนถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleTodayClick}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  วันนี้
                </button>
              </div>

              {/* Center: Month Name + Google Calendar Badge */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight">
                    {monthNamesThai[month]} {year + 543}
                  </h2>
                  <span
                    className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs"
                    title="ข้อมูลวันหยุดนักขัตฤกษ์อ้างอิงตาม Google Calendar ประเทศไทย"
                  >
                    <span>🎌</span>
                    <span className="hidden xl:inline">วันหยุดตาม</span> Google Calendar
                  </span>
                </div>
              </div>

              {/* Right: Department Filter */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">แผนก:</span>
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="all">ทั้งหมด ทุกแผนก</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 gap-1.5 text-center font-bold text-xs text-slate-500 py-1.5 border-b border-slate-100 shrink-0">
              <div className="text-rose-500">อา.</div>
              <div>จ.</div>
              <div>อ.</div>
              <div>พ.</div>
              <div>พฤ.</div>
              <div>ศ.</div>
              <div className="text-indigo-500">ส.</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 flex-1 overflow-y-auto py-1">
              {calendarDays.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];
                const holiday = holidaysByDate.get(cell.dateStr);
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => onSelectDate(cell.dateStr)}
                    className={`min-h-[70px] p-1.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-200'
                        : holiday
                        ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 shadow-2xs'
                        : cell.isCurrentMonth
                        ? 'border-slate-200 bg-white hover:border-teal-300'
                        : 'border-slate-100 bg-slate-50/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between leading-none">
                      <span
                        className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                          isToday
                            ? 'bg-teal-600 text-white'
                            : isSelected
                            ? 'bg-teal-100 text-teal-800'
                            : holiday
                            ? 'text-rose-700 font-black'
                            : cell.isSun
                            ? 'text-rose-500'
                            : cell.isSat
                            ? 'text-indigo-500'
                            : cell.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Public Holiday Indicator */}
                      {holiday && (
                        <span
                          className="text-[9px] font-bold text-rose-700 bg-rose-100/90 border border-rose-200/80 px-1 py-0.5 rounded truncate max-w-[95px] flex items-center gap-0.5 shadow-2xs"
                          title={`วันหยุดตาม Google Calendar: ${holiday.title}`}
                        >
                          <span className="shrink-0">🎌</span>
                          <span className="truncate">{holiday.title}</span>
                        </span>
                      )}
                    </div>

                    {/* Badges for events on this day */}
                    <div className="space-y-1 mt-1 overflow-hidden flex-1">
                      {dayEvents
                        .slice()
                        .sort((a, b) => {
                          const aWalk =
                            a.Reason === 'จำกัดเคส walk-in' ||
                            a.Reason === 'ระบบโควตา Walk-in' ||
                            Boolean(a.WalkInQuota && Number(a.WalkInQuota) > 0);
                          const bWalk =
                            b.Reason === 'จำกัดเคส walk-in' ||
                            b.Reason === 'ระบบโควตา Walk-in' ||
                            Boolean(b.WalkInQuota && Number(b.WalkInQuota) > 0);
                          if (aWalk && !bWalk) return -1;
                          if (!aWalk && bWalk) return 1;
                          return 0;
                        })
                        .slice(0, 3)
                        .map((evt) => {
                          const dpt = deptMap.get(evt.DepartmentId) || {
                            name: evt.DepartmentId,
                            bg: '#f1f5f9',
                            text: '#334155',
                          };
                          const hasDoc = evt.DoctorName && evt.DoctorName.trim() !== '' && evt.DoctorName !== '-';
                          const isWalkIn =
                            evt.Reason === 'จำกัดเคส walk-in' ||
                            evt.Reason === 'ระบบโควตา Walk-in' ||
                            Boolean(evt.WalkInQuota && Number(evt.WalkInQuota) > 0);
                          const label =
                            evt.Reason === 'คลินิกปิดให้บริการ'
                              ? `[ปิด] ${dpt.name}`
                              : isWalkIn
                              ? `[Q] ${hasDoc ? evt.DoctorName : dpt.name}`
                              : hasDoc
                              ? evt.DoctorName
                              : dpt.name;

                          return (
                            <div
                              key={evt.ID}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEventDetail(evt);
                              }}
                              className="text-[10px] font-semibold px-1 py-0.5 rounded truncate transition-opacity hover:opacity-80"
                              style={{ backgroundColor: dpt.bg, color: dpt.text }}
                              title={`${dpt.name}: ${label} (${evt.Reason})`}
                            >
                              {label}
                            </div>
                          );
                        })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-slate-500 font-bold pl-0.5">
                          +{dayEvents.length - 3} รายการ
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. RIGHT SIDEBAR: AGENDA OF SELECTED DATE */}
        <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col shrink-0 h-full shadow-xs z-10">
          <div className="bg-slate-50 border-b border-slate-100 p-3 text-center">
            <h3 className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 uppercase tracking-wider">
              <CalendarDays className="w-3.5 h-3.5 text-teal-600" /> รายการประจำวัน
            </h3>
            <div className="text-teal-800 font-bold text-xs bg-teal-50 px-3 py-1 rounded-full mt-1.5 border border-teal-100 inline-block">
              {formatThaiDate(selectedDate)}
            </div>
            {holidaysByDate.get(selectedDate) && (
              <div
                className="mt-2 flex items-center justify-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs"
                title="วันหยุดนักขัตฤกษ์ตาม Google Calendar ประเทศไทย"
              >
                <span>🎌</span>
                <span className="truncate">{holidaysByDate.get(selectedDate)!.title}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
            {selectedDeptFilter !== 'all' && (
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-800 mb-2">
                <span className="flex items-center gap-1 truncate">
                  <Filter className="w-3 h-3 text-teal-600 shrink-0" />
                  <span className="truncate">เฉพาะ: {deptMap.get(selectedDeptFilter)?.name || selectedDeptFilter}</span>
                </span>
                <button
                  onClick={() => setSelectedDeptFilter('all')}
                  className="text-[10px] text-rose-600 hover:text-rose-700 underline font-bold shrink-0 ml-1 cursor-pointer"
                >
                  ดูทั้งหมด
                </button>
              </div>
            )}

            {agendaEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center mt-12">
                {holidaysByDate.get(selectedDate) ? (
                  <>
                    <div className="text-3xl mb-2">🎌</div>
                    <p className="text-xs font-bold text-rose-700">
                      วันหยุดนักขัตฤกษ์ (Google Calendar ไทย)
                    </p>
                    <p className="text-sm font-black text-rose-900 mt-1">
                      {holidaysByDate.get(selectedDate)!.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                      วันหยุดราชการตามปฏิทิน Google Calendar / แผนกเปิดตรวจตามเวรวันหยุด
                    </p>
                  </>
                ) : (
                  <>
                    <Smile className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">
                      {selectedDeptFilter !== 'all'
                        ? `ไม่มีรายงานแพทย์งดออกตรวจของแผนก ${deptMap.get(selectedDeptFilter)?.name || ''}`
                        : 'คลินิกเปิดทำการตามปกติ'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedDeptFilter !== 'all'
                        ? 'ในวันที่เลือกนี้เปิดให้บริการตามปกติ'
                        : 'ไม่มีรายงานแพทย์งดออกตรวจในวันนี้'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              agendaEvents.map((evt) => renderAgendaCard(evt))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
