// ============================================================================
// iDesign Review — proxy Edge Function
// Deploy once to Supabase (Edge Functions ▸ name it "review" ▸ paste ▸ Deploy,
// and turn OFF "Verify JWT" so reviewers can open the link without logging in).
//
// It fetches any URL you pass as ?url=..., injects the comment overlay, and
// serves it as a normal web page. The generator page builds those links for you.
// ============================================================================

const SUPABASE_URL = "https://puytjdeavhowngzqdymh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eXRqZGVhdmhvd25nenFkeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjYyMzEsImV4cCI6MjA5OTEwMjIzMX0.CqC7Sh6d6dNr6hCiT9tpgKPKWsVJpQhsbaJyAYN-kZY";
const OVERLAY = "https://idesign-creative.github.io/brand-site-review/review-overlay.js";

// OPTIONAL: lock the proxy to domains you control (prevents it being used as an
// open proxy). Leave empty [] to allow any site. Example: ["webflow.io","idesignedu.org"]
const ALLOW_HOSTS: string[] = [];

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

Deno.serve(async (req) => {
  const reqUrl = new URL(req.url);

  // ── Reorder → Slack DM (OPX Inventory "Reorder" button) ──────────────────
  // CORS-simple POST from the static inventory; the Slack webhook lives in the
  // SLACK_WEBHOOK_URL env var (server-side only — never in the browser).
  const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, GET, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (reqUrl.pathname.replace(/\/+$/, "").endsWith("/reorder")) {
    const jh = { ...CORS, "content-type": "application/json" };
    if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers: jh });
    let b: Record<string, unknown> = {};
    try { b = await req.json(); } catch { /* tolerate empty/bad body */ }
    const item = String(b.item ?? "an item");
    const partner = String(b.partner ?? "—");
    const source = String(b.source ?? "OPX Inventory");
    const hook = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!hook) return new Response(JSON.stringify({ ok: false, error: "SLACK_WEBHOOK_URL not set" }), { status: 500, headers: jh });
    const text = `:package: *Reorder request* — *${item}*\n• Partner: ${partner}\n• Source: ${source}\nWhitney to reach out for details.`;
    try {
      const sr = await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!sr.ok) throw new Error("Slack HTTP " + sr.status);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 502, headers: jh });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: jh });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const target = reqUrl.searchParams.get("url");
  if (!target) {
    return new Response("Add ?url=https://site-to-review", { status: 400, headers: { "content-type": "text/plain" } });
  }
  let t: URL;
  try { t = new URL(target); } catch { return new Response("Invalid url", { status: 400 }); }
  if (t.protocol !== "http:" && t.protocol !== "https:") {
    return new Response("Only http/https allowed", { status: 400 });
  }
  if (ALLOW_HOSTS.length && !ALLOW_HOSTS.some((h) => t.hostname.endsWith(h))) {
    return new Response("This host is not allowed for review", { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(t.href, { headers: { "User-Agent": "Mozilla/5.0 (iDesignReview)" } });
  } catch (e) {
    return new Response("Could not fetch that site: " + e, { status: 502 });
  }

  const ctype = res.headers.get("content-type") || "";
  // Non-HTML (images, css, js fetched directly): stream through untouched.
  if (!ctype.includes("text/html")) {
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: { "content-type": ctype || "application/octet-stream", "access-control-allow-origin": "*" } });
  }

  let html = await res.text();
  const origin = t.origin + "/";
  // Public URL of THIS function — used for in-wrapper navigation links.
  // (Don't derive from reqUrl: inside Supabase the path is /review over http, which breaks externally.)
  const PROXY_BASE = SUPABASE_URL + "/functions/v1/review";

  // 1) strip any page-level CSP that could block our injected script
  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
  // 2) rewrite the target's own links FIRST — before injecting <base>, so we don't clobber the base tag
  const link = (p: string) => `${PROXY_BASE}?url=${encodeURIComponent(t.origin + "/" + p.replace(/^\//, ""))}`;
  html = html.replace(/href="\/([^"]*)"/g, (_m, p) => `href="${link(p)}"`);       // root-relative
  html = html.replace(new RegExp(`href="${esc(t.origin)}/([^"]*)"`, "g"), (_m, p) => `href="${link(p)}"`); // same-origin absolute
  // 3) NOW inject <base> so the target's own CSS/JS/images keep loading from the real site
  html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}">`);
  // 4) inject the comment overlay (auto-scoped to the target's domain)
  const cfg = JSON.stringify({ url: SUPABASE_URL, key: ANON_KEY, project: t.hostname, page: t.pathname });
  const inject = `<script>window.IDR_CONFIG=${cfg};</script><script src="${OVERLAY}?v=${Date.now()}"></script>`;
  html = html.replace(/<\/body>/i, inject + "</body>");

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
});
