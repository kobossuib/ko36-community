// Secrets are deliberately absent from wrangler vars and committed config.
interface Env {
  GITHUB_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  IP_HASH_SECRET?: string;
}
