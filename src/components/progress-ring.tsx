"use client";

/**
 * Circular progress ring with gradient color based on score.
 * 0-40% red, 40-70% yellow, 70-100% green — smooth HSL transition.
 */

interface ProgressRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

function scoreToColor(score: number): string {
  // HSL hue: 0 (red) → 45 (yellow/amber) → 145 (green)
  let hue: number;
  if (score <= 40) {
    hue = (score / 40) * 45; // 0 → 45
  } else if (score <= 70) {
    hue = 45 + ((score - 40) / 30) * 55; // 45 → 100
  } else {
    hue = 100 + ((score - 70) / 30) * 45; // 100 → 145
  }
  return `hsl(${hue}, 75%, 50%)`;
}

function scoreToTrackColor(score: number): string {
  let hue: number;
  if (score <= 40) {
    hue = (score / 40) * 45;
  } else if (score <= 70) {
    hue = 45 + ((score - 40) / 30) * 55;
  } else {
    hue = 100 + ((score - 70) / 30) * 45;
  }
  return `hsl(${hue}, 20%, 90%)`;
}

export default function ProgressRing({
  score,
  size = 80,
  strokeWidth = 6,
  showLabel = true,
  label,
  className = "",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const color = scoreToColor(score);
  const trackColor = scoreToTrackColor(score);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>
            {score}%
          </span>
          {label && (
            <span className="text-[9px] text-gray-400 leading-tight">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

export { scoreToColor };
