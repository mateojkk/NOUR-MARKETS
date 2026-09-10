import { API_BASE_URL } from "../config/api";

const API_URL = API_BASE_URL;
const ADDR_KEY = "nour-auth-address";
const SESSION_TOKEN_KEY = "nour_session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

export function getAuthAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADDR_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(ADDR_KEY);
}

export function setAuthToken(token: string, address: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ADDR_KEY, address);
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ADDR_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

// Backend Session Sync (persists session to Supabase database)
export async function syncBackendSession(
  walletAddress: string,
  authMethod: "magic" | "injected"
): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: walletAddress, auth_method: authMethod }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.session_token) {
        saveSessionToken(data.session_token);
        return data.session_token;
      }
    }
  } catch (err) {
    console.warn("Could not sync session to backend:", err);
  }
  return null;
}

export async function validateBackendSession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/api/user/session?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      return Boolean(data?.valid);
    }
  } catch (err) {
    console.warn("Session validation error:", err);
  }
  return false;
}

export async function deleteBackendSession(token?: string): Promise<void> {
  const tokenToDelete = token || getSessionToken();
  if (!tokenToDelete) return;
  try {
    await fetch(`${API_URL}/api/user/session?token=${encodeURIComponent(tokenToDelete)}`, {
      method: "DELETE",
    });
  } catch {}
}

export async function getNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get nonce");
  return res.json();
}

export async function verifySignature(address: string, signature: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Signature verification failed");
  const data = await res.json();
  return data.token;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    console.warn("Unauthorized request (401), clearing session token...");
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return response;
}
