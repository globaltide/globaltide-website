export async function handler() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      lpViews: ["Insurance", "Pension", "Bank", "MutualAid", "SWF"],
      strategies: [
        {
          strategy: "Large Buyout",
          irrHistory: [
            { date: "2023", value: 13.5 },
            { date: "2024", value: 14.2 },
            { date: "2025", value: 14.8 }
          ],
          industries: ["Industrial", "Healthcare", "Consumer"],
          visibleTo: ["Insurance", "Pension", "SWF"]
        },
        {
          strategy: "Mid Buyout",
          irrHistory: [
            { date: "2023", value: 16.8 },
            { date: "2024", value: 17.5 },
            { date: "2025", value: 18.2 }
          ],
          industries: ["Software", "Business Services"],
          visibleTo: ["Pension", "SWF"]
        }
      ],
      secFilings: [
        { fund: "KKR Americas Fund XIII", form: "Form ADV", date: "2024-10" },
        { fund: "TPG Capital X", form: "Form D", date: "2024-11" }
      ]
    })
  };
}
