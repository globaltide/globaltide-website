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

    // 무료 번역: 처음 15개만 번역
    const itemsToTranslate = items.slice(0, 15);
    
    try {
      // Google Translate 무료 API 사용
      for (const item of itemsToTranslate) {
        try {
          const encodedText = encodeURIComponent(item.title);
          const translateUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" + encodedText;
          
          const translateRes = await fetch(translateUrl);
          const translateData = await translateRes.json();
          
          if (translateData && translateData[0] && translateData[0][0] && translateData[0][0][0]) {
            item.summary = translateData[0][0][0];
          } else {
            item.summary = item.title;
          }
          
          // API 레이트 리밋 방지 (100ms 대기)
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (translateError) {
          console.error("Translation error for item:", translateError);
          item.summary = item.title;
        }
      }
    } catch (apiError) {
      console.error("Translation API error:", apiError);
      // 번역 실패해도 원본 제목으로 계속 진행
      itemsToTranslate.forEach(item => {
        if (!item.summary) item.summary = item.title;
      });
    }

    // 나머지 아이템도 원본 제목 사용
    items.forEach(item => {
      if (!item.summary) {
        item.summary = item.title;
      }
    });

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
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
