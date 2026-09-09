import { useState, useEffect, type FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import RankBadge from "./RankBadge";
import { API_BASE_URL } from "../config/api";

const API_URL = API_BASE_URL;

interface PublicProfile {
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string;
  rank: string;
  title: string;
  score: number;
  total_trades: number;
}

const ProfilePage: FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError("");
    fetch(`${API_URL}/api/user/username/${encodeURIComponent(username)}/public`)
      .then((res) => {
        if (!res.ok) throw new Error("User not found");
        return res.json();
      })
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <p>{error || "User not found"}</p>
          <button className="profile-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <button className="profile-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Avatar */}
        <div className="profile-avatar-section">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">
              <User size={32} />
            </div>
          )}
        </div>

        {/* Name & Username */}
        <h2 className="profile-name">{profile.display_name || "Anonymous"}</h2>
        {profile.username && (
          <p className="profile-username">@{profile.username}</p>
        )}

        {/* Rank Badge */}
        <RankBadge
          rank={profile.rank}
          title={profile.title}
          score={profile.score}
          size="lg"
        />

        {/* Bio */}
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.total_trades}</span>
            <span className="profile-stat-label">Trades</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{Math.round(profile.score)}</span>
            <span className="profile-stat-label">Score</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
