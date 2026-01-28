import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById("volGrid");
const resultCount = document.getElementById("resultCount");
const volCount = document.getElementById("volCount");
const reqCount = document.getElementById("reqCount");

const searchEl = document.getElementById("courseSearch");
const genderEl = document.getElementById("filterGender");
const gradeEl = document.getElementById("filterGrade");
const clearBtn = document.getElementById("clearFilters");

let cache = [];

// ================== كارت المتطوع ==================
function cardHTML(v) {
  // ✅ نفس منطق صفحة الملف الشخصي
  const img =
    v.photoData ||
    v.photoURL ||
    v.photoUrl ||
    v.imageUrl ||
    v.image ||
    v.avatar ||
    v.photo ||
    "p.jpg"; // لو مفيش صورة -> Pixology

  const name = v.name || "متطوع";
  const hours = Number(v.hours ?? 0);
  const id = v.volunteerId || v.id || "—";
  const gender = v.gender || "";

  return `
    <article class="course-card" data-gender="${gender}">
      <div class="course-card__img">
        <img 
          src="${img}" 
          alt="صورة المتطوع ${name}"
          onerror="this.src='p.jpg'"
        />
        <span class="ribbon ribbon--pink">المتطوع</span>
        <span class="price-badge">${hours}<br /><small>ساعات</small></span>
      </div>

      <div class="course-card__body">
        <span class="teacher-tag">${name}</span>
        <div class="course-card__title">${name}</div>
        <p class="course-card__desc">ID: ${id}</p>

        <div class="actions">
          <a class="btn btn--outline" href="volunteer.html?id=${encodeURIComponent(id)}">
            الدخول للملف الشخصي
          </a>
          <a class="btn btn--solid" href="verify.html?id=${encodeURIComponent(id)}">
            Verify
          </a>
        </div>
      </div>
    </article>
  `;
}

// ================== Render ==================
function render() {
  if (!grid) return;

  const q = (searchEl?.value || "").trim().toLowerCase();
  const g = (genderEl?.value || "").trim();
  const mode = (gradeEl?.value || "").trim();

  let list = cache.slice();

  if (q) {
    list = list.filter(
      (v) =>
        (v.name || "").toLowerCase().includes(q) ||
        (v.volunteerId || "").toLowerCase().includes(q),
    );
  }

  if (g) {
    list = list.filter((v) => (v.gender || "") === g);
  }

  if (mode === "اكبر عدد ساعات") {
    list.sort((a, b) => Number(b.hours || 0) - Number(a.hours || 0));
  } else if (mode === "اقل عدد ساعات") {
    list.sort((a, b) => Number(a.hours || 0) - Number(b.hours || 0));
  }

  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<p class="muted">لا يوجد متطوعين معتمدين بعد.</p>`;

  if (resultCount) resultCount.textContent = String(list.length);
  if (volCount) volCount.textContent = String(cache.length);
}

// ================== Load ==================
async function load() {
  // المتطوعين المعتمدين
  const snap = await getDocs(
    query(collection(db, "pixology_volunteers"), orderBy("createdAt", "desc")),
  );

  cache = snap.docs.map((d) => d.data());
  render();

  // عدد الطلبات Pending
  try {
    const rs = await getDocs(
      query(
        collection(db, "volunteer_requests"),
        where("status", "==", "Pending"),
      ),
    );
    if (reqCount) reqCount.textContent = String(rs.size);
  } catch {
    if (reqCount) reqCount.textContent = "—";
  }
}

// ================== Events ==================
searchEl?.addEventListener("input", render);
genderEl?.addEventListener("change", render);
gradeEl?.addEventListener("change", render);

clearBtn?.addEventListener("click", () => {
  if (searchEl) searchEl.value = "";
  if (genderEl) genderEl.value = "";
  if (gradeEl) gradeEl.value = "";
  render();
});

// ================== Init ==================
load();
