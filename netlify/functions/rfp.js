export async function handler() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      domestic: [
        {
          institution: "우정사업본부",
          asset: "Private Credit",
          region: "Global",
          deadline: "2025-03-15",
          source: "https://www.epost.go.kr"
        },
        {
          institution: "공무원연금공단",
          asset: "Infrastructure Equity",
          region: "Global",
          deadline: "2025-04-01",
          source: "https://www.geps.or.kr"
        },
        {
          institution: "금융투자협회",
          asset: "PE / VC",
          region: "Domestic",
          deadline: "2025-02-28",
          source: "https://www.kofia.or.kr"
        }
      ],
      global: [
        {
          institution: "CalPERS",
          asset: "Infrastructure Debt",
          region: "US",
          deadline: "2025-03-30",
          source: "https://www.calpers.ca.gov"
        },
        {
          institution: "CPPIB",
          asset: "Private Equity Co-invest",
          region: "Global",
          deadline: "2025-04-15",
          source: "https://www.cppinvestments.com"
        }
      ]
    })
  };
}
