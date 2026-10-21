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
  fetchAllFromGAS,
  getShareableLink,
  saveQueueToGAS,
  saveWalkInToGAS,
} from './services/googleWorkspace';
import {
  subscribeToAbsences,
  subscribeToQueues,
  subscribeToWalkIns,
  saveAbsenceToFirestore,
  deleteAbsenceFromFirestore,
  saveQueueToFirestore,
  deleteQueueFromFirestore,
  saveWalkInToFirestore,
  pushBatchToFirestore,
  subscribeToBroadcast,
} from './services/firestoreSync';
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
import { syncGoogleCalendarHolidays } from './services/holidaysService';
import {
  getOperationalToday,
  deductQueueQuota,
  restoreQueueQuota,
  adjustAdminQueue,
  normalizeDoctorName,
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

  const [holidays, setHolidays] = useState<HolidayItem[]>(() => getHolidays());

  // Background sync for Google Calendar Thailand holidays
  useEffect(() => {
    syncGoogleCalendarHolidays().then((res) => {
      if (res && res.success && res.holidays && res.holidays.length > 0) {
        setHolidays(res.holidays);
      }
    });
  }, []);

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

  // Cross-Device Sync 1: Real-time Firestore Cloud Synchronization
  useEffect(() => {
    let isInitialized = false;

    // Listen to real-time changes across all hospital machines
    const unsubAbsences = subscribeToAbsences((records) => {
      if (records) {
        setEvents(records);
        isInitialized = true;
      }
    });

    const unsubQueues = subscribeToQueues((qList) => {
      if (qList) {
        // Automatic deduplication by Date + Dept + normalizeDoctorName
        const dedupedMap = new Map<string, QueueRecord>();
        const dupKeysToDelete: string[] = [];

        for (const q of qList) {
          const normKey = `${q.Date}_${q.DepartmentId}_${normalizeDoctorName(q.DoctorName)}`;
          if (!dedupedMap.has(normKey)) {
            dedupedMap.set(normKey, q);
          } else {
            const existing = dedupedMap.get(normKey)!;
            // Prioritize the queue that preserves counted/deducted patients (lower CurrentQuota)
            if (q.CurrentQuota < existing.CurrentQuota) {
              dupKeysToDelete.push(existing.KeyDateDeptDoc);
              dedupedMap.set(normKey, q);
            } else if (existing.CurrentQuota < q.CurrentQuota) {
              dupKeysToDelete.push(q.KeyDateDeptDoc);
            } else if (q.MaxQuota >= existing.MaxQuota) {
              dupKeysToDelete.push(existing.KeyDateDeptDoc);
              dedupedMap.set(normKey, q);
            } else {
              dupKeysToDelete.push(q.KeyDateDeptDoc);
            }
          }
        }

        // Clean up redundant duplicate entries in Firestore in background
        dupKeysToDelete.forEach((k) => {
          if (k) deleteQueueFromFirestore(k).catch(() => {});
        });

        const dedupedQueues = Array.from(dedupedMap.values());
        try {
          localStorage.setItem('app_queues', JSON.stringify(dedupedQueues));
        } catch {}
        setQueues(dedupedQueues);
      }
    });

    const unsubWalkIns = subscribeToWalkIns((wList) => {
      if (wList) {
        setWalkInCounts(wList);
      }
    });

    // Cross-tab broadcast listener on same machine (0ms latency between tabs/windows)
    const unsubBroadcast = subscribeToBroadcast((type, data) => {
      if (type === 'ABSENCE_SAVED' && data) {
        setEvents((prev) => {
          const idx = prev.findIndex((e) => e.ID === data.ID);
          return idx !== -1 ? prev.map((e) => (e.ID === data.ID ? data : e)) : [data, ...prev];
        });
      } else if (type === 'ABSENCE_DELETED' && data) {
        setEvents((prev) => prev.filter((e) => e.ID !== data.id));
      } else if (type === 'QUEUE_SAVED' && data) {
        setQueues((prev) => {
          const key = data.KeyDateDeptDoc || `${data.Date}_${data.DepartmentId}_${data.DoctorName}`;
          const normDoc = normalizeDoctorName(data.DoctorName);
          const filtered = prev.filter(
            (q) =>
              q.KeyDateDeptDoc !== key &&
              !(
                q.Date === data.Date &&
                q.DepartmentId === data.DepartmentId &&
                normalizeDoctorName(q.DoctorName) === normDoc
              )
          );
          return [...filtered, data];
        });
      } else if (type === 'QUEUE_DELETED' && data) {
        setQueues((prev) =>
          prev.filter(
            (q) =>
              q.KeyDateDeptDoc !== data.keyDateDeptDoc &&
              !q.KeyDateDeptDoc.includes(data.keyDateDeptDoc)
          )
        );
      } else if (type === 'WALKIN_SAVED' && data) {
        setWalkInCounts((prev) => {
          const key = data.KeyDateDept || `${data.Date}_${data.DepartmentId}`;
          const idx = prev.findIndex((w) => w.KeyDateDept === key);
          return idx !== -1 ? prev.map((w) => (w.KeyDateDept === key ? data : w)) : [...prev, data];
        });
      }
    });

    // If Firestore database is brand new and empty, seed current local records to cloud
    const seedTimer = setTimeout(() => {
      if (!isInitialized && events.length > 0) {
        pushBatchToFirestore(events, queues, walkInCounts).catch(() => {});
      }
    }, 2500);

    return () => {
      clearTimeout(seedTimer);
      unsubAbsences();
      unsubQueues();
      unsubWalkIns();
      unsubBroadcast();
    };
  }, []);

  // Cross-Device Sync 2: Google Apps Script Web App background polling & auto-fetch
  useEffect(() => {
    if (!gasUrl) return;
    let isMounted = true;

    const pullFromGAS = async (quiet = true) => {
      try {
        const res = await fetchAllFromGAS(gasUrl);
        if (isMounted && res.success) {
          if (res.events && res.events.length > 0) {
            setEvents(res.events);
          }
          if (res.queues && res.queues.length > 0) {
            setQueues((prevLocalQueues) => {
              const mergedMap = new Map<string, QueueRecord>();
              for (const rq of res.queues!) {
                const normKey = `${rq.Date}_${rq.DepartmentId}_${normalizeDoctorName(rq.DoctorName)}`;
                mergedMap.set(normKey, rq);
              }
              for (const lq of prevLocalQueues) {
                const normKey = `${lq.Date}_${lq.DepartmentId}_${normalizeDoctorName(lq.DoctorName)}`;
                const rq = mergedMap.get(normKey);
                if (!rq) {
                  mergedMap.set(normKey, lq);
                } else if (lq.CurrentQuota < rq.CurrentQuota && lq.MaxQuota === rq.MaxQuota) {
                  // Local has patients counted/deducted! Preserve local and push back to GAS
                  mergedMap.set(normKey, lq);
                  if (gasUrl) {
                    saveQueueToGAS(gasUrl, lq).catch(() => {});
                  }
                }
              }
              const merged = Array.from(mergedMap.values());
              try {
                localStorage.setItem('app_queues', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
          if (res.walkInCounts && res.walkInCounts.length > 0) {
            setWalkInCounts((prevLocalCounts) => {
              const mergedMap = new Map<string, WalkInCountRecord>();
              for (const rw of res.walkInCounts!) {
                mergedMap.set(rw.KeyDateDept, rw);
              }
              for (const lw of prevLocalCounts) {
                const rw = mergedMap.get(lw.KeyDateDept);
                if (!rw) {
                  mergedMap.set(lw.KeyDateDept, lw);
                } else if (lw.Count > rw.Count) {
                  mergedMap.set(lw.KeyDateDept, lw);
                  if (gasUrl) {
                    saveWalkInToGAS(gasUrl, lw).catch(() => {});
                  }
                }
              }
              const merged = Array.from(mergedMap.values());
              try {
                localStorage.setItem('app_walkin_counts', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
          if (!quiet) {
            showToast('อัปเดตข้อมูลล่าสุดจาก Google Sheets สำเร็จเรียบร้อย', 'success');
          }
        }
      } catch (err: any) {
        console.warn('Background GAS sync note:', err.message);
      }
    };

    // Immediate pull when opening app on another machine
    pullFromGAS(true);

    // Auto-refresh every 30 seconds so all computers and stations stay updated
    const pollInterval = setInterval(() => {
      pullFromGAS(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [gasUrl]);

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
      const normDoc = normalizeDoctorName(doctorName);
      const idx = prev.findIndex(
        (q) => q.Date === date && q.DepartmentId === deptId && normalizeDoctorName(q.DoctorName) === normDoc
      );
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = deductQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      const updatedQueue = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      next[idx] = updatedQueue;
      try {
        localStorage.setItem('app_queues', JSON.stringify(next));
      } catch {}
      saveQueueToFirestore(updatedQueue).catch(() => {});
      if (gasUrl) {
        saveQueueToGAS(gasUrl, updatedQueue).catch(() => {});
      }
      return next;
    });
  }, [authPin, authName, requirePin, gasUrl]);

  const handleRestoreQueue = useCallback((date: string, deptId: string, doctorName: string) => {
    if (authPin !== '4000' && authPin !== '4217') {
      requirePin(() => handleRestoreQueue(date, deptId, doctorName));
      return;
    }

    setQueues((prev) => {
      const normDoc = normalizeDoctorName(doctorName);
      const idx = prev.findIndex(
        (q) => q.Date === date && q.DepartmentId === deptId && normalizeDoctorName(q.DoctorName) === normDoc
      );
      if (idx === -1) return prev;
      const target = prev[idx];
      const result = restoreQueueQuota(target.CurrentQuota, target.MaxQuota);
      if (!result.success) {
        alert(result.error);
        return prev;
      }
      const next = [...prev];
      const updatedQueue = {
        ...target,
        CurrentQuota: result.newQuota,
        LastUpdatedBy: authName || 'เจ้าหน้าที่',
      };
      next[idx] = updatedQueue;
      try {
        localStorage.setItem('app_queues', JSON.stringify(next));
      } catch {}
      saveQueueToFirestore(updatedQueue).catch(() => {});
      if (gasUrl) {
        saveQueueToGAS(gasUrl, updatedQueue).catch(() => {});
      }
      return next;
    });
  }, [authPin, authName, requirePin, gasUrl]);

  const handleAdjustAdminQueue = useCallback(
    (date: string, deptId: string, doctorName: string, action: 'increment' | 'reset') => {
      if (authPin !== '4217') {
        alert('เฉพาะหัวหน้าหน่วย (PIN แอดมิน 4217) เท่านั้นที่มีสิทธิ์ทำรายการนี้');
        return;
      }

      setQueues((prev) => {
        const normDoc = normalizeDoctorName(doctorName);
        const idx = prev.findIndex(
          (q) => q.Date === date && q.DepartmentId === deptId && normalizeDoctorName(q.DoctorName) === normDoc
        );
        if (idx === -1) return prev;
        const target = prev[idx];
        const res = adjustAdminQueue(target.CurrentQuota, target.MaxQuota, action);
        if (!res.success) {
          alert(res.error);
          return prev;
        }
        const next = [...prev];
        const updatedQueue = {
          ...target,
          CurrentQuota: res.newQuota,
          LastUpdatedBy: authName || 'แอดมิน',
        };
        next[idx] = updatedQueue;
        try {
          localStorage.setItem('app_queues', JSON.stringify(next));
        } catch {}
        saveQueueToFirestore(updatedQueue).catch(() => {});
        if (gasUrl) {
          saveQueueToGAS(gasUrl, updatedQueue).catch(() => {});
        }
        return next;
      });
    },
    [authPin, authName, gasUrl]
  );

  // Walk-in Count Update with 0ms Latency
  const handleUpdateWalkInCount = useCallback(
    (deptId: string, delta: number, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        const next = [...prev];

        let updated: WalkInCountRecord;
        if (idx !== -1) {
          const newCount = Math.max(0, prev[idx].Count + delta);
          updated = {
            ...prev[idx],
            Count: newCount,
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          };
          next[idx] = updated;
        } else {
          const dpt = deptMap.get(deptId);
          updated = {
            KeyDateDept: key,
            Date: selectedDate,
            DepartmentId: deptId,
            DepartmentName: dpt?.name || deptId,
            Count: Math.max(0, delta),
            NurseName: nurse,
            LastUpdated: new Date().toISOString(),
            UpdatedBy: authName || 'คัดกรอง',
          };
          next.push(updated);
        }
        try {
          localStorage.setItem('app_walkin_counts', JSON.stringify(next));
        } catch {}
        saveWalkInToFirestore(updated).catch(() => {});
        if (gasUrl) {
          saveWalkInToGAS(gasUrl, updated).catch(() => {});
        }
        return next;
      });
    },
    [selectedDate, deptMap, authName, gasUrl]
  );

  const handleResetWalkInCount = useCallback(
    (deptId: string, nurse: string) => {
      setWalkInCounts((prev) => {
        const key = `${selectedDate}_${deptId}`;
        const idx = prev.findIndex((w) => w.KeyDateDept === key);
        if (idx === -1) return prev;
        const next = [...prev];
        const updated = {
          ...prev[idx],
          Count: 0,
          NurseName: nurse,
          LastUpdated: new Date().toISOString(),
          UpdatedBy: authName || 'คัดกรอง',
        };
        next[idx] = updated;
        try {
          localStorage.setItem('app_walkin_counts', JSON.stringify(next));
        } catch {}
        saveWalkInToFirestore(updated).catch(() => {});
        if (gasUrl) {
          saveWalkInToGAS(gasUrl, updated).catch(() => {});
        }
        return next;
      });
    },
    [selectedDate, authName, gasUrl]
  );

  // Save Absence Event (Create or Update with synchronized Walk-in Quota)
  const handleSaveEvent = async (record: AbsenceRecord) => {
    if (!authPin || !authName) {
      requirePin(() => handleSaveEvent(record));
      return;
    }

    // 1. Identify prior record if this was an edit
    const prevRecord = editingEvent || events.find((e) => e.ID === record.ID);

    // 2. Save/update events state
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.ID === record.ID);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    // 3. Walk-in quota synchronization and duplicate prevention
    const hasWalkInQuota = Boolean(record.WalkInQuota && Number(record.WalkInQuota) > 0);
    const quotaNum = hasWalkInQuota ? Number(record.WalkInQuota) : 0;
    const normNewDoc = normalizeDoctorName(record.DoctorName);
    const newKey = `${record.DateStart}_${record.DepartmentId}_${normNewDoc}`;

    const oldNormDoc = prevRecord ? normalizeDoctorName(prevRecord.DoctorName) : null;
    const oldKey =
      prevRecord && oldNormDoc
        ? `${prevRecord.DateStart}_${prevRecord.DepartmentId}_${oldNormDoc}`
        : null;
    const oldRawKey = prevRecord
      ? `${prevRecord.DateStart}_${prevRecord.DepartmentId}_${prevRecord.DoctorName}`
      : null;

    if (hasWalkInQuota) {
      // If date, department, or doctor changed from the prior record, remove the obsolete old queue(s)
      if (oldKey && oldKey !== newKey) {
        deleteQueueFromFirestore(oldKey).catch(() => {});
        if (oldRawKey && oldRawKey !== oldKey) {
          deleteQueueFromFirestore(oldRawKey).catch(() => {});
        }
      }

      setQueues((prev) => {
        // Filter out obsolete old queues and ANY duplicate matching this slot
        const filtered = prev.filter((q) => {
          if (oldKey && oldKey !== newKey) {
            if (q.KeyDateDeptDoc === oldKey || q.KeyDateDeptDoc === oldRawKey) return false;
            if (
              prevRecord &&
              q.Date === prevRecord.DateStart &&
              q.DepartmentId === prevRecord.DepartmentId &&
              normalizeDoctorName(q.DoctorName) === oldNormDoc
            ) {
              return false;
            }
          }
          if (q.KeyDateDeptDoc === newKey) return false;
          if (
            q.Date === record.DateStart &&
            q.DepartmentId === record.DepartmentId &&
            normalizeDoctorName(q.DoctorName) === normNewDoc
          ) {
            return false;
          }
          return true;
        });

        // Check if an existing queue existed for this slot to preserve usage deductions
        const existingQueue = prev.find(
          (q) =>
            q.KeyDateDeptDoc === newKey ||
            (q.Date === record.DateStart &&
              q.DepartmentId === record.DepartmentId &&
              normalizeDoctorName(q.DoctorName) === normNewDoc) ||
            (oldKey && (q.KeyDateDeptDoc === oldKey || q.KeyDateDeptDoc === oldRawKey))
        );

        let finalCurrentQuota = quotaNum;
        if (existingQueue) {
          const used = Math.max(0, existingQueue.MaxQuota - existingQueue.CurrentQuota);
          if (existingQueue.MaxQuota === quotaNum) {
            finalCurrentQuota = existingQueue.CurrentQuota;
          } else {
            finalCurrentQuota = Math.max(0, quotaNum - used);
          }
        }

        const newQueueRecord: QueueRecord = {
          KeyDateDeptDoc: newKey,
          Date: record.DateStart,
          DepartmentId: record.DepartmentId,
          DoctorName: record.DoctorName,
          MaxQuota: quotaNum,
          CurrentQuota: finalCurrentQuota,
          LastUpdatedBy: authName || 'เจ้าหน้าที่',
        };

        // Save immediately to Firestore
        saveQueueToFirestore(newQueueRecord).catch(() => {});

        return [...filtered, newQueueRecord];
      });
    } else {
      // Walk-in quota was removed or cancelled (empty, 0, or non-walk-in reason)
      // Must completely remove and delete the correlated doctor queue quota
      if (oldKey) {
        deleteQueueFromFirestore(oldKey).catch(() => {});
      }
      if (oldRawKey && oldRawKey !== oldKey) {
        deleteQueueFromFirestore(oldRawKey).catch(() => {});
      }
      deleteQueueFromFirestore(newKey).catch(() => {});
      deleteQueueFromFirestore(`${record.DateStart}_${record.DepartmentId}_${record.DoctorName}`).catch(() => {});

      setQueues((prev) =>
        prev.filter((q) => {
          const matchNew =
            q.KeyDateDeptDoc === newKey ||
            (q.Date === record.DateStart &&
              q.DepartmentId === record.DepartmentId &&
              normalizeDoctorName(q.DoctorName) === normNewDoc);
          const matchOld =
            prevRecord &&
            (q.KeyDateDeptDoc === oldKey ||
              q.KeyDateDeptDoc === oldRawKey ||
              (q.Date === prevRecord.DateStart &&
                q.DepartmentId === prevRecord.DepartmentId &&
                normalizeDoctorName(q.DoctorName) === oldNormDoc));
          return !matchNew && !matchOld;
        })
      );
    }

    setIsFormModalOpen(false);
    setEditingEvent(null);
    showToast('บันทึกข้อมูลเรียบร้อยแล้ว (อัปเดตโควตาและปฏิทินสัมพันธ์กันทันที)', 'success');

    // Save to Firestore real-time cloud (synchronizes all computers immediately)
    saveAbsenceToFirestore(record).catch(() => {});

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

  // Delete Absence Event with Correlated Quota Deletion (Both Parts Cancelled Together)
  const handleDeleteEvent = async (id: string) => {
    if (!authPin || !authName) {
      requirePin(() => handleDeleteEvent(id));
      return;
    }

    const target = events.find((e) => e.ID === id);
    if (!target) return;

    // 1. Remove from events state
    setEvents((prev) => prev.filter((e) => e.ID !== id));

    // 2. Remove matching quota(s) from queues state across affected date range
    const targetDates = [target.DateStart];
    if (target.DateEnd && target.DateEnd !== target.DateStart) {
      const [sy, sm, sd] = target.DateStart.split('-').map(Number);
      const [ey, em, ed] = target.DateEnd.split('-').map(Number);
      const cur = new Date(Date.UTC(sy, sm - 1, sd));
      const stop = new Date(Date.UTC(ey, em - 1, ed));
      while (cur <= stop) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cur.getUTCDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;
        if (!targetDates.includes(dStr)) targetDates.push(dStr);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const normTargetDoc = normalizeDoctorName(target.DoctorName);

    setQueues((prev) =>
      prev.filter((q) => {
        const isDateMatch = targetDates.includes(q.Date);
        const isDeptMatch = q.DepartmentId === target.DepartmentId;
        const isDocMatch =
          !target.DoctorName || target.DoctorName === '-'
            ? true
            : normalizeDoctorName(q.DoctorName) === normTargetDoc;
        return !(isDateMatch && isDeptMatch && isDocMatch);
      })
    );

    setIsFormModalOpen(false);
    setEditingEvent(null);
    setIsDetailModalOpen(false);
    setInspectingEvent(null);
    showToast('ยกเลิกรายการงดออกตรวจและโควตาคิวที่สัมพันธ์กันเรียบร้อยแล้ว', 'info');

    // 3. Delete from Firestore real-time cloud for both absence and walk-in quota collections
    deleteAbsenceFromFirestore(id).catch(() => {});
    for (const d of targetDates) {
      const qKey = `${d}_${target.DepartmentId}_${target.DoctorName}`;
      const normKey = `${d}_${target.DepartmentId}_${normTargetDoc}`;
      deleteQueueFromFirestore(qKey).catch(() => {});
      if (normKey !== qKey) {
        deleteQueueFromFirestore(normKey).catch(() => {});
      }
    }

    // Delete calendar event in background if synced
    const currentGasUrl = getSavedGASUrl();
    if (currentGasUrl) {
      deleteAbsenceFromGAS(currentGasUrl, id, target.CalendarEventId);
    } else if (googleUser && target.CalendarEventId) {
      deleteGoogleCalendarEvent(target.CalendarEventId);
    }
  };

  // Cancel Quota from Left Sidebar (Both Parts Cancelled Together)
  const handleCancelQueue = useCallback(
    (date: string, deptId: string, doctorName: string) => {
      if (!authPin || !authName) {
        requirePin(() => handleCancelQueue(date, deptId, doctorName));
        return;
      }

      const qKey = `${date}_${deptId}_${doctorName}`;
      const normDoc = normalizeDoctorName(doctorName);
      const normKey = `${date}_${deptId}_${normDoc}`;

      // 1. Remove from queues state
      setQueues((prev) =>
        prev.filter(
          (q) =>
            q.KeyDateDeptDoc !== qKey &&
            q.KeyDateDeptDoc !== normKey &&
            !(q.Date === date && q.DepartmentId === deptId && normalizeDoctorName(q.DoctorName) === normDoc)
        )
      );

      // 2. Find matching events on that date and remove them too
      const matchingEvents = events.filter((e) => {
        const inRange = e.DateStart <= date && (e.DateEnd || e.DateStart) >= date;
        const sameDept = e.DepartmentId === deptId;
        const sameDoc = !doctorName || doctorName === '-' ? true : normalizeDoctorName(e.DoctorName) === normDoc;
        return inRange && sameDept && sameDoc;
      });

      if (matchingEvents.length > 0) {
        const matchingIds = matchingEvents.map((e) => e.ID);
        setEvents((prev) => prev.filter((e) => !matchingIds.includes(e.ID)));
        matchingIds.forEach((mId) => {
          deleteAbsenceFromFirestore(mId).catch(() => {});
        });
      }

      // 3. Delete from Firestore
      deleteQueueFromFirestore(qKey).catch(() => {});
      if (normKey !== qKey) {
        deleteQueueFromFirestore(normKey).catch(() => {});
      }
      showToast('ยกเลิกโควตาและรายการในปฏิทินที่สัมพันธ์กันเรียบร้อยแล้ว', 'info');
    },
    [events, showToast]
  );

  const handleShareLink = () => {
    const shareUrl = getShareableLink(gasUrl);
    navigator.clipboard.writeText(shareUrl);
    showToast('คัดลอกลิงก์สำหรับส่งให้คอมพิวเตอร์เครื่องอื่นเรียบร้อยแล้ว! (ปฏิทินจะซิงค์ตรงกันทันที)', 'success');
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
        onShareLink={handleShareLink}
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
            onCancelQueue={handleCancelQueue}
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
        authName={authName}
        authPin={authPin}
        onRequirePin={requirePin}
        onEdit={(evt) => {
          setIsDetailModalOpen(false);
          handleOpenEdit(evt);
        }}
        onDelete={handleDeleteEvent}
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
