/**
 * GenLayer Bradbury RPC id-normalizing proxy.
 *
 * Problem: the Bradbury JSON-RPC server (https://rpc-bradbury.genlayer.com)
 * rejects requests whose `id` is a string, e.g. MetaMask's, with:
 *   -32700 Parse error: cannot unmarshal string into Go struct field
 *   Request.id of type int
 * even though JSON-RPC 2.0 permits string ids.
 *
 * Fix: this proxy swaps each request id to a sequential integer, forwards the
 * request to Bradbury, then restores the original id on the response. Works for
 * single requests and for batch requests (an array). Also adds permissive CORS
 * so browser dapps (and MetaMask) can call it cross-origin.
 */

const UPSTREAM = "https://rpc-bradbury.genlayer.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// JSON headers minus the CORS ones (so we can merge cleanly).
const HEADERS = {
  "Content-Type": "application/json",
  ...CORS,
};

// Normalise a single request object: map its id to an int, remember the mapping.
function normaliseRequest(req, counter) {
  const intId = counter.next++;
  return {
    intId,
    originalId: req.id,
    body: { ...req, id: intId },
  };
}

// Restore the original id on a single response object.
function restoreResponse(resp, mapping) {
  if (resp && typeof resp === "object" && "id" in resp) {
    const m = mapping[resp.id];
    if (m !== undefined) return { ...resp, id: m };
  }
  return resp;
}

export default {
  async fetch(request) {
    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST is supported" }), {
        status: 405,
        headers: HEADERS,
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
        { status: 400, headers: HEADERS }
      );
    }

    const counter = { next: 1 };
    const mapping = {}; // intId -> originalId
    let upstreamBody;

    if (Array.isArray(payload)) {
      // Batch request.
      const normalised = payload.map((req) => {
        const n = normaliseRequest(req, counter);
        mapping[n.intId] = n.originalId;
        return n.body;
      });
      upstreamBody = JSON.stringify(normalised);
    } else {
      const n = normaliseRequest(payload, counter);
      mapping[n.intId] = n.originalId;
      upstreamBody = JSON.stringify(n.body);
    }

    let upstreamResp;
    try {
      upstreamResp = await fetch(UPSTREAM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: upstreamBody,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Array.isArray(payload) ? payload.map((r) => r.id) : payload.id,
          error: { code: -32603, message: `Upstream fetch failed: ${err?.message || err}` },
        }),
        { status: 502, headers: HEADERS }
      );
    }

    const text = await upstreamResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON upstream response: return as-is (wrapped).
      return new Response(text, { status: upstreamResp.status, headers: HEADERS });
    }

    if (Array.isArray(data)) {
      data = data.map((r) => restoreResponse(r, mapping));
    } else {
      data = restoreResponse(data, mapping);
    }

    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  },
};
