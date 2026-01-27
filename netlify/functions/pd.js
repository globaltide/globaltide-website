// netlify/functions/pd.js
// Private Debt Market API

exports.handler = async function(event, context) {
  try {
    // Generate monthly deal data for the past 12 months
    const generateMonthlyDeals = () => {
      const months = [];
      const dealCounts = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      
      for (let i = 11; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        const year = currentDate.getFullYear() - (currentMonth - i < 0 ? 1 : 0);
        
        months.push({
          month: monthNames[monthIndex],
          year: year
        });
        
        // Generate realistic deal counts (80-130 deals per month)
        const deals = Math.floor(Math.random() * 50) + 80;
        dealCounts.push(deals);
      }
      
      return { months, dealCounts };
    };

    // Generate SEC Filings data
    const generateSECFilings = () => {
      const filings = [
        {
          company: "Ares Capital Corporation",
          cik: "0001287750",
          formType: "10-Q",
          filedDate: "2026-01-20",
          description: "Quarterly Report",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001287750"
        },
        {
          company: "Blackstone Private Credit Fund",
          cik: "0001823913",
          formType: "Form D",
          filedDate: "2026-01-18",
          description: "Private Securities Offering",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001823913"
        },
        {
          company: "Blue Owl Credit Income Corp.",
          cik: "0001823622",
          formType: "8-K",
          filedDate: "2026-01-15",
          description: "Current Report",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001823622"
        },
        {
          company: "Golub Capital BDC Inc.",
          cik: "0001539550",
          formType: "497",
          filedDate: "2026-01-12",
          description: "Definitive Materials",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001539550"
        },
        {
          company: "FS KKR Capital Corp.",
          cik: "0001422183",
          formType: "N-CSR",
          filedDate: "2026-01-10",
          description: "Annual Report to Shareholders",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001422183"
        },
        {
          company: "Sixth Street Specialty Lending",
          cik: "0001432353",
          formType: "10-K",
          filedDate: "2026-01-08",
          description: "Annual Report",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001432353"
        },
        {
          company: "Oaktree Specialty Lending",
          cik: "0001414932",
          formType: "Form D/A",
          filedDate: "2026-01-05",
          description: "Amended Private Offering",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001414932"
        },
        {
          company: "Apollo Debt Solutions BDC",
          cik: "0001880596",
          formType: "485BPOS",
          filedDate: "2026-01-03",
          description: "Post-Effective Amendment",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001880596"
        },
        {
          company: "Capital Southwest Corporation",
          cik: "0000015109",
          formType: "10-Q",
          filedDate: "2025-12-30",
          description: "Quarterly Report",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000015109"
        },
        {
          company: "Main Street Capital Corporation",
          cik: "0001396440",
          formType: "8-K",
          filedDate: "2025-12-28",
          description: "Current Report",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001396440"
        }
      ];

      return filings;
    };

    const dealData = generateMonthlyDeals();
    const totalDeals = dealData.dealCounts.reduce((sum, count) => sum + count, 0);

    const response = {
      marketOverview: {
        strategy: "Senior Direct Lending",
        totalDeals12M: totalDeals,
        description: "Senior Direct Lending 시장은 지난 12개월간 상당한 성장을 보였습니다. 이 차트는 월별 거래 흐름의 분포를 시각화하여 시장의 활발한 대출 환경을 보여줍니다.",
        dealHistory: dealData.months.map((m, i) => ({
          date: `${m.year}-${String(dealData.months.findIndex(x => x.month === m.month) + 1).padStart(2, '0')}`,
          month: m.month,
          year: m.year,
          deals: dealData.dealCounts[i]
        }))
      },
      secFilings: generateSECFilings(),
      lastUpdated: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error in PD function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
