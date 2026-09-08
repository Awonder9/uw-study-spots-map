import { STUDY_SPOTS } from "../../data.js";

const OVERRIDE_PREFIX = "spot-override:";

export function overrideKey(spotId) {
  return OVERRIDE_PREFIX + spotId;
}

// Returns { [spotId]: overrideRecord } for every spot that currently has one.
export async function getOverrides(env) {
  const list = await env.STUDY_SPOTS_KV.list({ prefix: OVERRIDE_PREFIX });
  const overrides = {};
  for (const key of list.keys) {
    const raw = await env.STUDY_SPOTS_KV.get(key.name);
    if (!raw) continue;
    overrides[key.name.slice(OVERRIDE_PREFIX.length)] = JSON.parse(raw);
  }
  return overrides;
}

// Base STUDY_SPOTS with any active overrides merged in (override wins).
// Iterates the base list — not the override keys — so a stale override for
// a spot that no longer exists in data.js is silently ignored rather than
// reintroducing a removed spot.
export async function getMergedSpots(env) {
  const overrides = await getOverrides(env);
  return STUDY_SPOTS.map((s) => Object.assign({}, s, overrides[s.id] || {}));
}
