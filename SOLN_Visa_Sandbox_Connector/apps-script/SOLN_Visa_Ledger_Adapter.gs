/**
 * SOLN Visa Direct Account and Wallet sandbox adapter.
 * Internal transaction currency is locked to LND.
 * Visa secrets and full recipient credentials must never be stored in Sheets.
 */

var SOLN_VISA = Object.freeze({
  VERSION: '1.0.0',
  PAYMENTS_SHEET: 'SOLN_VISA_PAYOUTS',
  EVENTS_SHEET: 'SOLN_VISA_EVENTS',
  CONTROL_PAYMENTS_SHEET: 'SOLN_CTL_Payments',
  LEDGER_CURRENCY: 'LND',
  FINAL_STATUS: 'FINAL_AND_IRREVOCABLE',
  HEADERS: [
    'visaPayoutRowId', 'paymentId', 'clientReferenceId', 'endToEndId',
    'idempotencyKey', 'ledgerCurrency', 'lndUnits', 'declaredReferenceRate',
    'partnerId', 'partnerFundingReference', 'partnerFundingConfirmed',
    'payoutMethod', 'payoutCurrency', 'payoutAmount', 'recipientCountryCode',
    'recipientMaskedReference', 'status', 'providerStatus',
    'providerSettlementRef', 'settlementEvidenceUrl', 'maker', 'checker',
    'reconciler', 'createdAt', 'updatedAt', 'errorCode', 'errorMessage'
  ],
  EVENT_HEADERS: [
    'eventId', 'timestamp', 'paymentId', 'clientReferenceId', 'action',
    'fromStatus', 'toStatus', 'httpStatus', 'providerReference',
    'actor', 'detailHash', 'errorMessage'
  ]
});

function solnVisaInstallSandboxConnector() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  solnVisaEnsureSheet_(ss, SOLN_VISA.PAYMENTS_SHEET, SOLN_VISA.HEADERS);
  solnVisaEnsureSheet_(ss, SOLN_VISA.EVENTS_SHEET, SOLN_VISA.EVENT_HEADERS);
  PropertiesService.getScriptProperties().setProperties({
    SOLN_VISA_MODE: 'SANDBOX',
    SOLN_VISA_EXECUTION_ENABLED: 'false',
    SOLN_VISA_LEDGER_CURRENCY: 'LND',
    SOLN_VISA_VERSION: SOLN_VISA.VERSION
  }, false);
  solnVisaAppendEvent_({ action: 'INSTALL', toStatus: 'SANDBOX_READY', detail: { version: SOLN_VISA.VERSION } });
  SpreadsheetApp.getUi().alert('SOLN Visa sandbox adapter installed. Execution remains disabled.');
}

function solnVisaHealthCheck() {
  var result = solnVisaCallConnector_('GET', '/health', null, false);
  solnVisaAppendEvent_({ action: 'HEALTH_CHECK', toStatus: result.ok ? 'PASS' : 'MANUAL_REVIEW', detail: result });
  SpreadsheetApp.getUi().alert(JSON.stringify(result, null, 2));
  return result;
}

