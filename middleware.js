// Password gate for the LOVE MACHINE page only. The main chatbot stays open to everyone.
// The password lives in the Vercel environment variable LM_PASSWORD, never in this file.
// Several passwords (e.g. one per person) can be listed with commas: "apple,banana,cherry".

export const config = { matcher: ["/love-machine", "/love-machine.html"] };

export default function middleware(request) {
  const allowed = (process.env.LM_PASSWORD || "")
    .split(",").map((p) => p.trim()).filter(Boolean);

  const header = request.headers.get("authorization") || "";
  if (allowed.length && header.startsWith("Basic ")) {
    let given = "";
    try { given = atob(header.slice(6)).split(":").slice(1).join(":"); } catch {}
    if (allowed.includes(given)) return; // correct password: show the page
  }

  // No password set yet, or wrong/missing password: ask again and show nothing.
  return new Response("LOVE MACHINE is open to invited guests only. / 초대받은 분만 볼 수 있습니다.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="LOVE MACHINE", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
