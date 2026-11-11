// إشعار مدير المنصة بكل جديد: يُحفظ في سجل الإشعارات، ويُرسل بريدياً
// (Resend إن وُجد مفتاحه، وإلا عبر Netlify Forms التي ترسل إشعار البريد من إعدادات الموقع)
import { db } from './db.js';
import { newId } from './http.js';

export async function notify(type, title, data = {}) {
  const rec = { id: `${Date.now()}-${newId()}`, type, title, data, at: new Date().toISOString() };
  try { await db.set('notifications', rec.id, rec); } catch (e) { console.error('notify/store', e); }
  const details = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
  const to = process.env.NOTIFY_EMAIL;
  try {
    if (process.env.RESEND_API_KEY && to) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.NOTIFY_FROM || 'Iltizam Training <onboarding@resend.dev>',
          to: [to], subject: `التزام التدريب | ${title}`, text: `${title}\n\n${details}\n\n${rec.at}`
        })
      });
    } else if (process.env.URL) {
      await fetch(`${process.env.URL}/`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'form-name': 'platform-events', type, title, details }).toString()
      });
    }
  } catch (e) { console.error('notify/send', e); }
  return rec;
}
