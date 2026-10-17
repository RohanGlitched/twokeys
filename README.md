<p align="center"><img src="docs/cover.png" alt="Two Keys: know what you could pass on together" width="100%"></p>

<p align="center">
  <img alt="tests" src="https://img.shields.io/badge/tests-14%20passing-4F6F58">
  <img alt="protocol" src="https://img.shields.io/badge/PSI-ristretto255-22201E">
  <img alt="languages" src="https://img.shields.io/badge/Arabic%20%2B%20English-RTL-2E3A6E">
  <img alt="data" src="https://img.shields.io/badge/data-synthetic%20people%20only-9B2335">
</p>

**[Live site](#)** · **[Two-phone demo](#)** · **[How it works](#)** · **[Proof](#)** · **[Counsellor desk](#)** (demo passcode in the submission) · **[Programme view](#)**

Two Keys lets a couple learn what they could pass on to their children together, and nothing else. Their premarital carrier results are compared inside their own phones with authorised private set intersection: each partner learns only the genes they both carry. The partner, the families and the server learn nothing else. Each result is explained in plain Arabic or English at three reading levels, and a counsellor is one tap away. Relatives can be told, anonymously, that they may want a test.

Built for the **Future Health Digital Innovation Challenge** (Abu Dhabi), statement: *Understanding and Reducing Inherited Disease Risk*.

## What's inside

| Part | Where | What it does |
|---|---|---|
| Protocol | `src/lib/psi.ts`, `src/lib/lab.ts` | Session-bound, lab-authorised tokens. Diffie–Hellman PSI on ristretto255 over 64-entry padded sets. Role tags for mild alleles. X-linked handling. Count-only mode |
| Pairing | `src/lib/pairing.ts`, `src/app/api/relay` | A link secret in the URL fragment gives the session id, an AES-GCM relay key and three check words. Relay slots are write-once and expire after 10 minutes |
| Phone app | `/phone` | Carrier card (couple-only by default; own results on request), pairing, couple result with pedigree icon arrays, three reading levels, Listen, teach-back, options, counsellor booking, explainer, family notes |
| Explainer | `src/lib/ask.ts` | Amazon Nova Pro on Bedrock. Guards run before the model (partner probing, decide-for-me, crisis). Answers are grounded in vetted facts. Code checks reject invented numbers and directive language |
| Counsellor desk | `/desk` | Consent-scoped cases, two-working-day contact clocks, referral and closure, hash-chained audit, withdrawal that erases shared data |
| Family notes | `/r/[id]` | Letters sealed on the sender's phone. The server stores ciphertext and counts "opened" and "booked" anonymously |
| Programme view | `/programme` | Comprehension, uptake, time to referral, cascade testing and equity by language and literacy. Laplace noise (ε = 1) and small-cell suppression. It never counts marriages |
| Evidence | `/proof`, `scripts/` | Unit and end-to-end tests. Pedigree simulator calibrated to Dubai and Abu Dhabi outcomes. 60-case Arabic/English explainer safety evaluation |

## Run it

```bash
npm install
npm run dev -- -p 3410        # http://localhost:3410
npm test                      # protocol and risk-engine tests
BASE=http://localhost:3410 npx vitest run tests/pairing.int.test.ts   # two phones over HTTP
npm run calibrate             # data/calibration.json
npm run eval:ask              # data/eval-ask.json (needs AWS Bedrock credentials)
```

Environment (`.env.local`):

| Variable | Meaning |
|---|---|
| `LAB_KEY` | 64 hex chars |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Bedrock access |
| `ASK_MODEL` | Default `apac.amazon.nova-pro-v1:0` |
| `STORE_TABLE` | DynamoDB table; without it, memory is used |
| `DESK_PASSCODE` | Counsellor desk passcode |

## Data and rights

- No real person's data is used: every person, result and case is synthetic.
- Carrier frequencies come from published Emirati exomes (Jain et al., *Genet Med Open* 2025), cited, and from gnomAD v4.1 (CC0).
- Variant classes come from ClinVar. Condition explanations link to MedlinePlus Genetics.
- The full table is on `/proof`.

## Limits

- The protocol is semi-honest and has not been audited. It trusts the lab, which already holds both results.
- Gene-level matching needs clinical curation for exceptions.
- The demo runs outside the UAE. Production needs UAE hosting, a DoH licence (Decree-Law 49/2023 Art. 28) and a National Genomic Database feed (Art. 26).

The details are on `/proof`.
