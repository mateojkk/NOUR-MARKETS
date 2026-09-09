const rawApiUrl = import.meta.env.VITE_API_URL;
const apiBase = rawApiUrl && rawApiUrl.trim() !== "" ? rawApiUrl.replace(/\/$/, "") : "";

const rawWsUrl = import.meta.env.VITE_WS_URL;
const wsUrl = rawWsUrl && rawWsUrl.trim() !== "" ? rawWsUrl : "";

export const API_BASE_URL = apiBase;
export const API_WS_URL = wsUrl;
