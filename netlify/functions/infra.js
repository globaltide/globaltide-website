export async function handler() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      lpViews: ["Insurance", "Pension", "Bank", "SWF"],
      strategies: [
        {
          strategy: "Core Infrastructure Debt",
          type: "Debt",
          yieldHistory: [
            { date: "2024", value: 6.2 },
            { date: "2025", value: 6.8 }
          ],
          trends: ["Transport", "Utilities"],
          visibleTo: ["Insurance", "Bank"]
        },
        {
          strategy: "Renewable Equity",
          type: "Equity",
          irrHistory: [
            { date: "2024", value: 11.5 },
            { date: "2025", value: 12.8 }
          ],
          trends: ["Solar", "Wind", "Battery"],
          visibleTo: ["Pension", "SWF"]
        }
      ],
      secFilings: [
        { fund: "Brookfield Infrastructure Fund V", form: "Form ADV", date: "2024-09" }
      ]
    })
  };
}
