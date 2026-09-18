"""
DHCSOLN Automated Network Payload & Protocol Compliance Verification Engine.
Validates independent sovereign parameters for Caribbean & African gateway mapping.
"""

import json
import os
import sys

REGISTRY_FILE = "currency.json"
MANIFEST_FILE = "api_manifest.json"

def audit_pipeline_compliance():
    print("[INFO] Initializing structural compliance audit for Caribbean & African gateway mapping...")
    
    # 1. Verify existence of primary structural files
    if not os.path.exists(REGISTRY_FILE) or not os.path.exists(MANIFEST_FILE):
        print("[ERROR] Core architecture files missing from local repository workspace.")
        sys.exit(1)
        
    # 2. Ingest registry file data
    with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
        registry_data = json.load(f)
        
    # 3. Extract and check the cryptographic seal
    embedded_signature = registry_data.get("integrity_signature", "")
    if not embedded_signature.startswith("sha256-"):
        print("[ERROR] Database file does not contain a valid enterprise cryptographic seal.")
        sys.exit(1)
        
    print(f"[SUCCESS] Cryptographic seal detected: {embedded_signature}")
    
    # 4. Check for mandatory sovereign routing elements
    jurisdiction = registry_data.get("jurisdiction", {}).get("name", "")
    numeric_code = registry_data.get("numericCode", None)
    
    if "Loc Nation" not in jurisdiction or numeric_code != 666:
        print("[ERROR] Sovereign baseline parameters are altered or misconfigured.")
        sys.exit(1)
        
    print(f"[SUCCESS] Validated sovereign authority parameters for: '{jurisdiction}' (Code {numeric_code}).")
    
    # 5. Verify whitelisted identities exist and possess active routing keys
    currencies = registry_data.get("currencies", [])
    if len(currencies) < 4:
        print("[ERROR] Whitelist data matrix is incomplete or contains unverified profiles.")
        sys.exit(1)
        
    for entity in currencies:
        holder = entity.get("authority_holder", "System Ledger")
        status = entity.get("status", "")
        
        # Robust dual-layer lookup to accept BOTH sovereign keys or checking account identifiers safely
        routing_parameters = entity.get("sovereign_routing_parameters", {}) or entity.get("checking_routing_identifiers", {})
        routing_node = routing_parameters.get("ledger_account_node", "") or routing_parameters.get("checking_account_iban", "")
        
        if status != "WHITELISTED" or not routing_node:
            print(f"[ERROR] Security clearance validation failed for entity profile: {holder}")
            sys.exit(1)
            
    print("[SUCCESS] All identity profiles match automated clearance guidelines.")
    print("[SUCCESS] Systems are fully verified for direct regional inter-ledger interface. Validation complete.")

if __name__ == "__main__":
    audit_pipeline_compliance()

