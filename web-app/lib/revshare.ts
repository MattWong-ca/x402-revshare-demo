import { createPublicClient, createWalletClient, http, parseUnits, getContract } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia } from "viem/chains"

// Minimal ABI for BuilderCodes registry
const BUILDER_CODES_ABI = [
  {
    name: "payoutAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "code", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "code", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// Minimal ERC20 ABI for USDC transfer
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const

// Base mainnet BuilderCodes contract
const BUILDER_CODES_ADDRESS = "0x000000bc7e6457e610fe52dcc0ca5b3ce59c8e80" as const

// USDC on Base Sepolia
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const

const mainnetClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org"),
})

const sepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
})

export async function resolveBuilderCodeAddress(builderCode: string): Promise<`0x${string}` | null> {
  try {
    const contract = getContract({
      address: BUILDER_CODES_ADDRESS,
      abi: BUILDER_CODES_ABI,
      client: mainnetClient,
    })

    const isRegistered = await contract.read.isRegistered([builderCode])
    if (!isRegistered) return null

    const addr = await contract.read.payoutAddress([builderCode])
    return addr as `0x${string}`
  } catch {
    return null
  }
}

export interface RevshareResult {
  txHash: string
  builderCode: string
  recipientAddress: string
  amountUsd: string
}

export async function sendRevshare(
  builderCode: string,
  paymentAmountUsd: string,
  revshareBps: number,
): Promise<RevshareResult | null> {
  const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY
  if (!sellerPrivateKey) throw new Error("SELLER_PRIVATE_KEY not set")

  const recipientAddress = await resolveBuilderCodeAddress(builderCode)
  if (!recipientAddress) {
    console.log(`Builder code "${builderCode}" not registered on mainnet, skipping revshare`)
    return null
  }

  const account = privateKeyToAccount(`0x${sellerPrivateKey.replace(/^0x/, "")}`)
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  })

  const paymentAmount = parseFloat(paymentAmountUsd)
  const revshareAmount = (paymentAmount * revshareBps) / 10000
  const revshareAmountMicro = parseUnits(revshareAmount.toFixed(6), 6) // USDC has 6 decimals

  const txHash = await walletClient.writeContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipientAddress, revshareAmountMicro],
  })

  return {
    txHash,
    builderCode,
    recipientAddress,
    amountUsd: revshareAmount.toFixed(6),
  }
}
