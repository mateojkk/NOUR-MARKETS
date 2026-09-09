import { useEvmWallet } from "../contexts/EvmWalletContext";
import { useState, useEffect, useRef, type FC } from "react";
import { 
  User, 
  Bell, 
  Settings2, 
  LogOut, 
  Camera, 
  Sparkles,
  Zap,
  Twitter,
  ChevronLeft,
  Moon,
  Sun,
  Eye,
  EyeOff,
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

type SettingsView = "main" | "profile" | "preferences";

const Settings: FC<SettingsProps> = ({ onClose, theme, setTheme }) => {
  const { connected, disconnect } = useEvmWallet();
  const { profile, walletAddress, updateDisplayName, updateUsername, updateBio, updateAvatar, clearProfile } = useProfile();
  
  // View State
  const [currentView, setCurrentView] = useState<SettingsView>("main");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [copied, setCopied] = useState(false);

  // Preferences State
  const [notifications, setNotifications] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  
  // Profile Edit State
  const [editName, setEditName] = useState(profile.displayName || "");
  const [editUsername, setEditUsername] = useState(profile.username?.replace('@nour.app', '') || "");
  const [editBio, setEditBio] = useState(profile.bio || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Derived data
  const displayName = profile.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'User');
  const displayUsername = profile.username || (walletAddress ? `@${walletAddress.slice(0, 8)}.nour.app` : '');

  useEffect(() => {
    const savedNotifications = localStorage.getItem("nour-notifications") !== "false";
    const savedHideBalances = localStorage.getItem("nour-hide-balances") === "true";
    setNotifications(savedNotifications);
    setHideBalances(savedHideBalances);
  }, []);

  const navigateTo = (view: SettingsView) => {
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

  const toggleNotifications = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem("nour-notifications", String(newValue));
  };
  
  const toggleHideBalances = () => {
    const newValue = !hideBalances;
    setHideBalances(newValue);
    localStorage.setItem("nour-hide-balances", String(newValue));
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

  const handleSaveProfile = () => {
    if (editName.trim()) updateDisplayName(editName.trim());
    
    let finalUsername = editUsername.trim().toLowerCase();
    if (finalUsername && !finalUsername.endsWith('@nour.app')) {
      finalUsername = `${finalUsername}@nour.app`;
    }
    updateUsername(finalUsername);
    
    updateBio(editBio.trim());
    navigateBack();
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
        
        <button className="menu-item" onClick={() => window.open('https://t.me/trynour', '_blank')}>
          <div className="menu-icon"><Sparkles size={18} /></div>
          <span className="menu-label">Community</span>
        </button>
        
        <button className="menu-item">
            <div className="menu-icon"><Zap size={18} /></div>
            <span className="menu-label">Mode</span>
            <span className="menu-badge beta">Beta</span>
        </button>

        <button className="menu-item" onClick={() => navigateTo("preferences")}>
          <div className="menu-icon"><Settings2 size={18} /></div>
          <span className="menu-label">Preferences</span>
          <div className="menu-icon"><ChevronLeft size={16} style={{transform: 'rotate(180deg)'}} /></div>
        </button>

        <button className="menu-item" onClick={() => window.open('https://x.com/nourterminal', '_blank')}>
          <div className="menu-icon"><Twitter size={18} /></div>
          <span className="menu-label">Updates</span>
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

        <button className="save-btn" onClick={handleSaveProfile}>
          Save Changes
        </button>
      </div>
    </>
  );

  const renderPreferencesView = () => (
    <>
      <div className="settings-header">
        <button className="settings-back-btn" onClick={navigateBack}>
          <ChevronLeft size={20} />
        </button>
        <span className="settings-title">Preferences</span>
        <div style={{width: 20}} />
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-label">Appearance</div>
          <div className="theme-toggle-row">
            <button 
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme?.('light')}
            >
              <Sun size={18} />
              <span>Light</span>
            </button>
            <button 
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme?.('dark')}
            >
              <Moon size={18} />
              <span>Dark</span>
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-label">Privacy</div>
          <button className="menu-item" onClick={toggleHideBalances}>
            <div className="menu-icon">
              {hideBalances ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
            <span className="menu-label">Hide Balances</span>
            <div className={`menu-toggle ${hideBalances ? 'on' : ''}`} />
          </button>
        </div>

        <div className="settings-section">
          <div className="section-label">System</div>
          <button className="menu-item" onClick={toggleNotifications}>
            <div className="menu-icon"><Bell size={18} /></div>
            <span className="menu-label">Notifications</span>
            <div className={`menu-toggle ${notifications ? 'on' : ''}`} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Invisible overlay to handle click-outside */}
      <div className="settings-overlay" onClick={onClose} />

      <div className="settings-card">
        <div className={`settings-view ${slideDirection}`}>
          {    
             currentView === 'main' ? renderMainView() :
             currentView === 'profile' ? renderProfileView() :
             renderPreferencesView()
          }
        </div>
      </div>
    </>
  );
};

export default Settings;