function solnVisaStageSandboxExample() {
  var props = PropertiesService.getScriptProperties();
  var initiatingPartyId = props.getProperty('SOLN_VISA_INITIATING_PARTY_ID');
  if (!initiatingPartyId) throw new Error('Set SOLN_VISA_INITIATING_PARTY_ID to the Visa-assigned sandbox value first. Do not use sample IDs as production identifiers.');

  var now = new Date();
  var clientReferenceId = 'SOLN-' + Utilities.formatDate(now, 'UTC', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8);
  var row = {
    visaPayoutRowId: 'VP-' + Utilities.getUuid(),
    paymentId: clientReferenceId,
    clientReferenceId: clientReferenceId,
    endToEndId: 'E2E-' + Utilities.getUuid(),
    idempotencyKey: solnVisaSha256_(clientReferenceId + '|VALIDATE'),
    ledgerCurrency: 'LND',
    lndUnits: 1.333333,
    declaredReferenceRate: '1 LND = 750 USD',
    partnerId: 'SANDBOX_PARTNER',
    partnerFundingReference: 'SANDBOX-ONLY',
    partnerFundingConfirmed: true,
    payoutMethod: 'W',
    payoutCurrency: 'USD',
    payoutAmount: 1000,
    recipientCountryCode: 'UGA',
    recipientMaskedReference: 'VISA_SANDBOX_TEST_RECIPIENT',
    status: 'PARTNER_CONVERSION_PENDING',
    maker: Session.getEffectiveUser().getEmail(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  solnVisaAppendObjectRow_(SOLN_VISA.PAYMENTS_SHEET, SOLN_VISA.HEADERS, row);
  solnVisaAppendEvent_({ paymentId: row.paymentId, clientReferenceId: row.clientReferenceId, action: 'STAGE', toStatus: row.status, detail: { sandbox: true } });
  return row.paymentId;
}

/**
 * Validates the selected staged payout. This uses only Visa sandbox test data.
 * Replace the payload builder with Visa-provided route test data; never put a
 * real recipient account number in a sheet or log.
 */
function solnVisaValidateSelectedPayout() {
  var context = solnVisaSelectedPayout_();
  solnVisaAssertStaged_(context.record);
  var payload = solnVisaBuildSandboxWalletPayload_(context.record);
  var envelope = solnVisaEnvelope_(context.record, payload);
  var response = solnVisaCallConnector_('POST', '/v1/payouts/validate', envelope, true);
  solnVisaApplyProviderResult_(context, 'VALIDATE', response);
  return response;
}

function solnVisaApproveSelectedSandboxPayout() {
  var context = solnVisaSelectedPayout_();
  if (context.record.status !== 'VISA_VALIDATED') throw new Error('Only a VISA_VALIDATED payout may be approved.');
  var checker = Session.getEffectiveUser().getEmail();
  if (!checker) throw new Error('A signed-in checker identity is required.');
  solnVisaUpdateRow_(context.sheet, context.row, { checker: checker, updatedAt: new Date().toISOString() });
  solnVisaAppendEvent_({
    paymentId: context.record.paymentId,
    clientReferenceId: context.record.clientReferenceId,
    action: 'CHECKER_APPROVAL',
    fromStatus: 'VISA_VALIDATED',
    toStatus: 'VISA_VALIDATED',
    detail: { checkerRecorded: true }
  });
}

function solnVisaEnableSandboxExecution() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Enable Visa sandbox sends?',
    'This enables only the Apps Script gate. The secure connector must also remain configured for Visa sandbox and be enabled separately. Never use real recipient data.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return false;
  PropertiesService.getScriptProperties().setProperty('SOLN_VISA_EXECUTION_ENABLED', 'true');
  solnVisaAppendEvent_({ action: 'ENABLE_SANDBOX_EXECUTION', toStatus: 'ENABLED', detail: { sandboxOnly: true } });
  return true;
}

function solnVisaSendSelectedSandboxPayout() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SOLN_VISA_EXECUTION_ENABLED') !== 'true') {
    throw new Error('Sandbox payout execution is disabled. Complete validation and set SOLN_VISA_EXECUTION_ENABLED=true only for Visa-provided sandbox scenarios.');
  }
  var context = solnVisaSelectedPayout_();
  if (context.record.status !== 'VISA_VALIDATED') throw new Error('Selected payout must be VISA_VALIDATED before send.');
  if (!context.record.checker) throw new Error('Checker approval is required before send. Run solnVisaApproveSelectedSandboxPayout().');
  var payload = solnVisaBuildSandboxWalletPayload_(context.record);
  var envelope = solnVisaEnvelope_(context.record, payload);
  var response = solnVisaCallConnector_('POST', '/v1/payouts', envelope, true);
  solnVisaApplyProviderResult_(context, 'SEND', response);
  return response;
}

function solnVisaMarkSelectedPayoutReconciled() {
  var context = solnVisaSelectedPayout_();
  var record = context.record;
  if (record.status !== 'VISA_PAID') throw new Error('Only a VISA_PAID payout may be reconciled.');
  var ui = SpreadsheetApp.getUi();
  var providerRef = record.providerSettlementRef || ui.prompt('Provider settlement reference').getResponseText().trim();
  var evidenceUrl = ui.prompt('Settlement evidence URL or controlled document reference').getResponseText().trim();
  if (!providerRef || !evidenceUrl) throw new Error('Provider reference and settlement evidence are required.');
  var reconciler = Session.getEffectiveUser().getEmail();
  if (!reconciler) throw new Error('A signed-in reconciler identity is required.');
  solnVisaUpdateRow_(context.sheet, context.row, {
    status: 'RECONCILED',
    providerSettlementRef: providerRef,
    settlementEvidenceUrl: evidenceUrl,
    reconciler: reconciler,
    updatedAt: new Date().toISOString()
  });
  solnVisaAppendEvent_({
    paymentId: record.paymentId,
    clientReferenceId: record.clientReferenceId,
    action: 'RECONCILE',
    fromStatus: 'VISA_PAID',
    toStatus: 'RECONCILED',
    providerReference: providerRef,
    detail: { evidenceRecorded: true }
  });
}

