// A person's own results, released only to that (signed-in) person. `scope: "personal"` returns only
// the findings that matter whatever the partner carries (a woman's X-linked carrier results);
// `scope: "all"` is the full right of access under Decree-Law 49/2023 Art. 9.
import { personalFindings } from '@/lib/lab';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const body = await readJson<{ scope?: string; confirm?: boolean }>(req);
  if (body instanceof Response) return body;
  if (body.confirm !== true) return Response.json({ error: 'Confirm that you want to see your own results.' }, { status: 400 });
  const findings = body.scope === 'personal' ? personalFindings(p.sex, p.findings) : p.findings;
  return Response.json({ findings, panel: 'demo-v1' }, { headers: { 'cache-control': 'no-store' } });
}
