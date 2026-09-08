import { jsonResponse, readJsonBody } from "../_shared/kv-helpers.js";

const SUGGESTION_THROTTLE_MS = 30 * 1000;
const CATEGORY_OPTIONS = [
  "Library",
  "Student Union",
  "Academic Building",
  "Outdoor",
  "Dining Hall",
  "Coffee Shop",
  "Other"
];

export async function onRequestPost({ request, env }) {
  const body = await readJsonBody(request);
  const name = body && typeof body.name === "string" ? body.name.trim() : "";
  const location = body && typeof body.location === "string" ? body.location.trim() : "";
  const deviceId = body && typeof body.deviceId === "string" ? body.deviceId : "";

  if (!name || !location || !deviceId || name.length > 150 || location.length > 300) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }

  const now = Date.now();
  const throttleKey = "suggest-throttle:" + deviceId;
  const lastSubmit = await env.STUDY_SPOTS_KV.get(throttleKey);
  if (lastSubmit && now - Number(lastSubmit) < SUGGESTION_THROTTLE_MS) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }

  const category = CATEGORY_OPTIONS.includes(body.category) ? body.category : "";
  const description = typeof body.description === "string" ? body.description.slice(0, 1000) : "";

  const key = "suggestion:" + now + "-" + Math.random().toString(36).slice(2, 8);
  const record = { name, location, category, description, ts: now };

  await env.STUDY_SPOTS_KV.put(key, JSON.stringify(record));
  await env.STUDY_SPOTS_KV.put(throttleKey, String(now), { expirationTtl: 60 });

  return jsonResponse({ ok: true });
}
