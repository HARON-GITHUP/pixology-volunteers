import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/** ================== DOM ================== */
const myProfileLink = document.getElementById("myProfileLink");

const grid = document.getElementById("volGrid");
const resultCount = document.getElementById("resultCount");
const volCount = document.getElementById("volCount");
const reqCount = document.getElementById("reqCount");

const searchEl = document.getElementById("courseSearch");
const genderEl = document.getElementById("filterGender");
const gradeEl = document.getElementById("filterGrade");
const clearBtn = document.getElementById("clearFilters");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

// قائمة طرق التسجيل
const loginMenu = document.getElementById("loginMenu");
const loginGoogle = document.getElementById("loginGoogle");

// شاشة البداية
const startGate = document.getElementById("startGate");

let cache = [];

/** ================== Helpers ================== */
function toggle(el, show) {
  if (!el) return;
  el.style.display = show ? "block" : "none";
}

function toggleMenu() {
  if (!loginMenu) return;
  const isOpen = loginMenu.style.display === "block";
  toggle(loginMenu, !isOpen);
}

function closeMenu() {
  toggle(loginMenu, false);
}

/** ================== كارت المتطوع ================== */
function cardHTML(v) {
  const img =
    v.photoData ||
    v.photoURL ||
    v.photoUrl ||
    v.imageUrl ||
    v.image ||
    v.avatar ||
    v.photo ||
    "p.jpg";

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

/** ================== Render ================== */
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
        (v.volunteerId || v.id || "").toString().toLowerCase().includes(q),
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

/** ================== Load ================== */
async function load() {
  const snap = await getDocs(
    query(collection(db, "pixology_volunteers"), orderBy("createdAt", "desc")),
  );

  cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();

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

/** ================== Events ================== */
searchEl?.addEventListener("input", render);
genderEl?.addEventListener("change", render);
gradeEl?.addEventListener("change", render);

clearBtn?.addEventListener("click", () => {
  if (searchEl) searchEl.value = "";
  if (genderEl) genderEl.value = "";
  if (gradeEl) gradeEl.value = "";
  render();
});

/** ================== Login Menu ================== */
btnLogin?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu();
});

document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;

  const clickedInsideMenu = loginMenu?.contains(target);
  const clickedLoginBtn = btnLogin?.contains(target);

  if (!clickedInsideMenu && !clickedLoginBtn) closeMenu();
});

loginGoogle?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    closeMenu();
    alert("تم تسجيل الدخول بحساب Google ✅");
  } catch {
    alert("فشل تسجيل الدخول");
  }
});

btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("تم تسجيل الخروج ✅");
  } catch {
    alert("فشل تسجيل الخروج");
  }
});

myProfileLink?.addEventListener("click", (e) => {
  if (!auth.currentUser) {
    e.preventDefault();
    alert("لازم تسجل / تنشئ حساب الأول ✅");
    toggle(loginMenu, true);
  }
});

/** ================== Auth State ================== */
onAuthStateChanged(auth, (user) => {
  if (user) {
    btnLogin &&
      (btnLogin.textContent =
        "حسابي: " + (user.displayName || user.email || "User"));
    btnLogout && (btnLogout.style.display = "inline-flex");
    myProfileLink && (myProfileLink.style.display = "inline-flex");
  } else {
    btnLogin && (btnLogin.textContent = "تسجيل / إنشاء حساب");
    btnLogout && (btnLogout.style.display = "none");
    myProfileLink && (myProfileLink.style.display = "none");
  }
});

/** ================== Start Gate: تسجيل متطوع/مؤسسة بجوجل ================== */
startGate?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn) return;

  const type = btn.dataset.type; // volunteer | org

  try {
    // ✅ لو مسجل بالفعل، استخدم نفس الحساب
    let user = auth.currentUser;

    // ✅ لو مش مسجل، افتح جوجل
    if (!user) {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      user = cred.user;
    }

    // ✅ حفظ النوع في Firestore users/{uid}
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        role: type, // volunteer | org
        active: true, // ✅ مهم للقواعد
        displayName: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    // ✅ اقفل شاشة البداية + اقفل قائمة التسجيل لو مفتوحة
    startGate.style.display = "none";
    closeMenu();

    alert(type === "org" ? "تم التسجيل كمؤسسة ✅" : "تم التسجيل كمتطوع ✅");
  } catch (err) {
    alert("لم يتم تسجيل الدخول");
    console.log(err);
  }
});

/** ================== Init ================== */
load();
