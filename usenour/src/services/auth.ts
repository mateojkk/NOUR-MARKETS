import { API_BASE_URL } from "../config/api";

const API_URL = API_BASE_URL;
const ADDR_KEY = "nour-auth-address";

export function getAuthToken(): string | null {
  return null; // Token is now handled via HttpOnly cookie
}

export function setAuthToken(_token: string, address: string) {
  // We no longer store the token in localStorage for security (XSS)
  localStorage.setItem(ADDR_KEY, address);
}

export function clearAuthToken() {
  localStorage.removeItem(ADDR_KEY);
  // Backend handles cookie deletion on /logout
}

export async function getNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
    credentials: 'include'
  });
  if (!res.ok) throw new Error("Failed to get nonce");
  return res.json();
}

export async function verifySignature(address: string, signature: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
    credentials: 'include'
  });
  if (!res.ok) throw new Error("Signature verification failed");
  const data = await res.json();
  return data.token;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  // Note: credentials: 'include' handles the cookie automatically
  const response = await fetch(input, { 
    ...init, 
    headers,
    credentials: 'include' // Send HttpOnly session cookie
  });
  
  if (response.status === 401) {
    console.warn("Unauthorized request (401), clearing token...");
    clearAuthToken();
    // Optional: reload to force re-auth flow if on a protected route
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
  
  return response;
}