function solnVisaQuerySelectedPayout() {
  var context = solnVisaSelectedPayout_();
  var path = '/v1/payouts/' + encodeURIComponent(context.record.clientReferenceId);
  var response = solnVisaCallConnector_('GET', path, null, true);
  solnVisaApplyProviderResult_(context, 'QUERY', response);
  return response;
}

function solnVisaFinalizeSelectedReconciledPayout() {
  var context = solnVisaSelectedPayout_();
  var record = context.record;
  if (record.status !== 'RECONCILED') throw new Error('Only a RECONCILED payout may be finalized.');
  if (!record.reconciler || !record.providerSettlementRef || !record.settlementEvidenceUrl) {
    throw new Error('Reconciler, provider settlement reference, and settlement evidence are required.');
  }
  solnVisaUpdateRow_(context.sheet, context.row, { status: SOLN_VISA.FINAL_STATUS, updatedAt: new Date().toISOString() });
  solnVisaAppendEvent_({
    paymentId: record.paymentId,
    clientReferenceId: record.clientReferenceId,
    action: 'FINALIZE',
    fromStatus: 'RECONCILED',
    toStatus: SOLN_VISA.FINAL_STATUS,
    providerReference: record.providerSettlementRef,
    detail: { evidence: record.settlementEvidenceUrl }
  });
}

function solnVisaEnvelope_(record, visaPayload) {
  return {
    paymentId: record.paymentId,
    idempotencyKey: record.idempotencyKey,
    ledgerCurrency: 'LND',
    lndUnits: Number(record.lndUnits),
    partnerId: record.partnerId,
    partnerFundingReference: record.partnerFundingReference,
    partnerFundingConfirmed: String(record.partnerFundingConfirmed).toLowerCase() === 'true',
    visaPayload: visaPayload
  };
}

function solnVisaBuildSandboxWalletPayload_(record) {
  var initiatingPartyId = PropertiesService.getScriptProperties().getProperty('SOLN_VISA_INITIATING_PARTY_ID');
  return {
    recipientDetail: {
      lastName: 'Do', firstName: 'John', type: 'I',
      wallet: {
        countryCode: 'UGA',
        accountIdentifier: '+8801888513100',
        accountIdentifierType: 'PHONENUMBER',
        currencyCode: 'UGX',
        operatorName: 'AIRTEL_MONEY'
      }
    },
    senderDetail: {
      senderReferenceNumber: '122342',
      lastName: 'Sender', firstName: 'Ben', type: 'I',
      address: { country: 'USA', city: 'Washington', postalCode: '111222', addressLine1: 'Sandbox Test', state: 'CF' }
    },
    payoutMethod: 'W',
    transactionDetail: {
      initiatingPartyId: Number(initiatingPartyId),
      businessApplicationId: 'FD',
      transactionAmount: Number(record.payoutAmount),
      transactionCurrencyCode: String(record.payoutCurrency).toUpperCase(),
      endToEndId: record.endToEndId,
      clientReferenceId: record.clientReferenceId
    }
  };
}

