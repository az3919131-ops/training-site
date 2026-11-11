# التزام التدريب+ — Iltizam Training

منصة تعليمية وتدريبية: مكتبة مجانية مرتبة من يوتيوب + دبلومات مدفوعة مؤهلة لسوق العمل + مسارات تعلم.
واجهة Vanilla HTML/CSS/JS وخلفية Netlify Functions + Netlify Blobs.

## الهيكل
- `public/` — الواجهة: `index.html`, `styles.css`, `app.js`, `seed-data.js` (بيانات الكورسات والباقات والأسعار).
- `netlify/functions/` — `auth-rbac`, `courses-and-paths`, `booking-engine`, `subscription-manager`, `cron-monthly-renewal` (يومياً), `verify-certificate`.
- `src/lib/` — `db.js` (Netlify Blobs مع بديل تلقائي), `http.js`, `notify.js`, `seed.js`.
- `netlify.toml` — `/api/*`، `/join/:role`، `/verify/:code`، والجدولة.

## التشغيل محلياً
- افتح `public/index.html` مباشرة (يعمل بـ localStorage بدون خادم)، أو
- `npm install && node tests/dev-server.mjs` ثم http://localhost:8888 (الواجهة + الدوال بمخزن مؤقت).
- `npm test` لاختبار الدوال.

## متغيرات البيئة على Netlify
| المتغير | الوظيفة |
|---|---|
| `WHATSAPP_NUMBER` | رقم واتساب بالصيغة الدولية بدون `+` (مثل `9665XXXXXXXX`) لأزرار التواصل والاشتراك |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | حساب مدير المنصة (تفعيل الاشتراكات، تأكيد الحجوزات، اعتماد الروابط والمحاضرين) |
| `NOTIFY_EMAIL` + `RESEND_API_KEY` | (اختياري) إرسال الإشعارات بالبريد عبر Resend |
| `SESSION_SECRET` | (اختياري) مفتاح توقيع الجلسات؛ يُولَّد تلقائياً إن لم يُضبط |

بدون `RESEND_API_KEY` تُرسل أحداث المنصة إلى نموذج Netlify Forms باسم `platform-events`؛
فعّل Forms ثم أضف إشعار بريد من: Site configuration → Notifications → Form submission notifications.

## ملاحظات
- الدفع يُستكمل عبر واتساب ثم يفعّل المدير الاشتراك من «حسابي ← لوحة المدير».
- الأسعار وأسعار التحويل في `public/seed-data.js` قيم مبدئية قابلة للتعديل.
- فيديوهات الدبلومات المدفوعة يضيفها المدير أو المحاضر المعتمد من صفحة الدبلوم.

Project manager  Eng  Ahmed Zahran
