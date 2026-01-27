import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const months = Number(url.searchParams.get("months") || 6);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const from = new Date();
    from.setMonth(from.getMonth() - months - 1);
    const fromISO = from.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("market_snapshots")
      .select("*")
      .gte("snapshot_date", fromISO)
      .order("snapshot_date", { ascending: true });

    if (error) throw error;

    // 월별 마지막 값만 선택
    const byMonth = {};
    data.forEach(row => {
      const m = row.snapshot_date.slice(0, 7);
      byMonth[m] = row;
    });

    return new Response(
      JSON.stringify({
        items: Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, row]) => ({ month, row }))
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    );
  }
};
