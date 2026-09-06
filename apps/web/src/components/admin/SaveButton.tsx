interface SaveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children?: React.ReactNode;
}

export function SaveButton({ loading, children = "Save", disabled, className = "", ...rest }: SaveButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`inline-flex items-center gap-2 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 hover:bg-signal-dim active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all ${className}`}
      {...rest}
    >
      {loading && (
        <span className="inline-block w-3 h-3 border-2 border-signal-ink/40 border-t-signal-ink rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
