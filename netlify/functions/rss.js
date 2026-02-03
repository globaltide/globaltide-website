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
      
      // RSS description (요약문) 추출
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
      let description = descMatch ? descMatch[1] : "";
      
      // HTML 태그 제거 및 정리
      description = description
        .replace(/<[^>]+>/g, '') // HTML 태그 제거
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      
      // 첫 100자만 (너무 길면 자르기)
      if (description.length > 100) {
        description = description.substring(0, 100) + "...";
      }
      
      items.push({ title, link, pubDate, description });
    }

    // description을 번역
    const itemsToTranslate = items.slice(0, 15);
    
    try {
      for (const item of itemsToTranslate) {
        try {
          // description이 있으면 그것을 번역, 없으면 제목 번역
          const textToTranslate = item.description || item.title;
          const encodedText = encodeURIComponent(textToTranslate);
          const translateUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" + encodedText;
          
          const translateRes = await fetch(translateUrl);
          const translateData = await translateRes.json();
          
          if (translateData && translateData[0] && translateData[0][0] && translateData[0][0][0]) {
            item.summary = translateData[0][0][0];
          } else {
            item.summary = item.description || item.title;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (translateError) {
          console.error("Translation error:", translateError);
          item.summary = item.description || item.title;
        }
      }
    } catch (apiError) {
      console.error("Translation API error:", apiError);
      itemsToTranslate.forEach(item => {
        if (!item.summary) item.summary = item.description || item.title;
      });
    }

    items.forEach(item => {
      if (!item.summary) {
        item.summary = item.description || item.title;
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
