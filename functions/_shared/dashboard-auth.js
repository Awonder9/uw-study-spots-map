// Shared auth helpers for the dashboard page and dashboard action endpoint.

export const COOKIE_NAME = "dashboard_auth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function isAuthed(request, env) {
  if (!env.DASHBOARD_PASSWORD) return false;
  const cookie = getCookie(request, COOKIE_NAME);
  if (!cookie) return false;
  const expected = await sha256Hex(env.DASHBOARD_PASSWORD + ":session");
  return timingSafeEqual(cookie, expected);
}

export function sessionCookieHeader(request, token) {
  const isHttps = new URL(request.url).protocol === "https:";
  return (
    COOKIE_NAME + "=" + token + "; Max-Age=" + SESSION_MAX_AGE + "; Path=/; HttpOnly; SameSite=Strict" +
    (isHttps ? "; Secure" : "")
  );
}

// Verifies a login POST (already-parsed FormData, since a request body can
// only be read once). Returns a redirect Response on success — to whatever
// the "redirect" field carried, so a login triggered from a deep link (e.g.
// /dashboard-edit?spot=x) lands back where the user was headed — or null on
// a wrong password, so the caller can re-render its own login form with an
// error instead.
export async function tryLogin(form, request, env, fallbackRedirect) {
  const password = String(form.get("password") || "");
  if (!timingSafeEqual(password, env.DASHBOARD_PASSWORD)) return null;
  const token = await sha256Hex(env.DASHBOARD_PASSWORD + ":session");
  const redirectTo = String(form.get("redirect") || fallbackRedirect);
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo, "Set-Cookie": sessionCookieHeader(request, token) }
  });
}
