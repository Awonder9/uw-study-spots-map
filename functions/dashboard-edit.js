import { STUDY_SPOTS, CATEGORY_META, FILTER_TAGS } from "../data.js";
import { isAuthed, tryLogin } from "./_shared/dashboard-auth.js";
import { escapeHtml, htmlResponse, pageShell, renderLogin, renderError } from "./_shared/dashboard-ui.js";
import { getMergedSpots, getOverrides, overrideKey } from "./_shared/spot-overrides.js";

const CATEGORY_KEYS = Object.keys(CATEGORY_META);
const ALL_TAGS = FILTER_TAGS.concat(CATEGORY_KEYS);
const AFFILIATIONS = ["University", "Off-Campus"];

function currentPath(request) {
  const url = new URL(request.url);
  return url.pathname + url.search;
}

// ---------- rendering ----------

function renderIndex(spots, overrideIds, query) {
  const q = (query || "").trim().toLowerCase();
  const filtered = q
    ? spots.filter(function (s) {
        return s.name.toLowerCase().indexOf(q) !== -1 || s.address.toLowerCase().indexOf(q) !== -1;
      })
    : spots;
  const sorted = filtered.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

  const rows = sorted.map(function (s) {
    const overrideTag = overrideIds.has(s.id) ? "<span class=\"override-tag\">Edited</span>" : "";
    return (
      "<div class=\"spot-index-row\">" +
      "<a href=\"/dashboard-edit?spot=" + encodeURIComponent(s.id) + "\">" + escapeHtml(s.name) + "</a>" +
      "<div class=\"spot-index-meta\">" + overrideTag +
      "<span class=\"issue-tag\">" + escapeHtml(s.category) + "</span></div>" +
      "</div>"
    );
  }).join("");

  const body =
    "<div class=\"dash-header\"><h1>Edit Spots</h1>" +
    "<div class=\"dash-header-links\"><a href=\"/dashboard\">Reports Dashboard</a><a href=\"/\">&larr; Back to map</a></div></div>" +
    "<div class=\"dash-body\">" +
    "<form method=\"GET\" action=\"/dashboard-edit\" class=\"search-form\">" +
    "<input type=\"text\" name=\"q\" placeholder=\"Search spots by name or address&hellip;\" value=\"" + escapeHtml(query || "") + "\">" +
    "<button type=\"submit\">Search</button>" +
    "</form>" +
    "<div class=\"dash-section\">" +
    (rows || "<div class=\"dash-empty\">No spots match that search.</div>") +
    "</div></div>";
  return pageShell("Edit Spots — UW Study Spots", body);
}

function renderEditForm(spot, hasOverride, opts) {
  opts = opts || {};
  const errorHtml = opts.error ? "<div class=\"login-error\">" + escapeHtml(opts.error) + "</div>" : "";
  const savedHtml = opts.saved ? "<div class=\"save-success\">Saved — this is now live on the map.</div>" : "";

  const categoryOptions = CATEGORY_KEYS.map(function (c) {
    return "<option value=\"" + escapeHtml(c) + "\"" + (c === spot.category ? " selected" : "") + ">" + escapeHtml(CATEGORY_META[c].label) + "</option>";
  }).join("");

  const affiliationOptions = AFFILIATIONS.map(function (a) {
    return "<option value=\"" + escapeHtml(a) + "\"" + (a === spot.affiliation ? " selected" : "") + ">" + escapeHtml(a) + "</option>";
  }).join("");

  const spotTags = spot.tags || [];
  const tagCheckboxes = ALL_TAGS.map(function (t) {
    const checked = spotTags.indexOf(t) !== -1 ? " checked" : "";
    const id = "tag-" + t.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return (
      "<label class=\"tag-checkbox\" for=\"" + id + "\" style=\"text-transform:none;font-weight:400;margin:0;\">" +
      "<input type=\"checkbox\" name=\"tags\" value=\"" + escapeHtml(t) + "\" id=\"" + id + "\"" + checked + "> " + escapeHtml(t) +
      "</label>"
    );
  }).join("");

  const resetForm = hasOverride
    ? "<form method=\"POST\" action=\"/dashboard-edit\">" +
      "<input type=\"hidden\" name=\"spotId\" value=\"" + escapeHtml(spot.id) + "\">" +
      "<input type=\"hidden\" name=\"intent\" value=\"reset\">" +
      "<button type=\"submit\" class=\"reset-btn\">Reset to original</button>" +
      "</form>"
    : "";

  const body =
    "<div class=\"dash-header\"><h1>Edit Spot</h1>" +
    "<div class=\"dash-header-links\"><a href=\"/dashboard-edit\">&larr; All spots</a><a href=\"/\">Back to map</a></div></div>" +
    "<div class=\"dash-body\">" +
    errorHtml + savedHtml +
    "<div class=\"edit-form\">" +
    "<form method=\"POST\" action=\"/dashboard-edit\">" +
    "<input type=\"hidden\" name=\"spotId\" value=\"" + escapeHtml(spot.id) + "\">" +
    "<input type=\"hidden\" name=\"intent\" value=\"save\">" +
    "<label for=\"f-name\">Name</label>" +
    "<input type=\"text\" id=\"f-name\" name=\"name\" maxlength=\"150\" value=\"" + escapeHtml(spot.name) + "\" required>" +
    "<label for=\"f-address\">Address</label>" +
    "<input type=\"text\" id=\"f-address\" name=\"address\" maxlength=\"300\" value=\"" + escapeHtml(spot.address) + "\" required>" +
    "<label for=\"f-category\">Category</label>" +
    "<select id=\"f-category\" name=\"category\">" + categoryOptions + "</select>" +
    "<label for=\"f-affiliation\">Affiliation</label>" +
    "<select id=\"f-affiliation\" name=\"affiliation\">" + affiliationOptions + "</select>" +
    "<label>Tags</label>" +
    "<div class=\"tag-checkbox-grid\">" + tagCheckboxes + "</div>" +
    "<label for=\"f-description\">Description</label>" +
    "<textarea id=\"f-description\" name=\"description\" maxlength=\"1000\" required>" + escapeHtml(spot.description) + "</textarea>" +
    "<div class=\"edit-form-actions\">" +
    "<button type=\"submit\" class=\"save-btn\">Save changes</button>" +
    "</div></form>" +
    (resetForm ? "<div style=\"margin-top:14px;\">" + resetForm + "</div>" : "") +
    "</div></div>";
  return pageShell("Edit " + spot.name + " — UW Study Spots", body);
}

