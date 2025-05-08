# Crypto Payment Gateway

A minimal **Next.js** + **TypeScript** service for accepting on-chain crypto payments (BTC, ETH, USDT/ERC-20) without a third-party gateway. Customers can pay exactly the invoice amount to one of two rotating deposit addresses per network, and the backend will detect & confirm the on-chain transfer automatically.

---
## ⚠️ VERY IMPORTANT NOTES

> This software is for educational and testing purposes only. USE THE SOFTWARE AT YOUR OWN RISK. THE AUTHORS AND ALL AFFILIATES ASSUME NO RESPONSIBILITY FOR YOUR SOFTWARE USE.
---

## 🚀 Features

- **Multi-currency support**:  
  - **Bitcoin** (native UTXO scan via Blockstream API)  
  - **Ethereum** (native balance check via JSON-RPC)  
  - **USDT/ERC-20** (Transfer event log scan)

- **Address rotation**: evenly distributes new orders across two deposit addresses per currency to avoid collisions.

- **Instant confirmation**:  
  - Writes `pending` order + start balances/block to Supabase  
  - Polls /api/payment/status until on-chain receipt  
  - Marks order `paid` in your Supabase table  

- **Zero-extra UI**: no frontend; drop-in `/api/payment/*` endpoints into your Next.js app.

- **Fully typed** with **TypeScript**, unit-tested conversion logic, and CI workflow.

---

## 📋 Prerequisites

- **Node.js** ≥ 18  
- **npm** or **yarn**  
- A **Supabase** project with a table matching this schema (must include columns:  
  `id` (UUID primary key),  
  `deposit_address`, `currency`, `network`, `total_due`,  
  `start_block`, `start_balance`,  
  `payment_status` (text),  
  plus any other fields your app needs)

---

## ⚙️ Configuration

1. Copy `.env.example` → `.env` and fill in your values:

   ```dotenv
   # Supabase
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   # Ethereum RPC endpoints (primary + fallback)
   ETH_RPC_URL=https://ethereum-rpc.publicnode.com
   ETH_FALLBACK_RPC_URL=https://cloudflare-eth.com

   # USDT contract (mainnet)
   USDT_CONTRACT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7

   # Deposit address pools (two each, comma-separated)
   BTC_ADDRESSES=bc1qp…abc,bc1qp…def
   ETH_ADDRESSES=0xAbc123…456,0xDef789…012
   USDT_ADDRESSES=0xUsdtAddr1…345,0xUsdtAddr2…678
---

   ## 🛠️ API Endpoints

### `POST /api/payment/initiate`
- **Request JSON body**:
  ```json
  {
    "orderId": "<uuid-of-TABLE-row>",
    "currency": "usdt" | "eth" | "btc",
    "network": "erc20" | "eth-mainnet" | "btc-mainnet",
    "amountDue": 15.00
  }
  
What it does:
- Converts `amountDue` into on-chain base units (satoshis, wei, or USDT decimals)
- Rotates between two deposit addresses for that currency
- Reads current on-chain block & starting balance
- Updates your Supabase `TABLE` row with: `deposit_address`, `start_block`, `start_balance`, `payment_status='pending'`
- Returns:
  {
    "orderId": "...",
    "depositAddress": "...",
    "expiresAt": 1672531199000
  }

### GET /api/payment/status?orderId=<uuid>

**What it does:**
- Fetches your order row from Supabase  
- If still initializing, returns HTTP 202  
- Otherwise:  
  - For **BTC**, calls Blockstream API to scan UTXOs since `start_block`  
  - For **ETH**, checks `balance > start_balance + total_due`  
  - For **USDT**, fetches logs of `Transfer(..., to=deposit_address, value=total_due)`  
- If a matching on-chain payment is found, updates `payment_status='paid'` in Supabase  
- Returns:
  ```json
  { "confirmed": true }
  ---
---
## ✅ Testing

Run unit tests for your decimals logic:

```bash
npm test
```
---

## 🤝 Contributing
Fork the repo
Create a feature branch (git checkout -b feat/your-feature)
Commit your changes & push
Open a PR

---
## 📄 License
This project is licensed under the MIT License. See LICENSE for details.



