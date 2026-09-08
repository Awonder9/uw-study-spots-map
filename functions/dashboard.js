import { STUDY_SPOTS } from "../data.js";
import { pruneStale, computeBusynessStatus } from "./_shared/kv-helpers.js";

const COOKIE_NAME = "dashboard_auth";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const LEVEL_META = {
  "empty": { label: "Empty", color: "#4C8C5B" },
  "some-seats": { label: "Some seats", color: "#E0A82E" },
  "busy": { label: "Busy", color: "#C97A3D" },
  "full": { label: "Full", color: "#C5050C" }
};

const ISSUE_LABELS = {
  "wrong-address": "Wrong address",
  "closed": "Permanently closed",
  "wrong-hours": "Wrong hours",
  "other": "Other"
};

// ---------- crypto / cookie helpers ----------

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

async function isAuthed(request, env) {
  if (!env.DASHBOARD_PASSWORD) return false;
  const cookie = getCookie(request, COOKIE_NAME);
  if (!cookie) return false;
  const expected = await sha256Hex(env.DASHBOARD_PASSWORD + ":session");
  return timingSafeEqual(cookie, expected);
}

// ---------- rendering helpers ----------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelativeTime(ts) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hr ago" : hours + " hrs ago";
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : days + " days ago";
}

function htmlResponse(body, status, extraHeaders) {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(body, { status: status || 200, headers });
}

function pageShell(title, bodyHtml) {
  return (
    "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
    "<title>" + escapeHtml(title) + "</title>" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">" +
    "<style>" + PAGE_CSS + "</style></head><body>" + bodyHtml + "</body></html>"
  );
}

const PAGE_CSS =
  ":root{--red:#C5050C;--red-dark:#9B0000;--red-tint:#FDEBEA;--ink:#1D1A17;--ink-soft:#5B564F;" +
  "--ink-faint:#8C867C;--paper:#FBF8F2;--paper-alt:#F3EDE0;--line:#E6DFD1;--white:#FFFFFF;}" +
  "*{box-sizing:border-box;}body{margin:0;font-family:'Inter',sans-serif;background:var(--paper);color:var(--ink);}" +
  "h1,h2{font-family:'Fraunces',serif;margin:0;}" +
  ".login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}" +
  ".login-card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:32px;max-width:340px;width:100%;box-shadow:0 8px 24px rgba(29,26,23,.10);}" +
  ".login-card h1{font-size:22px;margin-bottom:8px;}" +
  ".login-card p{font-size:13.5px;color:var(--ink-soft);margin:0 0 18px;}" +
  ".login-card input{width:100%;font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin-bottom:12px;}" +
  ".login-card button{width:100%;background:var(--ink);color:#fff;border:none;padding:11px;border-radius:999px;font-weight:600;font-size:14px;cursor:pointer;}" +
  ".login-card button:hover{background:var(--red);}" +
  ".login-error{background:var(--red-tint);color:var(--red-dark);font-size:12.5px;padding:8px 10px;border-radius:8px;margin-bottom:12px;}" +
  ".dash-header{background:var(--white);border-bottom:1px solid var(--line);padding:18px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}" +
  ".dash-header h1{font-size:22px;}" +
  ".dash-header a{color:var(--ink-soft);font-size:13px;font-weight:600;text-decoration:none;}" +
  ".dash-header a:hover{color:var(--red);}" +
  ".dash-body{max-width:960px;margin:0 auto;padding:24px 28px 60px;}" +
  ".dash-section{margin-bottom:36px;}" +
  ".dash-section h2{font-size:17px;margin-bottom:14px;}" +
  ".dash-empty{color:var(--ink-faint);font-size:13.5px;background:var(--white);border:1px dashed var(--line);border-radius:12px;padding:20px;text-align:center;}" +
  ".report-card{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;}" +
  ".report-card-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;}" +
  ".report-card-head strong{font-size:14.5px;}" +
  ".level-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;color:#fff;}" +
  ".mixed-tag{font-size:10.5px;font-weight:700;color:var(--red-dark);background:var(--red-tint);padding:3px 8px;border-radius:999px;}" +
  ".report-row{font-size:12px;color:var(--ink-soft);padding:3px 0;border-top:1px solid var(--paper-alt);}" +
  ".report-row:first-child{border-top:none;}" +
  "table{width:100%;border-collapse:collapse;background:var(--white);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13px;}" +
  "th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--paper-alt);vertical-align:top;}" +
  "th{background:var(--paper-alt);font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);}" +
  "tr:last-child td{border-bottom:none;}" +
  ".issue-tag{font-size:11px;font-weight:600;background:var(--paper-alt);padding:2px 8px;border-radius:999px;white-space:nowrap;}" +
  ".ts-cell{color:var(--ink-faint);white-space:nowrap;}";

function renderLogin(error) {
  const errorHtml = error ? "<div class=\"login-error\">" + escapeHtml(error) + "</div>" : "";
  return pageShell(
    "Dashboard — UW Study Spots",
    "<div class=\"login-wrap\"><div class=\"login-card\">" +
      "<h1>Dashboard</h1><p>Enter the password to view reports.</p>" +
      errorHtml +
      "<form method=\"POST\" action=\"/dashboard\">" +
      "<input type=\"password\" name=\"password\" placeholder=\"Password\" autofocus autocomplete=\"current-password\">" +
      "<button type=\"submit\">Log in</button>" +
      "</form></div></div>"
  );
}

function renderError(message) {
  return pageShell(
    "Dashboard — UW Study Spots",
    "<div class=\"login-wrap\"><div class=\"login-card\"><h1>Dashboard</h1>" +
      "<div class=\"login-error\">" + escapeHtml(message) + "</div></div></div>"
  );
}

