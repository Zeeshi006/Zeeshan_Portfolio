interface SkProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Sk({ className = "", style }: SkProps) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
