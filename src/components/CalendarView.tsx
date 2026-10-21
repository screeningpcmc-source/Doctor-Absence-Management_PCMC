import React, { useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  AlertCircle,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Smile,
  Filter,
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
  onCancelQueue,
}) => {
  // Calendar navigation state
  const [currentMonthDate, setCurrentMonthDate] = React.useState<Date>(() => {
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
  const [selectedDeptFilter, setSelectedDeptFilter] = React.useState<string>('all');

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
      // Populate dates
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
        // Prioritize preserving counted/deducted patients (lower CurrentQuota)
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

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full bg-slate-50">
      {/* 1. LEFT SIDEBAR: QUEUE COUNTERS */}
      <div className="w-[200px] border-r border-slate-200 bg-white hidden md:flex flex-col shrink-0 z-10 shadow-xs overflow-y-auto p-3">
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

            // Department label with SubSpecialty if present (e.g. ศัลยกรรม-Uro)
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

            {/* Center: Month Name (Centered) */}
            <div className="flex items-center justify-center text-center">
              <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight text-center">
                {monthNamesThai[month]} {year + 543}
              </h2>
            </div>

            {/* Right: Department Filter Selector */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
                <Filter className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <label htmlFor="calendar-dept-selector" className="text-xs font-bold text-slate-600 whitespace-nowrap">
                  แผนก:
                </label>
                <select
                  id="calendar-dept-selector"
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-teal-800 outline-none cursor-pointer max-w-[170px] truncate"
                >
                  <option value="all">ทั้งหมด ทุกแผนก</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {selectedDeptFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedDeptFilter('all')}
                    className="text-[10px] text-rose-600 hover:text-rose-700 font-bold ml-0.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 cursor-pointer"
                    title="แสดงทุกแผนก"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 border-b border-slate-200 pb-1.5 text-center text-xs font-bold text-slate-600 shrink-0">
            <div className="text-rose-600">อา.</div>
            <div>จ.</div>
            <div>อ.</div>
            <div>พ.</div>
            <div>พฤ.</div>
            <div>ศ.</div>
            <div className="text-violet-600">ส.</div>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 flex-1 overflow-y-auto mt-1 auto-rows-fr">
            {calendarDays.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateStr) || [];
              const holiday = holidaysByDate.get(cell.dateStr);
              const isSelected = cell.dateStr === selectedDate;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => onSelectDate(cell.dateStr)}
                  className={`min-h-[70px] p-1.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-200'
                      : holiday
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : cell.isSun
                      ? 'bg-rose-50/30 border-rose-100'
                      : cell.isSat
                      ? 'bg-violet-50/30 border-violet-100'
                      : cell.isCurrentMonth
                      ? 'bg-white border-slate-100 hover:border-slate-300'
                      : 'bg-slate-50/50 border-slate-100 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black ${
                        isSelected
                          ? 'text-teal-700 underline font-black'
                          : holiday || cell.isSun
                          ? 'text-rose-600'
                          : cell.isSat
                          ? 'text-violet-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {holiday && (
                      <span
                        className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded truncate max-w-[85px] border border-rose-200/80 shadow-2xs flex items-center gap-0.5"
                        title={`วันหยุดนักขัตฤกษ์ (Google Calendar): ${holiday.title}`}
                      >
                        <span className="text-[8px]">🎌</span>
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
      <div className="w-[340px] bg-white border-l border-slate-200 hidden lg:flex flex-col shrink-0 h-full shadow-xs z-10">
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
            agendaEvents.map((evt) => {
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
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: dpt.color }}></div>

                  <div className="pl-1.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
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
            })
          )}
        </div>
      </div>
    </div>
  );
};
