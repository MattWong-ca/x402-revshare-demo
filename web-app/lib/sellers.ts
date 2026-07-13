export interface SellerConfig {
  id: string
  name: string
  description: string
  revshare_bps: number
  price_usd: string
  emoji: string
  sample_response: object
}

export const SELLERS: SellerConfig[] = [
  {
    id: "weather",
    name: "Weather API",
    description: "Real-time weather data for any city",
    revshare_bps: 5000,
    price_usd: "0.50",
    emoji: "🌤️",
    sample_response: {
      city: "San Francisco",
      temp_f: 62,
      condition: "Partly cloudy",
      humidity: "78%",
      wind_mph: 12,
    },
  },
  {
    id: "prices",
    name: "Crypto Price Feed",
    description: "Live crypto prices across major assets",
    revshare_bps: 3000,
    price_usd: "0.50",
    emoji: "📈",
    sample_response: {
      BTC: "$97,420",
      ETH: "$3,210",
      SOL: "$148",
      USDC: "$1.00",
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: "search",
    name: "AI Search API",
    description: "Semantic search over web content",
    revshare_bps: 2500,
    price_usd: "0.50",
    emoji: "🔍",
    sample_response: {
      query: "latest AI news",
      results: [
        { title: "GPT-5 Released", snippet: "OpenAI announces...", url: "https://example.com/1" },
        { title: "Claude 4 Benchmarks", snippet: "Anthropic reports...", url: "https://example.com/2" },
        { title: "Gemini Ultra 2", snippet: "Google DeepMind...", url: "https://example.com/3" },
      ],
    },
  },
]

export function getSeller(id: string): SellerConfig | undefined {
  return SELLERS.find((s) => s.id === id)
}
