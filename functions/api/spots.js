import { jsonResponse } from "../_shared/kv-helpers.js";
import { getMergedSpots } from "../_shared/spot-overrides.js";

export async function onRequestGet({ env }) {
  const spots = await getMergedSpots(env);
  return jsonResponse({ spots: spots });
}
