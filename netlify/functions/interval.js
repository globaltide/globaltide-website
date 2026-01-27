export async function handler(){
  return {
    statusCode:200,
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      stats:[
        {label:"US Interval Fund AUM",value:"$90B+"},
        {label:"Annual Growth Rate",value:"~20%"}
      ],
      news:[
        "Interval Funds increasingly used by RIAs",
        "Private Credit dominates new Interval launches"
      ],
      whitepapers:[
        {title:"BlackRock – Interval Fund Liquidity",url:"https://blackrock.com"},
        {title:"SEC – Interval Fund Regulation",url:"https://sec.gov"}
      ]
    })
  };
}
