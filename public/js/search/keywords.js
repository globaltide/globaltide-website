import { client } from "./config.js";

export async function listKeywords(userId){
  const { data, error } = await client
    .from('user_search_keywords')
    .select('id, keyword, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending:false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function addKeyword(userId, keyword){
  const kw = (keyword || '').trim();
  if (!kw) throw new Error('키워드를 입력하세요.');

  // 중복 체크
  const { data: ex, error: exErr } = await client
    .from('user_search_keywords')
    .select('id')
    .eq('user_id', userId)
    .eq('keyword', kw)
    .limit(1);

  if (exErr) throw new Error(exErr.message);
  if (ex && ex.length) throw new Error('이미 등록된 키워드입니다.');

  const { error } = await client
    .from('user_search_keywords')
    .insert([{ user_id: userId, keyword: kw }]);

  if (error) throw new Error(error.message);
}

export async function deleteKeyword(userId, keywordId){
  const { error } = await client
    .from('user_search_keywords')
    .delete()
    .eq('id', keywordId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
