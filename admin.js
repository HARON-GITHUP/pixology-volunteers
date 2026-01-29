import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  runTransaction,
  deleteDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/** ========== Collections ========== */
const REQ_COL = "volunteer_requests";
const VOL_COL = "pixology_volunteers";
const COUNTERS_COL = "counters";

/** ========== DOM ========== */
const loginBox = document.getElementById("loginBox");
const dataBox = document.getElementById("dataBox");

const reqRowsEl = document.getElementById("reqRows");
const rowsEl = document.getElementById("rows");

const searchEl = document.getElementById("search");
const filterStatusEl = document.getElementById("filterStage");
const exportBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logout");

const loginBtn = document.getElementById("login");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

const toastEl = document.getElementById("toast");

const selectAll = document.getElementById("selectAll");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const clearSelectionBtn = document.getElementById("clearSelection");

/** ===== Manual Add (Step 2) DOM ===== */
const mName = document.getElementById("mName");
const mPhone = document.getElementById("mPhone");
const mGender = document.getElementById("mGender");
const mJoinedAt = document.getElementById("mJoinedAt");
const mCountry = document.getElementById("mCountry");
const mNotes = document.getElementById("mNotes");
const mPhoto = document.getElementById("mPhoto");
const mAddBtn = document.getElementById("mAddBtn");
const mMsg = document.getElementById("mMsg");

/** ========== State ========== */
let volunteers = [];
let unsubVols = null;
let unsubReqs = null;

let ADMIN_OK = false;
let CURRENT_ROLE = null; // "admin" | "super_admin"

/** ========== Helpers ========== */
const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

const digitsOnly = (s) => String(s ?? "").replace(/\D/g, "");

function setControlsEnabled(enabled) {
  if (searchEl) searchEl.disabled = !enabled;
  if (filterStatusEl) filterStatusEl.disabled = !enabled;
  if (exportBtn) exportBtn.disabled = !enabled;
  if (logoutBtn) logoutBtn.disabled = !enabled;

  if (selectAll) selectAll.disabled = !enabled;
  if (deleteSelectedBtn) deleteSelectedBtn.disabled = !enabled;
  if (clearSelectionBtn) clearSelectionBtn.disabled = !enabled;

  if (mAddBtn) mAddBtn.disabled = !enabled;
  if (mName) mName.disabled = !enabled;
  if (mPhone) mPhone.disabled = !enabled;
  if (mGender) mGender.disabled = !enabled;
  if (mJoinedAt) mJoinedAt.disabled = !enabled;
  if (mCountry) mCountry.disabled = !enabled;
  if (mNotes) mNotes.disabled = !enabled;
  if (mPhoto) mPhoto.disabled = !enabled;
}

function showToast(text, sub = "") {
  if (!toastEl) return;
  toastEl.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 4500);
}

function safeAttr(str) {
  return String(str ?? "").replaceAll('"', "&quot;");
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll(".rowCheck:checked"))
    .map((c) => c.dataset.id)
    .filter(Boolean);
}

function setMiniMsg(text = "") {
  if (!mMsg) return;
  mMsg.textContent = text;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** ✅ تحقق Role من users/{uid} (admin + super_admin) */
async function checkAdmin(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { ok: false, role: null };

    const data = snap.data() || {};
    const role = String(data.role || "").trim(); // "admin" | "super_admin"
    const active = data.active === true;

    const allowedRoles = ["admin", "super_admin"];
    const ok = active && allowedRoles.includes(role);

    return { ok, role: ok ? role : null };
  } catch (e) {
    console.error("checkAdmin error:", e);
    return { ok: false, role: null };
  }
}

