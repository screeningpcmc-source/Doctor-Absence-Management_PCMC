import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calendar,
  Clock,
  ShieldAlert,
  Hash,
  Trash2,
} from 'lucide-react';
import { AbsenceRecord, Department } from '../types';
import { SUB_SPECIALTIES } from '../services/dataStorage';
import { formatCanonicalDoctorName } from '../utils/absence-logic';

interface AbsenceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: AbsenceRecord) => void;
  onDelete?: (id: string) => void;
  initialData?: AbsenceRecord | null;
  departments: Department[];
  reasons: string[];
  selectedDate: string;
  authName: string;
}

export const AbsenceFormModal: React.FC<AbsenceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  departments,
  reasons,
  selectedDate,
  authName,
}) => {
  const [deptId, setDeptId] = useState('');
  const [reason, setReason] = useState('');
  const [prefix, setPrefix] = useState('นพ.');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('ทั่วไป');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [timeType, setTimeType] = useState('in');
  const [dateStart, setDateStart] = useState(selectedDate);
  const [timeStart, setTimeStart] = useState('08:00');
  const [dateEnd, setDateEnd] = useState(selectedDate);
  const [timeEnd, setTimeEnd] = useState('16:00');
  const [walkInQuota, setWalkInQuota] = useState('');
  const [affectedPatients, setAffectedPatients] = useState('0');
  const [replacementDoc, setReplacementDoc] = useState('');
  const [patientManagement, setPatientManagement] = useState('โอนให้แพทย์ตรวจแทน');
  const [notificationStatus, setNotificationStatus] = useState('โทรแจ้งสำเร็จทั้งหมด');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (initialData) {
      setDeptId(initialData.DepartmentId || '');
      setReason(initialData.Reason || '');

      let rawDoc = initialData.DoctorName || '';
      if (rawDoc.startsWith('นพ.') || rawDoc.startsWith('พญ.') || rawDoc.startsWith('ทพ.') || rawDoc.startsWith('ทญ.')) {
        setPrefix(rawDoc.substring(0, 3));
        setDoctorName(rawDoc.substring(3).trim());
      } else {
        setPrefix('นพ.');
        setDoctorName(rawDoc === '-' ? '' : rawDoc);
      }

      setSpecialty(initialData.Specialty || 'ทั่วไป');
      setCustomSpecialty('');
      setTimeType(initialData.TimeType || 'in');
      setDateStart(initialData.DateStart || selectedDate);
      setTimeStart(initialData.TimeStart ? initialData.TimeStart.substring(0, 5) : '08:00');
      setDateEnd(initialData.DateEnd || selectedDate);
      setTimeEnd(initialData.TimeEnd ? initialData.TimeEnd.substring(0, 5) : '16:00');
      setWalkInQuota(initialData.WalkInQuota ? String(initialData.WalkInQuota) : '');
      setAffectedPatients(initialData.AffectedPatients ? String(initialData.AffectedPatients) : '0');
      setReplacementDoc(initialData.ReplacementDoc || '');
      setPatientManagement(initialData.PatientManagement || 'โอนให้แพทย์ตรวจแทน');
      setNotificationStatus(initialData.NotificationStatus || 'โทรแจ้งสำเร็จทั้งหมด');
      setNote(initialData.Note || '');
    } else {
      setDeptId(departments[0]?.id || 'internal');
      setReason(reasons[0] || 'ลาพักผ่อนส่วนตัว');
      setPrefix('นพ.');
      setDoctorName('');
      setSpecialty('ทั่วไป');
      setCustomSpecialty('');
      setTimeType('in');
      setDateStart(selectedDate);
      setTimeStart('08:00');
      setDateEnd(selectedDate);
      setTimeEnd('16:00');
      setWalkInQuota('');
      setAffectedPatients('0');
      setReplacementDoc('');
      setPatientManagement('โอนให้แพทย์ตรวจแทน');
      setNotificationStatus('โทรแจ้งสำเร็จทั้งหมด');
      setNote('');
    }
  }, [initialData, isOpen, selectedDate, departments, reasons]);

  if (!isOpen) return null;

  const isWalkIn = reason === 'จำกัดเคส walk-in' || reason === 'ระบบโควตา Walk-in';
  const isClinicClosed = reason === 'คลินิกปิดให้บริการ';

  const handleTimeTypeChange = (val: string) => {
    setTimeType(val);
    if (val === 'in') {
      setTimeStart('08:00');
      setTimeEnd('15:59');
    } else if (val === 'out') {
      setTimeStart('16:00');
      setTimeEnd('20:00');
    } else if (val === 'out_weekend') {
      setTimeStart('08:00');
      setTimeEnd('12:00');
    } else {
      setTimeStart('08:00');
      setTimeEnd('20:00');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId) {
      alert('กรุณาเลือกแผนก');
      return;
    }

    let finalDocName = '';
    if (isClinicClosed) {
      finalDocName = '-';
    } else if (isWalkIn && !doctorName.trim()) {
      finalDocName = '-';
    } else {
      finalDocName = formatCanonicalDoctorName(prefix, doctorName);
    }

    const finalSpecialty = specialty === 'custom' ? customSpecialty.trim() || 'ทั่วไป' : specialty;

    const record: AbsenceRecord = {
      ID: initialData?.ID || `ABS-${Date.now().toString().slice(-6)}`,
      DepartmentId: deptId,
      DoctorName: finalDocName,
      AllDay: timeType === 'in' || timeType === 'both',
      DateStart: dateStart,
      TimeStart: timeStart,
      DateEnd: dateEnd,
      TimeEnd: timeEnd,
      Reason: reason,
      Note: note,
      CreatedAt: initialData?.CreatedAt || new Date().toISOString(),
      CalendarEventId: initialData?.CalendarEventId,
      TimeType: timeType,
      UpdatedBy: authName || 'เจ้าหน้าที่',
      WalkInQuota: isWalkIn && walkInQuota ? parseInt(walkInQuota, 10) : '',
      AffectedPatients: affectedPatients,
      ReplacementDoc: replacementDoc,
      PatientManagement: patientManagement,
      NotificationStatus: notificationStatus,
      Specialty: finalSpecialty,
    };

    onSave(record);
  };

  const normalDepts = departments.filter((d) => !d.name.includes('Premium'));
  const premiumDepts = departments.filter((d) => d.name.includes('Premium'));

  const baseDeptId = deptId.replace('-Premium', '');
  const specialtyOptions = SUB_SPECIALTIES[deptId] || SUB_SPECIALTIES[baseDeptId] || ['ทั่วไป'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-6 border border-slate-200">
        <div className="bg-teal-700 px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-200" />
            <h3 className="font-bold text-base">
              {initialData ? 'แก้ไขข้อมูลการงดออกตรวจ' : 'ลงทะเบียนแพทย์งดออกตรวจ / จำกัดโควตา'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Department */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              1. แผนกที่สังกัด <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OPD ปกติ</div>
              <div className="flex flex-wrap gap-1.5">
                {normalDepts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDeptId(d.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      deptId === d.id
                        ? 'shadow-xs ring-2 ring-teal-500 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    style={deptId === d.id ? { backgroundColor: d.bg, color: d.text, borderColor: d.color } : {}}
                  >
                    {d.name}
                  </button>
                ))}
              </div>

              {premiumDepts.length > 0 && (
                <>
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-2">
                    คลินิกพิเศษ Premium
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {premiumDepts.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDeptId(d.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          deptId === d.id
                            ? 'shadow-xs ring-2 ring-amber-500 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        style={deptId === d.id ? { backgroundColor: d.bg, color: d.text, borderColor: d.color } : {}}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Reason & Specialty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                2. เหตุผลการงดตรวจ <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2.5 font-bold outline-none focus:border-teal-500 cursor-pointer"
                required
              >
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ความเฉพาะทาง (Sub-specialty)
              </label>
              <div className="flex gap-2">
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2.5 font-bold outline-none focus:border-teal-500 cursor-pointer"
                >
                  {specialtyOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="custom">อื่นๆ (ระบุเอง)</option>
                </select>
                {specialty === 'custom' && (
                  <input
                    type="text"
                    value={customSpecialty}
                    onChange={(e) => setCustomSpecialty(e.target.value)}
                    placeholder="ระบุสาขา..."
                    className="w-[110px] bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                    required
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quota box if walk-in */}
          {isWalkIn && (
            <div className="bg-teal-50/70 border border-teal-200 p-3 rounded-xl flex items-center gap-3">
              <Hash className="w-5 h-5 text-teal-600 shrink-0" />
              <div className="flex-1">
                <label className="block text-xs font-bold text-teal-900 mb-0.5">
                  จำนวนโควตาที่จำกัด (เคสต่อวัน) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={walkInQuota}
                  onChange={(e) => setWalkInQuota(e.target.value)}
                  placeholder="ระบุจำนวนตัวเลข เช่น 5"
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* 3. Doctor Name */}
          {!isClinicClosed && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                3. ชื่อแพทย์ผู้รับผิดชอบ {isWalkIn ? '(หรือเว้นว่างเพื่อระบุระดับแผนก)' : <span className="text-rose-500">*</span>}
              </label>
              <div className="flex gap-2">
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700"
                >
                  <option>นพ.</option>
                  <option>พญ.</option>
                  <option>ทพ.</option>
                  <option>ทญ.</option>
                </select>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="ชื่อ-นามสกุลแพทย์"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                  required={!isWalkIn}
                />
              </div>
            </div>
          )}

          {/* 4. Shift & Dates */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              4. ระบุประเภทเวลาปฏิบัติงาน
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'in', label: 'ในเวลาปกติ' },
                { id: 'out', label: 'นอกเวลา จ-ศ' },
                { id: 'out_weekend', label: 'นอกเวลา ส-อา' },
                { id: 'both', label: 'ในและนอกเวลา' },
              ].map((shift) => (
                <label
                  key={shift.id}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                    timeType === shift.id
                      ? 'border-teal-500 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="shift"
                    checked={timeType === shift.id}
                    onChange={() => handleTimeTypeChange(shift.id)}
                    className="accent-teal-600"
                  />
                  <span>{shift.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                required
              />
            </div>
          </div>

          {/* 5. Impact Control */}
          <div className="border border-teal-100 bg-teal-50/20 p-3.5 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 border-b border-teal-100/60 pb-1.5">
              <ShieldAlert className="w-4 h-4 text-teal-600" />
              <span>การบริหารผลกระทบและคนไข้ (Impact Control)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  คนไข้ที่ได้รับผลกระทบ (คน)
                </label>
                <input
                  type="number"
                  min="0"
                  value={affectedPatients}
                  onChange={(e) => setAffectedPatients(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  แพทย์ตรวจแทน (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={replacementDoc}
                  onChange={(e) => setReplacementDoc(e.target.value)}
                  placeholder="เช่น นพ.ประจักษ์"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">การจัดคิวนัด</label>
                <select
                  value={patientManagement}
                  onChange={(e) => setPatientManagement(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="โอนให้แพทย์ตรวจแทน">โอนให้แพทย์ตรวจแทน</option>
                  <option value="เลื่อนนัดทั้งหมด">เลื่อนนัดทั้งหมด</option>
                  <option value="ประสานติดต่อจัดสรรคิวใหม่">ประสานติดต่อจัดสรรคิวใหม่</option>
                  <option value="อื่นๆ (ระบุในหมายเหตุ)">อื่นๆ (ระบุในหมายเหตุ)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">สถานะโทรแจ้ง</label>
                <select
                  value={notificationStatus}
                  onChange={(e) => setNotificationStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="โทรแจ้งสำเร็จทั้งหมด">🟢 โทรแจ้งสำเร็จทั้งหมด</option>
                  <option value="ส่ง SMS แล้วกำลังติดตาม">🟡 ส่ง SMS แล้วกำลังติดตาม</option>
                  <option value="อยู่ระหว่างดำเนินการ">🟠 อยู่ระหว่างดำเนินการ</option>
                  <option value="ยังไม่ได้ดำเนินการ">🔴 ยังไม่ได้ดำเนินการ</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6. Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดข้อมูลผู้ป่วย หรือบันทึกข้อความประสานงาน..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
            ></textarea>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                    onDelete(initialData.ID);
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> ลบรายการ
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                บันทึกส่งข้อมูล
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
