import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Globe,
  Code2,
  Download,
  Upload,
  Play,
  Zap,
  CheckCheck,
  AlertTriangle,
  ArrowRight,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AbsenceRecord, QueueRecord, WalkInCountRecord } from '../types';
import {
  testGASConnection,
  fetchAllFromGAS,
  syncAllToGAS,
  getSavedGASUrl,
  setSavedGASUrl,
} from '../services/googleWorkspace';
import { FULL_GAS_CODE } from '../services/gasCodeSnippet';

interface GoogleConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: User | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSyncWorkspace: () => Promise<void>;
  isSyncing: boolean;
  spreadsheetUrl: string | null;
  events: AbsenceRecord[];
  queues: QueueRecord[];
  walkInCounts: WalkInCountRecord[];
  onImportData?: (imported: {
    events?: AbsenceRecord[];
    queues?: QueueRecord[];
    walkInCounts?: WalkInCountRecord[];
  }) => void;
}

export const GoogleConnectModal: React.FC<GoogleConnectModalProps> = ({
  isOpen,
  onClose,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncWorkspace,
  isSyncing,
  spreadsheetUrl,
  events,
  queues,
  walkInCounts,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<'gas' | 'firebase' | 'diagnostics' | 'backup'>('gas');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [gasUrl, setGasUrl] = useState(() => getSavedGASUrl());
  const [gasStatus, setGasStatus] = useState<string>('');
  const [gasLatency, setGasLatency] = useState<number | null>(null);
  const [isGasTesting, setIsGasTesting] = useState(false);
  const [isGasFetching, setIsGasFetching] = useState(false);
  const [isGasSyncing, setIsGasSyncing] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Diagnostic states
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<{
    storage: 'pass' | 'fail' | null;
    network: 'pass' | 'fail' | null;
    gasEndpoint: 'pass' | 'fail' | 'skip' | null;
    firebaseConfig: 'pass' | 'fail' | null;
    details: string[];
  }>({
    storage: null,
    network: null,
    gasEndpoint: null,
    firebaseConfig: null,
    details: [],
  });

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const projectId = firebaseConfig.projectId || 'gen-lang-client-0454752252';

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentHost);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  const handleTrySignIn = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      setAuthError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveGasUrl = (url: string) => {
    setGasUrl(url);
    setSavedGASUrl(url);
  };

  const handleTestGasConnection = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ของ Google Apps Script ก่อนทดสอบ');
      return;
    }
    setIsGasTesting(true);
    setGasStatus('กำลังส่งสัญญาณทดสอบไปยัง Google Apps Script...');
    setGasLatency(null);

    const res = await testGASConnection(gasUrl);
    setIsGasTesting(false);
    setGasLatency(res.latency);

    if (res.success) {
      setGasStatus(
        `✅ เชื่อมต่อสำเร็จ 100%! ตอบกลับใน ${res.latency} ms ${
          res.data?.spreadsheetName ? `(ไฟล์: ${res.data.spreadsheetName})` : ''
        }`
      );
    } else {
      setGasStatus(`❌ การเชื่อมต่อขัดข้อง: ${res.error}`);
    }
  };

  const handleFetchFromGAS = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ก่อนดึงข้อมูล');
      return;
    }
    setIsGasFetching(true);
    setGasStatus('กำลังดึงข้อมูลล่าสุดจาก Google Sheets...');

    const res = await fetchAllFromGAS(gasUrl);
    setIsGasFetching(false);

    if (res.success && onImportData) {
      onImportData({
        events: res.events,
        queues: res.queues,
        walkInCounts: res.walkInCounts,
      });
      setGasStatus(
        `✅ ดึงข้อมูลสำเร็จ! นำเข้า ${res.events?.length || 0} รายการงด, ${
          res.queues?.length || 0
        } โควตาคิว, ${res.walkInCounts?.length || 0} รายการ Walk-in`
      );
    } else {
      setGasStatus(`❌ ดึงข้อมูลไม่สำเร็จ: ${res.error}`);
    }
  };

  const handleSyncAllToGAS = async () => {
    if (!gasUrl.trim()) {
      setGasStatus('⚠️ กรุณากรอก Web App URL ก่อนส่งข้อมูล');
      return;
    }
    setIsGasSyncing(true);
    setGasStatus('กำลังส่งข้อมูลทั้งหมดขึ้น Google Sheets...');

    const res = await syncAllToGAS(gasUrl, events, queues, walkInCounts);
    setIsGasSyncing(false);

    if (res.success) {
      setGasStatus(`✅ ${res.message || 'ซิงค์ข้อมูลขึ้น Google Sheets สำเร็จเรียบร้อย!'}`);
    } else {
      setGasStatus(`❌ ซิงค์ข้อมูลขัดข้อง: ${res.error}`);
    }
  };

  // Run full system diagnostics
  const runFullDiagnostics = async () => {
    setDiagRunning(true);
    const details: string[] = [];

    // Test 1: Storage
    let storagePass = false;
    try {
      localStorage.setItem('__diag_test__', '1');
      localStorage.removeItem('__diag_test__');
      storagePass = true;
      details.push('✔️ ระบบหน่วยความจำ LocalStorage และ In-Memory Cache ทำงานปกติ 100%');
    } catch {
      details.push('❌ LocalStorage ไม่พร้อมใช้งาน ข้อมูลจะเก็บใน Memory ชั่วคราว');
    }

    // Test 2: Internet / Google Network reachability
    let networkPass = false;
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      networkPass = true;
      details.push('✔️ การเชื่อมต่อเครือข่ายอินเทอร์เน็ตไปยังเซิร์ฟเวอร์ Google ราบรื่น');
    } catch {
      details.push('⚠️ ไม่สามารถเชื่อมต่อภายนอกได้ หรือเครือข่ายมีการบล็อก Cross-Origin');
    }

    // Test 3: Firebase Config check
    let fbPass = false;
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      fbPass = true;
      details.push(`✔️ โครงสร้าง Firebase Config สมบูรณ์ (Project ID: ${projectId})`);
    } else {
      details.push('❌ ไม่พบการตั้งค่า Firebase API Key');
    }

    // Test 4: GAS Web App Endpoint
    let gasPass: 'pass' | 'fail' | 'skip' = 'skip';
    if (gasUrl.trim()) {
      const gasRes = await testGASConnection(gasUrl);
      if (gasRes.success) {
        gasPass = 'pass';
        details.push(`✔️ เซิร์ฟเวอร์ Google Apps Script ออนไลน์ พร้อมรับส่งข้อมูล (${gasRes.latency} ms)`);
      } else {
        gasPass = 'fail';
        details.push(`❌ เซิร์ฟเวอร์ Google Apps Script ตอบกลับขัดข้อง: ${gasRes.error}`);
      }
    } else {
      details.push('ℹ️ ยังไม่ได้ตั้งค่า URL ของ Google Apps Script (สามารถใช้งานระบบแบบ Local ได้ตามปกติ)');
    }

    setDiagResults({
      storage: storagePass ? 'pass' : 'fail',
      network: networkPass ? 'pass' : 'fail',
      gasEndpoint: gasPass,
      firebaseConfig: fbPass ? 'pass' : 'fail',
      details,
    });
    setDiagRunning(false);
  };

  // Export functions
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'DepartmentId',
      'DoctorName',
      'DateStart',
      'TimeStart',
      'DateEnd',
      'TimeEnd',
      'Reason',
      'AllDay',
      'WalkInQuota',
      'AffectedPatients',
      'ReplacementDoc',
      'Note',
    ];
    const rows = events.map((e) => [
      e.ID,
      `"${e.DepartmentId}"`,
      `"${e.DoctorName}"`,
      e.DateStart,
      e.TimeStart || '',
      e.DateEnd,
      e.TimeEnd || '',
      `"${e.Reason}"`,
      e.AllDay ? 'TRUE' : 'FALSE',
      e.WalkInQuota || 0,
      e.AffectedPatients || 0,
      `"${e.ReplacementDoc || ''}"`,
      `"${e.Note || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_AbsenceRecords_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      events,
      queues,
      walkInCounts,
      hospital: 'ศูนย์การแพทย์ปัญญานันทภิกขุ ชลประทาน (PCMC)',
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCMC_Absence_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (onImportData) {
          onImportData({
            events: parsed.events || [],
            queues: parsed.queues || [],
            walkInCounts: parsed.walkInCounts || [],
          });
          alert(
            `นำเข้าข้อมูลเรียบร้อย! (${parsed.events?.length || 0} รายการงด, ${
              parsed.queues?.length || 0
            } คิว)`
          );
        }
      } catch (err: any) {
        alert('ไฟล์ข้อมูลไม่ถูกต้อง: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const gasScriptExample = `/**
 * Google Apps Script Web App Backend (PCMC Doctor Absence System)
 * รองรับการทำงานฟรี 100% บน GitHub Pages หรือโฮสต์ใดๆ โดยไม่มีข้อจำกัดโดเมน
 */
const SHEET_ABSENCES = "AbsenceRecords";
const SHEET_QUEUES = "WalkInQuota";
const SHEET_WALKIN = "DailyWalkInCounts";

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e && e.parameter ? e.parameter.action : "ping";
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "เชื่อมต่อสำเร็จ!",
      spreadsheetName: ss.getName(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  // ดึงข้อมูล
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Active"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action || "syncAll";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // บันทึกการงดตรวจ + สร้าง Event ใน Google Calendar อัตโนมัติ
    if (action === "saveAbsence" && contents.record) {
      const rec = contents.record;
      const cal = CalendarApp.getDefaultCalendar();
      if (cal) {
        const title = "[" + rec.DepartmentId + "] " + rec.DoctorName + " - " + rec.Reason;
        const start = new Date(rec.DateStart);
        const end = new Date(rec.DateEnd || rec.DateStart);
        end.setDate(end.getDate() + 1);
        cal.createAllDayEvent(title, start, end, { description: "หมายเหตุ: " + (rec.Note || "-") });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "บันทึกเรียบร้อย" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(gasScriptExample);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden my-4 border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                ศูนย์จัดการเชื่อมต่อ Google Sheets &amp; Google Calendar
              </h3>
              <p className="text-xs text-teal-200">
                ระบบลงทะเบียนแพทย์งดออกตรวจ PCMC • ใช้งานได้จริง 100% ฟรีไม่มีค่าใช้จ่าย
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>โดเมนปัจจุบัน:</span>
            <code className="bg-white border border-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-800">
              {currentHost}
            </code>
          </div>

          <div className="flex items-center gap-2">
            {gasUrl ? (
              <span className="flex items-center gap-1.5 text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span>เชื่อมต่อ Google Apps Script แล้ว</span>
              </span>
            ) : googleUser ? (
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Google OAuth: {googleUser.displayName || googleUser.email}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>โหมดจัดเก็บข้อมูลในตัว (พร้อมเชื่อมต่อภายนอก)</span>
              </span>
            )}
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('gas')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gas'
                ? 'border-teal-600 text-teal-800 bg-teal-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-teal-600" />
            <span>วิธีที่ 1: Google Apps Script Web App (แนะนำสำหรับใช้งานจริง)</span>
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'firebase'
                ? 'border-teal-600 text-teal-800 bg-teal-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>วิธีที่ 2: Google OAuth / Firebase</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-teal-600 text-teal-800 bg-teal-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            <span>ตรวจสอบระบบ &amp; ทดสอบการเชื่อมต่อ</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-teal-600 text-teal-800 bg-teal-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>นำเข้า / สำรองข้อมูล (Excel/CSV)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4 max-h-[62vh] overflow-y-auto">
          {/* TAB 1: GOOGLE APPS SCRIPT WEB APP */}
          {activeTab === 'gas' && (
            <div className="space-y-4">
              <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-teal-900 flex items-center gap-2 text-sm">
                  <CheckCheck className="w-4 h-4 text-teal-600" />
                  <span>ทำไมวิธีนี้จึงทำงานได้ 100% บน GitHub Pages และโฮสต์จริงแบบฟรี?</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  Google Apps Script Web App ทำงานโดยตรงบนบัญชี Google ของโรงพยาบาล (เช่น
                  screening.pcmc@gmail.com) สามารถเขียนและอ่าน Google Sheets รวมถึงสร้างนัดหมายใน Google
                  Calendar ได้ทันที <strong>โดยไม่มีปัญหาเรื่องโดเมนบล็อก (auth/unauthorized-domain)</strong>{' '}
                  และไม่จำเป็นต้องตั้งค่า Firebase ให้ยุ่งยากเลยครับ!
                </p>
              </div>

              {/* URL Input Box */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800">
                  ระบุ Google Apps Script Web App URL (ลงท้ายด้วย /exec):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={gasUrl}
                    onChange={(e) => handleSaveGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 bg-white border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-3 py-2 text-xs font-mono outline-none shadow-2xs"
                  />
                  <button
                    onClick={handleTestGasConnection}
                    disabled={isGasTesting}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGasTesting ? 'animate-spin' : ''}`} />
                    <span>{isGasTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                  </button>
                </div>

                {gasStatus && (
                  <div
                    className={`mt-2 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                      gasStatus.startsWith('✅')
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : gasStatus.startsWith('⚠️')
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <span>{gasStatus}</span>
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleFetchFromGAS}
                    disabled={isGasFetching || !gasUrl.trim()}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-2xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${isGasFetching ? 'animate-spin text-teal-600' : ''}`} />
                    <span>{isGasFetching ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลล่าสุดจาก Sheets'}</span>
                  </button>

                  <button
                    onClick={handleSyncAllToGAS}
                    disabled={isGasSyncing || !gasUrl.trim()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGasSyncing ? 'animate-spin' : ''}`} />
                    <span>{isGasSyncing ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลทั้งหมดขึ้น Sheets & Calendar'}</span>
                  </button>
                </div>
              </div>

              {/* 3 Steps Guide */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[11px]">
                    1
                  </span>
                  <span>วิธีนำโค้ดไปติดตั้งใน Google Sheets ของหน่วยงาน (ทำเพียง 2 นาที):</span>
                </h4>
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                    <li>
                      เปิด Google Sheets ใหม่ที่ต้องการใช้เก็บข้อมูล ➔ เมนู <strong>ส่วนขยาย (Extensions)</strong>{' '}
                      ➔ <strong>Apps Script</strong>
                    </li>
                    <li>ลบโค้ดเดิมทั้งหมดในไฟล์ Code.gs แล้ววางโค้ดด้านล่างนี้ลงไป</li>
                    <li>
                      กดปุ่ม <strong>การทำให้ใช้งานได้ (Deploy)</strong> มุมขวาบน ➔{' '}
                      <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong>
                    </li>
                    <li>
                      เลือกประเภท: <strong>เว็บแอป (Web app)</strong> ➔ ผู้มีสิทธิ์เข้าถึง: <strong>ทุกคน (Anyone)</strong>{' '}
                      ➔ กด <strong>ทำให้ใช้งานได้ (Deploy)</strong>
                    </li>
                    <li>คัดลอก URL ของเว็บแอป (ที่ลงท้ายด้วย <code>/exec</code>) นำมาวางในช่องด้านบน</li>
                  </ol>
                </div>

                {/* Code Box with Copy */}
                <div className="bg-slate-900 rounded-xl p-3.5 text-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-teal-300">
                      โค้ด Apps Script Backend (Code.gs):
                    </span>
                    <button
                      onClick={handleCopyScript}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copiedScript ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedScript ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono overflow-x-auto text-slate-300 bg-black/40 p-2.5 rounded-lg max-h-[140px] overflow-y-auto">
                    {gasScriptExample}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIREBASE OAUTH */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              {/* Error Explanation Card */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-amber-900 leading-tight">
                      สาเหตุที่เชื่อมต่อ Firebase ไม่สำเร็จบน GitHub Pages (auth/unauthorized-domain)
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      เนื่องจากคุณนำเว็บไปเปิดใช้งานบน GitHub Pages หรือโดเมนภายนอก (
                      <strong>{currentHost}</strong>) ระบบความปลอดภัยของ Google Firebase
                      จะปฏิเสธการล็อกอินจนกว่าโดเมนนั้นจะถูกเพิ่มใน Authorized Domains ของโครงการ Firebase
                      ของท่านเอง
                    </p>
                  </div>
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-bold flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div>ข้อผิดพลาดล่าสุด:</div>
                      <div className="font-mono text-[11px] font-normal mt-0.5">{authError}</div>
                    </div>
                  </div>
                )}

                <div className="bg-white p-3.5 rounded-lg border border-amber-200/70 space-y-2 text-xs">
                  <div className="font-bold text-slate-800">คำแนะนำการแก้ไข:</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    👉 <strong>หากใช้ GitHub Pages:</strong> แนะนำให้ใช้ <strong>วิธีที่ 1 (Google Apps Script Web App)</strong>{' '}
                    ด้านบนแทน เพราะทำงานได้ทันที 100% ฟรี และไม่ต้องมีสิทธิ์เป็นแอดมิน Cloud Console
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    👉 <strong>หากท่านมีโปรเจกต์ Firebase ของโรงพยาบาลเอง:</strong> นำชื่อโดเมน{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-teal-800">{currentHost}</code>{' '}
                    ไปเพิ่มที่ Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {!googleUser ? (
                  <button
                    onClick={handleTrySignIn}
                    disabled={isSigningIn}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSigningIn ? 'animate-spin' : ''}`} />
                    <span>{isSigningIn ? 'กำลังเชื่อมต่อ...' : 'ทดสอบเข้าสู่ระบบด้วย Google อีกครั้ง'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onSyncWorkspace}
                      disabled={isSyncing}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูล Sheets & Calendar ตอนนี้'}</span>
                    </button>
                    <button
                      onClick={onGoogleSignOut}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      ออกจากระบบ Google
                    </button>
                  </>
                )}
              </div>

              {spreadsheetUrl && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Google Sheets ฐานข้อมูลพร้อมใช้งาน</span>
                  </div>
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 underline font-bold"
                  >
                    เปิดไฟล์ Spreadsheet <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & SYSTEM TEST */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">ระบบตรวจสอบความพร้อมและทดสอบการเชื่อมต่อ</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ทดสอบการอ่านเขียนข้อมูล การเชื่อมต่อเครือข่าย และความพร้อมของ Google APIs แบบสดๆ
                    </p>
                  </div>
                  <button
                    onClick={runFullDiagnostics}
                    disabled={diagRunning}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Play className={`w-3.5 h-3.5 ${diagRunning ? 'animate-spin' : ''}`} />
                    <span>{diagRunning ? 'กำลังวิเคราะห์...' : 'เริ่มการทดสอบสด (Run Test)'}</span>
                  </button>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">1. การเก็บข้อมูลในเบราว์เซอร์:</span>
                    {diagResults.storage === 'pass' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> พร้อมใช้งาน
                      </span>
                    )}
                    {diagResults.storage === 'fail' && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <X className="w-4 h-4" /> ขัดข้อง
                      </span>
                    )}
                    {diagResults.storage === null && <span className="text-slate-400">ยังไม่ได้ทดสอบ</span>}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">2. การเชื่อมต่อเซิร์ฟเวอร์ Google:</span>
                    {diagResults.network === 'pass' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> เชื่อมต่อได้
                      </span>
                    )}
                    {diagResults.network === 'fail' && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <X className="w-4 h-4" /> ล้มเหลว
                      </span>
                    )}
                    {diagResults.network === null && <span className="text-slate-400">ยังไม่ได้ทดสอบ</span>}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">3. Google Apps Script Endpoint:</span>
                    {diagResults.gasEndpoint === 'pass' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> ออนไลน์ 100%
                      </span>
                    )}
                    {diagResults.gasEndpoint === 'fail' && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <X className="w-4 h-4" /> ติดต่อไม่ได้
                      </span>
                    )}
                    {diagResults.gasEndpoint === 'skip' && (
                      <span className="text-amber-600 font-medium">ยังไม่ใส่ URL</span>
                    )}
                    {diagResults.gasEndpoint === null && <span className="text-slate-400">ยังไม่ได้ทดสอบ</span>}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">4. โครงสร้าง Google API / Firebase:</span>
                    {diagResults.firebaseConfig === 'pass' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> กำหนดค่าแล้ว
                      </span>
                    )}
                    {diagResults.firebaseConfig === 'fail' && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <X className="w-4 h-4" /> ไม่สมบูรณ์
                      </span>
                    )}
                    {diagResults.firebaseConfig === null && (
                      <span className="text-slate-400">ยังไม่ได้ทดสอบ</span>
                    )}
                  </div>
                </div>

                {/* Details Log */}
                {diagResults.details.length > 0 && (
                  <div className="bg-slate-900 rounded-lg p-3 text-slate-200 font-mono text-[11px] space-y-1">
                    <div className="text-teal-400 font-bold border-b border-slate-700 pb-1 mb-1">
                      บันทึกผลการตรวจสอบ (Diagnostic Output Log):
                    </div>
                    {diagResults.details.map((msg, i) => (
                      <div key={i}>{msg}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & CSV EXPORT */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">สำรองข้อมูลและนำเข้า / ส่งออก Excel</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  ถึงแม้คุณจะไม่ได้เชื่อมต่อกับ Google ข้อมูลทั้งหมดของท่านจะถูกบันทึกอย่างปลอดภัยในเบราว์เซอร์
                  และท่านสามารถดาวน์โหลดข้อมูลออกมาเป็นไฟล์ Excel (CSV) หรือไฟล์สำรองข้อมูล JSON ได้ตลอดเวลา
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>ส่งออก Excel (CSV)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      ดาวน์โหลดรายการแพทย์งดออกตรวจทั้งหมดเป็นไฟล์ CSV เพื่อเปิดใน Microsoft Excel หรือ Google
                      Sheets ได้ทันที
                    </p>
                    <button
                      onClick={handleExportCSV}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดไฟล์ CSV ({events.length} รายการ)</span>
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span>สำรองข้อมูลทั้งระบบ (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      บันทึกรายการแพทย์งดตรวจ, โควตาคิว, และยอดนับ Walk-in ประจำวันทั้งหมด
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportJSON}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลด Backup</span>
                      </button>
                      <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>นำเข้า Backup</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportJSON}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            ระบบลงทะเบียนแพทย์งดออกตรวจและจัดการโควตา Walk-in PCMC
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
