// Replaces claude.ai's window.claude.use("sample") with a call to this site's own /api/sample.
// The artwork code stays identical to the claude.ai version.
(() => {
  const fail = (code) => { throw { code }; };
  const sample = {
    async json(input, opts = {}) {
      let res;
      try {
        res = await fetch("/api/sample", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input }),
          signal: opts.signal,
        });
      } catch (e) {
        if (e && e.name === "AbortError") fail("cancelled");
        fail("other");
      }
      let body = null;
      try { body = await res.json(); } catch { /* fall through */ }
      if (!res.ok) fail((body && body.code) || (res.status === 429 ? "rate_limited" : "other"));
      if (!body || typeof body.data !== "object" || body.data === null) fail("invalid_json");
      return body.data;
    },
  };
  window.claude = { use: async (name) => (name === "sample" ? sample : fail("not_declared")) };
})();
