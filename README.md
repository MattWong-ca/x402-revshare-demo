> **NOTE: This is for demo purposes only and should not be used in production.**

# x402 Revshare Demo
https://github.com/user-attachments/assets/c8df7276-e554-4b72-bd3f-d2eaaad9a843


A few weeks ago we introduced [x402 Builder Codes](https://x.com/buildonbase/status/2069102951960904137), which unlocked onchain attribution for x402 payments. When an agent, framework, or app routes a paid x402 request, the builder's code (`s`) gets embedded in the settlement transaction onchain via an ERC-8021 suffix alongside the seller code (`a`) and facilitator code (`w`). 

Builder Codes give us durable, onchain attribution: we can now answer *which builder drove which x402 volume* (as opposed to just the wallet address). That attribution layer is the foundation for **revsharing**. If we know which agent, framework, or app sourced the traffic, we can automatically pay them for it.

This demo shows what that looks like end to end.

---

## How it works

An AI agent (the buyer) selects a seller API endpoint. Each endpoint advertises a revshare percentage — the cut the seller is willing to pay back to whoever routed the request.

```
1. Agent selects a seller service and sends a request

2. Seller returns HTTP 402. Agent pays via x402, appending
   its builder code as `s` in the payment payload.

3. CDP Facilitator settles the payment onchain, embedding
   {a, s, w} in the transaction calldata as an ERC-8021 suffix.

4. Seller's backend receives payment confirmation along with
   the full payment payload, including the buyer's builder code.

5. Seller looks up the builder code → wallet address by calling
   payoutAddress("bc_xxxxx") on the Base Builder Codes contract
   (0x000000bc7e6457e610fe52dcc0ca5b3ce59c8e80).

6. Seller sends revshare % of the payment directly to that wallet.
```

The builder code → wallet mapping is **fully onchain**. No API calls, no backend lookups — just a view call to the `BuilderCodes` contract that Base maintains.

### Demo shortcomings (intentional simplifications)

- **No trust enforcement**: the seller self-reports and pays from their own wallet. A builder has to trust the seller will pay. In production this is solved by a shared revshare contract (see below).
- **Hot wallet**: the seller backend holds a private key to sign the USDC transfer.
- **Seller-triggered**: the revshare is triggered by the seller's backend after payment. A production system would have the facilitator trigger it, so no seller integration is needed.

---

## What production looks like

For an external team to implement revshare in production, there are two paths depending on how much trust you want to enforce onchain.

### Simple path (seller-triggered, low overhead)

Same pattern as this demo but hardened:

1. **Deploy a shared revshare contract** that holds the seller's USDC budget and enforces payouts. The seller deposits funds once; the contract handles transfers. This removes the hot-key risk and gives builders onchain proof of what they're owed vs. what was paid.
2. **Add a post-payment hook** to your x402 seller middleware. After `verify()` succeeds, extract `s` from the payment payload, resolve the wallet address from the Builder Codes contract, and call `contract.payout(address, amount)`.

### Production path (facilitator-triggered, no seller changes needed)

The cleanest long-term model uses [Flywheel](https://github.com/coinbase/flywheel) — a modular onchain rewards protocol — as the shared revshare infrastructure:

1. **Seller creates a Flywheel campaign** pointing at a new `x402RevshareHook` contract, deposits a USDC budget, and sets their revshare rate. No custom contract needed per seller.
2. **CDP Facilitator calls Flywheel** after each settlement. It passes the builder code and payment amount. Flywheel looks up the payout address from the Base Builder Codes contract and sends USDC to the builder.
3. **Zero seller-side changes required** after initial campaign setup. The facilitator handles everything.

This approach is trustless, works across any seller that uses the CDP Facilitator, and gives builders a full onchain audit trail of every payout.

---

## Running the demo locally

```bash
cd web-app
cp .env.local.example .env.local
# fill in SELLER_PRIVATE_KEY, SELLER_WALLET_ADDRESS, BUYER_PRIVATE_KEY
npm install
npm run dev
```

Both wallets need **Sepolia ETH** (gas) and **Sepolia USDC**:
- ETH: [Base Sepolia faucet](https://docs.base.org/docs/tools/network-faucets)
- USDC: [Circle faucet](https://faucet.circle.com)

The buyer's builder code is registered on Base mainnet and revshare resolves to its registered wallet address, but the actual transaction for this demo is on Sepolia.
