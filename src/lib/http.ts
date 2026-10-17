import 'server-only';

/** Reads a JSON body, refusing anything not sent as application/json (blocks cross-site "simple" POSTs). */
export async function readJson<T>(req: Request): Promise<T | Response> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Send JSON with content-type application/json.' }, { status: 415 });
  }
  try {
    return (await req.json()) as T;
  } catch {
    return Response.json({ error: 'Send JSON.' }, { status: 400 });
  }
}
