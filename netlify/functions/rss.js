exports.handler = async function () {
  try {
    const url = "https://news.google.com/rss?hl=en";
    const res = await fetch(url);
    const xml = await res.text();
    
    const items = [];
    const regex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [null, ""])[1];
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [null, ""])[1];
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [null, ""])[1];
      items.push({ title, link, pubDate });
    }

    // Claude API로 한글 요약 생성 (처음 10개만)
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const itemsToSummarize = items.slice(0, 10);
    
    if (ANTHROPIC_API_KEY) {
      try {
        // 뉴스 제목들을 모아서 한 번에 요청
        const titles = itemsToSummarize.map((item, idx) => {
          return (idx + 1) + ". " + item.title;
        }).join("\n");

        const prompt = "다음은 금융/경제 뉴스 제목들입니다. 각 제목을 한 줄(20-30자)로 한글 요약해주세요. 형식: '1. 요약'\n\n" + titles;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const summaryText = data.content[0].text;
          
          // 응답을 파싱 (1. 요약\n2. 요약\n...)
          const summaryLines = summaryText.split("\n").filter(line => line.trim());
          
          summaryLines.forEach((line, idx) => {
            if (idx < itemsToSummarize.length) {
              // "1. 요약내용" 형식에서 번호 제거
              const summary = line.replace(/^\d+\.\s*/, "").trim();
              itemsToSummarize[idx].summary = summary || itemsToSummarize[idx].title;
            }
          });
        }
      } catch (apiError) {
        console.error("Claude API error:", apiError);
        // API 실패해도 원본 제목으로 계속 진행
        itemsToSummarize.forEach(item => {
          item.summary = item.title;
        });
      }
    } else {
      // API 키 없으면 원본 제목 사용
      itemsToSummarize.forEach(item => {
        item.summary = item.title;
      });
    }

    // 요약이 없는 나머지 아이템도 원본 제목 사용
    items.forEach(item => {
      if (!item.summary) {
        item.summary = item.title;
      }
    });

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300" // 5분 캐시
      },
      body: JSON.stringify({ items }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.toString() }),
    };
  }
};
