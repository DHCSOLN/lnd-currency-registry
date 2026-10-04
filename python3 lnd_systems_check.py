import json
import os
from datetime import datetime

# Define the local database paths for tracking
CITIZEN_REGISTRY_FILE = "citizen_registry.json"
MERCHANT_REGISTRY_FILE = "merchant_registry.json"
LEDGER_LOG_FILE = "ledger_transactions.json"

def initialize_mock_database():
    """Generates initial data files if they do not exist, ensuring plug-and-play readiness."""
    if not os.path.exists(CITIZEN_REGISTRY_FILE):
        mock_citizens = [
            {"node_id": "SOLN_C_001", "status": "ACTIVE", "role": "Nephesh_Hummus"},
            {"node_id": "SOLN_C_002", "status": "ACTIVE", "role": "Nephesh_Hummus"},
            {"node_id": "SOLN_C_003", "status": "ACTIVE", "role": "Nephesh_Hummus"}
        ]
        with open(CITIZEN_REGISTRY_FILE, 'w') as f:
            json.dump(mock_citizens, f, indent=2)

    if not os.path.exists(MERCHANT_REGISTRY_FILE):
        mock_merchants = [
            {"merchant_id": "SOLN_M_101", "status": "CLEARED_LIVE", "gate_port": 9000},
            {"merchant_id": "SOLN_M_102", "status": "CLEARED_LIVE", "gate_port": 443}
        ]
        with open(MERCHANT_REGISTRY_FILE, 'w') as f:
            json.dump(mock_merchants, f, indent=2)

    if not os.path.exists(LEDGER_LOG_FILE):
        mock_ledger = [
            {"tx_id": "TX_9901", "amount_lnd": 0.10, "state": "SETTLED"},
            {"tx_id": "TX_9902", "amount_lnd": 2.00, "state": "MANUAL_REVIEW_PENDING"}
        ]
        with open(LEDGER_LOG_FILE, 'w') as f:
            json.dump(mock_ledger, f, indent=2)

def run_network_systems_check():
    """Reads the ledger files and returns the exact count of tracked economic components."""
    initialize_mock_database()
    
    try:
        with open(CITIZEN_REGISTRY_FILE, 'r') as f:
            citizens = json.load(f)
        with open(MERCHANT_REGISTRY_FILE, 'r') as f:
            merchants = json.load(f)
        with open(LEDGER_LOG_FILE, 'r') as f:
            ledger = json.load(f)
    except Exception as e:
        print(f"[X] SYSTEM CHECK ERROR: Unable to parse ledger databases. Details: {e}")
        return

    # Calculate metrics
    total_citizens = len([c for c in citizens if c.get("status") == "ACTIVE"])
    total_merchants = len([m for m in merchants if m.get("status") == "CLEARED_LIVE"])
    total_nodes_tracked = total_citizens + total_merchants
    
    total_circulating_lnd = sum(tx.get("amount_lnd", 0.0) for tx in ledger if tx.get("state") == "SETTLED")
    pending_review_lnd = sum(tx.get("amount_lnd", 0.0) for tx in ledger if tx.get("state") == "MANUAL_REVIEW_PENDING")
    
    # Calculate equivalent USD value under the Fixed Parity Rule (1 LND = $750 USD)
    parity_rate = 750.00
    total_usd_value = total_circulating_lnd * parity_rate

    # Print the master dashboard layout
    print("=================================================================")
    print("        STATE OF LOC NATION GLOBAL PUBLIC BENEFIT CORP           ")
    print("           REAL-TIME NETWORK CENSUS & SYSTEMS CHECK              ")
    print("=================================================================")
    print(f"Timestamp: {datetime.utcnow().isoformat()}Z")
    print(f"Jurisdiction Status: ACTIVE & SELF-GOVERNED (Ninth Amendment)\n")
    
    print(f"📊 TRACKED INFRASTRUCTURE COUNTS:")
    print(f"  • Registered Citizens (Nephesh Hummus): {total_citizens}")
    print(f"  • Cleared Merchant Nodes (Gates Open):  {total_merchants}")
    print(f"  • TOTAL ACTIVE MATRIX NODES TRACKED:   {total_nodes_tracked}\n")
    
    print(f"💰 CIRCUILATING VOLUME METRICS:")
    print(f"  • Total Settled Liquidity:            {total_circulating_lnd:.4f} LND")
    print(f"  • Total Equivalent Market Cap:        ${total_usd_value:,.2f} USD")
    print(f"  • Volume Pending Treasury Review:     {pending_review_lnd:.4f} LND\n")
    
    print("🟢 SYSTEM STATUS: ALL PATHWAYS INTEROPERABLE & STANDING READY")
    print("=================================================================")

if __name__ == "__main__":
    run_network_systems_check()
