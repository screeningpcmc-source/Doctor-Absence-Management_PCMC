import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardList,
  Calculator,
  Award,
  Info,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Users,
  Trophy,
  UserCheck,
  Activity,
  BarChart2,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Department, WalkInCountRecord, QueueRecord } from '../types';
import { calculateNurseProductivity } from '../utils/absence-logic';

interface WalkInCounterViewProps {
  departments: Department[];
  deptMap: Map<string, Department>;
  walkInCounts: WalkInCountRecord[];
  queues: QueueRecord[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onUpdateCount: (deptId: string, delta: number, nurseName: string) => void;
  onResetCount: (deptId: string, nurseName: string) => void;
  authPin: string;
  onRequirePin: (callback: () => void) => void;
}

export const WalkInCounterView: React.FC<WalkInCounterViewProps> = ({
  departments,
  deptMap,
  walkInCounts,
  queues,
  selectedDate,
  onDateChange,
  onUpdateCount,
  onResetCount,
  authPin,
  onRequirePin,
}) => {
  const [subTab, setSubTab] = useState<'counter' | 'productivity'>('counter');
  const [nurseName, setNurseName] = useState(() => localStorage.getItem('walkin_nurse_name') || '');
  const [prodMonth, setProdMonth] = useState(() => selectedDate.substring(0, 7));
  const [deptOrder, setDeptOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dept_order_v3');
      return saved ? JSON.parse(saved) : departments.map((d) => d.id);
    } catch {
      return departments.map((d) => d.id);
    }
  });

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const handleNurseNameChange = (val: string) => {
    setNurseName(val);
    localStorage.setItem('walkin_nurse_name', val);
  };

  // Sorted departments according to custom order
  const sortedDepts = useMemo(() => {
    return [...departments].sort((a, b) => {
      const idxA = deptOrder.indexOf(a.id);
      const idxB = deptOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [departments, deptOrder]);

  // Index walk-in counts for selectedDate
  const currentCountsMap = useMemo(() => {
    const map = new Map<string, WalkInCountRecord>();
    for (const w of walkInCounts) {
      if (w.Date === selectedDate) {
        map.set(w.DepartmentId, w);
      }
    }
    return map;
  }, [walkInCounts, selectedDate]);

  // Index queues for selectedDate
  const currentQueuesMap = useMemo(() => {
    const map = new Map<string, QueueRecord>();
    for (const q of queues) {
      if (q.Date === selectedDate) {
        map.set(q.DepartmentId, q);
      }
    }
    return map;
  }, [queues, selectedDate]);

  const handleCardClick = (deptId: string) => {
    if (!nurseName.trim()) {
      alert('กรุณากรอก "ชื่อพยาบาลเวรปฏิบัติงาน" ที่ช่องด้านบนก่อนเริ่มนับยอด');
      return;
    }
    if (authPin !== '4000' && authPin !== '4217') {
      onRequirePin(() => onUpdateCount(deptId, 1, nurseName));
      return;
    }
    onUpdateCount(deptId, 1, nurseName);
  };

  const handleMinusClick = (deptId: string) => {
    if (!nurseName.trim()) {
      alert('กรุณากรอกชื่อพยาบาลก่อน');
      return;
    }
    if (authPin !== '4000' && authPin !== '4217') {
      onRequirePin(() => onUpdateCount(deptId, -1, nurseName));
      return;
    }
    onUpdateCount(deptId, -1, nurseName);
  };

  const handleResetClick = (deptId: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      onRequirePin(() => onResetCount(deptId, nurseName));
      return;
    }
    if (window.confirm('ยืนยันรีเซ็ตจำนวนเคสของแผนกนี้เป็น 0?')) {
      onResetCount(deptId, nurseName);
    }
  };

  const resetDeptOrder = () => {
    const def = departments.map((d) => d.id);
    setDeptOrder(def);
    localStorage.removeItem('dept_order_v3');
  };

  // Move department left or right
  const moveDept = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sortedDepts.map((d) => d.id)];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setDeptOrder(newOrder);
    localStorage.setItem('dept_order_v3', JSON.stringify(newOrder));
  };

  // Monthly productivity data
  const monthRecords = useMemo(() => {
    return walkInCounts.filter((w) => w.Date && w.Date.startsWith(prodMonth));
  }, [walkInCounts, prodMonth]);

  const productivity = useMemo(() => {
    return calculateNurseProductivity(monthRecords);
  }, [monthRecords]);

  // Chart for productivity
  useEffect(() => {
    if (subTab !== 'productivity' || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const labels = productivity.rows.map((r) => r.nurse);
    const data = productivity.rows.map((r) => r.total);
    const colors = ['#0d9488', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#e11d48'];

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'คนไข้คัดกรองสะสม (คน)',
            data,
            backgroundColor: colors.slice(0, labels.length),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [subTab, productivity]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-teal-950 text-white p-5 rounded-2xl shadow-xs border border-teal-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-300" /> นับ walk-in ประจำวัน
          </h2>
          <p className="text-xs text-teal-100 font-medium mt-0.5">
            บันทึกปริมาณงานคัดกรองสำหรับพยาบาลหน่วยคัดกรองเพื่อคิดคำนวณ Productivity รายบุคคล
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase">วันที่บันทึก</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-teal-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase">ชื่อพยาบาลเวรปฏิบัติงาน</label>
            <input
              type="text"
              value={nurseName}
              onChange={(e) => handleNurseNameChange(e.target.value)}
              placeholder="ชื่อ-นามสกุลพยาบาล..."
              className="bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-teal-300 w-full sm:w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setSubTab('counter')}
          className={`pb-2 text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            subTab === 'counter'
              ? 'border-b-2 border-teal-600 text-teal-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" /> บันทึกยอดประจำวัน
        </button>
        <button
          onClick={() => setSubTab('productivity')}
          className={`pb-2 text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            subTab === 'productivity'
              ? 'border-b-2 border-teal-600 text-teal-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" /> รายงาน Productivity พยาบาล
        </button>
      </div>

      {/* SUB-VIEW 1: COUNTER GRID */}
      {subTab === 'counter' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Info className="w-4 h-4 text-teal-600" />
              <span>คลิกตัวเลขใหญ่เพื่อบวกแต้ม (+1) หรือใช้ปุ่มลดคิว (-1) ด้านล่าง</span>
            </div>
            <button
              onClick={resetDeptOrder}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> รีเซ็ตลำดับแผนก
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedDepts.map((d, idx) => {
              const countRec = currentCountsMap.get(d.id);
              const count = countRec ? countRec.Count : 0;
              const nurse = countRec?.NurseName || '-';
              const lastUp = countRec?.LastUpdated ? new Date(countRec.LastUpdated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

              const quotaRec = currentQueuesMap.get(d.id);
              const maxQuota = quotaRec ? quotaRec.MaxQuota : 0;
              const isOverQuota = maxQuota > 0 && count >= maxQuota;
              const quotaProgress = maxQuota > 0 ? Math.min(100, (count / maxQuota) * 100) : 0;

              return (
                <div
                  key={d.id}
                  className={`bg-white rounded-2xl shadow-xs border transition-all flex flex-col justify-between overflow-hidden select-none hover:shadow-md ${
                    isOverQuota ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                  }`}
                >
                  {/* Department Title */}
                  <div
                    className="p-3 text-white flex items-center justify-between text-center shrink-0"
                    style={{ backgroundColor: isOverQuota ? '#e11d48' : d.color }}
                  >
                    <span className="font-bold text-sm leading-tight truncate">{d.name}</span>
                    <div className="flex items-center gap-1 opacity-75">
                      {idx > 0 && (
                        <button
                          onClick={() => moveDept(idx, 'up')}
                          className="hover:opacity-100 text-[10px] px-1 rounded bg-black/20"
                          title="เลื่อนไปข้างหน้า"
                        >
                          ◀
                        </button>
                      )}
                      {idx < sortedDepts.length - 1 && (
                        <button
                          onClick={() => moveDept(idx, 'down')}
                          className="hover:opacity-100 text-[10px] px-1 rounded bg-black/20"
                          title="เลื่อนไปข้างหลัง"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Big Number Click Area */}
                  <div
                    onClick={() => handleCardClick(d.id)}
                    className="cursor-pointer py-6 flex flex-col items-center justify-center hover:bg-slate-50/80 transition-colors group"
                    title="คลิกเพื่อบวกเพิ่ม +1"
                  >
                    <div
                      className="text-6xl font-black tracking-tight group-hover:scale-105 transition-transform"
                      style={{ color: isOverQuota ? '#e11d48' : d.color }}
                    >
                      {count}
                    </div>
                    {maxQuota > 0 && (
                      <span className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        / {maxQuota} คิว
                      </span>
                    )}
                  </div>

                  {/* Quota Progress Bar */}
                  {maxQuota > 0 && (
                    <div className="px-4 mb-2">
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isOverQuota ? 'bg-rose-500' : 'bg-teal-500'} transition-all`}
                          style={{ width: `${quotaProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Bottom Stats & Controls */}
                  <div className="bg-slate-50 border-t border-slate-100 p-2 text-[10px] text-slate-500 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="truncate max-w-[100px]">พยาบาล: <strong>{nurse}</strong></span>
                      <span>{lastUp !== '-' ? `เวลา ${lastUp}` : 'ยังไม่คีย์'}</span>
                    </div>

                    <div className="flex gap-1.5 mt-0.5">
                      <button
                        onClick={() => handleMinusClick(d.id)}
                        className="flex-1 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 font-bold flex justify-center items-center gap-1 active:scale-95 shadow-2xs"
                        title="ลด -1"
                      >
                        <Minus className="w-3 h-3" /> ลด (-1)
                      </button>
                      <button
                        onClick={() => handleResetClick(d.id)}
                        className="px-2.5 py-1 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg font-bold flex justify-center items-center active:scale-95 shadow-2xs"
                        title="รีเซ็ตเป็น 0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: PRODUCTIVITY REPORT */}
      {subTab === 'productivity' && (
        <div className="space-y-5">
          {/* Month Picker Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">คำนวณภาระงานพยาบาลหน่วยคัดกรองรายเดือน</h3>
              <p className="text-xs text-slate-400">เลือกปี-เดือน เพื่อวิเคราะห์ข้อมูลภาระงานและสัดส่วนรายบุคคล</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">เลือกเดือน:</label>
              <input
                type="month"
                value={prodMonth}
                onChange={(e) => setProdMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-teal-500 font-semibold"
              />
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                  ผู้ป่วย Walk-in คัดกรองสะสม
                </span>
                <span className="text-3xl font-black text-slate-800 tracking-tight block mt-1">
                  {productivity.totalPatients} คน
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">ยอดรวมประจำเดือน {prodMonth}</span>
            </div>

            <div className="bg-gradient-to-br from-white to-teal-50/30 p-4 rounded-xl border border-teal-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-teal-700 block uppercase tracking-wide">
                  ผู้ทำยอดสูงสุด (Top Performer)
                </span>
                <span className="text-xl md:text-2xl font-black text-teal-800 tracking-tight block mt-1 truncate">
                  {productivity.topNurse}
                </span>
              </div>
              <span className="text-[10px] text-teal-600 font-semibold mt-2">
                คัดกรอง {productivity.topNurseCount} คน ({productivity.topNurseShare}%)
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                  บุคลากรที่มีสถิติ
                </span>
                <span className="text-3xl font-black text-slate-800 tracking-tight block mt-1">
                  {productivity.rows.length} คน
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">พยาบาลที่มีเวรคัดกรองในเดือนนี้</span>
            </div>
          </div>

          {/* Table & Chart Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-teal-600" /> ตารางคำนวณ Productivity รายบุคคล
                </h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-2.5">ชื่อพยาบาล</th>
                      <th className="px-4 py-2.5 text-center">ยอดรวม (คน)</th>
                      <th className="px-4 py-2.5 text-center">วันขึ้นเวร</th>
                      <th className="px-4 py-2.5 text-center">เฉลี่ย/วัน</th>
                      <th className="px-4 py-2.5 text-center">สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100 text-slate-700">
                    {productivity.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          ไม่พบสถิติภาระงานในเดือนนี้
                        </td>
                      </tr>
                    ) : (
                      productivity.rows.map((row) => (
                        <tr key={row.nurse} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800">{row.nurse}</td>
                          <td className="px-4 py-3 text-center font-black text-teal-700">{row.total}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">{row.days} วัน</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">{row.average}</td>
                          <td className="px-4 py-3 text-center font-extrabold text-slate-700">{row.share}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-teal-600" /> แผนภูมิจำนวนคนไข้สะสมแยกรายบุคคล
              </h4>
              <div className="h-64 relative flex-1">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
