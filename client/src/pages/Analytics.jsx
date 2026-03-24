import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

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

export default function Analytics() {
  const { loadingInitial, isRefreshing, selectedMonths, availableMonths } = useData();
  const { req } = useApi();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('entity');

  const [entityData, setEntityData] = useState([]);
  const [employeeTrend, setEmployeeTrend] = useState([]);
  const [managerData, setManagerData] = useState([]);
  const [nonBillable, setNonBillable] = useState({ byTask: [], byDeptMonth: [], deptTotals: [] });
  const [prodIndex, setProdIndex] = useState([]);
  const [deptRanking, setDeptRanking] = useState([]);
  const [leaveCalendar, setLeaveCalendar] = useState({});
  const [locationUtil, setLocationUtil] = useState([]);
  const [leaveDept, setLeaveDept] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const allQs = availableMonths.length > 0 ? `?months=${availableMonths.join(',')}` : '';
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [entity, empTrend, mgr, nb, prod, ranking, loc] = await Promise.all([
          req(`/analytics/entity-billing${allQs}`),
          req(`/analytics/employee-trend${allQs}`),
          req(`/analytics/manager-scorecard${qs}`),
          req(`/analytics/non-billable${qs}`),
          req(`/analytics/productivity-index${allQs}`),
          req(`/analytics/dept-ranking${allQs}`),
          req(`/analytics/location-utilization${allQs}`)
        ]);
        setEntityData(entity || []);
        setEmployeeTrend(empTrend || []);
        setManagerData(mgr || []);
        setNonBillable(nb || { byTask: [], byDeptMonth: [], deptTotals: [] });
        setProdIndex(prod || []);
        setDeptRanking(ranking || []);
        setLocationUtil(loc || []);
      } catch (err) { console.error("Analytics fetch error", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req, availableMonths]);

  // Fetch leave calendar separately (depends on dept filter)
  useEffect(() => {
    if (loadingInitial) return;
    const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '?';
    const deptQs = leaveDept ? `&dept=${encodeURIComponent(leaveDept)}` : '';
    req(`/analytics/leave-calendar${qs}${deptQs}`).then(d => setLeaveCalendar(d || {})).catch(() => {});
  }, [selectedMonths, leaveDept, loadingInitial, req]);

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  if (loadingInitial || (loading && entityData.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Loading deep analytics...</p>
      </div>
    );
  }

  // ── Entity Billing ──
  const entityMonths = [...new Set(entityData.map(d => d.yearMonth))].sort();
  const entities = [...new Set(entityData.map(d => d.entity))].filter(Boolean);
  const entityChartData = {
    labels: entities.map(e => e.length > 20 ? e.substring(0, 20) + '...' : e),
    datasets: entityMonths.map((m, i) => ({
      label: m,
      data: entities.map(e => entityData.find(d => d.entity === e && d.yearMonth === m)?.billableHours || 0),
      backgroundColor: palette[i % palette.length],
      borderRadius: 4
    }))
  };
  const entityBest = [...entities].sort((a, b) => {
    const aPct = entityData.filter(d => d.entity === a).reduce((s, d) => s + d.billabilityPct, 0) / Math.max(entityData.filter(d => d.entity === a).length, 1);
    const bPct = entityData.filter(d => d.entity === b).reduce((s, d) => s + d.billabilityPct, 0) / Math.max(entityData.filter(d => d.entity === b).length, 1);
    return bPct - aPct;
  });

  // ── Employee Trend ──
  const empMonths = [...new Set(employeeTrend.map(d => d.yearMonth))].sort();
  const empMap = {};
  employeeTrend.forEach(d => {
    if (!empMap[d.employeeId]) empMap[d.employeeId] = { id: d.employeeId, name: d.fullName, dept: d.department, months: {} };
    empMap[d.employeeId].months[d.yearMonth] = d.totalHours;
  });
  const empRows = Object.values(empMap).map(e => {
    const vals = empMonths.map(m => e.months[m] || 0);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const latest = vals[vals.length - 1] || 0;
    let status = 'healthy';
    if (avg > 160) status = 'at_risk';
    else if (avg > 130) status = 'high';
    else if (avg < 40) status = 'bench';
    else if (avg < 80) status = 'under';
    return { ...e, vals, avg, latest, status };
  }).sort((a, b) => b.avg - a.avg);

  const statusBadge = (s) => {
    const map = {
      at_risk: { label: 'At Risk', cls: 'bg-red-50 text-red-700 border-red-200' },
      high: { label: 'High Load', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      under: { label: 'Under', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
      bench: { label: 'Bench', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
    };
    const b = map[s] || map.healthy;
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${b.cls}`}>{b.label}</span>;
  };

  // ── Non-Billable ──
  const nbTaskData = {
    labels: nonBillable.byTask.slice(0, 8).map(t => t.taskName.length > 18 ? t.taskName.substring(0, 18) + '...' : t.taskName),
    datasets: [{ data: nonBillable.byTask.slice(0, 8).map(t => t.hours), backgroundColor: palette, borderWidth: 0 }]
  };

  // ── Productivity Index ──
  const prodMonths = [...new Set(prodIndex.map(d => d.yearMonth))].sort();
  const prodDeptMap = {};
  prodIndex.forEach(d => {
    if (!prodDeptMap[d.department]) prodDeptMap[d.department] = {};
    prodDeptMap[d.department][d.yearMonth] = d.productivityIndex;
  });
  const topProdDepts = Object.entries(prodDeptMap).sort((a, b) => {
    const aAvg = Object.values(a[1]).reduce((s, v) => s + v, 0) / Object.values(a[1]).length;
    const bAvg = Object.values(b[1]).reduce((s, v) => s + v, 0) / Object.values(b[1]).length;
    return bAvg - aAvg;
  }).slice(0, 8);

  const prodChartData = {
    labels: prodMonths,
    datasets: [
      ...topProdDepts.map(([dept], i) => ({
        label: dept.length > 18 ? dept.substring(0, 18) + '...' : dept,
        data: prodMonths.map(m => prodDeptMap[dept]?.[m] ?? null),
        borderColor: palette[i % palette.length],
        tension: 0.3, spanGaps: true, pointRadius: 3
      })),
      { label: 'Target (7.5h)', data: prodMonths.map(() => 7.5), borderColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0, borderWidth: 1 }
    ]
  };

  // ── Dept Racing ──
  const rankMonths = [...new Set(deptRanking.map(d => d.yearMonth))].sort();
  const [rankMetric, setRankMetric] = useState('totalHours');
  const rankDepts = [...new Set(deptRanking.map(d => d.department))].filter(Boolean);
  const latestRankMonth = rankMonths[rankMonths.length - 1];
  const latestRanking = deptRanking.filter(d => d.yearMonth === latestRankMonth).sort((a, b) => b[rankMetric] - a[rankMetric]).slice(0, 12);
  const rankChartData = {
    labels: latestRanking.map(d => d.department.length > 20 ? d.department.substring(0, 20) + '...' : d.department),
    datasets: [{
      label: rankMetric === 'totalHours' ? 'Total Hours' : rankMetric === 'billableHours' ? 'Billable Hours' : 'Utilization %',
      data: latestRanking.map(d => d[rankMetric]),
      backgroundColor: latestRanking.map((_, i) => palette[i % palette.length]),
      borderRadius: 4
    }]
  };

  // ── Leave Calendar ──
  const calendarDates = Object.keys(leaveCalendar).sort();
  const calendarMonths = [...new Set(calendarDates.map(d => d.substring(0, 7)))].sort();
  const uniqueLeaveDepts = [...new Set(employeeTrend.map(d => d.department))].filter(Boolean).sort();

  // ── Location Utilization ──
  const locMonths = [...new Set(locationUtil.map(d => d.yearMonth))].sort();
  const locations = [...new Set(locationUtil.map(d => d.location))].filter(Boolean);
  const locChartData = {
    labels: locations,
    datasets: locMonths.map((m, i) => ({
      label: m,
      data: locations.map(l => locationUtil.find(d => d.location === l && d.yearMonth === m)?.totalHours || 0),
      backgroundColor: palette[i % palette.length],
      borderRadius: 4
    }))
  };

  // ── Capacity Forecast ──
  const forecastDepts = [...new Set(deptRanking.map(d => d.department))].filter(Boolean).slice(0, 8);
  const forecastData = forecastDepts.map(dept => {
    const vals = rankMonths.map(m => deptRanking.find(d => d.department === dept && d.yearMonth === m)?.totalHours || 0);
    const projected = linearForecast(vals);
    return { dept, vals, projected };
  });

  const sections = [
    { id: 'entity', label: 'Entity Billing', icon: 'apartment' },
    { id: 'employee', label: 'Employee Trend', icon: 'trending_up' },
    { id: 'nonbillable', label: 'Non-Billable', icon: 'money_off' },
    { id: 'productivity', label: 'Productivity', icon: 'speed' },
    { id: 'ranking', label: 'Dept Ranking', icon: 'leaderboard' },
    { id: 'manager', label: 'Manager Score', icon: 'supervisor_account' },
    { id: 'leave', label: 'Leave Calendar', icon: 'calendar_month' },
    { id: 'location', label: 'Locations', icon: 'public' },
    { id: 'forecast', label: 'Forecast', icon: 'auto_graph' },
  ];

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">Deep Analytics</h2>
        <p className="text-on-surface-variant text-sm">Comparative analysis, manager visibility, forecasting, and alert infrastructure.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-outline-variant/10 pb-0 hide-scrollbar">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeSection === s.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-slate-300'
            }`}>
            <span className="material-symbols-outlined text-sm">{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* ═══ Entity Billing ═══ */}
      {activeSection === 'entity' && (
        <div className="space-y-6">
          {entityBest.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Top Billing Entity</p>
                <p className="text-lg font-extrabold text-on-surface mt-1 truncate">{entityBest[0]}</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Entities Tracked</p>
                <p className="text-2xl font-extrabold text-on-surface mt-1">{entities.length}</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Billable</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{fmtHr(entityData.reduce((s, d) => s + d.billableHours, 0))}</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Avg Billability</p>
                <p className="text-2xl font-extrabold text-primary mt-1">{(() => { const t = entityData.reduce((s, d) => s + d.totalHours, 0); const b = entityData.reduce((s, d) => s + d.billableHours, 0); return t > 0 ? Math.round(b / t * 100) : 0; })()}%</p>
              </div>
            </div>
          )}
          <ChartCard title="Entity-Level Billing Performance" subtitle="Billable hours by legal entity, grouped by month" className="h-[400px]">
            {entities.length > 0 ? (
              <Bar data={entityChartData} options={{ ...commonOptions, plugins: { legend: { position: 'top' } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No entity data</div>}
          </ChartCard>
          <DataTable title="Entity Billing Table" subtitle="Detailed breakdown per entity per month" data={entityData.map(d => ({ ...d, billabilityPct: d.billabilityPct + '%' }))}
            columns={[
              { key: 'entity', label: 'Entity' },
              { key: 'yearMonth', label: 'Month' },
              { key: 'headcount', label: 'Headcount', rightAlign: true },
              { key: 'totalHours', label: 'Total Hrs', rightAlign: true, render: (_, v) => <span className="font-bold">{fmtHr(v)}</span> },
              { key: 'billableHours', label: 'Billable Hrs', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{fmtHr(v)}</span> },
              { key: 'billabilityPct', label: 'Billability', rightAlign: true }
            ]} />
        </div>
      )}

      {/* ═══ Employee Utilization Trend ═══ */}
      {activeSection === 'employee' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="text-lg font-bold text-on-surface">Employee Utilization Trend</h3>
            <p className="text-xs text-on-surface-variant mt-1">Rolling average across {empMonths.length} months. Showing {empRows.length} employees.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-10">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dept</th>
                  {empMonths.map(m => <th key={m} className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">{m}</th>)}
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Avg</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {empRows.slice(0, 50).map(e => (
                  <tr key={e.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-2.5 font-semibold text-on-surface sticky left-0 bg-surface-container-lowest z-10">{e.name}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{e.dept}</td>
                    {e.vals.map((v, i) => (
                      <td key={i} className={`px-3 py-2.5 text-right font-semibold ${v > 160 ? 'text-red-600' : v > 130 ? 'text-amber-600' : v > 0 ? 'text-on-surface' : 'text-slate-300'}`}>
                        {v > 0 ? fmtHr(v) : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-bold">{fmtHr(e.avg)}</td>
                    <td className="px-4 py-2.5 text-center">{statusBadge(e.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Non-Billable Hours ═══ */}
      {activeSection === 'nonbillable' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Non-Billable by Task" subtitle="Top task types consuming non-billable hours">
              {nonBillable.byTask.length > 0 ? (
                <div className="h-full flex items-center justify-center pb-4 pt-2">
                  <Doughnut data={nbTaskData} options={{ ...commonOptions, cutout: '65%', plugins: { legend: { position: 'right', labels: { font: { size: 10 }, padding: 6 } } } }} />
                </div>
              ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
            </ChartCard>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
              <h3 className="text-sm font-bold text-on-surface mb-4">Department Non-Billable Summary</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {nonBillable.deptTotals.slice(0, 12).map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{d.department}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-error rounded-full" style={{ width: `${d.pct}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant">{d.pct}%</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-error">{fmtHr(d.nonBillable)}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Productivity Index ═══ */}
      {activeSection === 'productivity' && (
        <ChartCard title="Productivity Index Trend" subtitle="Hours logged per present day by department (target: 7.5h/day)" className="h-[450px]">
          {topProdDepts.length > 0 ? (
            <Line data={prodChartData} options={{
              ...commonOptions,
              plugins: { legend: { position: 'right', labels: { font: { size: 10 }, usePointStyle: true, padding: 8 } } },
              scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, title: { display: true, text: 'Hours / Present Day' } } }
            }} />
          ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
        </ChartCard>
      )}

      {/* ═══ Department Racing ═══ */}
      {activeSection === 'ranking' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[['totalHours', 'Total Hours'], ['billableHours', 'Billable Hours'], ['utilizationPct', 'Utilization %']].map(([key, label]) => (
              <button key={key} onClick={() => setRankMetric(key)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${rankMetric === key ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                {label}
              </button>
            ))}
          </div>
          <ChartCard title={`Department Ranking — ${latestRankMonth || ''}`} subtitle="Top 12 departments by selected metric" className="h-[450px]">
            {latestRanking.length > 0 ? (
              <Bar data={rankChartData} options={{ ...commonOptions, indexAxis: 'y', plugins: { legend: { display: false } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
          </ChartCard>
        </div>
      )}

      {/* ═══ Manager Scorecard ═══ */}
      {activeSection === 'manager' && (
        <DataTable title="Department Attendance Scorecard" subtitle="Sorted by lowest attendance rate (proxy for manager accountability)"
          data={managerData} columns={[
            { key: 'managerGroup', label: 'Department' },
            { key: 'directReports', label: 'Employees', rightAlign: true },
            { key: 'totalPresent', label: 'Present', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{v}</span> },
            { key: 'totalAbsent', label: 'Absent', rightAlign: true, render: (_, v) => <span className="font-bold text-red-600">{v}</span> },
            { key: 'totalLeave', label: 'Leave', rightAlign: true },
            { key: 'attendanceRate', label: 'Rate %', rightAlign: true,
              render: (_, v) => <span className={`font-bold ${v >= 95 ? 'text-emerald-600' : v >= 85 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span>
            }
          ]} />
      )}

      {/* ═══ Leave Calendar ═══ */}
      {activeSection === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <select value={leaveDept} onChange={e => setLeaveDept(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/30 text-sm rounded-lg px-3 py-2 outline-none focus:border-primary">
              <option value="">All Departments</option>
              {uniqueLeaveDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {calendarMonths.map(month => {
            const year = parseInt(month.split('-')[0]);
            const mon = parseInt(month.split('-')[1]) - 1;
            const daysInMonth = new Date(year, mon + 1, 0).getDate();
            const firstDay = new Date(year, mon, 1).getDay();
            const weeks = [];
            let week = new Array(firstDay).fill(null);
            for (let d = 1; d <= daysInMonth; d++) {
              week.push(d);
              if (week.length === 7) { weeks.push(week); week = []; }
            }
            if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

            return (
              <div key={month} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
                <h3 className="text-sm font-bold text-on-surface mb-3">{month}</h3>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-[9px] font-bold text-on-surface-variant uppercase py-1">{d}</div>
                  ))}
                  {weeks.flat().map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
                    const info = leaveCalendar[dateStr];
                    const count = info?.onLeave || 0;
                    let bg = 'bg-surface-container-low text-on-surface';
                    if (count >= 6) bg = 'bg-red-500 text-white';
                    else if (count >= 4) bg = 'bg-blue-500 text-white';
                    else if (count >= 2) bg = 'bg-blue-200 text-blue-900';
                    else if (count >= 1) bg = 'bg-blue-50 text-blue-800';
                    return (
                      <div key={i} className={`rounded p-1.5 text-[11px] font-semibold cursor-default ${bg}`}
                        title={info ? `${count} on leave: ${info.employees.slice(0, 5).join(', ')}` : `${dateStr}`}>
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 text-[9px] text-on-surface-variant">
                  <span className="font-bold uppercase">Legend:</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 rounded"></span>1</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded"></span>2-3</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span>4-5</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span>6+</span>
                </div>
              </div>
            );
          })}
          {calendarMonths.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant italic">No leave data for selected period</div>
          )}
        </div>
      )}

      {/* ═══ Location Utilization ═══ */}
      {activeSection === 'location' && (
        <div className="space-y-6">
          <ChartCard title="Location Utilization Comparison" subtitle="Total hours by office location, grouped by month" className="h-[400px]">
            {locations.length > 0 ? (
              <Bar data={locChartData} options={{ ...commonOptions, plugins: { legend: { position: 'top' } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No location data</div>}
          </ChartCard>
          <DataTable title="Location Detail" data={locationUtil} columns={[
            { key: 'location', label: 'Location' },
            { key: 'yearMonth', label: 'Month' },
            { key: 'headcount', label: 'Headcount', rightAlign: true },
            { key: 'totalHours', label: 'Total Hrs', rightAlign: true, render: (_, v) => <span className="font-bold">{fmtHr(v)}</span> },
            { key: 'billableHours', label: 'Billable Hrs', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{fmtHr(v)}</span> },
            { key: 'utilizationPct', label: 'Util %', rightAlign: true, render: (_, v) => <span className={`font-bold ${v >= 85 ? 'text-emerald-600' : v >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span> }
          ]} />
        </div>
      )}

      {/* ═══ Capacity Forecast ═══ */}
      {activeSection === 'forecast' && (
        <div className="space-y-6">
          <ChartCard title="Capacity Forecast (Linear Projection)" subtitle={`Based on ${rankMonths.length} months of data. Dashed = projected next month.`} className="h-[400px]">
            {forecastData.length > 0 ? (
              <Bar data={{
                labels: [...rankMonths, 'Next Month'],
                datasets: forecastData.slice(0, 6).map((fd, i) => ({
                  label: fd.dept.length > 18 ? fd.dept.substring(0, 18) + '...' : fd.dept,
                  data: [...fd.vals, fd.projected],
                  backgroundColor: [...fd.vals.map(() => palette[i % palette.length]), palette[i % palette.length] + '60'],
                  borderRadius: 4
                }))
              }} options={{ ...commonOptions, plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">Need more months for forecast</div>}
          </ChartCard>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
            <h3 className="text-sm font-bold text-on-surface mb-4">Projected Capacity (Next Month)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {forecastData.slice(0, 8).map((fd, i) => (
                <div key={i} className="p-3 bg-surface-container-low rounded-lg">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider truncate">{fd.dept}</p>
                  <p className="text-xl font-extrabold text-on-surface mt-1">{fd.projected ? `~${Math.round(fd.projected)}h` : 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
