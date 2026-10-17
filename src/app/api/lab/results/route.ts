// A person's own full results, released only to that person on request (Decree-Law 49/2023 Art. 9:
// everyone may request their own results). In the demo the person id stands in for their login.
import { personById } from '@/lib/people';

export async function POST(req: Request) {
  let body: { person?: string; confirm?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const p = body.person ? personById(body.person) : null;
  if (!p) return Response.json({ error: 'Unknown person.' }, { status: 404 });
  if (body.confirm !== true) return Response.json({ error: 'Confirm that you want to see your own results.' }, { status: 400 });
  return Response.json({ findings: p.findings, panel: 'demo-v1' }, { headers: { 'cache-control': 'no-store' } });
}
