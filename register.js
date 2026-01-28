import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
const storage = getStorage();

import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("regForm");
const msg = document.getElementById("msg");
const submitBtn = document.getElementById("submitBtn");

const successCard = document.getElementById("successCard");
const scName = document.getElementById("scName");
const scPhone = document.getElementById("scPhone");

const photoFileEl = document.getElementById("photoFile");

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "جارٍ الإرسال..." : "إرسال الطلب";
}

const norm = (v) => String(v ?? "").trim();

function showErr(text) {
  if (msg) msg.textContent = text;
}

/** ✅ تحويل الصورة إلى Base64 بعد تصغيرها لتفادي حد Firestore */
async function fileToSmallDataURL(file, maxSize = 360, quality = 0.7) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("❌ لازم تختار صورة (JPG/PNG)");
  }

  // حد حجم الملف الأصلي (اختياري) علشان ما يتعبّكش
  const maxOriginalMB = 5;
  if (file.size > maxOriginalMB * 1024 * 1024) {
    throw new Error("❌ الصورة كبيرة جدًا (أقصى 5MB)");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });

    let { width, height } = img;
    const ratio = Math.min(maxSize / width, maxSize / height, 1);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    // JPEG أصغر حجمًا غالبًا
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    // حماية إضافية: لو الداتا كبيرة جدًا، قلل أكتر مرة
    if (dataUrl.length > 650_000) {
      return canvas.toDataURL("image/jpeg", 0.6);
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (msg) msg.textContent = "";
  if (successCard) successCard.style.display = "none";

  const name = norm(document.getElementById("name")?.value);
  const phone = norm(document.getElementById("phone")?.value);
  const gender = norm(document.getElementById("gender")?.value);
  const joinedAt = norm(document.getElementById("joinedAt")?.value);
  const country = norm(document.getElementById("country")?.value);
  const notes = norm(document.getElementById("notes")?.value);

  if (!name || !phone || !gender || !joinedAt) {
    showErr("❌ املأ كل الحقول المطلوبة (*)");
    return;
  }

  setLoading(true);

  try {
    const file = photoFileEl?.files?.[0] || null;

    // ✅ صورة Base64 (أو فاضية)
    const photoData = file ? await fileToSmallDataURL(file) : "";

    await addDoc(collection(db, "volunteer_requests"), {
      name,
      phone,
      gender,
      joinedAt,
      country,
      notes,

      // ✅ بيانات الصورة
      photoData,
      photoName: file?.name || "",
      photoType: file?.type || "",

      status: "Pending",
      organization: "Pixology Foundation",
      createdAt: serverTimestamp(),
    });

    if (msg)
      msg.textContent =
        "✅ تم إرسال الطلب. انتظر موافقة الأدمن لإصدار ID رسمي.";
    if (scName) scName.textContent = name;
    if (scPhone) scPhone.textContent = phone;
    if (successCard) successCard.style.display = "block";

    form.reset();
  } catch (err) {
    console.error(err);
    showErr(err?.message || "❌ حصل خطأ أثناء الإرسال (راجع Console)");
  } finally {
    setLoading(false);
  }
});
