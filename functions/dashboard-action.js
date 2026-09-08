import { isAuthed } from "./_shared/dashboard-auth.js";

const TYPE_PREFIXES = {
  feedback: "feedback:",
  suggestion: "suggestion:"
};

export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const type = String(form.get("type") || "");
  const key = String(form.get("key") || "");
  const action = String(form.get("action") || "");
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
      const logKey = "log:" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const logRecord = {
        type: type,
        summary: summary,
        originalMessage: originalMessage || "",
        response: message,
        ts: Date.now()
      };
      await env.STUDY_SPOTS_KV.put(logKey, JSON.stringify(logRecord));
    }
  }

  await env.STUDY_SPOTS_KV.delete(key);

  return new Response(null, { status: 302, headers: { Location: "/dashboard" } });
}
