/**
 * ============================================================================
 * BRIGHT ACADEMY - SCHOOL MANAGEMENT APP
 * Firebase (v9+ modular SDK) backed data layer
 * ============================================================================
 *
 * SECURITY NOTE ON TEACHER PASSWORDS:
 * Your original spec stored `password: 'hashed_password'` directly on the
 * teacher document. Hashing on the client and saving the hash in Firestore
 * is NOT secure — the hash becomes just another password an attacker can
 * read or brute-force, and your JS bundle is public. Instead, this file
 * uses Firebase Authentication (email/password) to handle credentials.
 * The `teachers` collection only stores profile/role data, keyed by the
 * Firebase Auth `uid`. See section 3 (Teacher Functions) below.
 *
 * SETUP:
 * 1. In Firebase Console -> Authentication -> Sign-in method, enable
 *    "Email/Password".
 * 2. In Firebase Console -> Firestore Database, create a database
 *    (production mode) and add security rules (sample provided at the
 *    bottom of this file).
 * 3. Import this file as an ES module:
 *      <script type="module" src="school-app.js"></script>
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// 0. FIREBASE INITIALIZATION
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAf-PKTp1TTyMeJqjT4JOogG2EUwtiO13g",
  authDomain: "bright-academy-12c54.firebaseapp.com",
  projectId: "bright-academy-12c54",
  storageBucket: "bright-academy-12c54.firebasestorage.app",
  messagingSenderId: "935042003716",
  appId: "1:935042003716:web:532d1f634b49ba7135d651",
  measurementId: "G-LHE9TXHT6D",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Firestore collection names (change here if your collections differ)
const COLLECTIONS = {
  STUDENTS: "students",
  TEACHERS: "teachers",
  ATTENDANCE: "attendance", // one doc per month, keyed by monthKey
  FEES: "fees", // one doc per student per month (see section 4)
};

// ---------------------------------------------------------------------------
// 1. CONSTANTS
// ---------------------------------------------------------------------------

export const FEE_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FI_SABILILLAH: "fi_sabilillah", // fee waived / charitable
  PARTIAL: "partial",
};

export const FEE_OPTION = {
  COLLECT_NOW: "collect_now",
  WRITE_LATER: "write_later",
};

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LEAVE: "leave",
};

export const ROLE = {
  ADMIN: "admin",
  TEACHER: "teacher",
  ADMIN_TEACHER: "admin_teacher",
};

export const ROLE_ACCESS = {
  admin: [
    "dashboard", "students", "teachers", "fees", "scan",
    "attendance", "bulkwa", "sabaq", "tests", "settings", "backup",
  ],
  teacher: ["attendance", "sabaq", "tests", "students_view"], // limited access
  admin_teacher: [
    "dashboard", "students", "teachers", "fees", "scan",
    "attendance", "bulkwa", "sabaq", "tests", "settings", "backup",
  ], // full access
};

/**
 * Check whether a role can access a given module/screen.
 * @param {string} role - one of ROLE values
 * @param {string} moduleName - e.g. 'fees', 'attendance'
 * @returns {boolean}
 */
export function hasAccess(role, moduleName) {
  const allowed = ROLE_ACCESS[role];
  return Array.isArray(allowed) && allowed.includes(moduleName);
}

// ---------------------------------------------------------------------------
// 2. UTILITIES
// ---------------------------------------------------------------------------

/** Returns current month key in 'YYYY-MM' format */
export function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Returns 'YYYY-MM-DD' for a given Date (defaults to today) */
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** How many days are in a given 'YYYY-MM' month */
function daysInMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// ---------------------------------------------------------------------------
// 3. STUDENT FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Student document shape:
 * {
 *   id, name, father, gender, section, fee, address, contact, dob,
 *   joinMonth, photo, active,
 *   feeStatus, feeOption, isFree, assignedTeacher, feeHistory: []
 * }
 */

/** Create a new student. Returns the new student's Firestore ID. */
export async function addStudent(studentData) {
  const payload = {
    name: "",
    father: "",
    gender: "",
    section: "",
    fee: 0,
    address: "",
    contact: "",
    dob: "",
    joinMonth: getCurrentMonthKey(),
    photo: "",
    active: true,
    feeStatus: FEE_STATUS.PENDING,
    feeOption: FEE_OPTION.COLLECT_NOW,
    isFree: false,
    assignedTeacher: "",
    feeHistory: [],
    createdAt: serverTimestamp(),
    ...studentData,
  };
  const ref = await addDoc(collection(db, COLLECTIONS.STUDENTS), payload);
  return ref.id;
}

