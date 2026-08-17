import type { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:5000';

async function proxy(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const search = req.nextUrl.search || '';
  const target = `${BACKEND}/api/${path}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const outHeaders = new Headers();
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) outHeaders.set('content-type', upstreamType);
    return new Response(body, { status: upstream.status, headers: outHeaders });
  } catch {
    console.error('[proxy] Backend unavailable at', BACKEND);
    return Response.json(
      { error: 'Backend unavailable', message: 'Le service est temporairement indisponible. Veuillez réessayer.' },
      { status: 502 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