function renderNotFound(spotId) {
  const body =
    "<div class=\"dash-header\"><h1>Edit Spot</h1>" +
    "<div class=\"dash-header-links\"><a href=\"/dashboard-edit\">&larr; All spots</a></div></div>" +
    "<div class=\"dash-body\"><div class=\"dash-empty\">No spot found for id &ldquo;" + escapeHtml(spotId) + "&rdquo;.</div></div>";
  return pageShell("Spot not found — UW Study Spots", body);
}

// ---------- validation ----------

function validateEdit(form) {
  const name = String(form.get("name") || "").trim();
  const address = String(form.get("address") || "").trim();
  const category = String(form.get("category") || "");
  const affiliation = String(form.get("affiliation") || "");
  const description = String(form.get("description") || "").trim();
  const tags = form.getAll("tags").map(String).filter(function (t) { return ALL_TAGS.indexOf(t) !== -1; });

  if (!name || name.length > 150) return { error: "Name is required (max 150 characters)." };
  if (!address || address.length > 300) return { error: "Address is required (max 300 characters)." };
  if (CATEGORY_KEYS.indexOf(category) === -1) return { error: "Choose a valid category." };
  if (AFFILIATIONS.indexOf(affiliation) === -1) return { error: "Choose a valid affiliation." };
  if (!tags.length) return { error: "Select at least one tag." };
  if (!description || description.length > 1000) return { error: "Description is required (max 1000 characters)." };

  return { record: { name: name, address: address, category: category, affiliation: affiliation, tags: tags, description: description } };
}

// ---------- route handlers ----------

export async function onRequestGet({ request, env }) {
  if (!env.DASHBOARD_PASSWORD) {
    return htmlResponse(renderError("Dashboard isn't configured yet — set a DASHBOARD_PASSWORD environment variable in the Cloudflare Pages project settings."), 500);
  }
  if (!(await isAuthed(request, env))) {
    return htmlResponse(renderLogin(null, "/dashboard-edit", currentPath(request)));
  }

  const url = new URL(request.url);
  const spotId = url.searchParams.get("spot");
  const overrides = await getOverrides(env);

  if (spotId) {
    const base = STUDY_SPOTS.find(function (s) { return s.id === spotId; });
    if (!base) return htmlResponse(renderNotFound(spotId), 404);
    const merged = Object.assign({}, base, overrides[spotId] || {});
    return htmlResponse(renderEditForm(merged, Boolean(overrides[spotId]), { saved: url.searchParams.get("saved") === "1" }));
  }

  const spots = STUDY_SPOTS.map(function (s) { return Object.assign({}, s, overrides[s.id] || {}); });
  return htmlResponse(renderIndex(spots, new Set(Object.keys(overrides)), url.searchParams.get("q")));
}

export async function onRequestPost({ request, env }) {
  if (!env.DASHBOARD_PASSWORD) {
    return htmlResponse(renderError("Dashboard isn't configured yet."), 500);
  }
  const form = await request.formData();

  if (!(await isAuthed(request, env))) {
    const loginResponse = await tryLogin(form, request, env, "/dashboard-edit");
    if (!loginResponse) return htmlResponse(renderLogin("Incorrect password.", "/dashboard-edit", "/dashboard-edit"), 401);
    return loginResponse;
  }

  const spotId = String(form.get("spotId") || "");
  const base = STUDY_SPOTS.find(function (s) { return s.id === spotId; });
  if (!base) return htmlResponse(renderNotFound(spotId), 404);

  const intent = String(form.get("intent") || "");

  if (intent === "reset") {
    await env.STUDY_SPOTS_KV.delete(overrideKey(spotId));
    return new Response(null, { status: 302, headers: { Location: "/dashboard-edit?spot=" + encodeURIComponent(spotId) } });
  }

  const result = validateEdit(form);
  if (result.error) {
    const overrides = await getOverrides(env);
    const attempted = Object.assign({ id: spotId }, base, overrides[spotId] || {}, {
      name: String(form.get("name") || ""),
      address: String(form.get("address") || ""),
      category: String(form.get("category") || base.category),
      affiliation: String(form.get("affiliation") || base.affiliation),
      description: String(form.get("description") || ""),
      tags: form.getAll("tags").map(String)
    });
    return htmlResponse(renderEditForm(attempted, Boolean(overrides[spotId]), { error: result.error }), 400);
  }

  await env.STUDY_SPOTS_KV.put(overrideKey(spotId), JSON.stringify(result.record));
  return new Response(null, { status: 302, headers: { Location: "/dashboard-edit?spot=" + encodeURIComponent(spotId) + "&saved=1" } });
}
