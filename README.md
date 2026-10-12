# سين جيم — نسخة مستقلة

لعبة سين جيم عن المسلسلات والأفلام، تشتغل على GitHub Pages، وتستخدم Firebase للغرف (القائد والجرس وشاشة العرض).

## الملفات
- `index.html`: اللعبة
- `img/`: صور الأسئلة (156 صورة)
- `shim.js`: يربط اللعبة بـ Firebase بدل خدمات Claude
- `sw.js`: يعرض الصور اللي تضيفها في «فئاتي»
- `firebase-config.js`: هنا تلصق إعدادات Firebase
- `database.rules.json`: قواعد قاعدة البيانات، تنلصق في Firebase

## بدون Firebase
إذا خليت `firebase-config.js` على `null`، تشتغل اللعبة على جهاز واحد بس.

## إعداد Firebase
1. console.firebase.google.com ← Create project (بدون Google Analytics).
2. Build ← Realtime Database ← Create database ← اختار موقع (مثلاً belgium) ← Start in **locked mode**.
3. تبويب Rules ← الصق محتوى `database.rules.json` ← Publish.
4. Project settings ← Your apps ← أيقونة الويب `</>` ← سجّل التطبيق ← انسخ `firebaseConfig`.
5. الصقه في `firebase-config.js` بدل `null`، مثل:
   `self.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", databaseURL: "https://...firebasedatabase.app", projectId: "...", appId: "..." };`

## ملاحظة
- «فئاتي» تنحفظ على الجهاز اللي أضفتها منه. الصور اللي تضيفها توصل لجوالات اللاعبين، الفيديوهات تطلع على جهازك بس.
