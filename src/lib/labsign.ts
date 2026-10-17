import 'server-only';
// The lab's signing key, for attesting each phone's first lock. Its own subkey of the lab key here; in
// production it would be its own key in an HSM, with the public half pinned in the app.
import { ed25519 } from '@noble/curves/ed25519.js';
import { subkey } from './labkey';

const sk = () => subkey('lab-signing'); // same derivation as before (HKDF, info twokeys/v2/lab-signing), so the public key is unchanged
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const labPublicKey = () => hex(ed25519.getPublicKey(sk()));
export const labSign = (msg: Uint8Array) => hex(ed25519.sign(msg, sk()));
