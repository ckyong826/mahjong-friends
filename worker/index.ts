/**
 * API entry point. Room orchestration and Durable Object binding arrive in #4–#5.
 * No gameplay state is maintained here yet.
 */
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({ status: "ok", app: "mahjong-friends", stage: "scaffold" }),
        { headers: jsonHeaders }
      );
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: jsonHeaders
      });
    }
    return new Response("Not found", { status: 404 });
  }
};
