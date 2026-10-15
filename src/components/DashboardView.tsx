import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Presentation,
  AlertTriangle,
  Users2,
  Building2,
  Siren,
  PhoneCall,
  ShieldCheck,
  TrendingUp,
  PieChart,
  Clock3,
  CalendarRange,
  GitCompare,
  Activity,
  LineChart,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { AbsenceRecord, Department } from '../types';
import {
  normalizeTimeType,
  getReasonCategory,
  isCriticalEvent,
  getOperationalToday,
} from '../utils/absence-logic';

interface DashboardViewProps {
  events: AbsenceRecord[];
  departments: Department[];
  deptMap: Map<string, Department>;
  onOpenEventDetail: (event: AbsenceRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  events,
  departments,
  deptMap,
  onOpenEventDetail,
}) => {
  const [timelineFilter, setTimelineFilter] = useState('month');
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  const chartDayRef = useRef<HTMLCanvasElement | null>(null);
  const chartTop5Ref = useRef<HTMLCanvasElement | null>(null);
  const chartRatioRef = useRef<HTMLCanvasElement | null>(null);
  const chartTimeRef = useRef<HTMLCanvasElement | null>(null);
  const chartCompareRef = useRef<HTMLCanvasElement | null>(null);

  const chartsInstances = useRef<{ [key: string]: Chart | null }>({});

  // Compute period dates
  const period = useMemo(() => {
    const todayStr = getOperationalToday();
    const [y, m, d] = todayStr.split('-').map(Number);
    const today = new Date(Date.UTC(y, m - 1, d));
    const start = new Date(today);
    const end = new Date(today);
    let label = 'ข้อมูลทั้งหมด';

    const pad = (n: number) => String(n).padStart(2, '0');
    const toYmd = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

    if (timelineFilter === 'today') {
      label = 'วันนี้';
    } else if (timelineFilter === 'week') {
      const day = today.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setUTCDate(today.getUTCDate() + diff);
      end.setUTCDate(start.getUTCDate() + 6);
      label = 'สัปดาห์นี้';
    } else if (timelineFilter === 'month') {
      start.setUTCDate(1);
      end.setUTCMonth(start.getUTCMonth() + 1, 0);
      label = 'เดือนนี้';
    } else if (timelineFilter === 'quarter') {
      const qMonth = Math.floor(today.getUTCMonth() / 3) * 3;
      start.setUTCMonth(qMonth, 1);
      end.setUTCMonth(qMonth + 3, 0);
      label = 'ไตรมาสนี้';
    } else if (timelineFilter === 'year' || timelineFilter === 'yoy') {
      start.setUTCMonth(0, 1);
      end.setUTCMonth(11, 31);
      label = timelineFilter === 'yoy' ? 'ปีนี้เทียบปีก่อน' : 'ปีนี้';
    } else {
      return { start: null, end: null, label };
    }

    return {
      start: toYmd(start),
      end: toYmd(end),
      label,
    };
  }, [timelineFilter]);

  // Filter events efficiently in memory
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Period check
      if (period.start && period.end) {
        if (!(evt.DateStart <= period.end && evt.DateEnd >= period.start)) {
          return false;
        }
      }

      // Dept check
      if (deptFilter !== 'all' && evt.DepartmentId !== deptFilter && !evt.DepartmentId.startsWith(deptFilter)) {
        return false;
      }

      // Reason category check
      if (typeFilter !== 'all' && getReasonCategory(evt.Reason) !== typeFilter) {
        return false;
      }

      // Time shift check
      if (timeFilter !== 'all' && normalizeTimeType(evt) !== timeFilter) {
        return false;
      }

      return true;
    });
  }, [events, period, deptFilter, typeFilter, timeFilter]);

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalAffected = 0;
    let notifiedSuccessCount = 0;
    let substituteCount = 0;
    const deptSet = new Set<string>();
    let criticalCount = 0;

    for (const evt of filteredEvents) {
      const aff = parseInt(String(evt.AffectedPatients || '0'), 10);
      totalAffected += isNaN(aff) ? 0 : aff;
      deptSet.add(evt.DepartmentId);
      if (isCriticalEvent(evt)) criticalCount++;

      const notif = evt.NotificationStatus || '';
      if (notif === 'โทรแจ้งสำเร็จทั้งหมด') notifiedSuccessCount++;
      else if (notif === 'ส่ง SMS แล้วกำลังติดตาม') notifiedSuccessCount += 0.6;
      else if (notif === 'อยู่ระหว่างดำเนินการ') notifiedSuccessCount += 0.2;

      if (evt.ReplacementDoc && evt.ReplacementDoc.trim() !== '' && evt.ReplacementDoc.trim() !== 'ไม่มี') {
        substituteCount++;
      }
    }

    const totalCancelled = filteredEvents.length;
    const notifyRate = totalCancelled > 0 ? Math.round((notifiedSuccessCount / totalCancelled) * 100) : 0;
    const coverageRate = totalCancelled > 0 ? Math.round((substituteCount / totalCancelled) * 100) : 0;

    return {
      totalCancelled,
      totalAffected,
      deptCount: deptSet.size,
      criticalCount,
      notifyRate,
      coverageRate,
    };
  }, [filteredEvents]);

  // Weekday Heatmap data
  const weekdayCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const evt of filteredEvents) {
      const [y, m, d] = evt.DateStart.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      let dayIndex = dt.getUTCDay();
      dayIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Mon = 0, Sun = 6
      counts[dayIndex]++;
    }
    return counts;
  }, [filteredEvents]);

  // Render & clean up charts deterministically
  useEffect(() => {
    // Destroy existing instances first to guarantee zero memory leaks
    Object.keys(chartsInstances.current).forEach((k) => {
      chartsInstances.current[k]?.destroy();
      chartsInstances.current[k] = null;
    });

    const categoryStats = { emergency: 0, planned: 0, academic: 0 };
    const timeStats = { in: 0, out: 0, out_weekend: 0, both: 0 };
    const deptStats: Record<string, number> = {};
    const buckets: Record<string, number> = {};

    for (const evt of filteredEvents) {
      categoryStats[getReasonCategory(evt.Reason)]++;
      timeStats[normalizeTimeType(evt)]++;

      const dpt = deptMap.get(evt.DepartmentId);
      const name = dpt ? dpt.name : evt.DepartmentId;
      deptStats[name] = (deptStats[name] || 0) + 1;

      const dateKey = evt.DateStart || 'ไม่ระบุ';
      buckets[dateKey] = (buckets[dateKey] || 0) + 1;
    }

    // 1. Line Trend Chart
    if (chartDayRef.current) {
      const sortedKeys = Object.keys(buckets).sort();
      chartsInstances.current.day = new Chart(chartDayRef.current, {
        type: 'line',
        data: {
          labels: sortedKeys,
          datasets: [
            {
              label: 'จำนวนรายการ',
              data: sortedKeys.map((k) => buckets[k]),
              borderColor: '#0d9488',
              backgroundColor: 'rgba(20, 184, 166, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 3,
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
    }

    // 2. Top 5 Departments
    if (chartTop5Ref.current) {
      const top5 = Object.entries(deptStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      chartsInstances.current.top5 = new Chart(chartTop5Ref.current, {
        type: 'bar',
        data: {
          labels: top5.map((x) => x[0]),
          datasets: [
            {
              label: 'จำนวนรายการ',
              data: top5.map((x) => x[1]),
              backgroundColor: '#10b981',
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    // 3. Reason Doughnut
    if (chartRatioRef.current) {
      chartsInstances.current.ratio = new Chart(chartRatioRef.current, {
        type: 'doughnut',
        data: {
          labels: ['ฉุกเฉิน/ลาป่วย', 'วางแผน/บริการ', 'ประชุม/อบรม'],
          datasets: [
            {
              data: [categoryStats.emergency, categoryStats.planned, categoryStats.academic],
              backgroundColor: ['#ef4444', '#0d9488', '#6366f1'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '70%',
        },
      });
    }

    // 4. Time Shift Bar Chart
    if (chartTimeRef.current) {
      chartsInstances.current.time = new Chart(chartTimeRef.current, {
        type: 'bar',
        data: {
          labels: ['ในเวลาฯ', 'นอกเวลา จ-ศ', 'นอกเวลา ส-อา', 'ทั้งวัน'],
          datasets: [
            {
              data: [timeStats.in, timeStats.out, timeStats.out_weekend, timeStats.both],
              backgroundColor: ['#14b8a6', '#f59e0b', '#8b5cf6', '#0ea5e9'],
              borderRadius: 4,
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
    }

    // 5. Comparison Chart
    if (chartCompareRef.current) {
      chartsInstances.current.compare = new Chart(chartCompareRef.current, {
        type: 'bar',
        data: {
          labels: ['รายการงดทั้งหมด', 'เข้าเกณฑ์เฝ้าระวัง'],
          datasets: [
            {
              data: [filteredEvents.length, metrics.criticalCount],
              backgroundColor: ['#0d9488', '#f59e0b'],
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
          },
        },
      });
    }

    return () => {
      Object.keys(chartsInstances.current).forEach((k) => {
        chartsInstances.current[k]?.destroy();
        chartsInstances.current[k] = null;
      });
    };
  }, [filteredEvents, deptMap, metrics.criticalCount]);

  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '';
    const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const [y, mon, d] = dStr.split('-').map(Number);
    return `${d} ${m[mon - 1]} ${y + 543}`;
  };

  const weekdayLabels = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const maxDayCount = Math.max(...weekdayCounts, 1);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
      {/* Executive Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-teal-950 text-white p-5 rounded-2xl shadow-xs border border-teal-700/50">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
              <Presentation className="w-6 h-6 text-teal-300" /> แดชบอร์ดสรุปผลเชิงบริหาร (Executive Overview)
            </h2>
            <p className="text-xs text-teal-100 font-medium mt-0.5">
              วิเคราะห์อัตรากำลังพล ผลกระทบคนไข้สะสม และการจัดสรรคิวบริการทางการแพทย์
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white/10 p-3 rounded-xl border border-white/15">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase tracking-wider">
              ช่วงเวลาวิเคราะห์
            </label>
            <select
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
              className="w-full bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:border-teal-300"
            >
              <option value="today">วันนี้</option>
              <option value="week">สัปดาห์นี้</option>
              <option value="month">เดือนนี้</option>
              <option value="quarter">ไตรมาสนี้</option>
              <option value="year">ปีนี้</option>
              <option value="all">ข้อมูลทั้งหมด</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase tracking-wider">
              กลุ่มงาน / แผนก
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:border-teal-300"
            >
              <option value="all">ทุกกลุ่มงาน</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase tracking-wider">
              ประเภทสาเหตุ
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:border-teal-300"
            >
              <option value="all">ทุกประเภทสาเหตุ</option>
              <option value="emergency">🚨 ฉุกเฉิน / ลาป่วย</option>
              <option value="planned">📅 วางแผนแล้ว / ลาพักผ่อน</option>
              <option value="academic">🎓 ประชุมวิชาการ / ดูงาน</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-teal-200 uppercase tracking-wider">
              ประเภทเวลาออกตรวจ
            </label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full bg-slate-900/80 text-white border border-teal-500/50 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:border-teal-300"
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="in">ในเวลาฯ</option>
              <option value="out">นอกเวลาฯ จ-ศ</option>
              <option value="out_weekend">นอกเวลาฯ ส.-อ.</option>
              <option value="both">ทั้งในและนอกเวลาฯ</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
              รายการงดตรวจ
            </span>
            <span className="text-3xl font-black text-slate-800 tracking-tight block mt-1">
              {metrics.totalCancelled}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2">จำนวนรายการในช่วงนี้</span>
        </div>

        <div className="bg-gradient-to-br from-white to-rose-50/30 p-4 rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-700 block uppercase tracking-wide">
              คนไข้ได้รับผลกระทบ
            </span>
            <span className="text-3xl font-black text-rose-700 tracking-tight block mt-1">
              {metrics.totalAffected}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2">คนไข้สะสม (คน)</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
              แผนกที่กระทบ
            </span>
            <span className="text-3xl font-black text-slate-800 tracking-tight block mt-1">
              {metrics.deptCount}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2">จำนวนแผนกไม่ซ้ำ</span>
        </div>

        <div className="bg-gradient-to-br from-white to-amber-50/40 p-4 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 block uppercase tracking-wide">
              ต้องเฝ้าระวัง
            </span>
            <span className="text-3xl font-black text-amber-600 tracking-tight block mt-1">
              {metrics.criticalCount}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2">ปิดคลินิก / จำกัด Walk-in</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
              อัตราติดต่อแจ้งคนไข้
            </span>
            <span className="text-3xl font-black text-teal-700 tracking-tight block mt-1">
              {metrics.notifyRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: `${metrics.notifyRate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
              แพทย์ตรวจแทน
            </span>
            <span className="text-3xl font-black text-emerald-700 tracking-tight block mt-1">
              {metrics.coverageRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${metrics.coverageRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Primary Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <LineChart className="w-4 h-4 text-teal-600" /> แนวโน้มตามวัน
          </h4>
          <div className="h-56 relative w-full flex-1">
            <canvas ref={chartDayRef}></canvas>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Top 5 แผนกที่มีรายการมากสุด
          </h4>
          <div className="h-56 relative w-full flex-1">
            <canvas ref={chartTop5Ref}></canvas>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-amber-600" /> สัดส่วนประเภทสาเหตุ
          </h4>
          <div className="h-44 relative w-full flex justify-center items-center">
            <canvas ref={chartRatioRef}></canvas>
          </div>
          <div className="flex justify-around text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-2 mt-2">
            <span className="text-rose-600">• ฉุกเฉิน/ป่วย</span>
            <span className="text-teal-700">• วางแผนแล้ว</span>
            <span className="text-indigo-600">• ประชุม/อบรม</span>
          </div>
        </div>
      </div>

      {/* Secondary Chart Row: Shift, Heatmap & Compare */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock3 className="w-4 h-4 text-sky-600" /> สัดส่วนช่วงเวลาออกตรวจ
          </h4>
          <div className="h-52 relative w-full flex-1">
            <canvas ref={chartTimeRef}></canvas>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-violet-600" /> วันที่ต้องเฝ้าระวังในสัปดาห์
          </h4>
          <div className="grid grid-cols-7 gap-1.5 flex-1 content-center py-2">
            {weekdayLabels.map((lbl, idx) => {
              const c = weekdayCounts[idx];
              const opacity = c === 0 ? 0.08 : 0.2 + (c / maxDayCount) * 0.75;
              return (
                <div
                  key={lbl}
                  className="rounded-lg border border-teal-100 flex flex-col items-center justify-center py-3 text-center transition-all"
                  style={{ backgroundColor: `rgba(20, 184, 166, ${opacity})` }}
                >
                  <div className="text-xs font-bold text-slate-700">{lbl}</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{c}</div>
                  <div className="text-[9px] text-slate-500 font-semibold">รายการ</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GitCompare className="w-4 h-4 text-teal-600" /> เปรียบเทียบความเสี่ยง
          </h4>
          <div className="h-52 relative w-full flex-1">
            <canvas ref={chartCompareRef}></canvas>
          </div>
        </div>
      </div>

      {/* Monitoring Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-teal-600" /> ตารางเฝ้าระวังและการบริหารผลกระทบ (Risk Control)
          </h3>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
            พบ {filteredEvents.length} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">แพทย์ / แผนก</th>
                <th className="px-4 py-2.5">วันที่งดตรวจ</th>
                <th className="px-4 py-2.5">เหตุผล</th>
                <th className="px-4 py-2.5 text-center">คนไข้กระทบ</th>
                <th className="px-4 py-2.5">แพทย์ตรวจแทน</th>
                <th className="px-4 py-2.5">การจัดการคิว</th>
                <th className="px-4 py-2.5">สถานะแจ้งคนไข้</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 text-slate-700">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-semibold">
                    ไม่มีรายการที่ต้องเฝ้าระวังในช่วงเวลาที่เลือก
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const dpt = deptMap.get(evt.DepartmentId) || {
                    name: evt.DepartmentId,
                    bg: '#f1f5f9',
                    text: '#334155',
                  };
                  return (
                    <tr
                      key={evt.ID}
                      onClick={() => onOpenEventDetail(evt)}
                      className="hover:bg-teal-50/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{evt.DoctorName || '-'}</div>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5"
                          style={{ backgroundColor: dpt.bg, color: dpt.text }}
                        >
                          {dpt.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{formatThaiDate(evt.DateStart)}</div>
                        <div className="text-[10px] text-slate-400">{evt.DateEnd !== evt.DateStart ? `ถึง ${formatThaiDate(evt.DateEnd)}` : 'วันเดียว'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {evt.Reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-black text-rose-700">
                        {evt.AffectedPatients || '0'} คน
                      </td>
                      <td className="px-4 py-3">
                        {evt.ReplacementDoc && evt.ReplacementDoc !== 'ไม่มี' && evt.ReplacementDoc.trim() !== '' ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                            {evt.ReplacementDoc}
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium">⚠️ ไม่มีแพทย์แทน</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{evt.PatientManagement || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evt.NotificationStatus === 'โทรแจ้งสำเร็จทั้งหมด'
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {evt.NotificationStatus || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
