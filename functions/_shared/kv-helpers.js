// Shared helpers for the busyness + feedback Pages Functions.

export const DECAY_MS = 2 * 60 * 60 * 1000; // reports older than this are ignored
export const RATE_LIMIT_MS = 20 * 60 * 1000; // min gap between busyness reports from one device, per spot
export const FEEDBACK_THROTTLE_MS = 30 * 1000; // min gap between feedback submissions from one device

export const BUSYNESS_LEVELS = ["empty", "some-seats", "busy", "full"];
export const FEEDBACK_ISSUE_TYPES = ["wrong-address", "closed", "wrong-hours", "other"];

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function pruneStale(reports, now) {
  return Array.isArray(reports) ? reports.filter((r) => now - r.ts < DECAY_MS) : [];
}

// Resolves conflicting busyness reports into a single status.
//
// Reports are ordinal (empty < some-seats < busy < full), so disagreement is
// blended rather than decided by "most recent wins" or a straight majority
// vote: each report gets a weight that fades linearly from 1 (just now) to 0
// (at the edge of the DECAY_MS window), the weighted average of the reports'
// ordinal positions is computed, and that average is rounded to the nearest
// real level. A report from 2 minutes ago outweighs one from 90 minutes ago,
// but doesn't erase it outright — and two people disagreeing right now pull
// the result toward the middle rather than one arbitrarily overriding the
// other. `mixed` flags when the spread between reports is wide (>=2 levels
// apart) so the UI can be honest that people are seeing different things.
export function computeBusynessStatus(reports, now) {
  if (!reports.length) {
    return { level: null, reportedAt: null, recentCount: 0, mixed: false };
  }

  var weightedSum = 0;
  var weightTotal = 0;
  var minIdx = Infinity;
  var maxIdx = -Infinity;
  var latestTs = 0;

  reports.forEach(function (r) {
    var idx = BUSYNESS_LEVELS.indexOf(r.level);
    if (idx === -1) return;
    var age = now - r.ts;
    var weight = Math.max(0, 1 - age / DECAY_MS);
    weightedSum += weight * idx;
    weightTotal += weight;
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
    if (r.ts > latestTs) latestTs = r.ts;
  });

  if (weightTotal === 0) {
    return { level: null, reportedAt: null, recentCount: 0, mixed: false };
  }

  var avgIdx = Math.round(weightedSum / weightTotal);
  avgIdx = Math.max(0, Math.min(BUSYNESS_LEVELS.length - 1, avgIdx));

  return {
    level: BUSYNESS_LEVELS[avgIdx],
    reportedAt: latestTs,
    recentCount: reports.length,
    mixed: maxIdx - minIdx >= 2
  };
}
