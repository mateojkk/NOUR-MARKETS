/**
 * Auth Button Component
 *
 * Shows a compact profile/disconnect button when connected.
 * Login is handled by LoginPage (email OTP via Magic SDK or injected wallet).
 */
import { useEvmWallet } from '../contexts/EvmWalletContext';
import { User, Wallet } from 'lucide-react';
import { useProfile } from '../contexts/ProfileContext';

export default function AuthButton({ onClick }: { onClick?: () => void }) {
  const { address, connected, connecting } = useEvmWallet();
  const { profile } = useProfile();

  // Still loading/connecting
  if (connecting) {
    return (
      <button className="auth-button loading" disabled>
        <div className="spinner-small" />
      </button>
    );
  }

  // Not connected
  if (!connected || !address) {
    return (
      <button
        onClick={onClick}
        className="auth-button"
      >
        <Wallet size={16} />
        <span>Login</span>
      </button>
    );
  }

  const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const displayName = profile.displayName || truncatedAddress;

  return (
    <button
      className="auth-button authenticated"
      onClick={onClick}
    >
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt={displayName}
          className="auth-avatar"
          style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : profile.displayName ? (
        <User size={16} />
      ) : (
        <Wallet size={16} />
      )}
      <span className="auth-name">{displayName}</span>
    </button>
  );
}
