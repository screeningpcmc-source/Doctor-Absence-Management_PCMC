import React, { useState, useMemo } from 'react';
import {
  ListCollapse,
  Search,
  RotateCcw,
  Calendar,
  AlertCircle,
  Users,
  Edit3,
  Clock,
  Inbox,
  FileText,
} from 'lucide-react';
import { AbsenceRecord, Department } from '../types';
import { normalizeTimeType } from '../utils/absence-logic';
import { getHolidayForDate } from '../services/holidaysService';

interface ListViewProps {
  events: AbsenceRecord[];
  departments: Department[];
  deptMap: Map<string, Department>;
  onEditEvent: (event: AbsenceRecord) => void;
  onOpenEventDetail: (event: AbsenceRecord) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  events,
  departments,
  deptMap,
  onEditEvent,
  onOpenEventDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('created-desc');

  const filteredEvents = useMemo(() => {
    let list = [...events];
    const q = searchTerm.toLowerCase().trim();

    if (q) {
      list = list.filter((e) => {
        const dpt = deptMap.get(e.DepartmentId);
        const deptName = dpt?.name.toLowerCase() || '';
        const docName = (e.DoctorName || '').toLowerCase();
        const reason = (e.Reason || '').toLowerCase();
        const note = (e.Note || '').toLowerCase();
        const spec = (e.Specialty || '').toLowerCase();
        return (
          docName.includes(q) ||
          deptName.includes(q) ||
          reason.includes(q) ||
          note.includes(q) ||
          spec.includes(q)
        );
      });
    }

    if (deptFilter !== 'all') {
      list = list.filter((e) => e.DepartmentId === deptFilter);
    }

    if (dateFilter) {
      list = list.filter((e) => e.DateStart <= dateFilter && e.DateEnd >= dateFilter);
    }

    list.sort((a, b) => {
      if (sortBy === 'created-desc') {
        return new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime();
      }
      if (sortBy === 'created-asc') {
        return new Date(a.CreatedAt || 0).getTime() - new Date(b.CreatedAt || 0).getTime();
      }
      if (sortBy === 'date-desc') {
        return b.DateStart.localeCompare(a.DateStart);
      }
      if (sortBy === 'date-asc') {
        return a.DateStart.localeCompare(b.DateStart);
      }
      return 0;
    });

    return list;
  }, [events, searchTerm, deptFilter, dateFilter, sortBy, deptMap]);

