import { useEvmWallet } from "../contexts/EvmWalletContext";
import { useState, useEffect, useRef, type FC } from "react";
import { 
  User, 
  LogOut, 
  Camera, 
  ChevronLeft, 
  Wallet, 
  Copy, 
  Check, 
  ExternalLink 
} from "lucide-react";
import { useProfile } from "../contexts/ProfileContext";

interface SettingsProps {
  onClose?: () => void;
  theme?: "light" | "dark";
  setTheme?: (theme: "light" | "dark") => void;
}

type SettingsView = "main" | "profile";

const Settings: FC<SettingsProps> = ({ onClose }) => {
  const { connected, disconnect } = useEvmWallet();
  const { profile, walletAddress, updateProfile, updateAvatar, clearProfile } = useProfile();
  
  // View State
  const [currentView, setCurrentView] = useState<SettingsView>("main");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile Edit State
  const [editName, setEditName] = useState(profile.displayName || "");
  const [editUsername, setEditUsername] = useState(profile.username?.replace('@nour.app', '') || "");
  const [editBio, setEditBio] = useState(profile.bio || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sync state whenever profile finishes loading from Supabase
  useEffect(() => {
    setEditName(profile.displayName || "");
    setEditUsername(profile.username ? profile.username.replace('@nour.app', '') : "");
    setEditBio(profile.bio || "");
  }, [profile.displayName, profile.username, profile.bio]);

  // Derived data
  const displayName = profile.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'User');
  const displayUsername = profile.username || (walletAddress ? `@${walletAddress.slice(0, 8)}.nour.app` : '');

  const navigateTo = (view: SettingsView) => {
    if (view === "profile") {
      setEditName(profile.displayName || "");
      setEditUsername(profile.username ? profile.username.replace('@nour.app', '') : "");
      setEditBio(profile.bio || "");
    }
    setSlideDirection("right");
    setCurrentView(view);
  };

  const navigateBack = () => {
    setSlideDirection("left");
    setCurrentView("main");
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openExplorer = () => {
    if (walletAddress) {
      window.open(`https://shannon-explorer.somnia.network/address/${walletAddress}`, '_blank');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let finalUsername = editUsername.trim().toLowerCase();
      if (finalUsername && !finalUsername.endsWith('@nour.app')) {
        finalUsername = `${finalUsername}@nour.app`;
      }
      await updateProfile({
        displayName: editName.trim(),
        username: finalUsername,
        bio: editBio.trim(),
      });
      navigateBack();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    clearProfile();
    disconnect();
    onClose?.();
  };

  // Settings only renders when connected (LoginPage handles unauthenticated)
  if (!connected) return null;

  // --- SUB-VIEWS ---

  const renderMainView = () => (
    <>
      {/* Header: User Info & Avatar */}
      <div className="settings-header">
        <div className="user-info">
          <span className="user-name">{displayName}</span>
          <span className="user-email">{displayUsername}</span>
          {profile.bio && <span className="user-bio">{profile.bio}</span>}
        </div>
        
        <div className="user-avatar-container">
          {profile.avatarUrl ? (
            <img className="user-avatar" src={profile.avatarUrl} alt="Profile" />
          ) : (
            <div className="user-avatar-placeholder">
              {displayName[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div className="settings-menu">
        <button className="menu-item" onClick={() => navigateTo("profile")}>
          <div className="menu-icon"><User size={18} /></div>
          <span className="menu-label">Profile</span>
          <div className="menu-icon"><ChevronLeft size={16} style={{transform: 'rotate(180deg)'}} /></div>
        </button>
      </div>

      {/* Divider */}
      <div className="settings-divider" />

      {/* Wallets Section */}
      <div className="settings-wallets">
        {walletAddress && (
          <div className="wallet-row">
            <div className="wallet-icon sol"><Wallet size={14} /></div>
            <div className="wallet-info">
              <span className="wallet-label">Somnia Shannon</span>
              <span className="wallet-address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </div>
            <div className="wallet-actions">
              <button className="icon-btn-small" onClick={copyAddress} title="Copy address">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button className="icon-btn-small" onClick={openExplorer} title="View on explorer">
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <button 
          className="menu-item danger" 
          onClick={handleDisconnect}
        >
          <div className="menu-icon"><LogOut size={18} /></div>
          <span className="menu-label">Disconnect</span>
        </button>
      </div>
    </>
  );

  const renderProfileView = () => (
    <>
      <div className="settings-header">
        <button className="settings-back-btn" onClick={navigateBack}>
          <ChevronLeft size={20} />
        </button>
        <span className="settings-title">Edit Profile</span>
        <div style={{width: 20}} />
      </div>

      <div className="settings-content">
        <div className="profile-edit-avatar">
          <div 
            className="user-avatar-large" 
            onClick={() => fileInputRef.current?.click()}
          >
           {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Profile" />
            ) : (
              <div className="user-avatar-placeholder large">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <div className="avatar-edit-overlay">
              <Camera size={20} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
          <span className="edit-hint">Tap to change</span>
        </div>

        <div className="form-group">
          <label>Display Name</label>
          <input 
            type="text" 
            className="settings-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div className="form-group">
          <label>Username</label>
          <div className="input-suffix-group">
            <input 
              type="text" 
              className="settings-input"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              placeholder="username"
            />
            <span className="input-suffix">@nour.app</span>
          </div>
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea 
            className="settings-input textarea"
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
          />
        </div>

        <button className="save-btn" onClick={handleSaveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Invisible overlay to handle click-outside */}
      <div className="settings-overlay" onClick={onClose} />

      <div className="settings-card">
        <div className={`settings-view ${slideDirection}`}>
          {currentView === 'main' ? renderMainView() : renderProfileView()}
        </div>
      </div>
    </>
  );
};

export default Settings;
