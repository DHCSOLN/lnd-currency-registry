# SOLN Visa Direct Account and Wallet Sandbox Connector

This package connects the SOLN Google Sheets ledger to a separate Node.js service that calls Visa Direct Account and Wallet APIs. It is deliberately safe by default: payout execution is disabled until the operator supplies Visa sandbox credentials and explicitly enables sending.

## Locked operating rule

- The SOLN ledger transaction currency is always `LND`.
- SOLN records the LND authorization and obligation.
- An approved conversion/funding partner supplies the Visa payout currency and amount.
- Visa receives only a Visa-supported payout currency such as `USD`.
- Email delivery never establishes settlement.
- A send response never automatically becomes `FINAL_AND_IRREVOCABLE`.
- Finality requires a reconciled Visa status, provider reference, evidence reference, and a separate checker/reconciler action.

## Package contents

- `apps-script/SOLN_Visa_Ledger_Adapter.gs` - paste into the existing ledger's Apps Script project.
- `connector/` - secure Node.js HTTPS connector; Visa keys stay here and never enter Google Sheets.
- `docs/FIELD_MAPPING.md` - Visa-to-ledger mapping.
- `docs/ACTIVATION_CHECKLIST.md` - exact activation sequence.

## Quick start

1. Deploy `connector/` on a private HTTPS service that supports outbound mutual TLS.
2. Copy `connector/.env.example` to `.env` and supply sandbox values only on the server.
3. Keep `DRY_RUN=true` and `VISA_EXECUTION_ENABLED=false` for the first deployment.
4. In Apps Script, add `SOLN_Visa_Ledger_Adapter.gs` and run `solnVisaInstallSandboxConnector()` once.
5. In Apps Script Project Settings, add these Script Properties:
   - `SOLN_VISA_CONNECTOR_URL`
   - `SOLN_VISA_CONNECTOR_SHARED_SECRET`
6. Run `solnVisaHealthCheck()`.
7. Stage a Visa sandbox request with `solnVisaStageSandboxExample()`.
8. Run `solnVisaValidateSelectedPayout()` while the staged row is selected.
9. Review the audit and event rows before enabling a sandbox send.

## Required Visa onboarding items

The code cannot manufacture these values. Visa or the contracted Visa Direct relationship must supply them:

- Mutual-TLS username and password
- Mutual-TLS client certificate and private key
- Visa CA chain
- Visa MLE Key ID and Visa encryption certificate
- Client signing/decryption keys as configured by Visa
- SOLN-assigned `initiatingPartyId`
- Enabled API list and allowed destination routes
- Virtual Account Number/funding configuration where applicable
- Callback configuration and certificates

## Important

The supplied PHP utility from Visa is licensed for non-production sandbox testing. This package implements the connector in Node.js and does not redistribute Visa's PHP source. Before certification or production, compare all cryptographic algorithms, wrapper formats, headers, and key roles against the exact Visa onboarding profile assigned to SOLN.
