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
      const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || block.match(/<title>([\s\S]*?)<\/title>/) || [null, null, ""])[2] || (block.match(/<title>([\s\S]*?)<\/title>/) || [null, ""])[1];
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [null, ""])[1];
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [null, ""])[1];
      
      items.push({ 
        title: cleanText(title), 
        link, 
        pubDate 
      });
    }

    // 제목만 간단하게 번역 (빠르고 깔끔)
    const itemsToTranslate = items.slice(0, 15);
    
    try {
      for (const item of itemsToTranslate) {
        try {
          const encodedText = encodeURIComponent(item.title);
          const translateUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" + encodedText;
          
          const translateRes = await fetch(translateUrl);
          const translateData = await translateRes.json();
          
          if (translateData && translateData[0] && translateData[0][0] && translateData[0][0][0]) {
            let translated = translateData[0][0][0];
            
            // 후처리
            translated = translated
              .replace(/\s*-\s*[A-Za-z\s]+$/, '') // 출처 제거 (예: "- CNN", "- The New York Times")
              .replace(/^"(.*)"$/, '$1') // 따옴표 제거
              .trim();
            
            item.summary = translated;
          } else {
            item.summary = item.title;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (translateError) {
          console.error("Translation error:", translateError);
          item.summary = item.title;
        }
      }
    } catch (apiError) {
      console.error("Translation API error:", apiError);
      itemsToTranslate.forEach(item => {
        if (!item.summary) item.summary = item.title;
      });
    }

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

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // CDATA 제거
    .replace(/<[^>]+>/g, '') // HTML 태그 제거
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