function solnVisaCallConnector_(method, path, body, signed) {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('SOLN_VISA_CONNECTOR_URL');
  if (!baseUrl) throw new Error('Missing SOLN_VISA_CONNECTOR_URL Script Property.');
  var bodyText = body ? JSON.stringify(body) : '';
  var headers = {};
  if (signed) {
    var secret = props.getProperty('SOLN_VISA_CONNECTOR_SHARED_SECRET');
    if (!secret || secret.length < 32) throw new Error('Missing or unsafe connector shared secret.');
    var timestamp = String(Date.now());
    var nonce = Utilities.getUuid();
    var canonical = [timestamp, nonce, method.toUpperCase(), path, solnVisaSha256_(bodyText)].join('\n');
    headers['X-SOLN-Timestamp'] = timestamp;
    headers['X-SOLN-Nonce'] = nonce;
    headers['X-SOLN-Signature'] = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(canonical, secret)
    ).replace(/=+$/, '');
  }
  var options = { method: method.toLowerCase(), muteHttpExceptions: true, headers: headers };
  if (bodyText) { options.contentType = 'application/json'; options.payload = bodyText; }
  var response = UrlFetchApp.fetch(baseUrl.replace(/\/$/, '') + path, options);
  var result;
  try { result = JSON.parse(response.getContentText()); }
  catch (error) { result = { ok: false, error: 'Connector returned a non-JSON response.' }; }
  result.httpStatus = result.httpStatus || response.getResponseCode();
  return result;
}

function solnVisaApplyProviderResult_(context, action, response) {
  var oldStatus = context.record.status;
  var newStatus = response.normalizedStatus || (response.ok ? 'VISA_SUBMITTED' : 'MANUAL_REVIEW');
  if (newStatus === SOLN_VISA.FINAL_STATUS) newStatus = 'MANUAL_REVIEW';
  var changes = {
    status: newStatus,
    providerStatus: newStatus,
    providerSettlementRef: response.providerReference || '',
    updatedAt: new Date().toISOString(),
    errorMessage: response.ok ? '' : String(response.error || 'Visa connector error')
  };
  solnVisaUpdateRow_(context.sheet, context.row, changes);
  solnVisaAppendEvent_({
    paymentId: context.record.paymentId,
    clientReferenceId: context.record.clientReferenceId,
    action: action,
    fromStatus: oldStatus,
    toStatus: newStatus,
    httpStatus: response.httpStatus || '',
    providerReference: response.providerReference || '',
    errorMessage: changes.errorMessage,
    detail: { ok: !!response.ok, dryRun: !!response.dryRun }
  });
}

function solnVisaAssertStaged_(record) {
  if (String(record.ledgerCurrency).toUpperCase() !== 'LND') throw new Error('Ledger currency must be LND.');
  if (!record.paymentId || !record.clientReferenceId || !record.idempotencyKey) throw new Error('Payment identifiers are incomplete.');
  if (String(record.partnerFundingConfirmed).toLowerCase() !== 'true') throw new Error('Partner funding confirmation is required.');
  if (String(record.payoutCurrency).toUpperCase() === 'LND') throw new Error('Visa payout currency cannot be LND.');
}

function solnVisaSelectedPayout_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SOLN_VISA.PAYMENTS_SHEET) throw new Error('Select a payout row on ' + SOLN_VISA.PAYMENTS_SHEET + '.');
  var row = sheet.getActiveRange().getRow();
  if (row < 2) throw new Error('Select a data row.');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var record = {};
  headers.forEach(function(header, index) { record[header] = values[index]; });
  return { sheet: sheet, row: row, record: record };
}

function solnVisaUpdateRow_(sheet, row, changes) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  Object.keys(changes).forEach(function(key) {
    var index = headers.indexOf(key);
    if (index >= 0) sheet.getRange(row, index + 1).setValue(changes[key]);
  });
}

function solnVisaEnsureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  headers.forEach(function(header) {
    if (existing.indexOf(header) < 0) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header); existing.push(header); }
  });
  sheet.setFrozenRows(1);
}

function solnVisaAppendObjectRow_(sheetName, headers, object) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  sheet.appendRow(headers.map(function(header) { return object[header] === undefined ? '' : object[header]; }));
}

function solnVisaAppendEvent_(event) {
  var detailText = JSON.stringify(event.detail || {});
  solnVisaAppendObjectRow_(SOLN_VISA.EVENTS_SHEET, SOLN_VISA.EVENT_HEADERS, {
    eventId: 'VE-' + Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    paymentId: event.paymentId || '',
    clientReferenceId: event.clientReferenceId || '',
    action: event.action || '',
    fromStatus: event.fromStatus || '',
    toStatus: event.toStatus || '',
    httpStatus: event.httpStatus || '',
    providerReference: event.providerReference || '',
    actor: Session.getEffectiveUser().getEmail(),
    detailHash: solnVisaSha256_(detailText),
    errorMessage: event.errorMessage || ''
  });
}

function solnVisaSha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function(byte) { var value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); })
    .join('');
}
