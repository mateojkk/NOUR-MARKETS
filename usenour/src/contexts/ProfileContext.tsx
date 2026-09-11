import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { API_BASE_URL } from "../config/api";
import { useEvmWallet } from "./EvmWalletContext";
import { authFetch } from "../services/auth";

interface UserProfile {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
}

interface ProfileContextType {
  profile: UserProfile;
  isLoading: boolean;
  walletAddress: string | null;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  updateAvatar: (url: string) => Promise<void>;
  clearProfile: () => void;
}

const defaultProfile: UserProfile = {
  displayName: "",
  username: "",
  bio: "",
  avatarUrl: "",
};

const ProfileContext = createContext<ProfileContextType | null>(null);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { address, connected } = useEvmWallet();
  
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(false);

  // Get wallet address as string
  const walletAddress = address || null;
  const apiUrl = API_BASE_URL;

  // Load Profile from DB whenever connected and wallet address is known
  useEffect(() => {
    if (connected && walletAddress) {
      loadProfile(walletAddress);
    } else if (!connected) {
      setProfileState(defaultProfile);
    }
  }, [connected, walletAddress]);

  const loadProfile = async (address: string) => {
    try {
      setIsLoading(true);
      const normalizedAddress = address.toLowerCase();

      // 1. Direct fetch from Supabase Database (Never localStorage, instant & authoritative)
      try {
        const { getSupabaseClient } = await import("../services/supabaseClient");
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("users")
          .select("*")
          .eq("wallet_address", normalizedAddress)
          .maybeSingle();

        if (data && !error && (data.display_name || data.username || data.bio || data.avatar_url)) {
          setProfileState({
            displayName: data.display_name || "",
            username: data.username || "",
            bio: data.bio || "",
            avatarUrl: data.avatar_url || "",
          });
          return;
        }
      } catch (err) {
        console.warn("Direct Supabase profile fetch failed, trying API:", err);
      }

      // 2. Fallback to serverless API
      try {
        const res = await authFetch(`${apiUrl}/api/user/${address}/profile`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          if (data && (data.display_name || data.username || data.bio)) {
            setProfileState({
              displayName: data.display_name || "",
              username: data.username || "",
              bio: data.bio || "",
              avatarUrl: data.avatar_url || "",
            });
            return;
          }
        }
      } catch {}
    } catch (error) {
      console.warn("Notice: Profile fetch failed.", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!walletAddress) {
      console.warn("updateProfile: No wallet address, skipping save");
      return;
    }

    try {
      // 1. Functional state update so concurrent calls never lose data
      setProfileState((prev) => ({ ...prev, ...updates }));

      const payload: Record<string, string | undefined> = {};
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      // 2. Direct persistence to Supabase Database (strictly compliant with AGENTS.md rule)
      try {
        const { getSupabaseClient } = await import("../services/supabaseClient");
        const sb = getSupabaseClient();
        
        const upsertPayload: Record<string, any> = {
          wallet_address: walletAddress.toLowerCase(),
          updated_at: new Date().toISOString(),
        };
        if (payload.display_name !== undefined) upsertPayload.display_name = payload.display_name;
        if (payload.username !== undefined) upsertPayload.username = payload.username;
        if (payload.bio !== undefined) upsertPayload.bio = payload.bio;
        if (payload.avatar_url !== undefined) upsertPayload.avatar_url = payload.avatar_url;

        const { error: sbError } = await sb.from("users").upsert(upsertPayload, { onConflict: "wallet_address" });
        if (sbError) {
          console.error("Supabase profile upsert error:", sbError);
        }
      } catch (err) {
        console.error("Supabase client error:", err);
      }

      // 3. Also sync to backend serverless API
      authFetch(`${apiUrl}/api/user/${walletAddress}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (error) {
      console.error("Profile save error:", error);
    }
  };

  const setProfile = (newProfile: UserProfile) => {
    updateProfile(newProfile);
  };

  const updateDisplayName = async (name: string) => {
    await updateProfile({ displayName: name });
  };

  const updateUsername = async (username: string) => {
    await updateProfile({ username });
  };

  const updateBio = async (bio: string) => {
    await updateProfile({ bio });
  };

  const updateAvatar = async (url: string) => {
    await updateProfile({ avatarUrl: url });
  };

  const clearProfile = () => {
    setProfileState(defaultProfile);
  };

  return (
    <ProfileContext.Provider value={{ 
      profile, 
      isLoading,
      walletAddress,
      setProfile,
      updateProfile,
      updateDisplayName, 
      updateUsername,
      updateBio,
      updateAvatar,
      clearProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
};
