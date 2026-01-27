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
          amount: "1,000억원",
          deadline: "2025-03-15",
          source: "https://www.koreapost.go.kr/kpost/main/index.jsp"
        },
        {
          institution: "공무원연금공단",
          asset: "Infrastructure Equity",
          region: "Global",
          amount: "2,500억원",
          deadline: "2025-04-01",
          source: "https://www.geps.or.kr"
        },
        {
          institution: "금융투자협회",
          asset: "PE / VC",
          region: "Domestic",
          amount: "800억원",
          deadline: "2025-02-28",
          source: "https://www.kofia.or.kr"
        },
        {
          institution: "국민연금공단",
          asset: "Real Estate - Core",
          region: "Asia Pacific",
          amount: "5,000억원",
          deadline: "2025-05-20",
          source: "https://www.nps.or.kr"
        },
        {
          institution: "사학연금공단",
          asset: "Infrastructure Debt",
          region: "OECD",
          amount: "1,200억원",
          deadline: "2025-03-25",
          source: "https://www.tp.or.kr"
        },
        {
          institution: "한국투자공사(KIC)",
          asset: "Opportunistic Real Estate",
          region: "Europe",
          amount: "3,000억원",
          deadline: "2025-06-15",
          source: "https://www.kic.kr"
        },
        {
          institution: "예금보험공사",
          asset: "Distressed Debt",
          region: "Global",
          amount: "1,500억원",
          deadline: "2025-04-30",
          source: "https://www.kdic.or.kr"
        },
        {
          institution: "군인연금공단",
          asset: "Infrastructure - Transportation",
          region: "APAC",
          amount: "900억원",
          deadline: "2025-02-15",
          source: "https://www.mps.mil.kr"
        }
      ],
      global: [
        {
          institution: "CalPERS",
          asset: "Infrastructure Debt",
          region: "US",
          amount: "$2.5B",
          deadline: "2025-03-30",
          source: "https://www.calpers.ca.gov"
        },
        {
          institution: "CPPIB",
          asset: "Private Equity Co-invest",
          region: "Global",
          amount: "CAD 4B",
          deadline: "2025-04-15",
          source: "https://www.cppinvestments.com"
        },
        {
          institution: "CalSTRS",
          asset: "Sustainable Real Estate",
          region: "North America",
          amount: "$1.8B",
          deadline: "2025-05-01",
          source: "https://www.calstrs.com"
        },
        {
          institution: "OMERS",
          asset: "Private Credit - Direct Lending",
          region: "Global",
          amount: "CAD 2.5B",
          deadline: "2025-03-20",
          source: "https://www.omers.com"
        },
        {
          institution: "New York State Common Retirement Fund",
          asset: "Emerging Market PE",
          region: "Emerging Markets",
          amount: "$3B",
          deadline: "2025-06-30",
          source: "https://www.osc.state.ny.us"
        },
        {
          institution: "Teacher Retirement System of Texas",
          asset: "Energy Transition Infrastructure",
          region: "Global",
          amount: "$2B",
          deadline: "2025-04-20",
          source: "https://www.trs.texas.gov"
        },
        {
          institution: "Washington State Investment Board",
          asset: "Core Plus Real Estate",
          region: "US & Europe",
          amount: "$1.5B",
          deadline: "2025-02-28",
          source: "https://www.sib.wa.gov"
        },
        {
          institution: "PGGM",
          asset: "Renewable Energy Infrastructure",
          region: "Europe & APAC",
          amount: "€2B",
          deadline: "2025-05-15",
          source: "https://www.pggm.nl"
        },
        {
          institution: "APG",
          asset: "Private Equity - Technology",
          region: "Global",
          amount: "€1.8B",
          deadline: "2025-03-31",
          source: "https://www.apg.nl"
        },
        {
          institution: "Ontario Teachers' Pension Plan",
          asset: "Infrastructure - Digital",
          region: "North America",
          amount: "CAD 3B",
          deadline: "2025-04-10",
          source: "https://www.otpp.com"
        },
        {
          institution: "CDPQ",
          asset: "Sustainable Infrastructure",
          region: "Global",
          amount: "CAD 2.2B",
          deadline: "2025-05-25",
          source: "https://www.cdpq.com"
        },
        {
          institution: "Future Fund (Australia)",
          asset: "Alternative Credit",
          region: "Asia Pacific",
          amount: "AUD 2B",
          deadline: "2025-06-01",
          source: "https://www.futurefund.gov.au"
        },
        {
          institution: "AustralianSuper",
          asset: "Infrastructure Equity - Core",
          region: "APAC & Europe",
          amount: "AUD 1.5B",
          deadline: "2025-03-15",
          source: "https://www.australiansuper.com"
        },
        {
          institution: "USS (UK)",
          asset: "Private Equity Secondaries",
          region: "Global",
          amount: "£1.5B",
          deadline: "2025-04-25",
          source: "https://www.uss.co.uk"
        },
        {
          institution: "BCI (British Columbia)",
          asset: "Real Estate - Value Add",
          region: "North America",
          amount: "CAD 1.8B",
          deadline: "2025-02-20",
          source: "https://www.bci.ca"
        },
        {
          institution: "SWFF (Swedish AP Funds)",
          asset: "Climate Infrastructure",
          region: "Global",
          amount: "SEK 15B",
          deadline: "2025-05-10",
          source: "https://www.ap1.se"
        },
        {
          institution: "GPIF (Japan)",
          asset: "ESG Real Assets",
          region: "Asia Pacific",
          amount: "¥300B",
          deadline: "2025-06-20",
          source: "https://www.gpif.go.jp"
        },
        {
          institution: "GIC (Singapore)",
          asset: "Private Equity - Healthcare",
          region: "Global",
          amount: "$2.5B",
          deadline: "2025-04-05",
          source: "https://www.gic.com.sg"
        },
        {
          institution: "Temasek",
          asset: "Venture Capital - Deep Tech",
          region: "Global",
          amount: "$1.2B",
          deadline: "2025-03-28",
          source: "https://www.temasek.com.sg"
        },
        {
          institution: "ADIA (Abu Dhabi)",
          asset: "Infrastructure - Energy",
          region: "Global",
          amount: "$3.5B",
          deadline: "2025-07-01",
          source: "https://www.adia.ae"
        }
      ]
    })
  };
}
