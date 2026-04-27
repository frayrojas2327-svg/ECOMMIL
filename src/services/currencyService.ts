export async function fetchExchangeRates() {
  const apis = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
  ];

  for (const url of apis) {
    try {
      console.log(`Attempting to fetch rates from: ${url}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Handle different API response structures
      if (data.rates) return data.rates;
      if (data.usd) {
        // Fawaz Ahmed API structure is { "usd": { "cop": ..., "eur": ... } }
        // Let's normalize it to { "COP": ..., "EUR": ... }
        const normalized: Record<string, number> = {};
        Object.entries(data.usd as Record<string, number>).forEach(([code, rate]) => {
          normalized[code.toUpperCase()] = rate;
        });
        return normalized;
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${url}:`, error instanceof Error ? error.message : error);
      continue; // Try next API
    }
  }

  console.error('All exchange rate APIs failed. Using fallback rates.');
  return null;
}
