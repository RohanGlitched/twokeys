// Clears demo state that predates a data-shape change: desk cases (all synthetic; the desk reseeds
// itself on the next read). Dry run unless --apply is passed. It never deletes programme releases (the
// append-only ledger, metrics:ledger:*, or older cached releases) or the per-person privacy markers
// (dp:*): deleting those would let a week be released again or a person be counted twice.
//   npx tsx --env-file=.env.prod.local scripts/reset-demo.mts [--apply]
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.STORE_TABLE ?? 'twokeys';
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY! },
}));
const apply = process.argv.includes('--apply');

async function items(pk: string, skPrefix?: string) {
  const out: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const r = await doc.send(new QueryCommand({ TableName: TABLE, ExclusiveStartKey: start,
      KeyConditionExpression: skPrefix ? 'pk = :pk AND begins_with(sk, :sk)' : 'pk = :pk',
      ExpressionAttributeValues: skPrefix ? { ':pk': pk, ':sk': skPrefix } : { ':pk': pk } }));
    out.push(...(r.Items ?? []));
    start = r.LastEvaluatedKey;
  } while (start);
  return out;
}

const cases = await items('case');
console.log(`${cases.length} desk cases: ${cases.map((c) => { try { return JSON.parse(c.v as string).person?.name; } catch { return '?'; } }).join(', ')}`);
console.log('programme releases and privacy markers are kept');
if (!apply) { console.log('dry run; pass --apply to delete'); process.exit(0); }
for (const it of cases) await doc.send(new DeleteCommand({ TableName: TABLE, Key: { pk: it.pk, sk: it.sk } }));
console.log('deleted', cases.length);
