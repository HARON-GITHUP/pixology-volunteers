import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const pPhoto = document.getElementById("pPhoto");
const pName = document.getElementById("pName");
const pEmail = document.getElementById("pEmail");
const pUid = document.getElementById("pUid");
const pLast = document.getElementById("pLast");
const btnLogout = document.getElementById("btnLogout");

// ✅ لو مش مسجل دخول: هنطلب تسجيل بجوجل ثم نرجع نعرض الملف
async function requireLogin() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      alert("لازم تسجل دخول بحسابك الأول ✅");
      await requireLogin();
      return; // بعد التسجيل هيتنادى onAuthStateChanged تاني لوحده
    }

    // عرض البيانات
    pName.textContent = user.displayName || "—";
    pEmail.textContent = user.email || "—";
    pUid.textContent = user.uid || "—";

    const last = user.metadata?.lastSignInTime;
    pLast.textContent = last ? new Date(last).toLocaleString("ar-EG") : "—";

    pPhoto.src = user.photoURL || "p.jpg";
    pPhoto.onerror = () => (pPhoto.src = "p.jpg");

    btnLogout.style.display = "inline-flex";
  } catch (e) {
    // لو المستخدم قفل نافذة تسجيل جوجل
    alert("لم يتم تسجيل الدخول");
    window.location.replace("index.html");
  }
});

// تسجيل خروج
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("index.html");
});
