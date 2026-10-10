// Vercel serverless function: forwards the artwork's prompt to Claude with the artist's API key.
// The key lives only in the ANTHROPIC_API_KEY environment variable and never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_INPUT_CHARS = 200_000;      // the LOVE MACHINE prompts are long
const MAX_TURNS = 60;
const PER_IP_LIMIT = Number(process.env.PER_IP_LIMIT || 40);       // requests per IP per window
const PER_IP_WINDOW_MS = 10 * 60 * 1000;                          // 10 minutes
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 2000);       // per server instance, best effort

const client = new Anthropic();
const hits = new Map();               // ip -> [timestamps]
let day = "", dayCount = 0;

function rateLimited(ip) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_LIMIT) return true;
  const list = (hits.get(ip) || []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (list.length >= PER_IP_LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  dayCount++;
  if (hits.size > 5000) hits.clear();
  return false;
}

// Accepts what the artwork sends: a prompt string, or an array of {role, content} turns.
function toMessages(input) {
  if (typeof input === "string") {
    if (!input.trim() || input.length > MAX_INPUT_CHARS) return null;
    return [{ role: "user", content: input }];
  }
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_TURNS) return null;
  const out = [];
  let total = 0;
  for (const t of input) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return null;
    total += t.content.length;
    if (total > MAX_INPUT_CHARS) return null;
    if (!t.content.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + t.content;
    else out.push({ role: t.role, content: t.content });
  }
  if (!out.length || out[0].role !== "user" || out[out.length - 1].role !== "user") return null;
  return out;
}

function parseJson(text) {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(s); } catch { /* try the outermost object */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* invalid */ } }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ code: "other" });
  }
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin && req.headers.origin !== allowed) {
    return res.status(403).json({ code: "not_granted" });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "sampling_disabled" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ code: "rate_limited" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const messages = toMessages(body && body.input);
  if (!messages) return res.status(413).json({ code: "prompt_too_large" });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: "Reply with exactly one JSON object that follows the format requested in the conversation. No markdown fences, no text outside the JSON.",
      messages,
      output_config: { effort: process.env.ANTHROPIC_EFFORT || "medium" },
      // Server-side fallbacks: if the primary model is overloaded, Anthropic retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") return res.status(422).json({ code: "refused" });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (!text.trim()) return res.status(502).json({ code: "empty_completion" });
    const data = parseJson(text);
    if (!data || typeof data !== "object") return res.status(502).json({ code: "invalid_json" });
    return res.status(200).json({ data });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ code: "rate_limited" });
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ code: "sampling_disabled" });
    if (err instanceof Anthropic.BadRequestError && /too long|too large|context/i.test(err.message)) {
      return res.status(413).json({ code: "prompt_too_large" });
    }
    console.error(err);
    return res.status(502).json({ code: "other" });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
