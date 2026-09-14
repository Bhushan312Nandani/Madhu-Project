// src/utils/api.js
import axios from "axios";

export const RAW_API = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/api\/?$/, "");
export const API_BASE = `${RAW_API}/api`;

/**
 * Returns a safe user id from localStorage.
 * Looks for userSession (JSON) or uid/raw string fallback.
 */
export function getUserIdFromLocal() {
  try {
    const rawSession = localStorage.getItem("userSession");
    const rawUid = localStorage.getItem("uid");
    const raw = rawSession ?? rawUid ?? null;
    if (!raw) return "guest";

    if (typeof raw === "string" && raw.trim().startsWith("{")) {
      const u = JSON.parse(raw);
      return String(u?.id ?? u?.userId ?? u?.email ?? "guest");
    }
    return String(raw);
  } catch (e) {
    return "guest";
  }
}

// shared axios client
const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// request interceptor injects userId as query param and x-user-id header
client.interceptors.request.use((config) => {
  try {
    const uid = getUserIdFromLocal() || "guest";
    config.params = config.params || {};
    config.params.userId = uid;
    config.headers = config.headers || {};
    config.headers["x-user-id"] = uid;
  } catch (e) {
    // ignore
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export function apiClient() {
  return client;
}
export default client;
