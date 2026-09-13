import fs from 'node:fs';
import { CompactEncrypt, CompactSign, compactDecrypt, compactVerify, importPKCS8, importX509, decodeProtectedHeader } from 'jose';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function readPem(name) {
  return fs.readFileSync(required(name), 'utf8');
}

export async function protectRequest(payload) {
  if (process.env.VISA_MLE_ENABLED !== 'true') return payload;

  const encryptionKey = await importX509(readPem('VISA_ENCRYPTION_CERT_PATH'), 'RSA-OAEP-256');
  const signingKey = await importPKCS8(readPem('VISA_SIGNING_PRIVATE_KEY_PATH'), 'PS256');
  const now = Date.now();

  const jwe = await new CompactEncrypt(Buffer.from(JSON.stringify(payload)))
    .setProtectedHeader({
      alg: 'RSA-OAEP-256',
      enc: 'A128GCM',
      iat: now,
      kid: required('VISA_MLE_ENCRYPTION_KID')
    })
    .encrypt(encryptionKey);

  const jws = await new CompactSign(Buffer.from(jwe))
    .setProtectedHeader({
      alg: 'PS256',
      cty: 'JWE',
      typ: 'JOSE',
      iat: now,
      exp: now + 60 * 60 * 1000,
      kid: required('VISA_MLE_SIGNING_KID')
    })
    .sign(signingKey);

  const envelope = process.env.VISA_MLE_ENVELOPE || 'raw-jws';
  if (envelope === 'raw-jws') return jws;
  if (envelope === 'encData') return { encData: jws };
  throw new Error('Unsupported VISA_MLE_ENVELOPE; confirm the Visa onboarding profile');
}

export async function unprotectResponse(payload) {
  if (process.env.VISA_MLE_ENABLED !== 'true') return payload;
  const token = typeof payload === 'string' ? payload : payload?.encData;
  if (!token) throw new Error('Encrypted Visa response token missing');

  const verifyKey = await importX509(readPem('VISA_SIGNING_CERT_PATH'), 'PS256');
  const { payload: signedPayload } = await compactVerify(token, verifyKey);
  const jwe = Buffer.from(signedPayload).toString('utf8');
  const header = decodeProtectedHeader(jwe);
  if (header.alg !== 'RSA-OAEP-256' || header.enc !== 'A128GCM') throw new Error('Unexpected Visa response algorithms');

  const decryptionKey = await importPKCS8(readPem('VISA_DECRYPTION_PRIVATE_KEY_PATH'), 'RSA-OAEP-256');
  const { plaintext } = await compactDecrypt(jwe, decryptionKey);
  return JSON.parse(Buffer.from(plaintext).toString('utf8'));
}
