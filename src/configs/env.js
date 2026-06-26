import "dotenv/config";

const required = [
  "PORT",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_JWKS_URL",
  "REDIS_URL",
  "BASE_URL",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  port: process.env.PORT,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL,
  redisUrl: process.env.REDIS_URL,
  baseUrl: process.env.BASE_URL,
};
