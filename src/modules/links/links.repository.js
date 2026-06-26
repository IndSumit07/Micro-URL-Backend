/**
 * @file links.repository.js
 * @description Data-access layer (DAL) for the `links` table in Supabase.
 *
 * All database operations for links are isolated here.  Higher layers
 * (service) must NEVER import `supabase` directly — they go through this
 * repository.  This ensures:
 *  • A single place to change if we migrate databases.
 *  • Consistent error-propagation (raw Supabase errors bubble up to the
 *    service, which decides how to handle them).
 *  • Clear documentation of every query the module performs.
 *
 * Database columns (links table)
 * ───────────────────────────────
 *  id          UUID  PK default gen_random_uuid()
 *  short_code  TEXT  UNIQUE NOT NULL
 *  long_url    TEXT  NOT NULL
 *  title       TEXT
 *  user_id     UUID  FK → auth.users(id) ON DELETE CASCADE
 *  status      TEXT  DEFAULT 'active'
 *  click_count BIGINT DEFAULT 0
 *  expires_at  TIMESTAMPTZ
 *  created_at  TIMESTAMPTZ DEFAULT now()
 *  updated_at  TIMESTAMPTZ DEFAULT now()
 */

import supabase from "../../configs/supabase.js";

/** Name of the Supabase table this repository operates on. */
const TABLE = "links";

// ─────────────────────────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a new link record into the database.
 *
 * @param {object} linkData              - Fields to insert.
 * @param {string} linkData.short_code   - Unique short code.
 * @param {string} linkData.long_url     - Original long URL.
 * @param {string} [linkData.title]      - Optional human-readable title.
 * @param {string} [linkData.user_id]    - Optional owner user UUID.
 * @param {string} [linkData.expires_at] - Optional ISO expiry datetime.
 * @returns {Promise<object>}            The created link record.
 * @throws Supabase error (e.g. code `23505` on duplicate short_code).
 */
export async function createLink(linkData) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(linkData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Apply a partial update to a link by its primary-key ID.
 *
 * @param {string} id      - Link UUID.
 * @param {object} updates - Key-value pairs to update (partial, snake_case).
 * @returns {Promise<object>} The updated link record.
 * @throws Supabase error if the row doesn't exist or a constraint is violated.
 */
export async function updateLink(id, updates) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Hard-delete a link by its primary-key ID.
 *
 * @param {string} id - Link UUID.
 * @returns {Promise<void>}
 * @throws Supabase error on failure.
 */
export async function deleteLink(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a single link by its primary-key UUID.
 *
 * @param {string} id  - Link UUID.
 * @returns {Promise<object|null>} Link record or `null` if not found.
 * @throws Supabase error on query failure.
 */
export async function findById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Fetch a single link by its short code.
 *
 * @param {string} shortCode - The short code string (e.g. `aB3kZ`).
 * @returns {Promise<object|null>} Link record or `null` if not found.
 * @throws Supabase error on query failure.
 */
export async function findByShortCode(shortCode) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Fetch all links belonging to a given user, newest first.
 *
 * @param {string} userId              - Owner user UUID.
 * @param {object} [pagination]        - Optional pagination options.
 * @param {number} [pagination.page=1] - 1-based page number.
 * @param {number} [pagination.limit=20] - Records per page.
 * @returns {Promise<object[]>} Array of link records (may be empty).
 * @throws Supabase error on query failure.
 */
export async function findByUserId(userId, { page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return data ?? [];
}

/**
 * Increment the `click_count` column on a link by 1.
 *
 * This is a lightweight fire-and-forget operation; the redirect service
 * also queues a full analytics event asynchronously.
 *
 * @param {string} id - Link UUID.
 * @returns {Promise<void>}
 * @throws Supabase error on failure.
 */
export async function incrementClickCount(id) {
  const { error } = await supabase.rpc("increment_link_click_count", {
    link_id: id,
  });

  if (error) throw error;
}

/**
 * Count the total number of links owned by a user.
 *
 * @param {string} userId - Owner user UUID.
 * @returns {Promise<number>} Total count.
 * @throws Supabase error on failure.
 */
export async function countByUserId(userId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;

  return count ?? 0;
}
