import { NextRequest, NextResponse } from "next/server"
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch"
import { x402Client } from "@x402/core/client"
import { ExactEvmScheme } from "@x402/evm/exact/client"
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code"
import { privateKeyToAccount } from "viem/accounts"
import { getSeller } from "@/lib/sellers"

const BUYER_BUILDER_CODE = process.env.BUYER_BUILDER_CODE || "demo_buyer"
const NETWORK = "eip155:84532"

export async function POST(request: NextRequest) {
  const { sellerId } = await request.json()

  const seller = getSeller(sellerId)
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const privateKey = process.env.BUYER_PRIVATE_KEY
  if (!privateKey) {
    return NextResponse.json({ error: "BUYER_PRIVATE_KEY not configured" }, { status: 500 })
  }

  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`)

  // ExactEvmScheme's base flow needs a signer with `address` + `signTypedData`;
  // a wallet client keeps its address at `.account.address`, which the scheme can't see
  const evmScheme = new ExactEvmScheme(account)
  const client = new x402Client().register(NETWORK, evmScheme)

  // Register builder code extension so `s` is included in payment payload
  client.registerExtension(new BuilderCodeClientExtension(BUYER_BUILDER_CODE))

  const fetchWithPayment = wrapFetchWithPayment(fetch, client)

  const sellerUrl = new URL(
    `/api/sellers/${sellerId}`,
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).toString()

  try {
    const response = await fetchWithPayment(sellerUrl)
    const data = await response.json()

    // The facilitator's settlement result rides back on the PAYMENT-RESPONSE header
    let settlement = null
    const settleHeader =
      response.headers.get("payment-response") || response.headers.get("x-payment-response")
    if (settleHeader) {
      try {
        const settle = decodePaymentResponseHeader(settleHeader)
        settlement = {
          txHash: settle.transaction,
          network: settle.network,
          payer: settle.payer,
        }
      } catch (err) {
        console.error("Failed to decode payment response header:", err)
      }
    }

    return NextResponse.json({
      success: true,
      builderCode: BUYER_BUILDER_CODE,
      buyerAddress: account.address,
      settlement,
      ...data,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