  const handleClear = () => {
    setSearchTerm('');
    setDeptFilter('all');
    setDateFilter('');
    setSortBy('created-desc');
  };

  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '';
    const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const [y, mon, d] = dStr.split('-').map(Number);
    return `${d} ${m[mon - 1]} ${y + 543}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
          <ListCollapse className="w-5 h-5 text-teal-600" /> รายการบันทึกแพทย์งดตรวจทั้งหมด
        </h2>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
          พบประวัติ: {filteredEvents.length} รายการ
        </span>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ค้นหาคำค้น
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อแพทย์ / แผนก / หมายเหตุ..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-lg text-xs outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              กลุ่มงาน / แผนกตรวจ
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500 cursor-pointer font-semibold text-slate-700"
            >
              <option value="all">ทั้งหมด ทุกแผนก</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              กรองด้วยวันที่ตรวจ
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              เรียงลำดับข้อมูล
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500 cursor-pointer font-semibold"
            >
              <option value="created-desc">📅 บันทึกล่าสุด (ใหม่สุด -&gt; เก่าสุด)</option>
              <option value="created-asc">📅 บันทึกแรกสุด (เก่าสุด -&gt; ใหม่สุด)</option>
              <option value="date-desc">🩺 วันที่งดตรวจล่าสุด (ใหม่ -&gt; เก่า)</option>
              <option value="date-asc">🩺 วันที่งดตรวจแรกสุด (เก่า -&gt; ใหม่)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-2.5 pt-2 border-t border-slate-100">
          <button
            onClick={handleClear}
            className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> ล้างข้อมูลตัวกรองทั้งหมด
          </button>
        </div>
      </div>

      {/* Grid of Results */}
      {filteredEvents.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center select-none">
          <Inbox className="w-10 h-10 text-slate-300 mb-2" />
          <span className="text-sm font-semibold text-slate-500">ไม่พบข้อมูลตรงกับเงื่อนไขการค้นหา</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            const dpt = deptMap.get(evt.DepartmentId) || {
              name: evt.DepartmentId,
              color: '#64748b',
              bg: '#f8fafc',
              text: '#334155',
            };

            const specLabel = evt.Specialty && evt.Specialty !== 'ทั่วไป' && evt.Specialty !== '-' ? `-${evt.Specialty}` : '';
            const deptDisplayName = `${dpt.name}${specLabel}`;

            let dateStr = formatThaiDate(evt.DateStart);
            if (evt.DateStart !== evt.DateEnd) {
              dateStr += ` - ${formatThaiDate(evt.DateEnd)}`;
            }

            const shift = normalizeTimeType(evt);
            const timeLabel =
              shift === 'out'
                ? 'นอกเวลา'
                : shift === 'out_weekend'
                ? 'นอกเวลา ส.-อ.'
                : shift === 'both'
                ? 'ใน/นอกเวลา'
                : 'ในเวลา';

            const isWalkIn = evt.Reason === 'จำกัดเคส walk-in' || evt.Reason === 'ระบบโควตา Walk-in';
            const doctorText =
              evt.Reason === 'คลินิกปิดให้บริการ'
                ? 'คลินิกปิดให้บริการ'
                : isWalkIn && (!evt.DoctorName || evt.DoctorName === '-')
                ? 'ระบบโควตา Walk-in (ระดับแผนก)'
                : evt.DoctorName || '-';

            return (
              <div
                key={evt.ID}
                className="bg-white rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between relative overflow-hidden select-none"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: dpt.color }}></div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-1.5 mb-2.5">
                    <span
                      className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md"
                      style={{ backgroundColor: dpt.bg, color: dpt.text }}
                    >
                      {deptDisplayName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {timeLabel}
                    </span>
                  </div>

                  <h3
                    className="font-extrabold text-slate-800 text-sm leading-tight truncate mb-2.5 cursor-pointer hover:text-teal-700"
                    title={doctorText}
                    onClick={() => onOpenEventDetail(evt)}
                  >
                    {doctorText}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-500">วันที่:</span>
                      <span className="font-bold text-teal-800">{dateStr}</span>
                    </div>

                    {Boolean(getHolidayForDate(evt.DateStart) || (evt.DateEnd && getHolidayForDate(evt.DateEnd))) && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/80 w-fit">
                        <span>🎌</span>
                        <span>{getHolidayForDate(evt.DateStart)?.title || (evt.DateEnd ? getHolidayForDate(evt.DateEnd)?.title : '')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-500">เหตุผล:</span>
                      <span className="font-semibold text-slate-800 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        {evt.Reason}
                      </span>
                    </div>

                    {Boolean(evt.WalkInQuota && Number(evt.WalkInQuota) > 0) && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="font-medium text-slate-500">จำกัดคิว:</span>
                        <span className="font-extrabold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">
                          {evt.WalkInQuota} เคส/วัน
                        </span>
                      </div>
                    )}

                    {evt.Note && (
                      <div className="mt-2 bg-slate-50/70 rounded-lg p-2 border border-slate-100 text-[11px] leading-relaxed text-slate-600">
                        <div className="font-bold text-slate-400 flex items-center gap-1 mb-0.5">
                          <FileText className="w-3 h-3" /> หมายเหตุ:
                        </div>
                        <div className="text-slate-700 font-medium">{evt.Note}</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 flex justify-between">
                    <span>ผู้บันทึก: <strong className="text-slate-600">{evt.UpdatedBy || '-'}</strong></span>
                    <span>ID: <code className="text-slate-500">{evt.ID}</code></span>
                  </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-100 p-2.5 flex gap-2">
                  <button
                    onClick={() => onOpenEventDetail(evt)}
                    className="flex-1 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all text-center shadow-2xs"
                  >
                    ดูรายละเอียด
                  </button>
                  <button
                    onClick={() => onEditEvent(evt)}
                    className="flex-1 py-1.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> แก้ไข
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
