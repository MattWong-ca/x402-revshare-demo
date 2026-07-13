import { NextRequest, NextResponse } from "next/server"
import { withX402, x402ResourceServer } from "@x402/next"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { getSeller } from "@/lib/sellers"
import { sendRevshare } from "@/lib/revshare"

const SELLER_ADDRESS = process.env.SELLER_WALLET_ADDRESS as `0x${string}`
const NETWORK = "eip155:84532" // Base Sepolia

function getResourceServer() {
  const scheme = new ExactEvmScheme()
  return new x402ResourceServer().register(NETWORK, scheme)
}

async function handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params
  const seller = getSeller(id)

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  // Extract builder code from payment payload header (set by x402 after verification)
  const builderCode = request.headers.get("x-builder-code") || ""

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
    },
    server,
  )(request)
}
