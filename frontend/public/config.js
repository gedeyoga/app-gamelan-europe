// Runtime API base URL. Overwritten at container start by
// docker-entrypoint.d/40-api-base-url.sh from the VITE_API_BASE_URL env var.
// Empty here so local dev falls back to import.meta.env.VITE_API_BASE_URL
// (Vite dev proxy /api -> localhost:3001).
window.__API_BASE_URL__ = ''
