import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Line } from 'react-chartjs-2';

const palette = ['#004ac6', '#10b981', '#943700', '#2563eb', '#ba1a1a', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

// Heatmap color for hours-based cells
const getHoursColor = (hours) => {
  if (hours >= 200) return 'bg-red-500 text-white';
  if (hours >= 161) return 'bg-orange-400 text-white';
  if (hours >= 121) return 'bg-blue-600 text-white';
  if (hours >= 81)  return 'bg-blue-400 text-white';
  if (hours >= 1)   return 'bg-blue-100 text-blue-900';
  return '';
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

export default function People() {
  const { loadingInitial, isRefreshing, selectedMonths, availableMonths, groupBy, squadMap } = useData();
  const { req } = useApi();

  const [resources, setResources] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const [squadAllocation, setSquadAllocation] = useState([]);
  const [billableByLoc, setBillableByLoc] = useState([]);
  const [squads, setSquads] = useState([]);
  const [burnoutData, setBurnoutData] = useState({ employees: [], history: [] });
  const [employeeTrend, setEmployeeTrend] = useState([]);
  const [prodIndex, setProdIndex] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterName, setFilterName] = useState('');
  const [filterSquad, setFilterSquad] = useState('');
  const [filterLoc, setFilterLoc] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      const allQs = availableMonths.length > 0 ? `?months=${availableMonths.join(',')}` : qs;

      try {
        const [resData, roster, squadData, locData, squadList, burnout, empTrend, prod] = await Promise.all([
          req(`/resources${qs}`),
          req(`/analytics/resource-roster${qs}`),
          req(`/squads/allocation${qs}`),
          req('/squads/billable-by-location'),
          req('/squads/list'),
          req('/analytics/burnout-risk'),
          req(`/analytics/employee-trend${allQs}`),
          req(`/analytics/productivity-index${allQs}`)
        ]);
        setResources(resData || []);
        setRosterData(roster || []);
        setSquadAllocation(squadData || []);
        setBillableByLoc(locData || []);
        setSquads(squadList || []);
        setBurnoutData(burnout || { employees: [], history: [] });
        setEmployeeTrend(empTrend || []);
        setProdIndex(prod || []);
      } catch (err) { console.error("People fetch error", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req, availableMonths]);

  // Roster
  const { rosterRows, rosterMonths } = useMemo(() => {
    const months = [...new Set(rosterData.map(r => r.yearMonth))].sort();
    const empMap = {};
    rosterData.forEach(r => {
      if (!empMap[r.employeeId]) {
        empMap[r.employeeId] = { employeeId: r.employeeId, fullName: r.fullName, department: r.department, designation: r.designation, location: r.location, entity: r.entity, months: {}, grandTotal: 0, grandBillable: 0 };
      }
      empMap[r.employeeId].months[r.yearMonth] = { total: r.totalHours, billable: r.billableHours };
      empMap[r.employeeId].grandTotal += r.totalHours;
      empMap[r.employeeId].grandBillable += r.billableHours;
    });
    return { rosterRows: Object.values(empMap).sort((a, b) => b.grandTotal - a.grandTotal), rosterMonths: months };
  }, [rosterData]);

  const uniqueLocs = useMemo(() => [...new Set(resources.map(r => r.location))].filter(Boolean).sort(), [resources]);
  const filteredRoster = useMemo(() => rosterRows.filter(r => {
    const matchName = !filterName || (r.fullName || '').toLowerCase().includes(filterName.toLowerCase());
    const matchLoc = !filterLoc || r.location === filterLoc;
    return matchName && matchLoc;
  }), [rosterRows, filterName, filterLoc]);

  // Employee Trend
  const empMonths = useMemo(() => [...new Set(employeeTrend.map(d => d.yearMonth))].sort(), [employeeTrend]);
  const empRows = useMemo(() => {
    const empMap = {};
    employeeTrend.forEach(d => {
      if (!empMap[d.employeeId]) empMap[d.employeeId] = { id: d.employeeId, name: d.fullName, dept: d.department, months: {} };
      empMap[d.employeeId].months[d.yearMonth] = d.totalHours;
    });
    return Object.values(empMap).map(e => {
      const vals = empMonths.map(m => e.months[m] || 0);
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      let status = 'healthy';
      if (avg > 160) status = 'at_risk'; else if (avg > 130) status = 'high'; else if (avg < 40) status = 'bench'; else if (avg < 80) status = 'under';
      return { ...e, vals, avg, status };
    }).sort((a, b) => b.avg - a.avg);
  }, [employeeTrend, empMonths]);

  // Productivity
  const prodMonths = useMemo(() => [...new Set(prodIndex.map(d => d.yearMonth))].sort(), [prodIndex]);
  const prodChartData = useMemo(() => {
    const deptMap = {};
    prodIndex.forEach(d => { if (!deptMap[d.department]) deptMap[d.department] = {}; deptMap[d.department][d.yearMonth] = d.productivityIndex; });
    const topDepts = Object.entries(deptMap).sort((a, b) => {
      const aA = Object.values(a[1]).reduce((s, v) => s + v, 0) / Object.values(a[1]).length;
      const bA = Object.values(b[1]).reduce((s, v) => s + v, 0) / Object.values(b[1]).length;
      return bA - aA;
    }).slice(0, 8);
    return {
      labels: prodMonths,
      datasets: [
        ...topDepts.map(([dept], i) => ({ label: dept.length > 18 ? dept.substring(0, 18) + '...' : dept, data: prodMonths.map(m => deptMap[dept]?.[m] ?? null), borderColor: palette[i % palette.length], tension: 0.3, spanGaps: true, pointRadius: 3 })),
        { label: 'Target (7.5h)', data: prodMonths.map(() => 7.5), borderColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0, borderWidth: 1 }
      ]
    };
  }, [prodIndex, prodMonths]);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Employee ID', 'Name', groupBy === 'squad' ? 'Squad' : 'Department', 'Location', ...rosterMonths.map(m => `${m} (Hrs)`), 'Total', 'Billable', 'Util %'];
    const csvRows = filteredRoster.map(r => [
      r.employeeId, `"${r.fullName || ''}"`, `"${groupBy === 'squad' ? (squadMap[r.employeeId] || '') : (r.department || '')}"`, `"${r.location || ''}"`,
      ...rosterMonths.map(m => r.months[m]?.total || 0), r.grandTotal.toFixed(1), r.grandBillable.toFixed(1),
      r.grandTotal > 0 ? Math.round((r.grandBillable / r.grandTotal) * 100) : 0
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `people-roster-${selectedMonths.join('_') || 'all'}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (loadingInitial || (loading && !isRefreshing && resources.length === 0)) {
    return <div className="flex flex-col items-center justify-center p-16 h-full text-slate-500"><span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span><p>Loading people data...</p></div>;
  }

  const activeEmps = resources.length;
  const totalHr = resources.reduce((a, r) => a + r.totalHours, 0);
  const totalBillHr = resources.reduce((a, r) => a + r.billableHours, 0);
  const avgBillable = totalHr > 0 ? Math.round((totalBillHr / totalHr) * 100) : 0;
  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  const squadChartData = {
    labels: squadAllocation.map(s => s.squad || 'Unassigned'),
    datasets: [
      { label: 'Billable', data: squadAllocation.map(s => s.billableCount), backgroundColor: chartColors.primary, borderRadius: 4 },
      { label: 'Non-Billable', data: squadAllocation.map(s => s.totalResources - s.billableCount), backgroundColor: chartColors.slate, borderRadius: 4 }
    ]
  };

  const locChartData = {
    labels: billableByLoc.map(l => l.location),
    datasets: [
      { label: 'Billable', data: billableByLoc.map(l => l.billable), backgroundColor: '#2563eb' },
      { label: 'Non-Billable', data: billableByLoc.map(l => l.nonBillable), backgroundColor: '#94a3b8' }
    ]
  };

  const statusBadge = (s) => {
    const map = { at_risk: { label: 'At Risk', cls: 'bg-red-50 text-red-700 border-red-200' }, high: { label: 'High Load', cls: 'bg-amber-50 text-amber-700 border-amber-200' }, healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }, under: { label: 'Under', cls: 'bg-orange-50 text-orange-700 border-orange-200' }, bench: { label: 'Bench', cls: 'bg-slate-100 text-slate-600 border-slate-200' } };
    const b = map[s] || map.healthy;
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${b.cls}`}>{b.label}</span>;
  };

  const riskColors = { critical: 'bg-red-100 text-red-700 border-red-200', high: 'bg-amber-100 text-amber-700 border-amber-200', elevated: 'bg-orange-100 text-orange-700 border-orange-200', watch: 'bg-blue-100 text-blue-700 border-blue-200' };

  return (
    <div className={`space-y-10 transition-opacity duration-300 ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      <header>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Workforce Intelligence</h3>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">People</h1>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Tracked Headcount" value={activeEmps.toLocaleString()} icon="groups" highlight />
        <KpiCard title="Avg Billability" value={`${avgBillable}%`} icon="verified" trend={`${fmtHr(totalBillHr)} billable hours`} trendIcon="payments" />
        <KpiCard title="Burnout Flags" value={burnoutData.employees.length.toString()} icon="local_fire_department" trend={burnoutData.employees.filter(e => e.riskLevel === 'critical').length + ' critical'} />
      </div>

      {/* ═══ SECTION: Resource Allocation ═══ */}
      <CollapsibleSection title="Resource Allocation" icon="pie_chart">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Squad Allocation" subtitle="Resource distribution by squad (Project)">
            {squadAllocation.length > 0 ? (
              <Bar data={squadChartData} options={{ ...commonOptions, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true, padding: 12 } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Upload Demand Capacity file</div>}
          </ChartCard>
          <ChartCard title="Billable vs Non-Billable by Location" subtitle="Resource allocation across locations">
            {billableByLoc.length > 0 ? (
              <Bar data={locChartData} options={{ ...commonOptions, indexAxis: 'y', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true, padding: 12 } } }, scales: { x: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } }, y: { stacked: true, grid: { display: false } } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Upload Demand Capacity file</div>}
          </ChartCard>
        </div>
      </CollapsibleSection>

      {/* ═══ SECTION: Workforce Health ═══ */}
      <CollapsibleSection title="Workforce Health" icon="health_and_safety">
        {/* Burnout Risk */}
        {burnoutData.employees.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['critical', 'Critical', 'bg-red-50 border-red-200 text-red-600'], ['high', 'High', 'bg-amber-50 border-amber-200 text-amber-600'], ['elevated', 'Elevated', 'bg-orange-50 border-orange-200 text-orange-600'], ['watch', 'Watch', 'bg-blue-50 border-blue-200 text-blue-600']].map(([level, label, cls]) => (
                <div key={level} className={`p-4 rounded-lg border ${cls}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest">{label} Risk</p>
                  <p className="text-2xl font-extrabold mt-1">{burnoutData.employees.filter(e => e.riskLevel === level).length}</p>
                </div>
              ))}
            </div>
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
              <div className="p-6 border-b border-outline-variant/10">
                <h3 className="text-sm font-bold text-on-surface">Burnout Risk Register</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead><tr className="bg-surface-container">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Employee</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Department</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Latest Hrs</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Avg Hrs</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Trend</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Risk</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Reason</th>
                  </tr></thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {burnoutData.employees.map((e, i) => {
                      const hist = burnoutData.history.filter(h => h.employeeId === e.employeeId).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
                      return (
                        <tr key={i} className="hover:bg-surface-container-low/50">
                          <td className="px-4 py-3 font-semibold">{e.fullName}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{e.department}</td>
                          <td className={`px-4 py-3 text-right font-bold ${e.latestHours > 160 ? 'text-red-600' : ''}`}>{fmtHr(e.latestHours)}</td>
                          <td className="px-4 py-3 text-right font-bold">{fmtHr(e.avgHours)}</td>
                          <td className="px-4 py-3"><div className="flex items-center justify-center gap-0.5">{hist.map((h, j) => <div key={j} className={`w-3 rounded-sm ${h.totalHours > 160 ? 'bg-red-500' : h.totalHours > 130 ? 'bg-amber-400' : 'bg-blue-300'}`} style={{ height: `${Math.min(24, Math.max(4, h.totalHours / 10))}px` }} title={`${h.yearMonth}: ${fmtHr(h.totalHours)}h`}></div>)}</div></td>
                          <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${riskColors[e.riskLevel] || ''}`}>{e.riskLevel}</span></td>
                          <td className="px-4 py-3 text-on-surface-variant">{e.riskReason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-emerald-500 mb-3 block">check_circle</span>
            <p className="text-sm font-bold text-on-surface">No Burnout Risks Detected</p>
            <p className="text-xs text-on-surface-variant mt-1">All employees are within healthy workload thresholds.</p>
          </div>
        )}

        {/* Employee Utilization Trend */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="text-sm font-bold text-on-surface">Employee Utilization Trend</h3>
            <p className="text-xs text-on-surface-variant mt-1">Rolling average across {empMonths.length} months. {empRows.length} employees.</p>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10"><tr className="bg-surface-container">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-20">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dept</th>
                {empMonths.map(m => <th key={m} className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">{m}</th>)}
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Avg</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {empRows.slice(0, 50).map(e => (
                  <tr key={e.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-2.5 font-semibold sticky left-0 bg-surface-container-lowest z-10">{e.name}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{e.dept}</td>
                    {e.vals.map((v, i) => <td key={i} className={`px-3 py-2.5 text-right font-semibold ${v > 160 ? 'text-red-600' : v > 130 ? 'text-amber-600' : v > 0 ? '' : 'text-slate-300'}`}>{v > 0 ? fmtHr(v) : '-'}</td>)}
                    <td className="px-4 py-2.5 text-right font-bold">{fmtHr(e.avg)}</td>
                    <td className="px-4 py-2.5 text-center">{statusBadge(e.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Productivity Index */}
        <ChartCard title="Productivity Index Trend" subtitle="Hours logged per present day (target: 7.5h/day)" className="h-[400px]">
          {prodMonths.length > 0 ? (
            <Line data={prodChartData} options={{ ...commonOptions, plugins: { legend: { position: 'right', labels: { font: { size: 10 }, usePointStyle: true, padding: 8 } } }, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, title: { display: true, text: 'Hours / Present Day' } } } }} />
          ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
        </ChartCard>
      </CollapsibleSection>

      {/* ═══ SECTION: Resource Roster ═══ */}
      <CollapsibleSection title="Resource Roster" icon="table_chart">
        {/* Filters */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Search Name</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant">search</span>
              <input type="text" placeholder="Type to filter..." value={filterName} onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg pl-10 pr-3 py-2 outline-none focus:border-primary transition-colors placeholder-on-surface-variant" />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Squad</label>
            <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors">
              <option value="">All Squads</option>
              {squads.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Location</label>
            <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors">
              <option value="">All Locations</option>
              {uniqueLocs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={exportCSV} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded flex items-center gap-2 hover:opacity-90"><span className="material-symbols-outlined text-lg">download</span>CSV</button>
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant px-2">
          <span className="font-bold uppercase tracking-wider">Heatmap:</span>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-100 rounded"></div> 1-80h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-400 rounded"></div> 81-120h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-600 rounded"></div> 121-160h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-orange-400 rounded"></div> 161-200h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-red-500 rounded"></div> 200h+</div>
        </div>

        {/* Roster Table */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">{filteredRoster.length} of {rosterRows.length} employees, {rosterMonths.length} months</p>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10"><tr className="bg-surface-container border-b border-outline-variant/10">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-20">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{groupBy === 'squad' ? 'Squad' : 'Department'}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                {rosterMonths.map(m => <th key={m} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">{m}</th>)}
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Total</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Util %</th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredRoster.map(r => {
                  const utilPct = r.grandTotal > 0 ? Math.round((r.grandBillable / r.grandTotal) * 100) : 0;
                  return (
                    <tr key={r.employeeId} className="hover:bg-surface-container-low/50">
                      <td className="px-4 py-3 sticky left-0 bg-surface-container-lowest z-10">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded bg-primary-fixed flex items-center justify-center text-[9px] font-bold text-primary">{r.fullName ? r.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'}</div>
                          <div><p className="text-xs font-semibold">{r.fullName}</p><p className="text-[9px] text-on-surface-variant">{r.designation || ''}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{groupBy === 'squad' ? (squadMap[r.employeeId] || '-') : r.department}</td>
                      <td className="px-4 py-3 text-xs">{r.location || '-'}</td>
                      {rosterMonths.map(m => {
                        const val = r.months[m]?.total || 0;
                        return <td key={m} className="px-1 py-1 text-center">{val > 0 ? <div className={`rounded px-2 py-1 text-xs font-bold ${getHoursColor(val)}`}>{fmtHr(val)}</div> : <span className="text-xs text-slate-300">-</span>}</td>;
                      })}
                      <td className="px-4 py-3 text-xs text-right font-bold">{fmtHr(r.grandTotal)}</td>
                      <td className="px-4 py-3 text-right"><div className="flex items-center gap-1.5 justify-end"><div className="w-12 h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div className={`h-full rounded-full ${utilPct > 75 ? 'bg-emerald-500' : utilPct > 40 ? 'bg-primary' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, utilPct)}%` }}></div></div><span className="text-[10px] font-bold">{utilPct}%</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
