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
      // Instant cache retrieval
      const cacheKey = `nour_profile_${address.toLowerCase()}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setProfileState(prev => ({ ...prev, ...parsed }));
        } catch {}
      }

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
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      }
    } catch (error) {
      console.warn("Notice: Profile API unreachable, maintaining local profile state.", error);
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
      // Optimistic update and save to localStorage
      const cacheKey = `nour_profile_${walletAddress.toLowerCase()}`;
      setProfileState(prev => {
        const nextProfile = { ...prev, ...updates };
        localStorage.setItem(cacheKey, JSON.stringify(nextProfile));
        return nextProfile;
      });

      // Also dispatch to API if endpoint is available
      const payload: Record<string, string | undefined> = {};
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      await authFetch(`${apiUrl}/api/user/${walletAddress}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});
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
