import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { API_BASE_URL } from "../config/api";
import { useEvmWallet } from "./EvmWalletContext";
import { authFetch } from "../services/auth";

interface UserProfile {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  isBetaUser: boolean;
}

interface ProfileContextType {
  profile: UserProfile;
  isLoading: boolean;
  walletAddress: string | null;
  setProfile: (profile: UserProfile) => void;
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
  isBetaUser: true,
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
  const { address, connected, authenticated } = useEvmWallet();
  
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(false);

  // Get wallet address as string
  const walletAddress = address || null;
  const apiUrl = API_BASE_URL;

  // Load Profile from API once authenticated (not just connected)
  useEffect(() => {
    if (connected && walletAddress && authenticated) {
      loadProfile(walletAddress);
    } else if (!connected) {
      setProfileState(defaultProfile);
    }
  }, [connected, walletAddress, authenticated]);

  const loadProfile = async (address: string) => {
    try {
      setIsLoading(true);

      // 1. Try backend serverless API
      try {
        const res = await authFetch(`${apiUrl}/api/user/${address}/profile`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          const updated = {
            displayName: data.display_name || "",
            username: data.username || "",
            bio: data.bio || "",
            avatarUrl: data.avatar_url || "",
            isBetaUser: true,
          };
          setProfileState(updated);
          return;
        }
      } catch {}

      // 2. Direct fallback to Supabase Database (Never localStorage)
      try {
        const { getSupabaseClient } = await import("../services/supabaseClient");
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("users")
          .select("*")
          .eq("wallet_address", address.toLowerCase())
          .maybeSingle();
        if (data && !error) {
          setProfileState({
            displayName: data.display_name || "",
            username: data.username || "",
            bio: data.bio || "",
            avatarUrl: data.avatar_url || "",
            isBetaUser: true,
          });
        }
      } catch {}
    } catch (error) {
      console.warn("Notice: Profile fetch failed.", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (updates: Partial<UserProfile>) => {
    if (!walletAddress) {
      console.warn("saveProfile: No wallet address, skipping save");
      return;
    }
    
    try {
      const nextProfile = { ...profile, ...updates };
      setProfileState(nextProfile);

      const payload: Record<string, string | undefined> = {};
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      // 1. Dispatch to serverless API
      await authFetch(`${apiUrl}/api/user/${walletAddress}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});

      // 2. Direct persistence to Supabase Database (Never localStorage)
      try {
        const { getSupabaseClient } = await import("../services/supabaseClient");
        const sb = getSupabaseClient();
        await sb.from("users").upsert({
          wallet_address: walletAddress.toLowerCase(),
          ...(payload.display_name !== undefined ? { display_name: payload.display_name } : {}),
          ...(payload.username !== undefined ? { username: payload.username } : {}),
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.avatar_url !== undefined ? { avatar_url: payload.avatar_url } : {}),
          updated_at: new Date().toISOString()
        }, { onConflict: "wallet_address" });
      } catch {}
    } catch (error) {
      console.warn("Profile save warning:", error);
    }
  };

  const setProfile = (newProfile: UserProfile) => {
    setProfileState(newProfile);
    saveProfile(newProfile);
  };

  const updateDisplayName = async (name: string) => {
    await saveProfile({ displayName: name });
  };

  const updateUsername = async (username: string) => {
    await saveProfile({ username });
  };

  const updateBio = async (bio: string) => {
    await saveProfile({ bio });
  };

  const updateAvatar = async (url: string) => {
    await saveProfile({ avatarUrl: url });
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
