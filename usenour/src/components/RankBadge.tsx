import type { FC } from "react";

interface RankBadgeProps {
  rank?: string;
  title?: string;
  score?: number;
  size?: "sm" | "md" | "lg";
}

const RANK_COLORS: Record<string, string> = {
  R: "var(--primary)",
  D: "var(--text-muted)",
  C: "var(--primary)",
  B: "#3b82f6",
  A: "#f59e0b",
  S: "#ef4444",
};

const RankBadge: FC<RankBadgeProps> = ({ rank = "R", title = "Rookie", score, size = "md" }) => {
  const safeRank = rank || "R";
  const safeTitle = title || "Rookie";
  const color = RANK_COLORS[safeRank] || "var(--primary)";

  const sizeClass = `rank-badge rank-badge-${size}`;

  return (
    <div className={sizeClass} style={{ "--rank-color": color } as React.CSSProperties}>
      <span className="rank-letter">{safeRank}</span>
      <span className="rank-title">{safeTitle}</span>
      {score !== undefined && <span className="rank-score">{Math.round(score)} pts</span>}
    </div>
  );
};

export default RankBadge;
