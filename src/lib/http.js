import crypto from 'node:crypto';
import { db } from './db.js';

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export const fail = (status, error) => json({ error }, status);
export const readBody = async req => { try { return (await req.json()) || {}; } catch { return {}; } };
export const action = req => new URL(req.url).searchParams.get('action') || '';
export const clean = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
export const newId = (p = '') => p + crypto.randomBytes(6).toString('hex');
export const STAFF = ['admin', 'instructor', 'teacher'];
export const adminEmail = () => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  let s = await db.get('config', 'session_secret');
  if (!s) { s = { value: crypto.randomBytes(32).toString('hex') }; await db.set('config', 'session_secret', s); }
  return s.value;
}
const b64 = s => Buffer.from(s).toString('base64url');
const mac = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export async function signToken(email) {
  const p = b64(JSON.stringify({ e: email, x: Date.now() + 30 * 86400000 }));
  return `${p}.${mac(p, await secret())}`;
}
export async function currentUser(req) {
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [p, sig] = tok.split('.');
  if (!p || !sig || !safeEq(sig, mac(p, await secret()))) return null;
  let d; try { d = JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
  if (!d.e || d.x < Date.now()) return null;
  if (d.e === adminEmail()) return { email: d.e, name: 'مدير المنصة', role: 'admin' };
  return db.get('users', d.e);
}
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [salt, h] = String(stored || '').split(':');
  return !!salt && !!h && safeEq(crypto.scryptSync(pw, salt, 32).toString('hex'), h);
}
export const checkAdminPassword = pw => !!process.env.ADMIN_PASSWORD && safeEq(pw, process.env.ADMIN_PASSWORD);

export async function subscriptionOf(user) {
  if (!user) return null;
  if (user.role === 'admin') return { status: 'active', plan: 'admin' };
  return user.subId ? db.get('subscriptions', user.subId) : null;
}
export const hasAccess = (user, sub) => !!user && (STAFF.includes(user.role) || ['active', 'renewal_due'].includes(sub?.status));
export const publicUser = u => u && ({ email: u.email, name: u.name, role: u.role, phone: u.phone || '', company: u.company || '', requestedRole: u.requestedRole || '', specialty: u.specialty || '', bio: u.bio || '' });
