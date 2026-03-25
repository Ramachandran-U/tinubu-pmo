import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar } from 'react-chartjs-2';

const palette = ['#004ac6', '#10b981', '#943700', '#2563eb', '#ba1a1a', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

function linearForecast(values) {
  const n = values.length;
  if (n < 2) return null;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b) / n;
  const num = values.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0);
  const den = values.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0);
  if (den === 0) return yMean;
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return Math.max(0, intercept + slope * n);
}

// Heatmap color helper
const getHeatmapColor = (pct) => {
  if (pct >= 100) return 'bg-red-500 text-white';
  if (pct >= 85)  return 'bg-blue-500 text-white';
  if (pct >= 70)  return 'bg-blue-200 text-blue-900';
  if (pct >= 50)  return 'bg-blue-50 text-blue-800';
  if (pct > 0)    return 'bg-surface-container-highest text-outline';
  return 'bg-surface-container text-slate-300';
};

function CollapsibleSection({ title, icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 w-full text-left group">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface flex-1">{title}</h2>
        <span className={`material-symbols-outlined text-slate-400 group-hover:text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && <div className="space-y-6">{children}</div>}
    </div>
  );
}

export default function Analytics() {
  const { loadingInitial, isRefreshing, selectedMonths, availableMonths } = useData();
  const { req } = useApi();
  const [loading, setLoading] = useState(true);

  const [entityData, setEntityData] = useState([]);
  const [nonBillable, setNonBillable] = useState({ byTask: [], byDeptMonth: [], deptTotals: [] });
  const [deptRanking, setDeptRanking] = useState([]);
  const [deptHeatmap, setDeptHeatmap] = useState([]);
  const [locationUtil, setLocationUtil] = useState([]);
  const [rankMetric, setRankMetric] = useState('totalHours');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const allQs = availableMonths.length > 0 ? `?months=${availableMonths.join(',')}` : '';
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [entity, nb, ranking, deptHm, loc] = await Promise.all([
          req(`/analytics/entity-billing${allQs}`),
          req(`/analytics/non-billable${qs}`),
          req(`/analytics/dept-ranking${allQs}`),
          req(`/analytics/dept-heatmap${allQs}`),
          req(`/analytics/location-utilization${allQs}`)
        ]);
        setEntityData(entity || []);
        setNonBillable(nb || { byTask: [], byDeptMonth: [], deptTotals: [] });
        setDeptRanking(ranking || []);
        setDeptHeatmap(deptHm || []);
        setLocationUtil(loc || []);
      } catch (err) { console.error("Analytics fetch error", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req, availableMonths]);

  // All useMemo before early return
  const { heatmapDepts, heatmapMonths, heatmapGrid } = useMemo(() => {
    const months = [...new Set(deptHeatmap.map(d => d.yearMonth))].sort();
    const depts = [...new Set(deptHeatmap.map(d => d.department))].sort();
    const grid = {};
    deptHeatmap.forEach(d => { if (!grid[d.department]) grid[d.department] = {}; grid[d.department][d.yearMonth] = d; });
    return { heatmapDepts: depts, heatmapMonths: months, heatmapGrid: grid };
  }, [deptHeatmap]);

  if (loadingInitial || (loading && entityData.length === 0)) {
    return <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant"><span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span><p>Loading analytics...</p></div>;
  }

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // Entity
  const entityMonths = [...new Set(entityData.map(d => d.yearMonth))].sort();
  const entities = [...new Set(entityData.map(d => d.entity))].filter(Boolean);
  const entityChartData = {
    labels: entities.map(e => e.length > 20 ? e.substring(0, 20) + '...' : e),
    datasets: entityMonths.map((m, i) => ({ label: m, data: entities.map(e => entityData.find(d => d.entity === e && d.yearMonth === m)?.billableHours || 0), backgroundColor: palette[i % palette.length], borderRadius: 4 }))
  };

  // Non-Billable
  const nbTaskData = {
    labels: nonBillable.byTask.slice(0, 8).map(t => t.taskName.length > 18 ? t.taskName.substring(0, 18) + '...' : t.taskName),
    datasets: [{ label: 'Hours', data: nonBillable.byTask.slice(0, 8).map(t => t.hours), backgroundColor: palette, borderRadius: 4 }]
  };

  // Dept Ranking
  const rankMonths = [...new Set(deptRanking.map(d => d.yearMonth))].sort();
  const latestRankMonth = rankMonths[rankMonths.length - 1];
  const latestRanking = deptRanking.filter(d => d.yearMonth === latestRankMonth).sort((a, b) => b[rankMetric] - a[rankMetric]).slice(0, 12);
  const rankChartData = {
    labels: latestRanking.map(d => d.department.length > 20 ? d.department.substring(0, 20) + '...' : d.department),
    datasets: [{ label: rankMetric === 'totalHours' ? 'Total Hours' : rankMetric === 'billableHours' ? 'Billable Hours' : 'Utilization %', data: latestRanking.map(d => d[rankMetric]), backgroundColor: latestRanking.map((_, i) => palette[i % palette.length]), borderRadius: 4 }]
  };

  // Location
  const locMonths = [...new Set(locationUtil.map(d => d.yearMonth))].sort();
  const locations = [...new Set(locationUtil.map(d => d.location))].filter(Boolean);
  const locChartData = {
    labels: locations,
    datasets: locMonths.map((m, i) => ({ label: m, data: locations.map(l => locationUtil.find(d => d.location === l && d.yearMonth === m)?.totalHours || 0), backgroundColor: palette[i % palette.length], borderRadius: 4 }))
  };

  // Forecast
  const forecastDepts = [...new Set(deptRanking.map(d => d.department))].filter(Boolean).slice(0, 8);
  const forecastData = forecastDepts.map(dept => {
    const vals = rankMonths.map(m => deptRanking.find(d => d.department === dept && d.yearMonth === m)?.totalHours || 0);
    return { dept, vals, projected: linearForecast(vals) };
  });

  return (
    <div className={`space-y-10 transition-opacity duration-300 w-full ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      <header>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Comparative Analysis</h3>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Analytics</h1>
      </header>

      {/* ═══ Entity & Finance ═══ */}
      <CollapsibleSection title="Entity & Finance" icon="apartment">
        {entities.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Entities</p><p className="text-2xl font-extrabold text-on-surface mt-1">{entities.length}</p></div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Billable</p><p className="text-2xl font-extrabold text-emerald-600 mt-1">{fmtHr(entityData.reduce((s, d) => s + d.billableHours, 0))}</p></div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Avg Billability</p><p className="text-2xl font-extrabold text-primary mt-1">{(() => { const t = entityData.reduce((s, d) => s + d.totalHours, 0); const b = entityData.reduce((s, d) => s + d.billableHours, 0); return t > 0 ? Math.round(b / t * 100) : 0; })()}%</p></div>
          </div>
        )}
        <ChartCard title="Entity-Level Billing Performance" subtitle="Billable hours by legal entity" className="h-[400px]">
          {entities.length > 0 ? <Bar data={entityChartData} options={{ ...commonOptions, plugins: { legend: { position: 'top' } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
        </ChartCard>
        <DataTable title="Entity Billing Detail" data={entityData.map(d => ({ ...d, billabilityPct: d.billabilityPct + '%' }))} columns={[
          { key: 'entity', label: 'Entity' }, { key: 'yearMonth', label: 'Month' }, { key: 'headcount', label: 'HC', rightAlign: true },
          { key: 'totalHours', label: 'Total Hrs', rightAlign: true, render: (_, v) => <span className="font-bold">{fmtHr(v)}</span> },
          { key: 'billableHours', label: 'Billable', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{fmtHr(v)}</span> },
          { key: 'billabilityPct', label: 'Billability', rightAlign: true }
        ]} />

        {/* Non-Billable */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Non-Billable by Task" subtitle="Top tasks consuming non-billable hours" className="h-[350px]">
            {nonBillable.byTask.length > 0 ? <Bar data={nbTaskData} options={{ ...commonOptions, indexAxis: 'y', plugins: { legend: { display: false } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
          </ChartCard>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
            <h3 className="text-sm font-bold text-on-surface mb-4">Non-Billable by Department</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {nonBillable.deptTotals.slice(0, 12).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{d.department}</p><div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-error rounded-full" style={{ width: `${d.pct}%` }}></div></div><span className="text-[10px] font-bold text-on-surface-variant">{d.pct}%</span></div></div>
                  <span className="text-xs font-bold text-error">{fmtHr(d.nonBillable)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ Department & Location ═══ */}
      <CollapsibleSection title="Department & Location" icon="corporate_fare">
        {/* Dept Ranking */}
        <div className="space-y-4">
          <div className="flex gap-2">
            {[['totalHours', 'Total Hours'], ['billableHours', 'Billable Hours'], ['utilizationPct', 'Utilization %']].map(([key, label]) => (
              <button key={key} onClick={() => setRankMetric(key)} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${rankMetric === key ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{label}</button>
            ))}
          </div>
          <ChartCard title={`Department Ranking — ${latestRankMonth || ''}`} subtitle="Top 12 departments" className="h-[400px]">
            {latestRanking.length > 0 ? <Bar data={rankChartData} options={{ ...commonOptions, indexAxis: 'y', plugins: { legend: { display: false } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
          </ChartCard>
        </div>

        {/* Dept Heatmap */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="text-lg font-bold text-on-surface">Department Utilization Heatmap</h3>
            <p className="text-xs text-on-surface-variant mt-1">Utilization % per department per month (160h FTE).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="bg-surface-container">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-10 min-w-[200px]">Department</th>
                {heatmapMonths.map(m => <th key={m} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center min-w-[80px]">{m}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {heatmapDepts.map(dept => (
                  <tr key={dept} className="hover:bg-surface-container-low/30">
                    <td className="px-4 py-2.5 font-semibold sticky left-0 bg-surface-container-lowest z-10 border-r border-outline-variant/10">{dept}</td>
                    {heatmapMonths.map(m => {
                      const cell = heatmapGrid[dept]?.[m]; const pct = cell?.utilizationPct || 0;
                      return <td key={m} className="px-1 py-1 text-center"><div className={`rounded px-2 py-1.5 text-[11px] font-bold ${getHeatmapColor(pct)}`} title={`${dept} — ${m}: ${pct}%`}>{pct > 0 ? `${pct}%` : '-'}</div></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-outline-variant/10 flex items-center gap-4 text-[10px] text-on-surface-variant">
            <span className="font-bold uppercase tracking-wider">Legend:</span>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-surface-container-highest rounded"></div> &lt;50%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-50 rounded"></div> 50-70%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-200 rounded"></div> 70-85%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-500 rounded"></div> 85-100%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-red-500 rounded"></div> &gt;100%</div>
          </div>
        </div>

        {/* Location Utilization */}
        <ChartCard title="Location Utilization" subtitle="Total hours by location" className="h-[400px]">
          {locations.length > 0 ? <Bar data={locChartData} options={{ ...commonOptions, plugins: { legend: { position: 'top' } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
        </ChartCard>
        <DataTable title="Location Detail" data={locationUtil} columns={[
          { key: 'location', label: 'Location' }, { key: 'yearMonth', label: 'Month' }, { key: 'headcount', label: 'HC', rightAlign: true },
          { key: 'totalHours', label: 'Total', rightAlign: true, render: (_, v) => <span className="font-bold">{fmtHr(v)}</span> },
          { key: 'billableHours', label: 'Billable', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{fmtHr(v)}</span> },
          { key: 'utilizationPct', label: 'Util %', rightAlign: true, render: (_, v) => <span className={`font-bold ${v >= 85 ? 'text-emerald-600' : v >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span> }
        ]} />
      </CollapsibleSection>

      {/* ═══ Forecasting ═══ */}
      <CollapsibleSection title="Forecasting" icon="auto_graph">
        <ChartCard title="Capacity Forecast" subtitle={`Based on ${rankMonths.length} months. Dashed = projected.`} className="h-[400px]">
          {forecastData.length > 0 ? (
            <Bar data={{ labels: [...rankMonths, 'Next Month'], datasets: forecastData.slice(0, 6).map((fd, i) => ({ label: fd.dept.length > 18 ? fd.dept.substring(0, 18) + '...' : fd.dept, data: [...fd.vals, fd.projected], backgroundColor: [...fd.vals.map(() => palette[i % palette.length]), palette[i % palette.length] + '60'], borderRadius: 4 })) }} options={{ ...commonOptions, plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } } }} />
          ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Need more data</div>}
        </ChartCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {forecastData.slice(0, 8).map((fd, i) => (
            <div key={i} className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider truncate">{fd.dept}</p>
              <p className="text-xl font-extrabold text-on-surface mt-1">{fd.projected ? `~${Math.round(fd.projected)}h` : 'N/A'}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
