import 'server-only';
// The lab's signing key, for attesting each phone's first lock. Derived from the lab key here; in
// production it would be its own key in an HSM, with the public half pinned in the app.
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { labKey } from './labkey';

let secret: Uint8Array | null = null;
const sk = () => (secret ??= hkdf(sha256, labKey(), undefined, new TextEncoder().encode('twokeys/v2/lab-signing'), 32));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const labPublicKey = () => hex(ed25519.getPublicKey(sk()));
export const labSign = (msg: Uint8Array) => hex(ed25519.sign(msg, sk()));