/** Fetch a single student by ID */
export async function getStudent(studentId) {
  const snap = await getDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Fetch all students, optionally filtered by section */
export async function getAllStudents(section = null) {
  const colRef = collection(db, COLLECTIONS.STUDENTS);
  const q = section ? query(colRef, where("section", "==", section)) : colRef;
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Update arbitrary fields on a student */
export async function updateStudent(studentId, updates) {
  await updateDoc(doc(db, COLLECTIONS.STUDENTS, studentId), updates);
}

/** Soft-delete (deactivate) a student instead of removing history */
export async function deactivateStudent(studentId) {
  await updateDoc(doc(db, COLLECTIONS.STUDENTS, studentId), { active: false });
}

/** Hard delete — use with caution, prefer deactivateStudent() */
export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
}

// ---------------------------------------------------------------------------
// 4. TEACHER FUNCTIONS (auth handled via Firebase Authentication)
// ---------------------------------------------------------------------------

/**
 * Teacher profile document shape (stored at teachers/{uid}):
 * {
 *   name, username, role, assignedClasses: [], contact, photo, isActive
 * }
 * NOTE: no password field — Firebase Auth owns credentials.
 */

/**
 * Create a teacher account: registers them in Firebase Auth and creates
 * their profile document in Firestore keyed by their new uid.
 * Only an admin-role UI should be allowed to call this.
 */
export async function addTeacher({ email, password, name, username, role, assignedClasses, contact, photo }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const profile = {
    name: name || "",
    username: username || "",
    role: role || ROLE.TEACHER, // 'admin' | 'teacher' | 'admin_teacher'
    assignedClasses: assignedClasses || [],
    contact: contact || "",
    photo: photo || "",
    isActive: true,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, COLLECTIONS.TEACHERS, uid), profile);
  return uid;
}

/** Log a teacher in; returns their Firestore profile merged with uid */
export async function loginTeacher(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getTeacher(cred.user.uid);
  if (!profile || !profile.isActive) {
    await signOut(auth);
    throw new Error("Account not found or deactivated.");
  }
  return profile;
}

export async function logoutTeacher() {
  await signOut(auth);
}

