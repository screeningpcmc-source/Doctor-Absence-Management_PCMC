/**
 * Complete Google Apps Script backend source code (Code.gs)
 * Ready to be copied or downloaded directly from the application UI.
 */
export const FULL_GAS_CODE = `/**
 * ==============================================================================
 * ระบบลงทะเบียนแพทย์งดออกตรวจและบริหารจัดการโควตาคิว Walk-in (PCMC)
 * Google Apps Script Web App Backend (ฉบับสมบูรณ์สำหรับใช้งานจริงแบบฟรี 100%)
 * ==============================================================================
 * วิธีติดตั้ง (ทำเพียงครั้งเดียว):
 * 1. เปิด Google Sheets เปล่า หรือไฟล์ที่ต้องการใช้เป็นฐานข้อมูล
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมดใน Code.gs แล้ววางโค้ดชุดนี้ลงไป
 * 4. กดปุ่ม 'บันทึก' (ไอคอนแผ่นดิสก์)
 * 5. กดปุ่ม 'การทำให้ใช้งานได้' (Deploy) สีน้ำเงินมุมขวาบน > 'การทำให้ใช้งานได้ใหม่' (New deployment)
 * 6. เลือกประเภทเป็น 'เว็บแอป' (Web app)
 *    - คำอธิบาย: ระบบจัดการแพทย์งดออกตรวจ PCMC
 *    - ดำเนินการในฐานะ (Execute as): ตัวฉัน (Me / บัญชี Google ของโรงพยาบาล)
 *    - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): ทุกคน (Anyone)  <-- สำคัญมาก! เพื่อให้หน้าเว็บส่งข้อมูลมาได้
 * 7. กดปุ่ม 'ทำให้ใช้งานได้' (Deploy) และให้สิทธิ์เข้าถึง (Authorize access)
 * 8. คัดลอก 'URL ของเว็บแอป' (Web app URL ที่ลงท้ายด้วย /exec) นำไปใส่ในหน้าเว็บแอปพลิเคชัน
 * ==============================================================================
 */

// ชื่อแท็บของชีตฐานข้อมูล
const SHEET_ABSENCES = "AbsenceRecords";
const SHEET_QUEUES = "WalkInQuota";
const SHEET_WALKIN = "DailyWalkInCounts";
const SHEET_LOG = "SystemLog";

/**
 * ฟังก์ชันเริ่มต้นสร้างชีตและหัวตารางอัตโนมัติหากยังไม่มี
 */
function initSheetsIfNeeded() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ชีต AbsenceRecords
  let absSheet = ss.getSheetByName(SHEET_ABSENCES);
  if (!absSheet) {
    absSheet = ss.insertSheet(SHEET_ABSENCES);
    const headers = [
      "ID", "DepartmentId", "DoctorName", "AllDay", "DateStart",
      "TimeStart", "DateEnd", "TimeEnd", "Reason", "Note",
      "CreatedAt", "CalendarEventId", "TimeType", "UpdatedBy", "WalkInQuota",
      "AffectedPatients", "ReplacementDoc", "PatientManagement", "NotificationStatus", "Specialty"
    ];
    absSheet.appendRow(headers);
    absSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0f766e").setFontColor("#ffffff");
    absSheet.setFrozenRows(1);
  }

  // 2. ชีต WalkInQuota
  let qSheet = ss.getSheetByName(SHEET_QUEUES);
  if (!qSheet) {
    qSheet = ss.insertSheet(SHEET_QUEUES);
    const headers = ["KeyDateDeptDoc", "Date", "DepartmentId", "DoctorName", "MaxQuota", "CurrentQuota", "LastUpdatedBy"];
    qSheet.appendRow(headers);
    qSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
    qSheet.setFrozenRows(1);
  }

  // 3. ชีต DailyWalkInCounts
  let wSheet = ss.getSheetByName(SHEET_WALKIN);
  if (!wSheet) {
    wSheet = ss.insertSheet(SHEET_WALKIN);
    const headers = ["KeyDateDept", "Date", "DepartmentId", "DepartmentName", "Count", "NurseName", "LastUpdated", "UpdatedBy"];
    wSheet.appendRow(headers);
    wSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#059669").setFontColor("#ffffff");
    wSheet.setFrozenRows(1);
  }

  return ss;
}

/**
 * Handle GET Requests (ดึงข้อมูลหรือทดสอบการเชื่อมต่อ)
 */
function doGet(e) {
  try {
    initSheetsIfNeeded();
    const action = e && e.parameter ? e.parameter.action : "ping";

    if (action === "ping") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      return jsonResponse({
        success: true,
        status: "OK",
        message: "Google Apps Script Web App เชื่อมต่อสำเร็จ พร้อมใช้งาน 100%!",
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString(),
        version: "2.0.0"
      });
    }

    if (action === "getData" || action === "getAllData") {
      const data = getAllStoredData();
      return jsonResponse({
        success: true,
        ...data,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({
      success: true,
      message: "PCMC Doctor Absence System Web App is active.",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      stack: err.stack
    });
  }
}

/**
 * Handle POST Requests (บันทึกข้อมูล, ซิงค์ข้อมูล, และเชื่อมต่อ Google Calendar)
 */
function doPost(e) {
  try {
    initSheetsIfNeeded();
    let contents = {};
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        contents = { action: "unknown", raw: e.postData.contents };
      }
    }

    const action = contents.action || "syncAll";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ซิงค์ข้อมูลภาพรวมทั้งหมด (Batch Sync)
    if (action === "syncAll") {
      const events = contents.events || [];
      const queues = contents.queues || [];
      const walkInCounts = contents.walkInCounts || [];

      if (events.length > 0) {
        saveEventsBatch(events);
      }
      if (queues.length > 0) {
        saveQueuesBatch(queues);
      }
      if (walkInCounts.length > 0) {
        saveWalkInCountsBatch(walkInCounts);
      }

      writeLog("syncAll", \`Synced \${events.length} events, \${queues.length} queues, \${walkInCounts.length} walk-ins\`);

      return jsonResponse({
        success: true,
        message: \`ซิงค์ข้อมูลลง Google Sheets สำเร็จ (\${events.length} รายการงด, \${queues.length} คิว, \${walkInCounts.length} walk-in)\`,
        spreadsheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. บันทึกหรืออัปเดตการงดออกตรวจรายบุคคล + ซิงค์ปฏิทิน Google Calendar
    if (action === "saveAbsence") {
      const record = contents.record;
      if (!record || !record.ID) {
        throw new Error("Missing record data or record.ID");
      }

      // ซิงค์ Google Calendar อัตโนมัติ (ถ้าเปิดสิทธิ์)
      let calendarEventId = record.CalendarEventId || "";
      try {
        calendarEventId = syncToCalendar(record);
        record.CalendarEventId = calendarEventId;
      } catch (calErr) {
        Logger.log("Calendar sync note: " + calErr.message);
      }

      upsertAbsenceRecord(record);
      writeLog("saveAbsence", \`Saved absence for \${record.DoctorName} (\${record.DateStart})\`);

      return jsonResponse({
        success: true,
        message: "บันทึกข้อมูลการงดออกตรวจและสร้างใน Google Calendar เรียบร้อย",
        record: record,
        calendarEventId: calendarEventId,
        timestamp: new Date().toISOString()
      });
    }

    // 3. ลบการงดออกตรวจ + ลบในปฏิทิน Google Calendar
    if (action === "deleteAbsence") {
      const id = contents.id;
      const calendarEventId = contents.calendarEventId;

      if (calendarEventId) {
        try {
          deleteFromCalendar(calendarEventId);
        } catch (calErr) {
          Logger.log("Failed to delete from Calendar: " + calErr.message);
        }
      }

      deleteAbsenceRecord(id);
      writeLog("deleteAbsence", \`Deleted absence ID \${id}\`);

      return jsonResponse({
        success: true,
        message: "ลบข้อมูลการงดตรวจและลบใน Google Calendar เรียบร้อย",
        id: id
      });
    }

    // 4. บันทึกยอดนับ Walk-in ประจำวัน
    if (action === "updateWalkInCount") {
      const record = contents.record;
      if (record) {
        upsertWalkInCount(record);
      }
      return jsonResponse({ success: true, message: "อัปเดตยอดนับ Walk-in สำเร็จ" });
    }

    // 5. บันทึกโควตาคิว
    if (action === "updateQueue") {
      const record = contents.record;
      if (record) {
        upsertQueue(record);
      }
      return jsonResponse({ success: true, message: "อัปเดตโควตาคิวสำเร็จ" });
    }

    // 6. ทดสอบ Ping
    if (action === "ping") {
      return jsonResponse({
        success: true,
        message: "Ping POST ตอบกลับสำเร็จจาก Google Apps Script!",
        spreadsheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ success: true, message: "คำสั่งได้รับการประมวลผลแล้ว" });

  } catch (err) {
    writeLog("ERROR", err.toString());
    return jsonResponse({
      success: false,
      error: err.toString(),
      stack: err.stack
    });
  }
}

/**
 * ดึงข้อมูลทั้งหมดจาก Google Sheets ออกมาเป็น JSON
 */
function getAllStoredData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Absences
  const absSheet = ss.getSheetByName(SHEET_ABSENCES);
  const events = [];
  if (absSheet && absSheet.getLastRow() > 1) {
    const data = absSheet.getRange(2, 1, absSheet.getLastRow() - 1, 20).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      events.push({
        ID: String(row[0]),
        DepartmentId: String(row[1] || ""),
        DoctorName: String(row[2] || ""),
        AllDay: row[3] === true || String(row[3]).toLowerCase() === "true",
        DateStart: formatDateString(row[4]),
        TimeStart: String(row[5] || ""),
        DateEnd: formatDateString(row[6]),
        TimeEnd: String(row[7] || ""),
        Reason: String(row[8] || ""),
        Note: String(row[9] || ""),
        CreatedAt: String(row[10] || ""),
        CalendarEventId: String(row[11] || ""),
        TimeType: String(row[12] || "all_day"),
        UpdatedBy: String(row[13] || ""),
        WalkInQuota: Number(row[14]) || 0,
        AffectedPatients: Number(row[15]) || 0,
        ReplacementDoc: String(row[16] || ""),
        PatientManagement: String(row[17] || ""),
        NotificationStatus: String(row[18] || "ปกติ"),
        Specialty: String(row[19] || "")
      });
    }
  }

  // 2. Queues
  const qSheet = ss.getSheetByName(SHEET_QUEUES);
  const queues = [];
  if (qSheet && qSheet.getLastRow() > 1) {
    const data = qSheet.getRange(2, 1, qSheet.getLastRow() - 1, 7).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      queues.push({
        KeyDateDeptDoc: String(row[0]),
        Date: formatDateString(row[1]),
        DepartmentId: String(row[2] || ""),
        DoctorName: String(row[3] || ""),
        MaxQuota: Number(row[4]) || 0,
        CurrentQuota: Number(row[5]) || 0,
        LastUpdatedBy: String(row[6] || "")
      });
    }
  }

  // 3. WalkInCounts
  const wSheet = ss.getSheetByName(SHEET_WALKIN);
  const walkInCounts = [];
  if (wSheet && wSheet.getLastRow() > 1) {
    const data = wSheet.getRange(2, 1, wSheet.getLastRow() - 1, 8).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      walkInCounts.push({
        KeyDateDept: String(row[0]),
        Date: formatDateString(row[1]),
        DepartmentId: String(row[2] || ""),
        DepartmentName: String(row[3] || ""),
        Count: Number(row[4]) || 0,
        NurseName: String(row[5] || ""),
        LastUpdated: String(row[6] || ""),
        UpdatedBy: String(row[7] || "")
      });
    }
  }

  return { events, queues, walkInCounts };
}

/**
 * บันทึกหรืออัปเดตแถวใน AbsenceRecords
 */
function upsertAbsenceRecord(record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ABSENCES);
  const lastRow = sheet.getLastRow();
  let foundRow = -1;

  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(record.ID)) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const rowData = [
    record.ID,
    record.DepartmentId || "",
    record.DoctorName || "",
    record.AllDay ? true : false,
    record.DateStart || "",
    record.TimeStart || "",
    record.DateEnd || "",
    record.TimeEnd || "",
    record.Reason || "",
    record.Note || "",
    record.CreatedAt || new Date().toISOString(),
    record.CalendarEventId || "",
    record.TimeType || "all_day",
    record.UpdatedBy || "",
    record.WalkInQuota || 0,
    record.AffectedPatients || 0,
    record.ReplacementDoc || "",
    record.PatientManagement || "",
    record.NotificationStatus || "ปกติ",
    record.Specialty || ""
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/**
 * ลบรายการออกจาก AbsenceRecords
 */
function deleteAbsenceRecord(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ABSENCES);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

/**
 * บันทึก Events เป็นชุด (Batch)
 */
function saveEventsBatch(events) {
  for (let i = 0; i < events.length; i++) {
    upsertAbsenceRecord(events[i]);
  }
}

/**
 * บันทึกหรืออัปเดตโควตาคิว
 */
function upsertQueue(q) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_QUEUES);
  const key = q.KeyDateDeptDoc || \`\${q.Date}_\${q.DepartmentId}_\${q.DoctorName}\`;
  const lastRow = sheet.getLastRow();
  let foundRow = -1;

  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const rowData = [key, q.Date, q.DepartmentId, q.DoctorName, q.MaxQuota || 0, q.CurrentQuota || 0, q.LastUpdatedBy || ""];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function saveQueuesBatch(queues) {
  for (let i = 0; i < queues.length; i++) {
    upsertQueue(queues[i]);
  }
}

/**
 * บันทึกยอด Walk-in
 */
function upsertWalkInCount(w) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_WALKIN);
  const key = w.KeyDateDept || \`\${w.Date}_\${w.DepartmentId}\`;
  const lastRow = sheet.getLastRow();
  let foundRow = -1;

  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const rowData = [
    key,
    w.Date,
    w.DepartmentId,
    w.DepartmentName || "",
    w.Count || 0,
    w.NurseName || "",
    w.LastUpdated || new Date().toISOString(),
    w.UpdatedBy || ""
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function saveWalkInCountsBatch(walkInCounts) {
  for (let i = 0; i < walkInCounts.length; i++) {
    upsertWalkInCount(walkInCounts[i]);
  }
}

/**
 * ซิงค์ไปยัง Google Calendar ของบัญชี Google นี้
 */
function syncToCalendar(record) {
  const cal = CalendarApp.getDefaultCalendar();
  if (!cal) return "";

  const title = \`[\${record.DepartmentId}] \${record.DoctorName} - \${record.Reason}\`;
  const description = [
    \`แผนก: \${record.DepartmentId}\`,
    \`แพทย์: \${record.DoctorName}\`,
    \`เหตุผล: \${record.Reason}\`,
    \`ผลกระทบคนไข้: \${record.AffectedPatients || 0} คน\`,
    \`แพทย์ตรวจแทน: \${record.ReplacementDoc || "-"}\`,
    \`การจัดการคนไข้: \${record.PatientManagement || "-"}\`,
    \`หมายเหตุ: \${record.Note || "-"}\`,
    \`ผู้ลงบันทึก: \${record.UpdatedBy || "-"}\`
  ].join("\\n");

  if (record.CalendarEventId) {
    try {
      const existing = cal.getEventById(record.CalendarEventId);
      if (existing) {
        existing.setTitle(title);
        existing.setDescription(description);
        return existing.getId();
      }
    } catch (e) {
      // Event may have been deleted, create new
    }
  }

  const isAllDay = record.AllDay || record.TimeType === "in";
  const startDate = parseDate(record.DateStart);
  const endDate = parseDate(record.DateEnd || record.DateStart);

  if (isAllDay) {
    const calEndDate = new Date(endDate.getTime());
    calEndDate.setDate(calEndDate.getDate() + 1);
    const event = cal.createAllDayEvent(title, startDate, calEndDate, { description: description });
    return event.getId();
  } else {
    const startTimeStr = record.TimeStart || "08:00";
    const endTimeStr = record.TimeEnd || "16:00";
    const startDateTime = combineDateAndTime(startDate, startTimeStr);
    const endDateTime = combineDateAndTime(endDate, endTimeStr);
    const event = cal.createEvent(title, startDateTime, endDateTime, { description: description });
    return event.getId();
  }
}

/**
 * ลบ Event ออกจาก Google Calendar
 */
function deleteFromCalendar(calendarEventId) {
  if (!calendarEventId) return;
  const cal = CalendarApp.getDefaultCalendar();
  if (!cal) return;
  try {
    const event = cal.getEventById(calendarEventId);
    if (event) {
      event.deleteEvent();
    }
  } catch (err) {
    Logger.log("Could not delete calendar event: " + err.message);
  }
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
}

function formatDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return \`\${y}-\${m}-\${d}\`;
  }
  return String(val).split("T")[0];
}

function combineDateAndTime(dateObj, timeStr) {
  const res = new Date(dateObj.getTime());
  const parts = String(timeStr).split(":");
  const h = parts.length > 0 ? parseInt(parts[0], 10) : 8;
  const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  res.setHours(h, m, 0, 0);
  return res;
}

function writeLog(action, message) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_LOG);
      sheet.appendRow(["Timestamp", "Action", "Message"]);
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    }
    sheet.appendRow([new Date(), action, message]);
  } catch (e) {}
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
