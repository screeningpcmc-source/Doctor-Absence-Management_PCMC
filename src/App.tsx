import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
} from './services/auth';
import {
  syncEventToGoogleCalendar,
  deleteGoogleCalendarEvent,
  createOrGetAbsenceSpreadsheet,
  getSavedGASUrl,
  syncAllToGAS,
  saveAbsenceToGAS,
  deleteAbsenceFromGAS,
} from './services/googleWorkspace';
import {
  AbsenceRecord,
  Department,
  QueueRecord,
  WalkInCountRecord,
  HolidayItem,
} from './types';
import {
  INITIAL_DEPARTMENTS,
  DEFAULT_REASONS,
  getInitialAbsenceRecords,
  getInitialQueues,
  getInitialWalkInCounts,
  getHolidays,
} from './services/dataStorage';
import {
  getOperationalToday,
  deductQueueQuota,
  restoreQueueQuota,
  adjustAdminQueue,
} from './utils/absence-logic';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { ListView } from './components/ListView';
import { DashboardView } from './components/DashboardView';
import { WalkInCounterView } from './components/WalkInCounterView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { AbsenceFormModal } from './components/AbsenceFormModal';
import { EventDetailModal } from './components/EventDetailModal';
import { PinLoginModal } from './components/PinLoginModal';
import { GoogleConnectModal } from './components/GoogleConnectModal';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(() => getOperationalToday());

  // In-memory application state with LocalStorage persistence
  const [events, setEvents] = useState<AbsenceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_absence_events');
      return saved ? JSON.parse(saved) : getInitialAbsenceRecords();
    } catch {
      return getInitialAbsenceRecords();
    }
  });

  const [departments, setDepartments] = useState<Department[]>(() => {
    try {
      const saved = localStorage.getItem('app_departments');
      return saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
    } catch {
      return INITIAL_DEPARTMENTS;
    }
  });

  const [queues, setQueues] = useState<QueueRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_queues');
      return saved ? JSON.parse(saved) : getInitialQueues();
    } catch {
      return getInitialQueues();
    }
  });

  const [walkInCounts, setWalkInCounts] = useState<WalkInCountRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_walkin_counts');
      return saved ? JSON.parse(saved) : getInitialWalkInCounts();
    } catch {
      return getInitialWalkInCounts();
    }
  });

  const [reasons, setReasons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('app_reasons');
      return saved ? JSON.parse(saved) : DEFAULT_REASONS;
    } catch {
      return DEFAULT_REASONS;
    }
  });

  const holidays: HolidayItem[] = useMemo(() => getHolidays(), []);

  // Authentication State
  const [authPin, setAuthPin] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    const savedId = localStorage.getItem('google_spreadsheet_id');
    return savedId ? `https://docs.google.com/spreadsheets/d/${savedId}` : null;
  });

  // GAS and Toast notification states
  const [gasUrl, setGasUrl] = useState<string>(() => getSavedGASUrl());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // Modal states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AbsenceRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<AbsenceRecord | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // O(1) Department Map for constant-time lookups across views
  const deptMap = useMemo(() => {
    const map = new Map<string, Department>();
    for (const d of departments) {
      map.set(d.id, d);
    }
    return map;
  }, [departments]);

  // Persist state changes with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('app_absence_events', JSON.stringify(events));
      localStorage.setItem('app_departments', JSON.stringify(departments));
      localStorage.setItem('app_queues', JSON.stringify(queues));
      localStorage.setItem('app_walkin_counts', JSON.stringify(walkInCounts));
      localStorage.setItem('app_reasons', JSON.stringify(reasons));
    }, 250);
    return () => clearTimeout(timer);
  }, [events, departments, queues, walkInCounts, reasons]);

  // Initialize Google Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Operational Date Watcher: updates today's date smoothly at midnight Bangkok time
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getOperationalToday();
      setSelectedDate((prev) => (prev === today ? prev : today));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Action authorization helper
  const requirePin = useCallback((action: () => void) => {
    if (authPin && authName) {
      action();
    } else {
      setPendingAction(() => action);
      setIsPinModalOpen(true);
    }
  }, [authPin, authName]);

  const handlePinSuccess = (pin: string, userName: string) => {
    setAuthPin(pin);
    setAuthName(userName);
    setIsPinModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handlePinLogout = () => {
    setAuthPin('');
    setAuthName('');
  };

  // Google Sign-in flow
  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setIsGoogleModalOpen(false);
        showToast(`เข้าสู่ระบบ Google สำเร็จ: ${res.user.displayName || res.user.email}`, 'success');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('auth/unauthorized-domain')) {
        setIsGoogleModalOpen(true);
      } else {
        showToast(`การเชื่อมต่อ Google: ${err.message}`, 'error');
      }
      throw err;
    }
  };

  const handleGoogleSignOut = async () => {
    await googleLogout();
    setGoogleUser(null);
    showToast('ออกจากระบบ Google เรียบร้อย', 'info');
  };

  // Google Workspace / Apps Script Sync Action
  const handleSyncWorkspace = async () => {
    const currentGasUrl = getSavedGASUrl();
    if (currentGasUrl) {
      setIsSyncing(true);
      showToast('กำลังซิงค์ข้อมูลลง Google Sheets ผ่าน Google Apps Script...', 'info');
      try {
        const res = await syncAllToGAS(currentGasUrl, events, queues, walkInCounts);
        if (res.success) {
          showToast(res.message || 'ซิงค์ข้อมูลลง Google Sheets เรียบร้อย 100%!', 'success');
          if (res.spreadsheetUrl) {
            setSpreadsheetUrl(res.spreadsheetUrl);
          }
        } else {
          showToast(`ซิงค์ขัดข้อง: ${res.error}`, 'error');
        }
      } catch (err: any) {
        showToast(`เกิดข้อผิดพลาดในการซิงค์: ${err.message}`, 'error');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    if (!googleUser) {
      setIsGoogleModalOpen(true);
      return;
    }

    setIsSyncing(true);
    showToast('กำลังซิงค์ข้อมูลกับ Google Sheets & Google Calendar...', 'info');
    try {
      const sheetResult = await createOrGetAbsenceSpreadsheet();
      if (sheetResult) {
        setSpreadsheetUrl(sheetResult.url);
      }

      // Sync active events to Google Calendar
      for (const evt of events) {
        if (!evt.CalendarEventId) {
          const calId = await syncEventToGoogleCalendar(evt);
          if (calId) {
            evt.CalendarEventId = calId;
          }
        }
      }
      setEvents([...events]);
      showToast('ซิงค์ข้อมูลกับ Google Sheets และ Google Calendar เรียบร้อย!', 'success');
    } catch (err: any) {
      showToast(`การซิงค์มีข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportData = useCallback(
    (imported: {
      events?: AbsenceRecord[];
      queues?: QueueRecord[];
      walkInCounts?: WalkInCountRecord[];
    }) => {
      if (imported.events && imported.events.length > 0) {
        setEvents(imported.events);
        localStorage.setItem('app_absence_events', JSON.stringify(imported.events));
      }
      if (imported.queues && imported.queues.length > 0) {
        setQueues(imported.queues);
        localStorage.setItem('app_queues', JSON.stringify(imported.queues));
      }
      if (imported.walkInCounts && imported.walkInCounts.length > 0) {
        setWalkInCounts(imported.walkInCounts);
        localStorage.setItem('app_walkin_counts', JSON.stringify(imported.walkInCounts));
      }
      showToast('นำเข้าข้อมูลสำเร็จเรียบร้อย', 'success');
    },
    [showToast]
  );

  // Queue Operations with 0ms Optimistic UI updates
  const handleDeductQueue = useCallback((date: string, deptId: string, doctorName: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      requirePin(() => handleDeductQueue(date, deptId, doctorName));
      return;
    }

    setQueues((prev) => {
      const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = deductQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      return next;
    });
  }, [authPin, authName, requirePin]);

  const handleRestoreQueue = useCallback((date: string, deptId: string, doctorName: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      requirePin(() => handleRestoreQueue(date, deptId, doctorName));
      return;
    }

    setQueues((prev) => {
      const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = restoreQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      return next;
    });
  }, [authPin, authName, requirePin]);

  const handleAdjustAdminQueue = useCallback(
    (date: string, deptId: string, doctorName: string, action: 'increment' | 'reset') => {
      if (authPin !== '4217') {
        alert('เฉพาะหัวหน้าหน่วย (PIN แอดมิน 4217) เท่านั้นที่มีสิทธิ์ทำรายการนี้');
        return;
      }

      setQueues((prev) => {
        const idx = prev.findIndex((q) => q.Date === date && q.DepartmentId === deptId && q.DoctorName === doctorName);
        if (idx === -1) return prev;
        const target = prev[idx];
        const res = adjustAdminQueue(target.CurrentQuota, target.MaxQuota, action);
        if (!res.success) {
          alert(res.error);
          return prev;
        }
        const next = [...prev];
        next[idx] = {
          ...target,
          CurrentQuota: res.newQuota,
          LastUpdatedBy: authName || 'แอดมิน',
        };
        return next;
      });
    },
    [authPin, authName]
  );

  // Walk-in Count Update with 0ms Latency
  const handleUpdateWalkInCount = useCallback(
    (deptId: string, delta: number, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        const next = [...prev];

        if (idx !== -1) {
          const newCount = Math.max(0, prev[idx].Count + delta);
          next[idx] = {
            ...prev[idx],
            Count: newCount,
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          };
        } else {
          const dpt = deptMap.get(deptId);
          next.push({
            KeyDateDept: key,
            Date: selectedDate,
            DepartmentId: deptId,
            DepartmentName: dpt?.name || deptId,
            Count: Math.max(0, delta),
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          });
        }
        return next;
      });
    },
    [selectedDate, deptMap, authName]
  );

  const handleResetWalkInCount = useCallback(
    (deptId: string, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...prev[idx],
          Count: 0,
          NurseName: nurse,
          LastUpdated: new Date().toISOString(),
          UpdatedBy: authName || 'คัดกรอง',
        };
        return next;
      });
    },
    [selectedDate, authName]
  );

  // Save Absence Event (Create or Update)
  const handleSaveEvent = async (record: AbsenceRecord) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.ID === record.ID);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    // Create or update queue record if WalkInQuota is present
    if (record.WalkInQuota && Number(record.WalkInQuota) > 0) {
      const quotaNum = Number(record.WalkInQuota);
      const key = `${record.DateStart}_${record.DepartmentId}_${record.DoctorName}`;
      setQueues((prev) => {
        const idx = prev.findIndex((q) => q.KeyDateDeptDoc === key);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...prev[idx],
            MaxQuota: quotaNum,
            CurrentQuota: Math.min(prev[idx].CurrentQuota, quotaNum),
            LastUpdatedBy: authName || 'เจ้าหน้าที่',
          };
          return next;
        }
        return [
          ...prev,
          {
            KeyDateDeptDoc: key,
            Date: record.DateStart,
            DepartmentId: record.DepartmentId,
            DoctorName: record.DoctorName,
            MaxQuota: quotaNum,
            CurrentQuota: quotaNum,
            LastUpdatedBy: authName || 'เจ้าหน้าที่',
          },
        ];
      });
    }

    setIsFormModalOpen(false);
    setEditingEvent(null);
    showToast('บันทึกการงดออกตรวจเรียบร้อยแล้ว', 'success');

    // Asynchronously sync with Google Calendar / Apps Script in background
    const currentGasUrl = getSavedGASUrl();
    if (currentGasUrl) {
      saveAbsenceToGAS(currentGasUrl, record).then((res) => {
        if (res.calendarEventId) {
          setEvents((curr) =>
            curr.map((e) => (e.ID === record.ID ? { ...e, CalendarEventId: res.calendarEventId } : e))
          );
        }
      });
    } else if (googleUser) {
      syncEventToGoogleCalendar(record).then((calId) => {
        if (calId) {
          setEvents((curr) =>
            curr.map((e) => (e.ID === record.ID ? { ...e, CalendarEventId: calId } : e))
          );
        }
      });
    }
  };

  // Delete Absence Event with User Confirmation (Mandatory for Destructive Actions)
  const handleDeleteEvent = async (id: string) => {
    const target = events.find((e) => e.ID === id);
    if (!target) return;

    setEvents((prev) => prev.filter((e) => e.ID !== id));
    setIsFormModalOpen(false);
    setEditingEvent(null);
    setIsDetailModalOpen(false);
    setInspectingEvent(null);
    showToast('ลบรายการงดออกตรวจเรียบร้อยแล้ว', 'info');

    // Delete calendar event in background if synced
    const currentGasUrl = getSavedGASUrl();
    if (currentGasUrl) {
      deleteAbsenceFromGAS(currentGasUrl, id, target.CalendarEventId);
    } else if (googleUser && target.CalendarEventId) {
      deleteGoogleCalendarEvent(target.CalendarEventId);
    }
  };

  const handleOpenEdit = (record: AbsenceRecord) => {
    requirePin(() => {
      setEditingEvent(record);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenAdd = () => {
    requirePin(() => {
      setEditingEvent(null);
      setIsFormModalOpen(true);
    });
  };

  const handleOpenDetail = (record: AbsenceRecord) => {
    setInspectingEvent(record);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden text-slate-800 bg-slate-50 font-sans">
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        authPin={authPin}
        authName={authName}
        onOpenPinLogin={() => setIsPinModalOpen(true)}
        onPinLogout={handlePinLogout}
        onOpenAddModal={handleOpenAdd}
        googleUser={googleUser}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isSyncing={isSyncing}
        onSyncWorkspace={handleSyncWorkspace}
        spreadsheetUrl={spreadsheetUrl}
        hasGASConfigured={Boolean(gasUrl)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            departments={departments}
            deptMap={deptMap}
            queues={queues}
            holidays={holidays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenEventDetail={handleOpenDetail}
            onDeductQueue={handleDeductQueue}
            onRestoreQueue={handleRestoreQueue}
            authPin={authPin}
          />
        )}

        {currentView === 'list' && (
          <ListView
            events={events}
            departments={departments}
            deptMap={deptMap}
            onEditEvent={handleOpenEdit}
            onOpenEventDetail={handleOpenDetail}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            events={events}
            departments={departments}
            deptMap={deptMap}
            onOpenEventDetail={handleOpenDetail}
          />
        )}

        {currentView === 'walkin-counter' && (
          <WalkInCounterView
            departments={departments}
            deptMap={deptMap}
            walkInCounts={walkInCounts}
            queues={queues}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onUpdateCount={handleUpdateWalkInCount}
            onResetCount={handleResetWalkInCount}
            authPin={authPin}
            onRequirePin={requirePin}
          />
        )}

        {currentView === 'admin-settings' && (
          <AdminSettingsView
            queues={queues}
            selectedDate={selectedDate}
            onAdjustQueue={handleAdjustAdminQueue}
            reasons={reasons}
            onSaveReasons={setReasons}
            departments={departments}
            deptMap={deptMap}
            onSaveDepartments={setDepartments}
            authPin={authPin}
          />
        )}
      </main>

      {/* Modal Dialogs */}
      <PinLoginModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
      />

      <AbsenceFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialData={editingEvent}
        departments={departments}
        reasons={reasons}
        selectedDate={selectedDate}
        authName={authName}
      />

      <EventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setInspectingEvent(null);
        }}
        event={inspectingEvent}
        deptMap={deptMap}
        onEdit={(evt) => {
          setIsDetailModalOpen(false);
          handleOpenEdit(evt);
        }}
      />

      <GoogleConnectModal
        isOpen={isGoogleModalOpen}
        onClose={() => {
          setIsGoogleModalOpen(false);
          setGasUrl(getSavedGASUrl());
        }}
        googleUser={googleUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onSyncWorkspace={handleSyncWorkspace}
        isSyncing={isSyncing}
        spreadsheetUrl={spreadsheetUrl}
        events={events}
        queues={queues}
        walkInCounts={walkInCounts}
        onImportData={handleImportData}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700 bg-slate-900/95 backdrop-blur-xs text-white max-w-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-400 ring-2 ring-emerald-400/30'
                : toast.type === 'error'
                ? 'bg-rose-400 ring-2 ring-rose-400/30'
                : 'bg-teal-400 ring-2 ring-teal-400/30'
            }`}
          />
          <span className="leading-snug">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
