import { cn } from "@/lib/utils";

const iconBase = "inline-block flex-shrink-0";

// ── Stars (difficulty) ──
export function StarFilled({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

export function StarEmpty({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

// ── Difficulty stars row ──
export function DifficultyStars({ value, max = 5, className }: { value: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) =>
        i < value
          ? <StarFilled key={i} className="text-amber-400" />
          : <StarEmpty key={i} className="text-gray-300" />
      )}
    </span>
  );
}

// ── Clickable difficulty stars ──
export function DifficultyStarsClickable({
  value, onChange, max = 5, className
}: { value: number; onChange: (v: number) => void; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i + 1)}
          className="transition-colors hover:scale-110"
          title={`難度 ${i + 1}`}
        >
          {i < value
            ? <StarFilled className="text-amber-400" />
            : <StarEmpty className="text-gray-300 hover:text-amber-300" />
          }
        </button>
      ))}
    </span>
  );
}

// ── Bookmark / Favorite ──
export function BookmarkFilled({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
  );
}

export function BookmarkEmpty({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
  );
}

// ── Flag / Mark ──
export function FlagFilled({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3a1 1 0 011-1h.5a.5.5 0 01.5.5V4h10.382a1 1 0 01.894 1.447L14.236 9l1.54 3.553A1 1 0 0114.882 14H5v4.5a.5.5 0 01-.5.5H4a1 1 0 01-1-1V3z" />
    </svg>
  );
}

export function FlagEmpty({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v15m0-12h12.382a1 1 0 01.894 1.447L14.236 9l2.04 2.553A1 1 0 0115.382 14H3" />
    </svg>
  );
}

// ── Note / Pencil ──
export function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.586 3.586a2 2 0 112.828 2.828l-8.793 8.793a2 2 0 01-.874.51l-3.088.882a.5.5 0 01-.621-.621l.882-3.088a2 2 0 01.51-.874l8.793-8.793z" />
      <path strokeLinecap="round" d="M11.5 5.5l3 3" />
    </svg>
  );
}

// ── Correct / Wrong ──
export function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-5 h-5", className)} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

export function XCircle({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-5 h-5", className)} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

// ── Arrows ──
export function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 011.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
    </svg>
  );
}

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
    </svg>
  );
}

// ── Sparkle ──
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.937 2.25a.75.75 0 0 1 .713.526l1.258 3.895a4.5 4.5 0 0 0 2.871 2.871l3.895 1.258a.75.75 0 0 1 0 1.425l-3.895 1.258a4.5 4.5 0 0 0-2.871 2.871l-1.258 3.895a.75.75 0 0 1-1.425 0l-1.258-3.895a4.5 4.5 0 0 0-2.871-2.871L.488 11.475a.75.75 0 0 1 0-1.425l3.895-1.258a4.5 4.5 0 0 0 2.871-2.871L8.512 2.776a.75.75 0 0 1 .713-.526ZM18.75 6a.75.75 0 0 1 .705.497l.567 1.578c.21.583.682 1.055 1.265 1.265l1.578.567a.75.75 0 0 1 0 1.41l-1.578.567a2.25 2.25 0 0 0-1.265 1.265l-.567 1.578a.75.75 0 0 1-1.41 0l-.567-1.578a2.25 2.25 0 0 0-1.265-1.265l-1.578-.567a.75.75 0 0 1 0-1.41l1.578-.567a2.25 2.25 0 0 0 1.265-1.265l.567-1.578A.75.75 0 0 1 18.75 6Z" />
    </svg>
  );
}

// ── Copy / Clipboard ──
export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Warning ──
export function Warning({ className }: { className?: string }) {
  return (
    <svg className={cn(iconBase, "w-4 h-4", className)} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}
