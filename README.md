# التزام التدريب+ — Iltizam Training

منصة تعليمية وتدريبية: مكتبة مجانية مرتبة من يوتيوب + دبلومات مدفوعة مؤهلة لسوق العمل + مسارات تعلم.
واجهة Vanilla HTML/CSS/JS وخلفية Netlify Functions + Netlify Blobs.

## الهيكل
- `public/` — الواجهة: `index.html`, `styles.css`, `app.js`, `seed-data.js` (بيانات الكورسات والباقات والأسعار).
- `netlify/functions/` — `auth-rbac`, `courses-and-paths`, `booking-engine`, `subscription-manager`, `cron-monthly-renewal` (يومياً), `verify-certificate`.
- `src/lib/` — `db.js` (Netlify Blobs مع بديل تلقائي), `http.js`, `notify.js`, `seed.js`.
- `netlify.toml` — `/api/*`، `/join/:role`، `/verify/:code`، والجدولة.

## الصلاحيات والمحتوى
- صفحة المقدمة (`/`) للزوار: دخول مباشر وروابط التسجيل حسب الدور؛ المسجَّل يذهب إلى الرئيسية.
- الأدوار: `admin`، `instructor` (مدرب)، `teacher` (مدرّس)، `contractor_b2b`، `trainee`. المدرب والمدرّس يحتاجان اعتماد المدير.
- `netlify/functions/content-library.js`: المدير والمدربون المعتمدون يضيفون فيديو / ملفات (حتى 4MB) / روابط / مقالات، مجانية أو للمشتركين، مع ربطها بكورس.

## إدارة المستخدمين والمحافظ
- `#/admin` (للمدير فقط) و`netlify/functions/admin-users.js`: إنشاء مستخدمين، تغيير الأدوار، صلاحيات تفصيلية لكل عضو، إيقاف/حذف، منح اشتراك مباشر.
- الصلاحيات: `content.add`, `lessons.add`, `links.approve`, `bookings.manage`, `subs.manage`, `paid.access` (افتراضية حسب الدور أو مخصصة للمستخدم).
- `src/lib/wallet.js`: سجل قيود محاسبي. عند تفعيل اشتراك تُخصم نسبة المنصة والباقي لرصيد المدربين؛ عند إتمام جلسة تُخصم نسبة المنصة والباقي لمحفظة المدرب. النسب تُضبط من صفحة الإدارة (الافتراضي 30% و20%). السجل لا يحرّك أموالاً فعلية.

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
