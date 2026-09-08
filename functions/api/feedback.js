import { STUDY_SPOTS } from "../../data.js";
import { jsonResponse, readJsonBody, FEEDBACK_THROTTLE_MS, FEEDBACK_ISSUE_TYPES } from "../_shared/kv-helpers.js";

const SPOT_IDS = new Set(STUDY_SPOTS.map((s) => s.id));

export async function onRequestPost({ request, env }) {
  const body = await readJsonBody(request);
  if (
    !body ||
    !SPOT_IDS.has(body.spotId) ||
    !FEEDBACK_ISSUE_TYPES.includes(body.issueType) ||
    typeof body.deviceId !== "string" ||
    !body.deviceId
  ) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }

  const now = Date.now();
  const throttleKey = "feedback-throttle:" + body.deviceId;
  const lastSubmit = await env.STUDY_SPOTS_KV.get(throttleKey);
  if (lastSubmit && now - Number(lastSubmit) < FEEDBACK_THROTTLE_MS) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }

  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  const spot = STUDY_SPOTS.find((s) => s.id === body.spotId);

  const key = "feedback:" + now + "-" + Math.random().toString(36).slice(2, 8);
  const record = {
    spotId: body.spotId,
    spotName: spot ? spot.name : "",
    issueType: body.issueType,
    message,
    ts: now
  };

  await env.STUDY_SPOTS_KV.put(key, JSON.stringify(record));
  await env.STUDY_SPOTS_KV.put(throttleKey, String(now), { expirationTtl: 60 });

  return jsonResponse({ ok: true });
}