function renderBusynessSection(rows) {
  if (!rows.length) {
    return "<div class=\"dash-empty\">No active busyness reports right now.</div>";
  }
  const cards = rows.map(function (row) {
    const meta = LEVEL_META[row.status.level] || { label: row.status.level, color: "#8C867C" };
    const mixedTag = row.status.mixed ? "<span class=\"mixed-tag\">Mixed</span>" : "";
    const reportRows = row.reports.map(function (r) {
      const rMeta = LEVEL_META[r.level] || { label: r.level };
      return (
        "<div class=\"report-row\">" + escapeHtml(rMeta.label) + " &middot; " +
        formatRelativeTime(r.ts) + " &middot; device " + escapeHtml(String(r.deviceId).slice(0, 8)) + "&hellip;</div>"
      );
    }).join("");
    return (
      "<div class=\"report-card\"><div class=\"report-card-head\">" +
      "<strong>" + escapeHtml(row.spotName) + "</strong>" +
      "<span class=\"level-pill\" style=\"background:" + meta.color + "\">" + escapeHtml(meta.label) + "</span>" +
      mixedTag +
      "</div>" + reportRows + "</div>"
    );
  }).join("");
  return cards;
}

function renderFeedbackSection(rows) {
  if (!rows.length) {
    return "<div class=\"dash-empty\">No feedback submitted yet.</div>";
  }
  const body = rows.map(function (r) {
    const issueLabel = ISSUE_LABELS[r.issueType] || r.issueType;
    return (
      "<tr><td>" + escapeHtml(r.spotName || r.spotId) + "</td>" +
      "<td><span class=\"issue-tag\">" + escapeHtml(issueLabel) + "</span></td>" +
      "<td>" + (r.message ? escapeHtml(r.message) : "<span style=\"color:var(--ink-faint)\">&mdash;</span>") + "</td>" +
      "<td class=\"ts-cell\">" + formatRelativeTime(r.ts) + "</td></tr>"
    );
  }).join("");
  return (
    "<table><thead><tr><th>Spot</th><th>Issue</th><th>Message</th><th>When</th></tr></thead>" +
    "<tbody>" + body + "</tbody></table>"
  );
}

function renderDashboard(data) {
  const body =
    "<div class=\"dash-header\"><h1>Reports Dashboard</h1><a href=\"/\">&larr; Back to map</a></div>" +
    "<div class=\"dash-body\">" +
    "<div class=\"dash-section\"><h2>Busyness reports (" + data.busynessRows.length + " spots active)</h2>" +
    renderBusynessSection(data.busynessRows) +
    "</div>" +
    "<div class=\"dash-section\"><h2>Feedback (" + data.feedbackRows.length + ")</h2>" +
    renderFeedbackSection(data.feedbackRows) +
    "</div></div>";
  return pageShell("Dashboard — UW Study Spots", body);
}

// ---------- data loading ----------

async function loadDashboardData(env) {
  const now = Date.now();

  const busynessList = await env.STUDY_SPOTS_KV.list({ prefix: "busyness:" });
  const busynessRows = [];
  for (const key of busynessList.keys) {
    const raw = await env.STUDY_SPOTS_KV.get(key.name);
    if (!raw) continue;
    const spotId = key.name.slice("busyness:".length);
    const spot = STUDY_SPOTS.find(function (s) { return s.id === spotId; });
    const reports = pruneStale(JSON.parse(raw), now);
    if (!reports.length) continue;
    const status = computeBusynessStatus(reports, now);
    busynessRows.push({
      spotId: spotId,
      spotName: spot ? spot.name : spotId,
      status: status,
      reports: reports.slice().sort(function (a, b) { return b.ts - a.ts; })
    });
  }
  busynessRows.sort(function (a, b) { return b.status.reportedAt - a.status.reportedAt; });

  const feedbackList = await env.STUDY_SPOTS_KV.list({ prefix: "feedback:" });
  const feedbackRows = [];
  for (const key of feedbackList.keys) {
    const raw = await env.STUDY_SPOTS_KV.get(key.name);
    if (!raw) continue;
    feedbackRows.push(JSON.parse(raw));
  }
  feedbackRows.sort(function (a, b) { return b.ts - a.ts; });

  return { busynessRows: busynessRows, feedbackRows: feedbackRows };
}

// ---------- route handlers ----------

export async function onRequestGet({ request, env }) {
  if (!env.DASHBOARD_PASSWORD) {
    return htmlResponse(
      renderError("Dashboard isn't configured yet — set a DASHBOARD_PASSWORD environment variable in the Cloudflare Pages project settings."),
      500
    );
  }
  if (!(await isAuthed(request, env))) {
    return htmlResponse(renderLogin());
  }
  const data = await loadDashboardData(env);
  return htmlResponse(renderDashboard(data));
}

export async function onRequestPost({ request, env }) {
  if (!env.DASHBOARD_PASSWORD) {
    return htmlResponse(renderError("Dashboard isn't configured yet."), 500);
  }
  const form = await request.formData();
  const password = String(form.get("password") || "");
  if (!timingSafeEqual(password, env.DASHBOARD_PASSWORD)) {
    return htmlResponse(renderLogin("Incorrect password."), 401);
  }
  const token = await sha256Hex(env.DASHBOARD_PASSWORD + ":session");
  const isHttps = new URL(request.url).protocol === "https:";
  const cookie =
    COOKIE_NAME + "=" + token + "; Max-Age=" + SESSION_MAX_AGE + "; Path=/; HttpOnly; SameSite=Strict" +
    (isHttps ? "; Secure" : "");
  return new Response(null, { status: 302, headers: { Location: "/dashboard", "Set-Cookie": cookie } });
}
