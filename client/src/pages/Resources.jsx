import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Doughnut } from 'react-chartjs-2';

export default function Resources() {
  const { loadingInitial, isRefreshing, selectedMonths } = useData();
  const { req } = useApi();
  
  const [resources, setResources] = useState([]);
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
        const [resData, depsData, locsData] = await Promise.all([
          req(`/resources${qs}`),
          req(`/charts/departments${qs}`),
          req(`/charts/locations${qs}`)
        ]);
        setResources(resData || []);
        setCharts({ deps: depsData || [], locs: locsData || {} });
      } catch (err) {
        console.error("Failed to load resources", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

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

  const filteredResources = resources.filter(r => {
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

  // --- Table Columns Setup ---
  const tableColumns = [
    { key: 'employeeId', label: 'Emp ID' },
    { 
      key: 'fullName', 
      label: 'Name',
      render: (row, val) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-primary-fixed flex items-center justify-center text-[10px] font-bold text-primary">
            {val ? val.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">{val}</p>
            <p className="text-[10px] text-on-surface-variant">{row.designation || 'Unknown Role'}</p>
          </div>
        </div>
      )
    },
    { key: 'department', label: 'Department' },
    { key: 'location', label: 'Location' },
    { 
      key: 'billablePct', 
      label: 'Efficiency',
      render: (row, val) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div className={`h-full ${val > 75 ? 'bg-emerald-500' : val > 40 ? 'bg-primary' : 'bg-orange-500'}`} style={{ width: `${val}%` }}></div>
          </div>
          <span className="text-xs font-bold text-on-surface">{val}%</span>
        </div>
      )
    },
    { key: 'totalHours', label: 'Total Hrs', rightAlign: true, render: (_, val) => <span className="font-bold">{fmtHr(val)}</span> }
  ];

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
          <button className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-lg">ios_share</span>
            Export Report
          </button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
          title="Tracked Headcount" 
          value={activeEmps.toLocaleString()} 
          icon="groups" 
          highlight 
        />
        <KpiCard 
          title="Avg Billability" 
          value={`${avgBillable}%`} 
          icon="verified" 
          trend={`${fmtHr(totalBillHr)} billable hours`}
          trendIcon="payments"
        />
        <KpiCard 
          title="Leading Department" 
          value={topDept} 
          icon="corporate_fare" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard 
          title="Department Allocation" 
          subtitle="Top 10 departments by effort"
          className="lg:col-span-2"
        >
          {charts.deps.length > 0 ? (
            <Bar 
              data={deptData} 
              options={{ ...commonOptions, plugins: { legend: { display: false } } }} 
            />
          ) : (
             <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No department data</div>
          )}
        </ChartCard>
        
        <ChartCard 
          title="Global Locations" 
          subtitle="Active resources by region"
        >
          {hasLocData ? (
             <div className="h-full flex items-center justify-center pb-4 pt-2">
                <Doughnut 
                  data={locData} 
                  options={{ ...commonOptions, cutout: '70%', plugins: { legend: { position: 'bottom' } } }} 
                />
             </div>
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No location data</div>
          )}
        </ChartCard>
      </div>

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

      <DataTable 
        title="Resource Roster"
        subtitle={`Showing ${filteredResources.length} of ${resources.length} tracked individuals`}
        data={filteredResources}
        columns={tableColumns}
        isLoading={loading}
      />
    </div>
  );
}
