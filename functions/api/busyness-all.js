import { STUDY_SPOTS } from "../../data.js";
import { jsonResponse, pruneStale, computeBusynessStatus } from "../_shared/kv-helpers.js";

// Batch form of busyness.js's GET — the "Least busy" sort needs every spot's
// status at once rather than one request per spot.
export async function onRequestGet({ env }) {
  const now = Date.now();
  const statuses = {};

  await Promise.all(
    STUDY_SPOTS.map(async (spot) => {
      const raw = await env.STUDY_SPOTS_KV.get("busyness:" + spot.id);
      const reports = pruneStale(raw ? JSON.parse(raw) : [], now);
      statuses[spot.id] = computeBusynessStatus(reports, now);
    })
  );

  return jsonResponse({ statuses: statuses });
}
