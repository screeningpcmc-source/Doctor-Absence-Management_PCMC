import React from 'react';
import { X, Edit3, Stethoscope, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { AbsenceRecord, Department } from '../types';
import { normalizeTimeType } from '../utils/absence-logic';
import { getHolidayForDate } from '../services/holidaysService';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AbsenceRecord | null;
  deptMap: Map<string, Department>;
  onEdit: (event: AbsenceRecord) => void;
  onDelete?: (id: string) => void;
  authName?: string;
  authPin?: string;
  onRequirePin?: (action: () => void) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  deptMap,
  onEdit,
  onDelete,
  authName,
  authPin,
  onRequirePin,
}) => {
  if (!isOpen || !event) return null;

  const isLoggedIn = Boolean(authPin && authName);

  const dpt = deptMap.get(event.DepartmentId) || {
    name: event.DepartmentId,
    color: '#64748b',
    bg: '#f1f5f9',
    text: '#334155',
  };

  const specLabel = event.Specialty && event.Specialty !== 'ทั่วไป' && event.Specialty !== '-' ? `-${event.Specialty}` : '';
  const deptDisplayName = `${dpt.name}${specLabel}`;

  const isWalkIn = event.Reason === 'จำกัดเคส walk-in' || event.Reason === 'ระบบโควตา Walk-in';
  const isClinicClosed = event.Reason === 'คลินิกปิดให้บริการ';

  const doctorTitle = isClinicClosed
    ? 'คลินิกปิดให้บริการ'
    : isWalkIn && (!event.DoctorName || event.DoctorName === '-')
    ? 'ระบบโควตา Walk-in (ระดับแผนก)'
    : event.DoctorName || '-';

  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '';
    const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const [y, mon, d] = dStr.split('-').map(Number);
    return `${d} ${m[mon - 1]} ${y + 543}`;
  };

  let dateDisplay = formatThaiDate(event.DateStart);
  if (event.DateStart !== event.DateEnd) {
    dateDisplay += ` ถึง ${formatThaiDate(event.DateEnd)}`;
  }

  const shift = normalizeTimeType(event);
  const shiftText =
    shift === 'out'
      ? 'นอกเวลาราชการ จ-ศ (16:00-20:00)'
      : shift === 'out_weekend'
      ? 'นอกเวลาราชการ ส.-อ. (08:00-12:00)'
      : shift === 'both'
      ? 'ทั้งในและนอกเวลาราชการ (08:00-20:00)'
      : 'ในเวลาราชการปกติ (08:00-16:00)';

  const isUnplanned = event.Reason === 'ลาป่วย' || event.Reason === 'เหตุสุดวิสัย';

  const handleDeleteClick = () => {
    if (!isLoggedIn) {
      if (onRequirePin) {
        onRequirePin(() => {
          // Re-trigger deletion after login
          if (
            window.confirm(
              `ยืนยันยกเลิกรายการนี้หรือไม่?\n\n- แผนก: ${deptDisplayName}\n- แพทย์: ${doctorTitle}\n\n(ข้อมูลการงดออกตรวจและโควตาคิวที่เกี่ยวข้องจะถูกยกเลิกพร้อมกันทั้งสองส่วน)`
            )
          ) {
            if (onDelete) {
              onDelete(event.ID);
            }
            onClose();
          }
        });
      } else {
        alert('กรุณาเข้าสู่ระบบด้วยรหัส PIN ก่อนยกเลิกหรือลบรายการ');
      }
      return;
    }

    if (
      window.confirm(
        `ยืนยันยกเลิกรายการนี้หรือไม่?\n\n- แผนก: ${deptDisplayName}\n- แพทย์: ${doctorTitle}\n- ผู้ทำรายการ: ${authName}\n\n(ข้อมูลการงดออกตรวจและโควตาคิวที่เกี่ยวข้องจะถูกยกเลิกพร้อมกันทั้งสองส่วน)`
      )
    ) {
      if (onDelete) {
        onDelete(event.ID);
      }
      onClose();
    }
  };

  const handleEditClick = () => {
    if (!isLoggedIn) {
      if (onRequirePin) {
        onRequirePin(() => {
          onClose();
          onEdit(event);
        });
      } else {
        alert('กรุณาเข้าสู่ระบบด้วยรหัส PIN ก่อนแก้ไขข้อมูล');
      }
      return;
    }
    onClose();
    onEdit(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-6 border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h3 className="font-extrabold text-base text-slate-800 tracking-tight truncate max-w-[320px]">
              {doctorTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content details */}
        <div className="p-5 space-y-3 text-sm divide-y divide-slate-100">
          <div className="flex items-center justify-between pb-2">
            <span className="font-bold text-slate-400 text-xs">🏥 แผนกตรวจ:</span>
            <span
              className="font-bold px-2.5 py-1 rounded text-xs"
              style={{ backgroundColor: dpt.bg, color: dpt.text }}
            >
              {deptDisplayName}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">📅 วันที่งดตรวจ:</span>
            <span className="font-bold text-slate-800">{dateDisplay}</span>
          </div>

          {Boolean(getHolidayForDate(event.DateStart) || (event.DateEnd && getHolidayForDate(event.DateEnd))) && (
            <div className="flex items-center justify-between py-2 bg-rose-50 border border-rose-200 px-3 rounded-lg text-rose-800">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <span>🎌</span> วันหยุดนักขัตฤกษ์:
              </span>
              <span className="font-bold text-xs text-rose-900">
                {getHolidayForDate(event.DateStart)?.title || (event.DateEnd ? getHolidayForDate(event.DateEnd)?.title : '')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">⏰ ช่วงเวลา:</span>
            <span className="font-semibold text-slate-700 text-xs">{shiftText}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">📋 สาเหตุการงด:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-xs ${
                isUnplanned ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {event.Reason}
            </span>
          </div>

          {Boolean(event.WalkInQuota && Number(event.WalkInQuota) > 0) && (
            <div className="flex items-center justify-between py-2 bg-teal-50/70 border border-teal-100 px-3 rounded-lg">
              <div>
                <span className="font-bold text-teal-900 text-xs block">🔢 จำกัดโควตาคิว Walk-in:</span>
                <span className="text-[10px] text-teal-600 font-medium">สัมพันธ์กับแถบโควตาคิวแพทย์ด้านซ้าย</span>
              </div>
              <span className="font-black text-teal-800 text-base">{event.WalkInQuota} เคส/วัน</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">👥 คนไข้ได้รับผลกระทบ:</span>
            <span className="font-black text-rose-700 text-sm">{event.AffectedPatients || '0'} ราย</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">🔄 การจัดการคนไข้:</span>
            <span className="font-semibold text-slate-700 text-xs">{event.PatientManagement || '-'}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">👨‍⚕️ แพทย์ตรวจแทน:</span>
            <span className="font-semibold text-slate-700 text-xs">{event.ReplacementDoc || 'ไม่มี'}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-slate-400 text-xs">📢 สถานะแจ้งคนไข้:</span>
            <span className="font-semibold text-slate-700 text-xs">{event.NotificationStatus || '-'}</span>
          </div>

          {event.Note && (
            <div className="pt-2 text-xs">
              <div className="font-bold text-slate-400 mb-1">📝 หมายเหตุ:</div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700 font-medium leading-relaxed">
                {event.Note}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title={isLoggedIn ? 'ยกเลิกรายการนี้และโควตาที่สัมพันธ์กัน' : 'ต้องเข้าสู่ระบบ PIN ก่อนยกเลิกรายการ'}
              >
                {isLoggedIn ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-rose-500" />}
                <span>ยกเลิกรายการ</span>
              </button>
            )}

            {!isLoggedIn ? (
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" /> โหมดดูข้อมูล
              </span>
            ) : (
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> {authName}
              </span>
            )}
          </div>

          <div className="flex gap-2 ml-auto w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
            <button
              onClick={handleEditClick}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
              title={isLoggedIn ? 'แก้ไขข้อมูลรายการนี้' : 'ต้องเข้าสู่ระบบ PIN ก่อนแก้ไขข้อมูล'}
            >
              {isLoggedIn ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-teal-200" />}
              <span>แก้ไขข้อมูล</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
