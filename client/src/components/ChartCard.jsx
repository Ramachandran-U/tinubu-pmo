/**
 * ChartCard - Container for charts that match the bento-box aesthetic of KpiCard.
 */
export default function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-surface-container-lowest p-6 rounded-lg shadow-sm border border-outline-variant/10 flex flex-col gap-6 ${className}`}>
      <div>
        <h3 className="text-base font-semibold tracking-tight text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
      <div className="relative flex-1 opacity-95 hover:opacity-100 transition-opacity">
        {children}
      </div>
    </div>
  );
}
