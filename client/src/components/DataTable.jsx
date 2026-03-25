import { useState, useMemo } from 'react';

/**
 * DataTable - Reusable sortable/paginated dark-themed data table based on design.txt philosophy.
 * @param {Array<Object>} data 
 * @param {Array<Object>} columns - { key, label, render?, rightAlign? }
 */
export default function DataTable({ 
  title, 
  subtitle, 
  data = [], 
  columns = [],
  isLoading = false
}) {
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false); // default desc for metric tables usually
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      // Basic numeric vs string sort
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortAsc]);

  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-outline-variant/10 animate-fade-in">
      {(title || subtitle) && (
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h3 className="text-lg font-bold text-on-surface">{title}</h3>
            {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
          </div>
          {isLoading && (
            <span className="material-symbols-outlined text-sm text-slate-500 animate-spin">sync</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant/10">
              {columns.map(col => (
                <th 
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors ${col.rightAlign ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${col.rightAlign ? 'justify-end' : ''}`}>
                    {col.label}
                    {sortKey === col.key && (
                      <span className="material-symbols-outlined text-[10px]">
                        {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {sortedData.map((row, i) => (
              <tr key={i} className="hover:bg-surface-container-low/50 transition-colors group animate-fade-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                {columns.map(col => (
                  <td key={col.key} className={`px-6 py-4 ${col.rightAlign ? 'text-right' : ''}`}>
                    {col.render ? col.render(row, row[col.key]) : (
                      <span className="text-sm text-on-surface font-semibold">{row[col.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && !isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-on-surface-variant font-medium italic">
                  No data available for the selected period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
