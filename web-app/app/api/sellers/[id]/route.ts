import { NextRequest, NextResponse } from "next/server"
import { withX402, x402ResourceServer } from "@x402/next"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { decodePaymentSignatureHeader } from "@x402/core/http"
import {
  builderCodeResourceServerExtension,
  declareBuilderCodeExtension,
} from "@x402/extensions/builder-code"
import { getSeller } from "@/lib/sellers"
import { sendRevshare } from "@/lib/revshare"

const SELLER_ADDRESS = process.env.SELLER_WALLET_ADDRESS as `0x${string}`
const NETWORK = "eip155:84532" // Base Sepolia

// The seller's own app code (`a` field); the buyer's service code (`s`) comes from the client
const SELLER_BUILDER_CODE = process.env.SELLER_BUILDER_CODE || "demo_seller"

function getResourceServer() {
  const scheme = new ExactEvmScheme()
  const server = new x402ResourceServer().register(NETWORK, scheme)
  server.registerExtension(builderCodeResourceServerExtension)
  return server
}

async function handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params
  const seller = getSeller(id)

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  // withX402 verifies the payment header before invoking this handler, but doesn't
  // forward the payload — decode the same header to read the builder-code extension
  // (the client's BuilderCodeClientExtension puts service codes in the `s` field)
  let builderCode = ""
  const paymentHeader =
    request.headers.get("payment-signature") || request.headers.get("x-payment")
  if (paymentHeader) {
    try {
      const payload = decodePaymentSignatureHeader(paymentHeader)
      const ext = payload.extensions?.["builder-code"] as
        | { info?: { s?: string | string[] } }
        | undefined
      const s = ext?.info?.s
      builderCode = (Array.isArray(s) ? s[0] : s) || ""
    } catch (err) {
      console.error("Failed to decode payment header for builder code:", err)
    }
  }

  // Trigger revshare asynchronously (don't block response)
  let revshareResult = null
  if (builderCode) {
    try {
      revshareResult = await sendRevshare(builderCode, seller.price_usd, seller.revshare_bps)
    } catch (err) {
      console.error("Revshare failed:", err)
    }
  }

  return NextResponse.json({
    seller: seller.name,
    data: seller.sample_response,
    revshare: revshareResult
      ? {
          sent: true,
          builderCode,
          amountUsd: revshareResult.amountUsd,
          txHash: revshareResult.txHash,
          recipient: revshareResult.recipientAddress,
        }
      : { sent: false, reason: builderCode ? "lookup_failed" : "no_builder_code" },
  })
}

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = request.nextUrl.pathname.split("/").pop() || ""
  const seller = getSeller(id)

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const server = getResourceServer()

  return withX402(
    (req) => handler(req, context),
    {
      accepts: {
        scheme: "exact",
        payTo: SELLER_ADDRESS,
        price: `$${seller.price_usd}`,
        network: NETWORK,
      },
      description: seller.description,
      // Declaring the extension in the 402 is required — the client only attaches
      // its builder code when the server advertises support for it
      extensions: {
        "builder-code": declareBuilderCodeExtension(SELLER_BUILDER_CODE),
      },
    },
    server,
  )(request)
}
