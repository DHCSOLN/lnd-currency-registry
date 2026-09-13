import fs from 'node:fs';
import https from 'node:https';
import { protectRequest, unprotectResponse } from './mle.js';

const BASE_PATH = '/visapayouts/v3/payouts';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function buildAgent() {
  return new https.Agent({
    cert: fs.readFileSync(required('VISA_MTLS_CERT_PATH')),
    key: fs.readFileSync(required('VISA_MTLS_KEY_PATH')),
    ca: fs.readFileSync(required('VISA_CA_PATH')),
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  });
}

function normalizeStatus(httpStatus, body) {
  if (httpStatus === 202) return 'VISA_PROCESSING';
  if (httpStatus === 303) return 'VISA_PROCESSING';
  if (httpStatus >= 400) return 'MANUAL_REVIEW';
  const raw = String(body?.status || body?.transactionStatus || body?.actionCode || '').toUpperCase();
  if (/RETURN|REJECT|DECLIN|FAIL|ERROR|CANCEL/.test(raw)) return 'MANUAL_REVIEW';
  if (/PAID|PAYMENT_RECEIVED|COMPLETED|SUCCESS/.test(raw)) return 'VISA_PAID';
  if (/VALID/.test(raw)) return 'VISA_VALIDATED';
  return 'VISA_SUBMITTED';
}

function providerReference(body) {
  return body?.payoutId || body?.statusIdentifier || body?.transactionId || body?.clientReferenceId || '';
}

async function requestVisa(method, path, payload) {
  const baseUrl = required('VISA_BASE_URL');
  const url = new URL(path, baseUrl);
  const protectedPayload = payload === undefined ? undefined : await protectRequest(payload);
  const bodyText = protectedPayload === undefined ? '' : (typeof protectedPayload === 'string' ? protectedPayload : JSON.stringify(protectedPayload));
  const auth = Buffer.from(`${required('VISA_USERNAME')}:${required('VISA_PASSWORD')}`).toString('base64');

  const response = await new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      agent: buildAgent(),
      headers: {
        Accept: 'application/json',
        ...(bodyText ? { 'Content-Type': typeof protectedPayload === 'string' ? 'application/jose' : 'application/json', 'Content-Length': Buffer.byteLength(bodyText) } : {}),
        Authorization: `Basic ${auth}`
      },
      timeout: 30000
    }, res => {
      let responseText = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { responseText += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, responseText }));
    });
    req.on('timeout', () => req.destroy(new Error('Visa request timeout')));
    req.on('error', reject);
    if (bodyText) req.write(bodyText);
    req.end();
  });

  let parsed = response.responseText;
  try { parsed = response.responseText ? JSON.parse(response.responseText) : {}; } catch {}
  const result = await unprotectResponse(parsed);
  return {
    ok: response.status >= 200 && response.status < 400,
    httpStatus: response.status,
    normalizedStatus: normalizeStatus(response.status, result),
    providerReference: providerReference(result),
    visa: result
  };
}

export async function validatePayout(payload) {
  return requestVisa('POST', `${BASE_PATH}/validate`, payload);
}

export async function sendPayout(payload) {
  return requestVisa('POST', BASE_PATH, payload);
}

export async function queryPayout(clientReferenceId) {
  const initiatingPartyId = required('VISA_INITIATING_PARTY_ID');
  const query = new URLSearchParams({ idType: 'CLIENT_REFERENCE_ID', initiatingPartyId, id: clientReferenceId });
  return requestVisa('GET', `${BASE_PATH}?${query.toString()}`);
}

export async function metadata({ payoutMethod, recipientCurrencyCode, recipientCountryCode }) {
  const initiatingPartyId = required('VISA_INITIATING_PARTY_ID');
  const query = new URLSearchParams({ initiatingPartyId, payoutMethod, recipientCurrencyCode, recipientCountryCode });
  return requestVisa('GET', `${BASE_PATH}/metadata?${query.toString()}`);
}
