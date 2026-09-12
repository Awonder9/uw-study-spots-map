import { isAuthed } from "./_shared/dashboard-auth.js";

const TYPE_PREFIXES = {
  feedback: "feedback:",
  suggestion: "suggestion:"
};

function putLog(env, record) {
  const ts = Date.now();
  const logKey = "log:" + ts + "-" + Math.random().toString(36).slice(2, 8);
  return env.STUDY_SPOTS_KV.put(logKey, JSON.stringify(Object.assign({ ts: ts }, record)));
}

export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const action = String(form.get("action") || "");

  // Standalone update: posted directly from the dashboard, with no
  // feedback/suggestion record to dismiss or respond to.
  if (action === "post") {
    const summary = String(form.get("summary") || "").trim().slice(0, 150);
    const message = String(form.get("message") || "").trim().slice(0, 500);
    if (!summary || !message) {
      return new Response("Bad request", { status: 400 });
    }
    await putLog(env, { type: "announcement", summary: summary, originalMessage: "", response: message });
    return new Response(null, { status: 302, headers: { Location: "/dashboard" } });
  }

  const type = String(form.get("type") || "");
  const key = String(form.get("key") || "");
  const message = String(form.get("message") || "").trim().slice(0, 500);

  const prefix = TYPE_PREFIXES[type];
  const validAction = action === "dismiss" || action === "respond";
  if (!prefix || !key.startsWith(prefix) || !validAction || (action === "respond" && !message)) {
    return new Response("Bad request", { status: 400 });
  }

  if (action === "respond") {
    const raw = await env.STUDY_SPOTS_KV.get(key);
    const record = raw ? JSON.parse(raw) : null;
    if (record) {
      const summary = type === "feedback"
        ? (record.spotName || record.spotId || "a spot")
        : record.name;
      const originalMessage = type === "feedback" ? record.message : record.description;
      await putLog(env, { type: type, summary: summary, originalMessage: originalMessage || "", response: message });
    }
  }

  await env.STUDY_SPOTS_KV.delete(key);

  return new Response(null, { status: 302, headers: { Location: "/dashboard" } });
}