/** Subscribe to auth state changes; callback receives the Firebase user or null */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getTeacher(uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.TEACHERS, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllTeachers() {
  const snap = await getDocs(collection(db, COLLECTIONS.TEACHERS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateTeacher(uid, updates) {
  await updateDoc(doc(db, COLLECTIONS.TEACHERS, uid), updates);
}

export async function deactivateTeacher(uid) {
  await updateDoc(doc(db, COLLECTIONS.TEACHERS, uid), { isActive: false });
}

// ---------------------------------------------------------------------------
// 5. FEE FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Fee history entry shape:
 * {
 *   month: '2026-01', amount, paidAmount, pendingAmount, status,
 *   paidDate, method, notes
 * }
 *
 * Stored two ways for convenience:
 *  - Denormalized inside student.feeHistory[] (fast reads for a student's card)
 *  - Also written to a top-level `fees` collection as {studentId}_{month}
 *    (fast cross-student queries, e.g. "everyone pending this month")
 */

function feeDocId(studentId, month) {
  return `${studentId}_${month}`;
}

/**
 * Record or update a fee payment for a student for a given month.
 * Automatically computes pendingAmount/status and keeps student.feeHistory
 * and the top-level fees collection in sync.
 */
export async function recordFeePayment(studentId, month, { amount, paidAmount, method = "cash", notes = "" }) {
  const pendingAmount = Math.max(amount - paidAmount, 0);
  let status = FEE_STATUS.PENDING;
  if (paidAmount <= 0) status = FEE_STATUS.PENDING;
  else if (pendingAmount === 0) status = FEE_STATUS.PAID;
  else status = FEE_STATUS.PARTIAL;

  const record = {
    month,
    amount,
    paidAmount,
    pendingAmount,
    status,
    paidDate: paidAmount > 0 ? getDateKey() : null,
    method,
    notes,
  };

  // 1) Write to top-level fees collection
  await setDoc(doc(db, COLLECTIONS.FEES, feeDocId(studentId, month)), {
    studentId,
    ...record,
    updatedAt: serverTimestamp(),
  });

  // 2) Sync into student.feeHistory[]
  const student = await getStudent(studentId);
  if (student) {
    const history = Array.isArray(student.feeHistory) ? [...student.feeHistory] : [];
    const idx = history.findIndex((h) => h.month === month);
    if (idx >= 0) history[idx] = record;
    else history.push(record);
    await updateStudent(studentId, { feeHistory: history, feeStatus: status });
  }

  return record;
}

/** Mark a month as fi-sabilillah (waived) for a student */
export async function markFeeWaived(studentId, month, notes = "Fi sabilillah") {
  return recordFeePayment(studentId, month, { amount: 0, paidAmount: 0, method: "waived", notes })
    .then(async (record) => {
      const waivedRecord = { ...record, status: FEE_STATUS.FI_SABILILLAH, pendingAmount: 0 };
      await setDoc(doc(db, COLLECTIONS.FEES, feeDocId(studentId, month)), {
        studentId,
        ...waivedRecord,
        updatedAt: serverTimestamp(),
      });
      const student = await getStudent(studentId);
      const history = (student.feeHistory || []).map((h) => (h.month === month ? waivedRecord : h));
      await updateStudent(studentId, { feeHistory: history, feeStatus: FEE_STATUS.FI_SABILILLAH });
      return waivedRecord;
    });
}

/** Get a single month's fee record for a student (from feeHistory) */
export async function getFeeRecord(studentId, month) {
  const student = await getStudent(studentId);
  if (!student) return null;
  const record = (student.feeHistory || []).find((h) => h.month === month);
  return (
    record || {
      month,
      amount: student.fee || 0,
      paidAmount: 0,
      pendingAmount: student.fee || 0,
      status: FEE_STATUS.PENDING,
      paidDate: null,
      method: null,
      notes: "",
    }
  );
}

/**
 * Sum of all pendingAmount across every month BEFORE the given month
 * (i.e. "Purana bakiaya" / previous outstanding balance).
 */
export async function getRunningBalance(studentId, beforeMonth) {
  const student = await getStudent(studentId);
  if (!student) return 0;
  const history = student.feeHistory || [];
  return history
    .filter((h) => h.month < beforeMonth && h.status !== FEE_STATUS.FI_SABILILLAH)
    .reduce((sum, h) => sum + (h.pendingAmount || 0), 0);
}

// ---------------------------------------------------------------------------
// 6. FEE RECEIPT (with Bakiaya / running balance)
// ---------------------------------------------------------------------------

/**
 * Build a fee receipt for a student for a given month, including
 * previous outstanding balance ("Purana bakiaya") and total due.
 */
export async function generateFeeReceipt(studentId, month) {
  const student = await getStudent(studentId);
  if (!student) throw new Error("Student not found: " + studentId);

  const feeRecord = await getFeeRecord(studentId, month);
  const previousBalance = await getRunningBalance(studentId, month);
  const pendingThisMonth = (feeRecord.amount || 0) - (feeRecord.paidAmount || 0);
  const totalDue = previousBalance + pendingThisMonth;

  return {
    studentId,
    studentName: student.name,
    month,
    monthlyFee: student.fee,
    paidAmount: feeRecord.paidAmount,
    pendingAmount: pendingThisMonth,
    previousBalance,
    totalDue,
    message:
      `Is month (${month}) ki fees: Rs. ${student.fee}. ` +
      `Aap ne Rs. ${feeRecord.paidAmount} diye. ` +
      `Bakiaya: Rs. ${pendingThisMonth}. ` +
      `Purana bakiaya: Rs. ${previousBalance}. ` +
      `Total bakiaya: Rs. ${totalDue}.`,
  };
}

// ---------------------------------------------------------------------------
// 7. ATTENDANCE FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Attendance is stored per month document in the `attendance` collection,
 * doc id = monthKey ('YYYY-MM'), shape:
 * {
 *   '2026-01-01': { studentId1: 'present', studentId2: 'absent', ... },
 *   '2026-01-02': { ... },
 *   ...
 * }
 */

/** Mark one student's attendance for a specific date */
export async function markAttendance(studentId, dateKey, status) {
  const monthKey = dateKey.slice(0, 7); // 'YYYY-MM'
  const ref = doc(db, COLLECTIONS.ATTENDANCE, monthKey);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  data[dateKey] = { ...(data[dateKey] || {}), [studentId]: status };
  await setDoc(ref, data, { merge: true });
}

/** Mark attendance for many students at once for a single date */
export async function markAttendanceBulk(dateKey, statusMap) {
  // statusMap: { studentId: 'present' | 'absent' | 'leave', ... }
  const monthKey = dateKey.slice(0, 7);
  const ref = doc(db, COLLECTIONS.ATTENDANCE, monthKey);
  await setDoc(ref, { [dateKey]: statusMap }, { merge: true });
}

/** Raw attendance data for a month: { '2026-01-01': {studentId: status}, ... } */
export async function getMonthRawAttendance(monthKey) {
  const snap = await getDoc(doc(db, COLLECTIONS.ATTENDANCE, monthKey));
  return snap.exists() ? snap.data() : {};
}

/**
 * Auto-calculate absent count for a student in a given month.
 * (Matches the getAbsentCount() spec, adapted to async Firestore reads.)
 */
export async function getAbsentCount(studentId, monthKey) {
  const attendance = await getMonthRawAttendance(monthKey);
  let absentCount = 0;
  Object.keys(attendance).forEach((day) => {
    if (attendance[day][studentId] === ATTENDANCE_STATUS.ABSENT) {
      absentCount++;
    }
  });
  return absentCount;
}

/**
 * Build the full monthly attendance detail for a student:
 * { '2026-01-01': 'present', ..., presentDays, absentDays, leaveDays, percentage }
 */
export async function getMonthlyAttendanceDetail(studentId, monthKey) {
  const attendance = await getMonthRawAttendance(monthKey);
  const detail = {};
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;

  Object.keys(attendance)
    .sort()
    .forEach((day) => {
      const status = attendance[day][studentId];
      if (!status) return; // no record for this student on this day
      detail[day] = status;
      if (status === ATTENDANCE_STATUS.PRESENT) presentDays++;
      else if (status === ATTENDANCE_STATUS.ABSENT) absentDays++;
      else if (status === ATTENDANCE_STATUS.LEAVE) leaveDays++;
    });

  const totalMarked = presentDays + absentDays + leaveDays;
  const percentage = totalMarked > 0 ? Math.round((presentDays / totalMarked) * 100) : 0;

  return { ...detail, presentDays, absentDays, leaveDays, percentage };
}

/** Convenience: full attendance detail for every student in a month */
export async function getMonthlyAttendanceForSection(monthKey, section) {
  const students = await getAllStudents(section);
  const results = {};
  for (const student of students) {
    results[student.id] = await getMonthlyAttendanceDetail(student.id, monthKey);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 8. EXPORTS SUMMARY
// ---------------------------------------------------------------------------
// Firebase handles: db, auth (exported below for advanced/custom use)
export { app, db, auth };

/**
 * ============================================================================
 * SAMPLE FIRESTORE SECURITY RULES (paste into Firebase Console -> Rules)
 * Adjust to your real auth/role needs before going to production.
 * ============================================================================
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     function isSignedIn() { return request.auth != null; }
 *     function role() {
 *       return get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.role;
 *     }
 *     function isAdmin() { return isSignedIn() && (role() == 'admin' || role() == 'admin_teacher'); }
 *
 *     match /students/{studentId} {
 *       allow read: if isSignedIn();
 *       allow write: if isAdmin();
 *     }
 *     match /fees/{feeId} {
 *       allow read: if isSignedIn();
 *       allow write: if isAdmin();
 *     }
 *     match /attendance/{monthKey} {
 *       allow read: if isSignedIn();
 *       allow write: if isSignedIn(); // teachers can mark attendance
 *     }
 *     match /teachers/{uid} {
 *       allow read: if isSignedIn();
 *       allow write: if isAdmin();
 *     }
 *   }
 * }
 * ============================================================================
 */
