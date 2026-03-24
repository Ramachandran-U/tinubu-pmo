/**
 * KpiCard - A reusable metric display card based on the design philosophy.
 * @param {string} title - Uppercase label
 * @param {string} value - The main large metric
 * @param {string} icon - Material Symbols icon name
 * @param {string} trend - Optional subtext under the value
 * @param {string} trendIcon - Optional icon for the subtext
 * @param {string} trendColor - Tailwind color class for the trend text
 * @param {boolean} highlight - If true, gives the label/icon an accent color
 */
export default function KpiCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendIcon, 
  trendColor = "text-emerald-600",
  highlight = false
}) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 shadow-sm flex flex-col gap-2 transition-all hover:bg-surface-bright">
      <div className={`flex items-center justify-between ${highlight ? 'text-primary' : 'text-on-surface-variant'}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
        {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
      </div>
      <div className="mt-1">
        <span className="text-3xl font-extrabold tracking-tight text-on-surface">{value}</span>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold mt-1 opacity-80 ${trendColor.replace('400', '600')}`}>
            {trendIcon && <span className="material-symbols-outlined text-xs">{trendIcon}</span>}
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}
