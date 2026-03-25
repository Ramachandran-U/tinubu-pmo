import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar } from 'react-chartjs-2';

// Heatmap color for hours-based cells
const getHoursColor = (hours) => {
  if (hours >= 200) return 'bg-red-500 text-white';
  if (hours >= 161) return 'bg-orange-400 text-white';
  if (hours >= 121) return 'bg-blue-600 text-white';
  if (hours >= 81)  return 'bg-blue-400 text-white';
  if (hours >= 1)   return 'bg-blue-100 text-blue-900';
  return '';
};

export default function Resources() {
  const { loadingInitial, isRefreshing, selectedMonths, groupBy, squadMap } = useData();
  const { req } = useApi();

  const [resources, setResources] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const [squadAllocation, setSquadAllocation] = useState([]);
  const [billableByLoc, setBillableByLoc] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterName, setFilterName] = useState('');
  const [filterSquad, setFilterSquad] = useState('');
  const [filterLoc, setFilterLoc] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [resData, roster, squadData, locData, squadList] = await Promise.all([
          req(`/resources${qs}`),
          req(`/analytics/resource-roster${qs}`),
          req(`/squads/allocation${qs}`),
          req('/squads/billable-by-location'),
          req('/squads/list')
        ]);
        setResources(resData || []);
        setRosterData(roster || []);
        setSquadAllocation(squadData || []);
        setBillableByLoc(locData || []);
        setSquads(squadList || []);
      } catch (err) {
        console.error("Failed to load resources", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  // Build multi-month roster with squad join
  const { rosterRows, rosterMonths } = useMemo(() => {
    const months = [...new Set(rosterData.map(r => r.yearMonth))].sort();
    const empMap = {};
    rosterData.forEach(r => {
      if (!empMap[r.employeeId]) {
        empMap[r.employeeId] = {
          employeeId: r.employeeId,
          fullName: r.fullName,
          department: r.department,
          designation: r.designation,
          location: r.location,
          entity: r.entity,
          months: {},
          grandTotal: 0,
          grandBillable: 0
        };
      }
      empMap[r.employeeId].months[r.yearMonth] = { total: r.totalHours, billable: r.billableHours };
      empMap[r.employeeId].grandTotal += r.totalHours;
      empMap[r.employeeId].grandBillable += r.billableHours;
    });
    const rows = Object.values(empMap).sort((a, b) => b.grandTotal - a.grandTotal);
    return { rosterRows: rows, rosterMonths: months };
  }, [rosterData]);

  // All derived data using useMemo MUST be before any early returns (Rules of Hooks)
  const uniqueLocs = useMemo(() =>
    [...new Set(resources.map(r => r.location))].filter(Boolean).sort(),
    [resources]
  );

  const filteredRoster = useMemo(() =>
    rosterRows.filter(r => {
      const matchName = !filterName || (r.fullName || '').toLowerCase().includes(filterName.toLowerCase());
      const matchLoc = !filterLoc || r.location === filterLoc;
      return matchName && matchLoc;
    }),
    [rosterRows, filterName, filterLoc]
  );

  // CSV Export
  const exportCSV = () => {
    const headers = ['Employee ID', 'Name', 'Squad', 'Location', ...rosterMonths.map(m => `${m} (Hrs)`), 'Grand Total', 'Billable', 'Utilization %'];
    const csvRows = filteredRoster.map(r => [
      r.employeeId,
      `"${r.fullName || ''}"`,
      `"${r.squad || ''}"`,
      `"${r.location || ''}"`,
      ...rosterMonths.map(m => r.months[m]?.total || 0),
      r.grandTotal.toFixed(1),
      r.grandBillable.toFixed(1),
      r.grandTotal > 0 ? Math.round((r.grandBillable / r.grandTotal) * 100) : 0
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-roster-${selectedMonths.join('_') || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingInitial || (loading && !isRefreshing && resources.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-slate-500">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Loading global resources...</p>
      </div>
    );
  }

  // --- Aggregate Local KPIs ---
  const activeEmps = resources.length;
  const totalHr = resources.reduce((acc, r) => acc + r.totalHours, 0);
  const totalBillHr = resources.reduce((acc, r) => acc + r.billableHours, 0);
  const avgBillable = totalHr > 0 ? Math.round((totalBillHr / totalHr) * 100) : 0;

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // --- Squad Allocation Chart ---
  const squadChartData = {
    labels: squadAllocation.map(s => s.squad || 'Unassigned'),
    datasets: [
      {
        label: 'Billable',
        data: squadAllocation.map(s => s.billableCount),
        backgroundColor: chartColors.primary,
        borderRadius: 4
      },
      {
        label: 'Non-Billable',
        data: squadAllocation.map(s => s.totalResources - s.billableCount),
        backgroundColor: chartColors.slate,
        borderRadius: 4
      }
    ]
  };

  // --- Billable by Location Chart ---
  const locChartData = {
    labels: billableByLoc.map(l => l.location),
    datasets: [
      {
        label: 'Billable',
        data: billableByLoc.map(l => l.billable),
        backgroundColor: '#2563eb'
      },
      {
        label: 'Non-Billable',
        data: billableByLoc.map(l => l.nonBillable),
        backgroundColor: '#94a3b8'
      }
    ]
  };

  return (
    <div className={`space-y-8 transition-opacity duration-300 ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Page Header */}
      <header className="flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
            <span>Core Platform</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">Resource Management</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Resource Intelligence</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Export CSV
          </button>
        </div>
      </header>

      {/* KPI Cards — removed Leading Department */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard title="Tracked Headcount" value={activeEmps.toLocaleString()} icon="groups" highlight />
        <KpiCard
          title="Avg Billability"
          value={`${avgBillable}%`}
          icon="verified"
          trend={`${fmtHr(totalBillHr)} billable hours`}
          trendIcon="payments"
        />
      </div>

      {/* Charts: Squad Allocation + Billable by Location */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Squad Allocation" subtitle="Resource distribution by squad (DU)">
          {squadAllocation.length > 0 ? (
            <Bar data={squadChartData} options={{
              ...commonOptions,
              plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true, padding: 12 } } },
              scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } }
              }
            }} />
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Upload Demand Capacity file to see squad data</div>
          )}
        </ChartCard>

        <ChartCard title="Billable vs Non-Billable by Location" subtitle="Resource allocation across locations">
          {billableByLoc.length > 0 ? (
            <Bar data={locChartData} options={{
              ...commonOptions,
              indexAxis: 'y',
              plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true, padding: 12 } } },
              scales: {
                x: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } },
                y: { stacked: true, grid: { display: false } }
              }
            }} />
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Upload Demand Capacity file to see location data</div>
          )}
        </ChartCard>
      </div>

      {/* Filters — Squad instead of Department */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Search Name</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant">search</span>
            <input
              type="text"
              placeholder="Type to filter by name..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg pl-10 pr-3 py-2 outline-none focus:border-primary transition-colors placeholder-on-surface-variant"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Squad</label>
          <select
            value={filterSquad}
            onChange={(e) => setFilterSquad(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors"
          >
            <option value="">All Squads</option>
            {squads.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Location</label>
          <select
            value={filterLoc}
            onChange={(e) => setFilterLoc(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors"
          >
            <option value="">All Locations</option>
            {uniqueLocs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Multi-Month Resource Roster Table with Heatmap */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-outline-variant/10">
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Multi-Month Resource Roster</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Showing {filteredRoster.length} of {rosterRows.length} employees across {rosterMonths.length} month{rosterMonths.length !== 1 ? 's' : ''}
            </p>
          </div>
          {loading && <span className="material-symbols-outlined text-sm text-slate-500 animate-spin">sync</span>}
        </div>

        {/* Heatmap Legend */}
        <div className="px-6 py-2 border-b border-outline-variant/10 flex items-center gap-3 text-[10px] text-on-surface-variant">
          <span className="font-bold uppercase tracking-wider">Heatmap:</span>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-100 rounded"></div> 1-80h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-400 rounded"></div> 81-120h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-600 rounded"></div> 121-160h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-orange-400 rounded"></div> 161-200h</div>
          <div className="flex items-center gap-1"><div className="w-4 h-3 bg-red-500 rounded"></div> 200h+</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/10">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-10">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{groupBy === 'squad' ? 'Squad' : 'Department'}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                {rosterMonths.map(m => (
                  <th key={m} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">{m}</th>
                ))}
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Total</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Util %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredRoster.map((r) => {
                const utilPct = r.grandTotal > 0 ? Math.round((r.grandBillable / r.grandTotal) * 100) : 0;
                return (
                  <tr key={r.employeeId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-surface-container-lowest z-10">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded bg-primary-fixed flex items-center justify-center text-[9px] font-bold text-primary">
                          {r.fullName ? r.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-on-surface">{r.fullName}</p>
                          <p className="text-[9px] text-on-surface-variant">{r.designation || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface">{groupBy === 'squad' ? (squadMap[r.employeeId] || '-') : r.department}</td>
                    <td className="px-4 py-3 text-xs text-on-surface">{r.location || '-'}</td>
                    {rosterMonths.map(m => {
                      const val = r.months[m]?.total || 0;
                      const heatColor = getHoursColor(val);
                      return (
                        <td key={m} className="px-1 py-1 text-center">
                          {val > 0 ? (
                            <div className={`rounded px-2 py-1 text-xs font-bold ${heatColor}`} title={`${fmtHr(val)}h (${r.months[m]?.billable ? Math.round((r.months[m].billable / val) * 100) : 0}% billable)`}>
                              {fmtHr(val)}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-xs text-right font-bold text-on-surface">{fmtHr(r.grandTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-12 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${utilPct > 75 ? 'bg-emerald-500' : utilPct > 40 ? 'bg-primary' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, utilPct)}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold">{utilPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRoster.length === 0 && !loading && (
                <tr>
                  <td colSpan={4 + rosterMonths.length} className="px-6 py-8 text-center text-sm text-on-surface-variant font-medium italic">
                    No data available for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
