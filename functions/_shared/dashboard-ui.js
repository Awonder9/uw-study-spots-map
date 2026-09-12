// Shared rendering helpers for the dashboard pages (report review + spot editing).

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatRelativeTime(ts) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hr ago" : hours + " hrs ago";
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : days + " days ago";
}

export function htmlResponse(body, status, extraHeaders) {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(body, { status: status || 200, headers });
}

export function pageShell(title, bodyHtml) {
  return (
    "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
    "<title>" + escapeHtml(title) + "</title>" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">" +
    "<style>" + PAGE_CSS + "</style></head><body>" + bodyHtml + "</body></html>"
  );
}

export const PAGE_CSS =
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
  ".dash-header-links{display:flex;gap:16px;flex-wrap:wrap;}" +
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
  ".issue-tag{font-size:11px;font-weight:600;background:var(--paper-alt);padding:2px 8px;border-radius:999px;white-space:nowrap;}" +
  ".dash-actions{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--paper-alt);flex-wrap:wrap;}" +
  ".dash-inline-form{flex:0 0 auto;}" +
  ".dash-respond-form{flex:1 1 220px;display:flex;gap:8px;align-items:flex-start;}" +
  ".dash-respond-form textarea{flex:1;font:inherit;font-size:12.5px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;resize:vertical;min-height:36px;background:var(--paper-alt);}" +
  ".dash-btn{font:inherit;font-size:12px;font-weight:600;border-radius:999px;padding:7px 13px;cursor:pointer;white-space:nowrap;border:1px solid var(--line);background:var(--white);color:var(--ink-soft);}" +
  ".dash-btn:hover{background:var(--paper-alt);}" +
  ".dash-btn-respond{background:var(--ink);color:#fff;border-color:var(--ink);}" +
  ".dash-btn-respond:hover{background:var(--red);border-color:var(--red);}" +
  ".ts-cell{color:var(--ink-faint);white-space:nowrap;}" +
  ".post-update-form{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;}" +
  ".post-update-form input[type=text],.post-update-form textarea{width:100%;font:inherit;font-size:13.5px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper-alt);}" +
  ".post-update-form textarea{resize:vertical;min-height:70px;}" +
  ".post-update-form button{align-self:flex-start;}" +
  /* spot-edit page */
  ".search-form{display:flex;gap:8px;margin-bottom:18px;}" +
  ".search-form input{flex:1;font:inherit;font-size:13.5px;padding:9px 12px;border:1px solid var(--line);border-radius:999px;background:var(--white);}" +
  ".search-form button{font:inherit;font-size:13px;font-weight:600;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--white);color:var(--ink-soft);cursor:pointer;}" +
  ".spot-index-row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--white);border:1px solid var(--line);border-radius:10px;padding:11px 14px;margin-bottom:8px;}" +
  ".spot-index-row a{color:var(--ink);font-weight:600;font-size:13.5px;text-decoration:none;}" +
  ".spot-index-row a:hover{color:var(--red);}" +
  ".spot-index-meta{display:flex;align-items:center;gap:8px;}" +
  ".override-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--red-dark);background:var(--red-tint);padding:3px 8px;border-radius:999px;}" +
  ".edit-form{background:var(--white);border:1px solid var(--line);border-radius:14px;padding:22px 24px;}" +
  ".edit-form label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);margin-bottom:6px;margin-top:16px;}" +
  ".edit-form label:first-child{margin-top:0;}" +
  ".edit-form input[type=text],.edit-form select,.edit-form textarea{width:100%;font:inherit;font-size:14px;color:var(--ink);padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper-alt);}" +
  ".edit-form textarea{resize:vertical;min-height:90px;}" +
  ".tag-checkbox-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 12px;}" +
  ".tag-checkbox{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-soft);}" +
  ".edit-form-actions{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap;}" +
  ".save-btn{background:var(--ink);color:#fff;border:none;padding:11px 20px;border-radius:999px;font-weight:600;font-size:14px;cursor:pointer;}" +
  ".save-btn:hover{background:var(--red);}" +
  ".reset-btn{background:var(--white);color:var(--red-dark);border:1px solid var(--red);padding:11px 20px;border-radius:999px;font-weight:600;font-size:14px;cursor:pointer;}" +
  ".reset-btn:hover{background:var(--red-tint);}" +
  ".save-success{background:var(--red-tint);color:var(--red-dark);font-size:13px;font-weight:600;padding:10px 14px;border-radius:10px;margin-bottom:16px;}";

// A login form usable from any dashboard page: `formAction` is the page's
// own path (so the POST routes to that page's Function), and `redirect` is
// carried through as a hidden field so a successful login lands back on the
// exact page (query params included) the user was originally trying to reach.
export function renderLogin(error, formAction, redirect) {
  const errorHtml = error ? "<div class=\"login-error\">" + escapeHtml(error) + "</div>" : "";
  return pageShell(
    "Dashboard — UW Study Spots",
    "<div class=\"login-wrap\"><div class=\"login-card\">" +
      "<h1>Dashboard</h1><p>Enter the password to view reports.</p>" +
      errorHtml +
      "<form method=\"POST\" action=\"" + escapeHtml(formAction || "/dashboard") + "\">" +
      "<input type=\"hidden\" name=\"redirect\" value=\"" + escapeHtml(redirect || formAction || "/dashboard") + "\">" +
      "<input type=\"password\" name=\"password\" placeholder=\"Password\" autofocus autocomplete=\"current-password\">" +
      "<button type=\"submit\">Log in</button>" +
      "</form></div></div>"
  );
}

export function renderError(message) {
  return pageShell(
    "Dashboard — UW Study Spots",
    "<div class=\"login-wrap\"><div class=\"login-card\"><h1>Dashboard</h1>" +
      "<div class=\"login-error\">" + escapeHtml(message) + "</div></div></div>"
  );
}
