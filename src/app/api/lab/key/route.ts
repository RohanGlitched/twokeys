// The lab's public signing key, which phones use to check first-lock attestations. In production it
// is pinned in the app rather than fetched.
import { connection } from 'next/server';
import { labPublicKey } from '@/lib/labsign';

export async function GET() {
  await connection();
  return Response.json({ publicKey: labPublicKey() }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
