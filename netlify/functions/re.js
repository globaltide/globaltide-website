export async function handler() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      lpViews: ["Insurance", "Pension", "Bank", "MutualAid", "SWF"],
      strategies: [
        {
          strategy: "Senior Mortgage",
          category: "Debt",
          yieldHistory: [
            { date: "2024-Q1", value: 5.8 },
            { date: "2024-Q3", value: 6.2 },
            { date: "2025-Q1", value: 6.5 }
          ],
          visibleTo: ["Insurance", "Bank"]
        },
        {
          strategy: "Opportunistic Equity",
          category: "Equity",
          irrHistory: [
            { date: "2023", value: 13.5 },
            { date: "2024", value: 14.8 },
            { date: "2025", value: 16.0 }
          ],
          visibleTo: ["Pension", "SWF"]
        },
        {
          strategy: "CMBS B-Piece",
          category: "Structured",
          irrHistory: [
            { date: "2023", value: 16.5 },
            { date: "2024", value: 17.8 },
            { date: "2025", value: 18.5 }
          ],
          visibleTo: ["Insurance", "Bank", "Pension"]
        }
      ],
      secFilings: [
        { fund: "Starwood Real Estate Income Trust", form: "Form N-PORT", date: "2024-11" }
      ]
    })
  };
}
