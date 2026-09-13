# Ledger field mapping

| SOLN field | Visa / connector field | Rule |
|---|---|---|
| `paymentId` | `clientReferenceId` | Stable correlation identifier |
| `endToEndId` | `endToEndId` | Preserve when present |
| `idempotencyKey` | `X-SOLN-Idempotency-Key` | Prevent duplicate submission |
| `currency` | Internal source currency | Must equal `LND` |
| `lndUnits` | Internal authorized LND amount | Never submitted as a Visa currency |
| `referenceRate` | Internal declared parity/reference | Not represented as a Visa FX rate |
| `referenceCurrency` | Partner payout currency | Must be Visa-supported and must not be `LND` |
| `externalCashAmount` | `transactionAmount` | Must be funded/confirmed by the conversion partner |
| `providerStatus` | Normalized Visa status | Never derived from email delivery |
| `providerSettlementRef` | Visa payout ID/reference | Required for reconciliation |
| `settlementEvidenceUrl` | Evidence reference | Must not expose keys or full account numbers |

## Status state machine

Allowed path:

`LND_AUTHORIZED -> PARTNER_CONVERSION_PENDING -> VISA_VALIDATED -> VISA_SUBMITTED -> VISA_PROCESSING -> VISA_PAID -> RECONCILED -> FINAL_AND_IRREVOCABLE`

Exception path:

`ANY_NONFINAL_STATE -> MANUAL_REVIEW`

`FINAL_AND_IRREVOCABLE` is never set by the connector. The Apps Script finalization function requires a reconciler, provider reference, and evidence reference.

## Recipient information

Full bank-account or wallet identifiers are transmitted only in the encrypted request to the secure connector. The sheets should retain only a masked recipient reference. Do not put private keys, Visa passwords, full account numbers, or unencrypted payout payloads in cells, logs, email, or GitHub.
