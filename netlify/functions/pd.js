export async function handler() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      lpViews: ["Insurance", "Pension", "Bank", "MutualAid", "SWF"],
      strategies: [
        {
          strategy: "Senior Direct Lending",
          spreadHistory: [
            { date: "2024-01", value: 420 },
            { date: "2024-06", value: 460 },
            { date: "2025-01", value: 480 }
          ],
          deals12m: 1240,
          visibleTo: ["Insurance", "Pension", "Bank"]
        },
        {
          strategy: "Mezzanine",
          spreadHistory: [
            { date: "2024-01", value: 650 },
            { date: "2024-06", value: 700 },
            { date: "2025-01", value: 720 }
          ],
          deals12m: 320,
          visibleTo: ["Pension", "SWF"]
        }
      ],
      secFilings: [
        { fund: "Ares Direct Lending Fund V", form: "Form D", date: "2024-11" },
        { fund: "Blackstone Private Credit Fund IV", form: "ADV", date: "2024-10" }
      ]
    })
  };
}
