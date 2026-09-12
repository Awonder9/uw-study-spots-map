import { STUDY_SPOTS } from "../data.js";
import { pruneStale, computeBusynessStatus } from "./_shared/kv-helpers.js";
import { isAuthed, tryLogin } from "./_shared/dashboard-auth.js";
import { escapeHtml, formatRelativeTime, htmlResponse, pageShell, renderLogin, renderError } from "./_shared/dashboard-ui.js";

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

function actionForms(type, key) {
  const typeAttr = escapeHtml(type);
  const keyAttr = escapeHtml(key);
  return (
    "<div class=\"dash-actions\">" +
    "<form method=\"POST\" action=\"/dashboard-action\" class=\"dash-inline-form\">" +
    "<input type=\"hidden\" name=\"type\" value=\"" + typeAttr + "\">" +
    "<input type=\"hidden\" name=\"key\" value=\"" + keyAttr + "\">" +
    "<input type=\"hidden\" name=\"action\" value=\"dismiss\">" +
    "<button type=\"submit\" class=\"dash-btn\">Dismiss</button>" +
    "</form>" +
    "<form method=\"POST\" action=\"/dashboard-action\" class=\"dash-respond-form\">" +
    "<input type=\"hidden\" name=\"type\" value=\"" + typeAttr + "\">" +
    "<input type=\"hidden\" name=\"key\" value=\"" + keyAttr + "\">" +
    "<input type=\"hidden\" name=\"action\" value=\"respond\">" +
    "<textarea name=\"message\" placeholder=\"Write a public response&hellip;\" maxlength=\"500\" required></textarea>" +
    "<button type=\"submit\" class=\"dash-btn dash-btn-respond\">Respond</button>" +
    "</form>" +
    "</div>"
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
  const cards = rows.map(function (r) {
    const issueLabel = ISSUE_LABELS[r.issueType] || r.issueType;
    const message = r.message
      ? "<div class=\"report-row\">" + escapeHtml(r.message) + "</div>"
      : "";
    return (
      "<div class=\"report-card\"><div class=\"report-card-head\">" +
      "<strong>" + escapeHtml(r.spotName || r.spotId) + "</strong>" +
      "<span class=\"issue-tag\">" + escapeHtml(issueLabel) + "</span>" +
      "</div>" +
      message +
      "<div class=\"report-row\">" + formatRelativeTime(r.ts) + "</div>" +
      actionForms("feedback", r.key) +
      "</div>"
    );
  }).join("");
  return cards;
}

function renderSuggestionsSection(rows) {
  if (!rows.length) {
    return "<div class=\"dash-empty\">No spot suggestions submitted yet.</div>";
  }
  const cards = rows.map(function (r) {
    const categoryTag = r.category ? "<span class=\"issue-tag\">" + escapeHtml(r.category) + "</span>" : "";
    const description = r.description
      ? "<div class=\"report-row\">" + escapeHtml(r.description) + "</div>"
      : "";
    return (
      "<div class=\"report-card\"><div class=\"report-card-head\">" +
      "<strong>" + escapeHtml(r.name) + "</strong>" + categoryTag +
      "</div>" +
      "<div class=\"report-row\"><i class=\"fa-solid fa-location-dot\"></i> " + escapeHtml(r.location) + "</div>" +
      description +
      "<div class=\"report-row\">" + formatRelativeTime(r.ts) + "</div>" +
      actionForms("suggestion", r.key) +
      "</div>"
    );
  }).join("");
  return cards;
}

function renderPostUpdateForm() {
  return (
    "<div class=\"dash-section\"><h2>Post an update</h2>" +
    "<form method=\"POST\" action=\"/dashboard-action\" class=\"post-update-form\">" +
    "<input type=\"hidden\" name=\"action\" value=\"post\">" +
    "<input type=\"text\" name=\"summary\" maxlength=\"150\" placeholder=\"Headline&hellip;\" required>" +
    "<textarea name=\"message\" maxlength=\"500\" placeholder=\"What's new?&hellip;\" required></textarea>" +
    "<button type=\"submit\" class=\"save-btn\">Post update</button>" +
    "</form></div>"
  );
}

function renderDashboard(data) {
  const body =
    "<div class=\"dash-header\"><h1>Reports Dashboard</h1>" +
    "<div class=\"dash-header-links\"><a href=\"/dashboard-edit\">Edit Spots</a><a href=\"/\">&larr; Back to map</a></div></div>" +
    "<div class=\"dash-body\">" +
    renderPostUpdateForm() +
    "<div class=\"dash-section\"><h2>Suggested spots (" + data.suggestionRows.length + ")</h2>" +
    renderSuggestionsSection(data.suggestionRows) +
    "</div>" +
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
    const record = JSON.parse(raw);
    record.key = key.name;
    feedbackRows.push(record);
  }
  feedbackRows.sort(function (a, b) { return b.ts - a.ts; });

  const suggestionList = await env.STUDY_SPOTS_KV.list({ prefix: "suggestion:" });
  const suggestionRows = [];
  for (const key of suggestionList.keys) {
    const raw = await env.STUDY_SPOTS_KV.get(key.name);
    if (!raw) continue;
    const record = JSON.parse(raw);
    record.key = key.name;
    suggestionRows.push(record);
  }
  suggestionRows.sort(function (a, b) { return b.ts - a.ts; });

  return { busynessRows: busynessRows, feedbackRows: feedbackRows, suggestionRows: suggestionRows };
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
    return htmlResponse(renderLogin(null, "/dashboard", "/dashboard"));
  }
  const data = await loadDashboardData(env);
  return htmlResponse(renderDashboard(data));
}

export async function onRequestPost({ request, env }) {
  if (!env.DASHBOARD_PASSWORD) {
    return htmlResponse(renderError("Dashboard isn't configured yet."), 500);
  }
  const form = await request.formData();
  const loginResponse = await tryLogin(form, request, env, "/dashboard");
  if (!loginResponse) {
    return htmlResponse(renderLogin("Incorrect password.", "/dashboard", "/dashboard"), 401);
  }
  return loginResponse;
}