function renderVolunteersTable() {
  if (!rowsEl) return;

  const q = norm(searchEl?.value || "");
  const status = (filterStatusEl?.value || "").trim();

  const filtered = volunteers.filter((d) => {
    const hit =
      norm(d.name).includes(q) ||
      norm(d.volunteerId).includes(q) ||
      norm(d.phone).includes(q);

    const statusOk = status ? d.status === status : true;
    return (q ? hit : true) && statusOk;
  });

  if (!filtered.length) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center; padding:18px; color:#6b7280; font-weight:700;">
          لا توجد بيانات حتى الآن
        </td>
      </tr>`;
    return;
  }

  rowsEl.innerHTML = filtered
    .map(
      (d) => `
      <tr data-docid="${d._docId}">
        <td><input class="rowCheck" type="checkbox" data-id="${d._docId}" /></td>
        <td>${d.createdAtText || ""}</td>

        <td>
          ${
            d.photoData
              ? `<img src="${safeAttr(
                  d.photoData,
                )}" alt="photo" style="width:40px;height:40px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08)" />`
              : `<span style="color:#94a3b8">—</span>`
          }
        </td>

        <td>${d.name || ""}</td>
        <td>${d.volunteerId || ""}</td>
        <td>${d.phone || ""}</td>
        <td>${d.gender || ""}</td>
        <td>${d.joinedAt || ""}</td>

        <td><input class="mini" type="number" min="0" value="${
          d.hours ?? 0
        }" data-field="hours" /></td>

        <td>
          <select class="mini" data-field="status">
            <option value="Active" ${d.status === "Active" ? "selected" : ""}>Active</option>
            <option value="Inactive" ${d.status === "Inactive" ? "selected" : ""}>Inactive</option>
            <option value="Certified" ${d.status === "Certified" ? "selected" : ""}>Certified</option>
          </select>
        </td>

        <td><input class="mini" type="text" value="${safeAttr(
          d.notes || "",
        )}" data-field="notes" /></td>

        <td style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="miniBtn" data-action="save">حفظ</button>
          <button class="miniBtn" data-action="issueCert">إصدار شهادة</button>
          <a class="miniBtn" style="text-decoration:none; display:inline-block;"
             href="certificate.html?id=${encodeURIComponent(
               d.volunteerId || d._docId,
             )}"
             target="_blank">عرض</a>
        </td>
      </tr>
    `,
    )
    .join("");
}

function toCsv(docs) {
  const headers = [
    "createdAtText",
    "name",
    "volunteerId",
    "phone",
    "gender",
    "joinedAt",
    "hours",
    "status",
    "notes",
    "country",
  ];
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...docs.map((d) => headers.map((h) => escape(d[h])).join(",")),
  ];
  return lines.join("\n");
}

/** توليد Volunteer ID تلقائي */
async function generateVolunteerId() {
  const counterRef = doc(db, COUNTERS_COL, "volunteers");
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `VOL-${String(nextNumber).padStart(6, "0")}`;
}

async function generateCertificateId() {
  const counterRef = doc(db, COUNTERS_COL, "certificates");
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `CERT-${String(nextNumber).padStart(6, "0")}`;
}

/** ✅ إضافة متطوع يدويًا */
mAddBtn?.addEventListener("click", async () => {
  if (!ADMIN_OK) return alert("❌ غير مسموح");

  const name = (mName?.value || "").trim();
  const phone = digitsOnly(mPhone?.value || "");
  const gender = (mGender?.value || "").trim();
  const joinedAt = (mJoinedAt?.value || "").trim();
  const country = (mCountry?.value || "").trim();
  const notes = (mNotes?.value || "").trim();

  if (!name || !phone) {
    setMiniMsg("❌ الاسم ورقم الهاتف مطلوبين");
    return;
  }

  mAddBtn.disabled = true;
  setMiniMsg("جارٍ الإضافة...");

  try {
    let photoData = "";
    const f = mPhoto?.files?.[0];
    if (f) photoData = await fileToDataURL(f);

    const volunteerId = await generateVolunteerId();

    await setDoc(doc(db, VOL_COL, volunteerId), {
      name,
      volunteerId,
      phone,
      gender,
      joinedAt,
      hours: 0,
      status: "Active",
      photoData,
      notes,
      country,
      organization: "Pixology Foundation",
      createdAt: serverTimestamp(),
      addedManually: true,
    });

    showToast("✅ تمت الإضافة", `ID: ${volunteerId}`);
    setMiniMsg(`✅ تم — ${volunteerId}`);

    if (mName) mName.value = "";
    if (mPhone) mPhone.value = "";
    if (mGender) mGender.value = "";
    if (mJoinedAt) mJoinedAt.value = "";
    if (mCountry) mCountry.value = "";
    if (mNotes) mNotes.value = "";
    if (mPhoto) mPhoto.value = "";
  } catch (e) {
    console.error(e);
    setMiniMsg("❌ حصل خطأ أثناء الإضافة");
  } finally {
    mAddBtn.disabled = false;
  }
});

/** ========== Requests Table ========== */
function renderRequests(reqDocs) {
  if (!reqRowsEl) return;

  if (!reqDocs.length) {
    reqRowsEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:18px; color:#6b7280; font-weight:700;">
          لا توجد طلبات Pending
        </td>
      </tr>`;
    return;
  }

  reqRowsEl.innerHTML = reqDocs
    .map((r) => {
      const t = r.createdAtText || "";
      const country = r.country || "";
      const safeNotes = String(r.notes || "")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `
        <tr data-reqid="${r._docId}">
          <td>${t}</td>
          <td>${r.name || ""}</td>
          <td>${r.phone || ""}</td>
          <td>${r.gender || ""}</td>
          <td>${r.joinedAt || ""}</td>
          <td>${country}</td>
          <td>${safeNotes}</td>
          <td>
            <button class="miniBtn" data-action="approve">موافقة</button>
            <button class="miniBtn" data-action="reject">رفض</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

/** ✅ أزرار الجدول (save / issueCert / approve / reject) */
rowsEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  // ===== Requests (approve/reject) =====
  if (action === "approve" || action === "reject") {
    if (!ADMIN_OK) return alert("❌ غير مسموح");

    const row = btn.closest("tr");
    const reqId = row?.dataset?.reqid;
    if (!reqId) return;

    btn.disabled = true;

    try {
      if (action === "approve") {
        await updateDoc(doc(db, REQ_COL, reqId), { status: "Approved" });
        showToast("✅ تم قبول الطلب");
      } else {
        await updateDoc(doc(db, REQ_COL, reqId), { status: "Rejected" });
        showToast("✅ تم رفض الطلب");
      }
    } catch (err) {
      console.error(err);
      alert("❌ حصل خطأ");
    } finally {
      btn.disabled = false;
    }
    return;
  }

  // ===== Volunteers Table (save/issueCert) =====
  const row = btn.closest("tr");
  const docId = row?.dataset?.docid;
  if (!docId) return;

  if (action === "save") {
    const hoursInput = row.querySelector("input[data-field='hours']");
    const statusSelect = row.querySelector("select[data-field='status']");
    const notesInput = row.querySelector("input[data-field='notes']");

    const newHours = Number(hoursInput?.value || 0);
    const newStatus = (statusSelect?.value || "Active").trim();
    const newNotes = (notesInput?.value || "").trim();

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الحفظ...";

    try {
      await updateDoc(doc(db, VOL_COL, docId), {
        hours: Number.isFinite(newHours) ? newHours : 0,
        status: newStatus,
        notes: newNotes,
      });

      btn.textContent = "✅ تم";
      setTimeout(() => {
        btn.textContent = old || "حفظ";
        btn.disabled = false;
      }, 700);
    } catch (err) {
      console.error(err);
      btn.textContent = "❌ فشل";
      setTimeout(() => {
        btn.textContent = old || "حفظ";
        btn.disabled = false;
      }, 900);
    }
    return;
  }

  if (action === "issueCert") {
    if (!ADMIN_OK) return alert("❌ غير مسموح");

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الإصدار...";

    try {
      const vRef = doc(db, VOL_COL, docId);
      const vSnap = await getDoc(vRef);
      if (!vSnap.exists()) {
        alert("❌ المتطوع غير موجود");
        return;
      }

      const v = vSnap.data();
      const status = String(v.status || "Active")
        .trim()
        .toLowerCase();

      if (status === "inactive") {
        alert("❌ لا يمكن إصدار شهادة لمتطوع Inactive");
        return;
      }

      const certId = await generateCertificateId();

      await setDoc(doc(db, "certificates", certId), {
        certId,
        volunteerDocId: docId,
        volunteerId: v.volunteerId || docId,
        name: v.name || "",
        hoursAtIssue: Number(v.hours || 0),
        statusAtIssue: v.status || "Active",
        joinedAt: v.joinedAt || "",
        country: v.country || "",
        organization: v.organization || "Pixology Foundation",
        issuedAt: serverTimestamp(),
        issuedByUid: auth.currentUser?.uid || "",
      });

      showToast("✅ تم إصدار شهادة", certId);
      window.open(
        `certificate.html?cert=${encodeURIComponent(certId)}`,
        "_blank",
      );
    } catch (err) {
      console.error(err);
      alert("❌ حصل خطأ أثناء إصدار الشهادة");
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }
});

/** ✅ تحديد الكل */
selectAll?.addEventListener("change", () => {
  const checks = document.querySelectorAll(".rowCheck");
  checks.forEach((c) => (c.checked = selectAll.checked));
});

/** ✅ إلغاء التحديد */
clearSelectionBtn?.addEventListener("click", () => {
  document.querySelectorAll(".rowCheck").forEach((c) => (c.checked = false));
  if (selectAll) selectAll.checked = false;
});

/** ✅ مسح المحدد */
deleteSelectedBtn?.addEventListener("click", async () => {
  const ids = getSelectedIds();
  if (!ids.length) return alert("اختار متطوعين الأول ✅");

  const ok = confirm(`تأكيد مسح ${ids.length} متطوع؟`);
  if (!ok) return;

  deleteSelectedBtn.disabled = true;
  deleteSelectedBtn.textContent = "جارٍ المسح...";

  try {
    for (const id of ids) {
      await deleteDoc(doc(db, VOL_COL, id));
    }
    alert("✅ تم مسح المحدد");
  } catch (e) {
    console.error(e);
    alert("❌ حصل خطأ أثناء المسح");
  } finally {
    deleteSelectedBtn.disabled = false;
    deleteSelectedBtn.textContent = "🗑️ مسح المحدد";
  }
});

/** تصدير CSV */
exportBtn?.addEventListener("click", () => {
  const csv = toCsv(volunteers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pixology_volunteers.csv";
  a.click();
  URL.revokeObjectURL(url);
});

searchEl?.addEventListener("input", renderVolunteersTable);
filterStatusEl?.addEventListener("change", renderVolunteersTable);

passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn?.click();
});

loginBtn?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const pass = (passEl?.value || "").trim();
  if (loginMsg) loginMsg.textContent = "";

  if (!email || !pass) {
    if (loginMsg) loginMsg.textContent = "❌ اكتب الإيميل والباسورد";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    if (loginMsg) loginMsg.textContent = "❌ بيانات الدخول غلط";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

/** حالة الدخول */
onAuthStateChanged(auth, async (user) => {
  ADMIN_OK = false;
  CURRENT_ROLE = null;

  if (!user) {
    if (loginBox) loginBox.style.display = "block";
    if (dataBox) dataBox.style.display = "none";
    setControlsEnabled(false);

    volunteers = [];
    if (unsubVols) {
      unsubVols();
      unsubVols = null;
    }
    if (unsubReqs) {
      unsubReqs();
      unsubReqs = null;
    }

    renderVolunteersTable();
    if (reqRowsEl) reqRowsEl.innerHTML = "";
    setMiniMsg("");
    return;
  }

  const res = await checkAdmin(user);
  ADMIN_OK = res.ok;
  CURRENT_ROLE = res.role;

  // ✅ خزّن الدور عشان super.html يقدر يشيّك بسرعة (اختياري)
  localStorage.setItem("role", CURRENT_ROLE || "");

  if (!res.ok) {
    if (loginMsg) loginMsg.textContent = "❌ الحساب ده مش أدمن";
    await signOut(auth);
    return;
  }
  const goSuper = document.getElementById("goSuper");
  if (goSuper && CURRENT_ROLE === "super_admin") {
    goSuper.style.display = "inline-block";
  }

  if (loginBox) loginBox.style.display = "none";
  if (dataBox) dataBox.style.display = "block";
  setControlsEnabled(true);

  // requests
  const reqQ = query(collection(db, REQ_COL), orderBy("createdAt", "desc"));
  unsubReqs = onSnapshot(reqQ, (snap) => {
    const reqDocs = snap.docs
      .map((s) => {
        const d = s.data();
        const t = d.createdAt?.toDate ? d.createdAt.toDate() : null;
        return {
          _docId: s.id,
          name: d.name || "",
          phone: d.phone || "",
          gender: d.gender || "",
          joinedAt: d.joinedAt || "",
          country: d.country || "",
          notes: d.notes || "",
          status: d.status || "Pending",
          createdAtText: t ? t.toLocaleString("ar-EG") : "",
        };
      })
      .filter((x) => x.status === "Pending");

    renderRequests(reqDocs);
  });

  // volunteers
  const volQ = query(collection(db, VOL_COL), orderBy("createdAt", "desc"));
  unsubVols = onSnapshot(volQ, (snap) => {
    volunteers = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      const t = d.createdAt?.toDate ? d.createdAt.toDate() : null;

      return {
        _docId: docSnap.id,
        name: d.name || "",
        volunteerId: d.volunteerId || docSnap.id,
        phone: d.phone || "",
        gender: d.gender || "",
        joinedAt: d.joinedAt || "",
        hours: Number(d.hours || 0),
        status: d.status || "Active",
        notes: d.notes || "",
        country: d.country || "",
        photoData: d.photoData || "",
        createdAtText: t ? t.toLocaleString("ar-EG") : "",
      };
    });

    renderVolunteersTable();
  });
});

setControlsEnabled(false);
renderVolunteersTable();
