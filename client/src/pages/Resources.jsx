import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { chartColors, commonOptions, donutOptions } from '../charts/chart-config';
import { Bar, Doughnut } from 'react-chartjs-2';

export default function Resources() {
  const { loadingInitial, isRefreshing, selectedMonths } = useData();
  const { req } = useApi();

  const [resources, setResources] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const [charts, setCharts] = useState({ deps: [], locs: {} });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterName, setFilterName] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLoc, setFilterLoc] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [resData, depsData, locsData, roster] = await Promise.all([
          req(`/resources${qs}`),
          req(`/charts/departments${qs}`),
          req(`/charts/locations${qs}`),
          req(`/analytics/resource-roster${qs}`)
        ]);
        setResources(resData || []);
        setCharts({ deps: depsData || [], locs: locsData || {} });
        setRosterData(roster || []);
      } catch (err) {
        console.error("Failed to load resources", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  // Build multi-month roster from per-employee-per-month data
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

  // CSV Export
  const exportCSV = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Location', ...rosterMonths.map(m => `${m} (Hrs)`), 'Grand Total', 'Billable', 'Utilization %'];
    const csvRows = rosterRows.filter(r => {
      const matchName = !filterName || (r.fullName || '').toLowerCase().includes(filterName.toLowerCase());
      const matchDept = !filterDept || r.department === filterDept;
      const matchLoc = !filterLoc || r.location === filterLoc;
      return matchName && matchDept && matchLoc;
    }).map(r => [
      r.employeeId,
      `"${r.fullName || ''}"`,
      `"${r.department || ''}"`,
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
  const topDept = charts.deps.length > 0 ? charts.deps[0].department : 'N/A';

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // --- Filtering Logic ---
  const uniqueDepts = [...new Set(resources.map(r => r.department))].filter(Boolean).sort();
  const uniqueLocs = [...new Set(resources.map(r => r.location))].filter(Boolean).sort();

  const filteredRoster = rosterRows.filter(r => {
    const matchName = !filterName || (r.fullName || '').toLowerCase().includes(filterName.toLowerCase());
    const matchDept = !filterDept || r.department === filterDept;
    const matchLoc = !filterLoc || r.location === filterLoc;
    return matchName && matchDept && matchLoc;
  });

  // --- Chart Setup ---
  const deptData = {
    labels: charts.deps.map(d => d.department.substring(0, 15)),
    datasets: [{
      label: 'Hours',
      data: charts.deps.map(d => d.hours),
      backgroundColor: chartColors.secondary,
      borderRadius: 4
    }]
  };

  const locLabels = Object.keys(charts.locs);
  const locCounts = Object.values(charts.locs);
  const hasLocData = locLabels.length > 0;
  const locColors = [chartColors.primary, chartColors.emerald, chartColors.tertiary, chartColors.slate, chartColors.error];

  const locData = {
    labels: locLabels,
    datasets: [{
      data: locCounts,
      backgroundColor: locColors.slice(0, locLabels.length),
      borderWidth: 0
    }]
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
          <button className="px-4 py-2 bg-surface-container-low text-on-surface text-sm font-semibold rounded hover:bg-surface-container-high transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            Advanced Filters
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Tracked Headcount" value={activeEmps.toLocaleString()} icon="groups" highlight />
        <KpiCard
          title="Avg Billability"
          value={`${avgBillable}%`}
          icon="verified"
          trend={`${fmtHr(totalBillHr)} billable hours`}
          trendIcon="payments"
        />
        <KpiCard title="Leading Department" value={topDept} icon="corporate_fare" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Department Allocation" subtitle="Top 10 departments by effort" className="lg:col-span-2">
          {charts.deps.length > 0 ? (
            <Bar data={deptData} options={{ ...commonOptions, plugins: { legend: { display: false } } }} />
          ) : (
             <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No department data</div>
          )}
        </ChartCard>
        <ChartCard title="Global Locations" subtitle="Active resources by region">
          {hasLocData ? (
             <div className="h-full flex items-center justify-center pb-4 pt-2">
                <Doughnut data={locData} options={donutOptions} />
             </div>
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No location data</div>
          )}
        </ChartCard>
      </div>

      {/* Filters */}
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
          <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Department</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors"
          >
            <option value="">All Departments</option>
            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
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

      {/* Multi-Month Resource Roster Table */}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/10">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-10">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Department</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                {rosterMonths.map(m => (
                  <th key={m} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">{m}</th>
                ))}
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Total</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Util %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredRoster.map((r, i) => {
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
                    <td className="px-4 py-3 text-xs text-on-surface">{r.department}</td>
                    <td className="px-4 py-3 text-xs text-on-surface">{r.location || '-'}</td>
                    {rosterMonths.map(m => {
                      const val = r.months[m]?.total || 0;
                      const cellColor = val >= 160 ? 'text-red-600 font-bold' : val >= 120 ? 'text-amber-600 font-bold' : val > 0 ? 'text-on-surface font-semibold' : 'text-slate-300';
                      return (
                        <td key={m} className={`px-4 py-3 text-xs text-right ${cellColor}`}>
                          {val > 0 ? fmtHr(val) : '-'}
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
