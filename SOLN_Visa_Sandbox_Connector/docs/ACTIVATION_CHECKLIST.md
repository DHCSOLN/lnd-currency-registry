# Activation checklist

## 1. Visa project

- Project: `SOLN TREASURY`
- Product: Visa Direct Account and Wallet
- Environment: Sandbox
- Confirm the full legal organization record is used.
- Confirm `initiatingPartyId` is assigned to SOLN; do not use sample IDs `1002` or `1003` as production identifiers.

## 2. Visa security

- Download mutual-TLS credentials privately.
- Confirm Message Level Encryption is enabled for Send APIs.
- Confirm the assigned MLE request/response key roles.
- Confirm whether the assigned request wrapper is raw compact JWS or a named JSON field.
- Store all secrets in the connector hosting service's secret manager.
- Never place Visa secrets in Apps Script source, cells, GitHub, or screenshots.

## 3. Partner and funding

- Replace `TEST PARTNER - NOT PRODUCTION` with an approved, contracted partner record only after approval.
- Record the partner agreement reference.
- Confirm supported payout currencies and countries.
- Confirm the partner-funded payout amount before Visa validation or send.
- Confirm Visa virtual-account/funding configuration.

## 4. Ledger controls

- Run `solnVisaInstallSandboxConnector()`.
- Verify `SOLN_VISA_PAYOUTS` and `SOLN_VISA_EVENTS` were created.
- Confirm all internal currency values are normalized to `LND`.
- Do not use `Email sent = SETTLED` for Visa transactions.
- Require maker/checker approval before submission.
- Require idempotency before every POST.
- Route timeouts and ambiguous responses to query, not automatic retry.
- Route failed verification, returns, duplicates, and validation errors to `MANUAL_REVIEW`.

## 5. Test order

1. Connector health check
2. Mutual-TLS Hello World/connectivity test
3. Get Payout Metadata
4. Validate a Visa-provided sandbox account scenario
5. Validate a Visa-provided sandbox wallet scenario
6. Record checker approval with `solnVisaApproveSelectedSandboxPayout()`
7. Enable both sandbox execution gates
8. Send payout-received scenario
9. Send timeout scenario and query it
10. Duplicate/idempotency scenario
11. Invalid scenario and manual-review routing
12. Callback signature, replay, and reconciliation tests

## 6. Promotion

Do not enable production from this package alone. Visa certification/production onboarding, a sponsor or direct eligible relationship, funding configuration, approved endpoint routes, production credentials, PCI/security review where applicable, and the final Visa-specific encryption profile remain required.
