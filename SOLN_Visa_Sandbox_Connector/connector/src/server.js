import crypto from 'node:crypto';
import express from 'express';
import { verifySolnRequest, redact } from './security.js';
import { validatePayout, sendPayout, queryPayout, metadata } from './visa-client.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({
  limit: '256kb',
  verify: (req, _res, buffer) => { req.rawBody = buffer.toString('utf8'); }
}));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'SOLN Visa Direct Sandbox Connector',
    dryRun: process.env.DRY_RUN !== 'false',
    executionEnabled: process.env.VISA_EXECUTION_ENABLED === 'true',
    mleEnabled: process.env.VISA_MLE_ENABLED === 'true'
  });
});

app.use('/v1', (req, res, next) => {
  try { verifySolnRequest(req); next(); }
  catch (error) { res.status(401).json({ ok: false, error: error.message }); }
});

function validateEnvelope(body) {
  if (body?.ledgerCurrency !== 'LND') throw new Error('SOLN ledger currency must be LND');
  if (!body?.paymentId || !body?.idempotencyKey) throw new Error('paymentId and idempotencyKey are required');
  if (!body?.partnerFundingConfirmed) throw new Error('Partner funding confirmation is required');
  if (body?.visaPayload?.transactionDetail?.transactionCurrencyCode === 'LND') {
    throw new Error('LND is not submitted as the Visa payout currency');
  }
  if (!body?.visaPayload?.transactionDetail?.clientReferenceId) {
    throw new Error('Visa clientReferenceId is required');
  }
}

app.post('/v1/payouts/validate', async (req, res) => {
  try {
    validateEnvelope(req.body);
    if (process.env.DRY_RUN !== 'false') {
      return res.json({ ok: true, dryRun: true, normalizedStatus: 'VISA_VALIDATED', providerReference: '', preview: redact(req.body.visaPayload) });
    }
    res.json(await validatePayout(req.body.visaPayload));
  } catch (error) {
    res.status(400).json({ ok: false, normalizedStatus: 'MANUAL_REVIEW', error: error.message, correlationId: crypto.randomUUID() });
  }
});

app.post('/v1/payouts', async (req, res) => {
  try {
    validateEnvelope(req.body);
    if (process.env.DRY_RUN !== 'false' || process.env.VISA_EXECUTION_ENABLED !== 'true') {
      return res.status(409).json({ ok: false, normalizedStatus: 'MANUAL_REVIEW', error: 'Visa payout execution is disabled' });
    }
    if (process.env.VISA_MLE_ENABLED !== 'true') {
      return res.status(409).json({ ok: false, normalizedStatus: 'MANUAL_REVIEW', error: 'Visa payout execution requires Message Level Encryption' });
    }
    res.json(await sendPayout(req.body.visaPayload));
  } catch (error) {
    res.status(400).json({ ok: false, normalizedStatus: 'MANUAL_REVIEW', error: error.message, correlationId: crypto.randomUUID() });
  }
});

app.get('/v1/payouts/:clientReferenceId', async (req, res) => {
  try { res.json(await queryPayout(req.params.clientReferenceId)); }
  catch (error) { res.status(400).json({ ok: false, normalizedStatus: 'MANUAL_REVIEW', error: error.message }); }
});

app.post('/v1/metadata', async (req, res) => {
  try { res.json(await metadata(req.body)); }
  catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`SOLN Visa connector listening on ${port}`));
