import { jsonResponse } from "../_shared/kv-helpers.js";

export async function onRequestGet({ env }) {
  const list = await env.STUDY_SPOTS_KV.list({ prefix: "log:" });
  const entries = [];
  for (const key of list.keys) {
    const raw = await env.STUDY_SPOTS_KV.get(key.name);
    if (!raw) continue;
    entries.push(JSON.parse(raw));
  }
  entries.sort(function (a, b) { return b.ts - a.ts; });
  return jsonResponse({ entries: entries.slice(0, 50) });
}
