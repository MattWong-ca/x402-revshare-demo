"use client"

import { useState } from "react"
import { SELLERS, SellerConfig } from "@/lib/sellers"

type RequestState = "idle" | "loading" | "success" | "error"

interface RequestResult {
  builderCode: string
  buyerAddress: string
  seller: string
  data: object
  revshare: {
    sent: boolean
    builderCode?: string
    amountUsd?: string
    txHash?: string
    recipient?: string
    reason?: string
  }
}

export default function Home() {
  const [selectedSeller, setSelectedSeller] = useState<SellerConfig | null>(null)
  const [state, setState] = useState<RequestState>("idle")
  const [result, setResult] = useState<RequestResult | null>(null)
  const [totalEarned, setTotalEarned] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function sendRequest() {
    if (!selectedSeller) return
    setState("loading")
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: selectedSeller.id }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Request failed")

      setResult(data)
      if (data.revshare?.sent && data.revshare?.amountUsd) {
        setTotalEarned((prev) => prev + parseFloat(data.revshare.amountUsd))
      }
      setState("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setState("error")
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono">
      {/* Header */}
      <div className="relative border-b border-gray-800 px-6 py-16 flex items-center justify-between">
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <h1 className="text-5xl font-bold text-white tracking-tight">x402 Revshare Demo</h1>
          <p className="text-sm text-gray-500 mt-2">Built on ERC-8021 Builder Codes</p>
        </div>
        {totalEarned > 0 && (
          <div className="ml-auto bg-green-950 border border-green-800 rounded-lg px-4 py-2 text-right">
            <p className="text-xs text-green-400">Total Earned</p>
            <p className="text-lg font-bold text-green-300">${totalEarned.toFixed(6)} USDC</p>
          </div>
        )}
      </div>

      {/* Split screen */}
      <div className="flex h-[calc(100vh-145px)]">
        {/* Left: Buyer panel */}
        <div className="w-1/2 border-r border-gray-800 p-6 flex flex-col gap-4 overflow-y-auto">
          <p className="text-3xl font-bold text-white uppercase tracking-widest">Buyer</p>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center text-2xl shrink-0">
              🤖
            </div>
            <div>
              <p className="text-xl font-semibold text-white">AI Agent</p>
              <p className="text-sm text-gray-400 mt-0.5">
                Builder code: <span className="text-blue-400 font-bold">bc_59m9w3pa</span>
              </p>
            </div>
          </div>

          {/* Selected service */}
          <div>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Selected Service</p>
            {selectedSeller ? (
              <div className="bg-gray-900 border border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedSeller.emoji}</span>
                    <span className="font-semibold">{selectedSeller.name}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedSeller(null); setState("idle"); setResult(null) }}
                    className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    ✕ clear
                  </button>
                </div>
                <p className="text-xs text-gray-400">{selectedSeller.description}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="text-gray-500">Price: <span className="text-white">${selectedSeller.price_usd} USDC</span></span>
                  <span className="text-gray-500">Revshare: <span className="text-green-400 font-bold">{selectedSeller.revshare_bps / 100}%</span></span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-dashed border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 text-sm">← Select a service from the directory</p>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={sendRequest}
            disabled={!selectedSeller || state === "loading"}
            className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
          >
            {state === "loading" ? "Sending request + paying..." : "Send Request"}
          </button>

          {/* Result */}
          {state === "success" && result && (
            <div className="flex flex-col gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Response</p>
                <pre className="text-xs text-green-300 overflow-auto max-h-32 whitespace-pre-wrap">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>

              {result.revshare.sent ? (
                <div className="bg-green-950 border border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-400">💸</span>
                    <p className="text-sm font-bold text-green-300">
                      Revshare sent: ${result.revshare.amountUsd} USDC
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Builder: <span className="text-blue-400">{result.revshare.builderCode}</span></p>
                    <p>Recipient: <span className="text-gray-300 font-mono">{result.revshare.recipient}</span></p>
                    <p>
                      Tx:{" "}
                      <a
                        href={`https://sepolia.basescan.org/tx/${result.revshare.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline break-all"
                      >
                        {result.revshare.txHash?.slice(0, 20)}...
                      </a>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-500">
                  No revshare: {result.revshare.reason === "no_builder_code"
                    ? "no builder code in payment"
                    : `builder code "${result.revshare.builderCode}" not registered on mainnet`}
                </div>
              )}
            </div>
          )}

          {state === "error" && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Right: Seller directory */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <p className="text-3xl font-bold text-white uppercase tracking-widest mb-4">Seller Services</p>

          {/* How it works */}
          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-lg p-5 text-sm text-gray-400 space-y-2">
            <p className="text-white font-bold text-base mb-3">How it works</p>
            <p>1. Agent selects a seller service</p>
            <p>2. Agent pays via x402, appending its builder code</p>
            <p>3. Seller looks up builder code → associated wallet address</p>
            <p>4. Seller sends revshare % directly to wallet address</p>
          </div>

          {/* Seller cards — horizontal row */}
          <div className="flex gap-3">
            {SELLERS.map((seller) => (
              <button
                key={seller.id}
                onClick={() => { setSelectedSeller(seller); setState("idle"); setResult(null) }}
                className={`cursor-pointer flex-1 text-left rounded-lg border p-4 transition-all flex flex-col justify-between ${
                  selectedSeller?.id === seller.id
                    ? "border-blue-600 bg-blue-950"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div>
                  <span className="text-2xl mb-2 block">{seller.emoji}</span>
                  <p className="font-bold text-white text-xl leading-snug">{seller.name}</p>
                  <p className="text-sm text-gray-400 mt-1">{seller.description}</p>
                </div>
                <div className="mt-4 bg-green-900 border border-green-600 rounded-md px-3 py-2 text-center">
                  <p className="text-xs text-green-400 mb-0.5">Revshare</p>
                  <p className="text-2xl font-bold text-green-300">{seller.revshare_bps / 100}%</p>
                </div>
                <p className="text-xs text-gray-600 mt-2">${seller.price_usd} USDC · Base Sepolia</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
