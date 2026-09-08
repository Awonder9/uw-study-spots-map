import { STUDY_SPOTS } from "../../data.js";
import {
  jsonResponse,
  readJsonBody,
  pruneStale,
  computeBusynessStatus,
  RATE_LIMIT_MS,
  BUSYNESS_LEVELS
} from "../_shared/kv-helpers.js";

const SPOT_IDS = new Set(STUDY_SPOTS.map((s) => s.id));

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const spotId = url.searchParams.get("spotId");
  if (!spotId || !SPOT_IDS.has(spotId)) {
    return jsonResponse({ error: "invalid_spot" }, 400);
  }

  const now = Date.now();
  const raw = await env.STUDY_SPOTS_KV.get("busyness:" + spotId);
  const reports = pruneStale(raw ? JSON.parse(raw) : [], now);

  return jsonResponse(computeBusynessStatus(reports, now));
}

export async function onRequestPost({ request, env }) {
  const body = await readJsonBody(request);
  if (
    !body ||
    !SPOT_IDS.has(body.spotId) ||
    !BUSYNESS_LEVELS.includes(body.level) ||
    typeof body.deviceId !== "string" ||
    !body.deviceId
  ) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }

  const now = Date.now();
  const key = "busyness:" + body.spotId;
  const raw = await env.STUDY_SPOTS_KV.get(key);
  let reports = pruneStale(raw ? JSON.parse(raw) : [], now);

  const existing = reports.find((r) => r.deviceId === body.deviceId);
  if (existing && now - existing.ts < RATE_LIMIT_MS) {
    return jsonResponse(
      { ok: false, error: "rate_limited", retryAfterMs: RATE_LIMIT_MS - (now - existing.ts) },
      429
    );
  }

  reports = reports.filter((r) => r.deviceId !== body.deviceId);
  reports.push({ deviceId: body.deviceId, level: body.level, ts: now });
  if (reports.length > 200) reports = reports.slice(-200); // sanity cap

  await env.STUDY_SPOTS_KV.put(key, JSON.stringify(reports));
  return jsonResponse(Object.assign({ ok: true }, computeBusynessStatus(reports, now)));
}
