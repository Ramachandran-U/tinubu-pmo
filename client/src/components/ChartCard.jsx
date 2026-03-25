export default function ChartCard({ title, subtitle, children, className = "", stagger = 0 }) {
  return (
    <div
      className={`bg-surface-container-lowest p-6 rounded-lg shadow-sm border border-outline-variant/10 flex flex-col gap-5 card-hover animate-scale-fade ${className}`}
      style={stagger ? { animationDelay: `${stagger * 60}ms` } : undefined}
    >
      <div>
        <h3 className="text-base font-semibold tracking-tight text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
      <div className="relative flex-1">
        {children}
      </div>
    </div>
  );
}
