// app/api/proxy/[...path]/route.ts
import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "600"
};

export async function OPTIONS() {
  // Respond to preflight directly
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return forwardRequest("GET", req, params.path);
}
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return forwardRequest("POST", req, params.path);
}
export async function PUT(req: Request, { params }: { params: { path: string[] } }) {
  return forwardRequest("PUT", req, params.path);
}
export async function DELETE(req: Request, { params }: { params: { path: string[] } }) {
  return forwardRequest("DELETE", req, params.path);
}

async function forwardRequest(method: string, req: Request, pathParts: string[]) {
  try {
    const DHAN_BASE = process.env.NEXT_PUBLIC_DHAN_API_BASE || "https://api.dhan.com";
    const targetPath = "/" + pathParts.join("/");
    const targetUrl = `${DHAN_BASE}${targetPath}`;

    const auth = req.headers.get("authorization");
    const contentType = req.headers.get("content-type");

    // Debug log (server terminal)
    console.log("Proxy forwarding:", { method, targetUrl, authPresent: !!auth });

    // Build headers for upstream
    const upstreamHeaders: Record<string,string> = {};
    if (auth) upstreamHeaders["Authorization"] = auth;
    if (contentType) upstreamHeaders["Content-Type"] = contentType;
    upstreamHeaders["Accept"] = "application/json";

    let body: BodyInit | undefined = undefined;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      body = await req.text();
      if (body === "") body = undefined;
    }

    const resp = await fetch(targetUrl, {
      method,
      headers: upstreamHeaders,
      body
    });

    const responseText = await resp.text();
    const respContentType = resp.headers.get("content-type") || "application/json";

    const headers = {
      "Content-Type": respContentType,
      ...CORS_HEADERS
    };

    return new NextResponse(responseText, {
      status: resp.status,
      headers
    });
  } catch (err: any) {
    console.error("Proxy forward error:", err?.message ?? err);
    return new NextResponse(JSON.stringify({ error: "Proxy forward error", detail: String(err?.message ?? err) }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  }
}
