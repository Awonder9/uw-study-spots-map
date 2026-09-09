import { jsonResponse, readJsonBody } from "../_shared/kv-helpers.js";
import { getMergedSpots } from "../_shared/spot-overrides.js";

// Transit's public API (https://transitapp.com/apis) — the same feed the
// Transit app uses, covering Madison Metro (agency prefix MMTWI), including
// the free campus routes 80/81/82/84. Requires a `transit_publicapi_*` key,
// bound as the TRANSIT_API_KEY secret; see .dev.vars.example / README.
const TRANSIT_BASE_URL = "https://external.transitapp.com/v3/public";

// How far from a point a stop still counts as reachable on foot.
const MAX_STOP_DISTANCE_METERS = 600;
const WALK_SPEED_MPS = 1.35;
// A ride shorter than this isn't worth the two walks around it.
const MIN_RIDE_SECONDS = 120;
// Slack on top of the walk to the stop — a bus you cannot reach isn't an option.
const CATCH_BUFFER_SECONDS = 60;
// nearby_routes for a fixed point barely changes minute to minute, and Transit
// rate-limits bursts hard — caching in KV means a sort click doesn't refetch
// the same ~40 campus spots for every visitor within the same minute.
const CACHE_TTL_MS = 60 * 1000;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function cacheKey(lat, lng) {
  // ~11 m of precision — plenty to keep every spot in its own cache entry.
  return "transit-cache:" + lat.toFixed(4) + "," + lng.toFixed(4);
}

async function fetchNearbyRoutes(env, apiKey, lat, lng) {
  const key = cacheKey(lat, lng);
  const now = Date.now();

  try {
    const cachedRaw = await env.STUDY_SPOTS_KV.get(key);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (now - cached.fetchedAt < CACHE_TTL_MS) return cached.routes;
    }
  } catch {
    // Corrupt or missing cache entry — fall through and refetch.
  }

  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    max_distance: String(MAX_STOP_DISTANCE_METERS),
    should_update_realtime: "true"
  });

  let routes = [];
  try {
    const res = await fetch(`${TRANSIT_BASE_URL}/nearby_routes?${query}`, {
      headers: { apiKey: apiKey }
    });
    if (res.ok) {
      const body = await res.json();
      routes = body.routes || [];
    }
  } catch {
    routes = [];
  }

  try {
    await env.STUDY_SPOTS_KV.put(key, JSON.stringify({ fetchedAt: now, routes: routes }), {
      expirationTtl: 120
    });
  } catch {
    // Non-critical — the next request just refetches.
  }

  return routes;
}

// Every upcoming trip touching a stop near this point, keyed by its real-time
// trip id — the same id the same physical bus carries at every stop it makes.
function buildTripIndex(routes, lat, lng) {
  const index = new Map();
  for (const route of routes) {
    for (const itinerary of route.itineraries || []) {
      const stop = itinerary.closest_stop;
      if (!stop || typeof stop.stop_lat !== "number" || typeof stop.stop_lon !== "number") continue;
      const dist = haversineMeters(lat, lng, stop.stop_lat, stop.stop_lon);
      if (dist > MAX_STOP_DISTANCE_METERS) continue;

      for (const item of itinerary.schedule_items || []) {
        if (!item.rt_trip_id || item.is_cancelled) continue;
        const existing = index.get(item.rt_trip_id);
        // A loop route can pass the same point twice; keep the nearer stop.
        if (existing && existing.stopDistanceMeters <= dist) continue;
        index.set(item.rt_trip_id, { time: item.departure_time, stopDistanceMeters: dist });
      }
    }
  }
  return index;
}

// Fastest single-bus (no-transfer) trip from origin to destination, in
// seconds from now including the walk to catch it and the walk to arrive —
// or null when no bus currently links the two points.
function findBusSeconds(originRoutes, destRoutes, originLat, originLng, destLat, destLng) {
  const boarding = buildTripIndex(originRoutes, originLat, originLng);
  const alighting = buildTripIndex(destRoutes, destLat, destLng);
  const nowSeconds = Math.floor(Date.now() / 1000);

  let best = null;
  for (const [tripId, board] of boarding) {
    const alight = alighting.get(tripId);
    if (!alight) continue;
    // Direction: this bus must reach the destination after leaving the origin.
    if (alight.time - board.time < MIN_RIDE_SECONDS) continue;

    // Catchability: no use counting a bus that leaves before you'd arrive.
    const earliestCatch = nowSeconds + board.stopDistanceMeters / WALK_SPEED_MPS + CATCH_BUFFER_SECONDS;
    if (board.time < earliestCatch) continue;

    const total = alight.time - nowSeconds + alight.stopDistanceMeters / WALK_SPEED_MPS;
    if (best === null || total < best) best = total;
  }
  return best;
}

export async function onRequestPost({ request, env }) {
  const body = await readJsonBody(request);
  const origin = body && body.origin;
  if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const spots = await getMergedSpots(env);
  const apiKey = env.TRANSIT_API_KEY;

  const originRoutes = apiKey ? await fetchNearbyRoutes(env, apiKey, origin.lat, origin.lng) : [];

  const minutes = {};
  await Promise.all(
    spots.map(async (spot) => {
      const walkSeconds = haversineMeters(origin.lat, origin.lng, spot.lat, spot.lng) / WALK_SPEED_MPS;
      let bestSeconds = walkSeconds;

      if (apiKey) {
        const destRoutes = await fetchNearbyRoutes(env, apiKey, spot.lat, spot.lng);
        const busSeconds = findBusSeconds(originRoutes, destRoutes, origin.lat, origin.lng, spot.lat, spot.lng);
        if (busSeconds !== null && busSeconds < bestSeconds) bestSeconds = busSeconds;
      }

      minutes[spot.id] = Math.max(1, Math.round(bestSeconds / 60));
    })
  );

  // `live: false` tells the client these are walking-distance estimates only
  // (no TRANSIT_API_KEY configured), not that the request failed.
  return jsonResponse({ minutes: minutes, live: Boolean(apiKey) });
}
