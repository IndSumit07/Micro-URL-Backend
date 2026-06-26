import supabase from "../../configs/supabase.js";

const TABLE = "clicks";

export async function getClicksByUserId(userId, days = 7) {
  const dateStr = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Supabase does not support joining easily from a non-foreign key without views sometimes,
  // but `clicks` has `link_id`, and `links` has `user_id`.
  // Wait, `clicks` doesn't have `user_id`. We have to join with `links`.
  const { data, error } = await supabase
    .from("clicks")
    .select(`
      *,
      links!inner(user_id, title, short_code)
    `)
    .eq("links.user_id", userId)
    .gte("clicked_at", dateStr);

  if (error) throw error;
  return data || [];
}

export async function getOverviewStats(userId) {
  // Aggregate using the RPC or just fetch and compute in JS for simplicity
  // since the DB might be small right now.
  const { data, error } = await supabase
    .from("clicks")
    .select(`
      ip_address,
      device_type,
      links!inner(user_id, title, short_code)
    `)
    .eq("links.user_id", userId);

  if (error) throw error;
  return data || [];
}
