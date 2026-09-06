interface PageHeaderProps {
  index: string;
  title: string;
  action?: React.ReactNode;
}

export function PageHeader({ index, title, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8">
      <div>
        <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
          {index}
        </span>
        <h1 className="text-h2 sm:text-display-l font-display text-text-hi mt-1">{title}</h1>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
