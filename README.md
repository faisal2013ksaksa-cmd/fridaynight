# Friday Night — ألعاب جماعية

موقع ألعاب للجمعة يشتغل على GitHub Pages، ويستخدم Firebase للغرف أونلاين.

## الألعاب
| المجلد | اللعبة |
|---|---|
| `/` | الصفحة الرئيسية: الألعاب + خانة «ادخل برمز الغرفة» |
| `seenjeem/` | 🎬 سين جيم (مسلسلات وأفلام) |
| `outside/` | 🤫 برا السالفة |
| `sedq/` | 🤥 صدق ولا كذب |
| `mf/` | 👀 مين فينا؟ |
| `draw/` | 🎨 ارسم وخمّن |
| `tv/` | 📺 شاشة العرض للتلفزيون (تشتغل مع كل الألعاب) |

الروابط القديمة حق سين جيم (`الموقع/#AB123`) تتحوّل تلقائي لـ `seenjeem/`.

## المحتوى
- `seenjeem/index.html`: أسئلة سين جيم، والصور في `img/`
- `outside/words.json`: أقسام وكلمات برا السالفة
- `sedq/questions.json`: أسئلة صدق ولا كذب
- `mf/questions.json`: أسئلة مين فينا
- `draw/words.json`: كلمات ارسم وخمّن

## ملفات مشتركة
- `fncrypto.js`: تشفير أسرار الغرف (الأدوار، التصويت، الكذبات، الأجوبة) عشان محد يقدر يغش من قاعدة البيانات
- `shim.js` و `sw.js`: تشغيل سين جيم على Firebase وعرض صور «فئاتي»
- `firebase-config.js`: إعدادات Firebase
- `database.rules.json`: قواعد قاعدة البيانات. **أي تعديل عليها لازم ينلصق في Firebase** (Realtime Database ← Rules ← Publish)
- `scripts/localize_tmdb.py`: ينزّل صور TMDB داخل `img/` (يشتغل تلقائي على GitHub Actions)

## إعداد Firebase (مرة وحدة)
1. console.firebase.google.com ← Create project (بدون Google Analytics).
2. Build ← Realtime Database ← Create database ← Start in **locked mode**.
3. تبويب Rules ← الصق محتوى `database.rules.json` ← Publish.
4. Project settings ← Your apps ← أيقونة الويب `</>` ← انسخ `databaseURL` و `projectId` إلى `firebase-config.js`.

إذا `firebase-config.js` على `null`، تشتغل سين جيم وبرا السالفة على جهاز واحد بس.
