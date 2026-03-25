import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import { chartColors, commonOptions, donutOptions } from '../charts/chart-config';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

function Sparkline({ data, color = '#004ac6', height = 32 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = data.length * 12;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ current, previous }) {
  if (previous == null || previous === 0) return null;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  const isUp = pctChange > 0;
  const isFlat = Math.abs(pctChange) < 2;
  const color = isFlat ? 'text-slate-500 bg-slate-100' : isUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
  const icon = isFlat ? 'remove' : isUp ? 'arrow_upward' : 'arrow_downward';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>
      <span className="material-symbols-outlined text-[10px]">{icon}</span>
      {Math.abs(pctChange)}%
    </span>
  );
}

function TemporalKpiCard({ title, value, icon, trend, sparklineData, sparklineColor, thresholds, highlight = false }) {
  let statusColor = '';
  if (thresholds && typeof trend?.current === 'number') {
    const v = trend.current;
    if (v >= thresholds.green) statusColor = 'border-l-emerald-500';
    else if (v >= thresholds.yellow) statusColor = 'border-l-amber-500';
    else statusColor = 'border-l-red-500';
  }

  return (
    <div className={`bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 shadow-sm flex flex-col gap-2 transition-all hover:bg-surface-bright ${statusColor ? `border-l-4 ${statusColor}` : ''}`}>
      <div className={`flex items-center justify-between ${highlight ? 'text-primary' : 'text-on-surface-variant'}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
        {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="text-3xl font-extrabold tracking-tight text-on-surface">{value}</span>
          {trend && (
            <div className="flex items-center gap-2 mt-1">
              <TrendBadge current={trend.current} previous={trend.previous} />
              {trend.label && <span className="text-[10px] text-on-surface-variant">{trend.label}</span>}
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparklineColor || '#004ac6'} />
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { kpis, loadingInitial, isRefreshing, selectedMonths, availableMonths } = useData();
  const { req } = useApi();
  const [charts, setCharts] = useState({ clients: [], approval: {} });
  const [kpiTrends, setKpiTrends] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    async function fetchCharts() {
      if (loadingInitial) return;
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [clients, approval, alertData, desigData] = await Promise.all([
          req(`/charts/clients${qs}`),
          req(`/charts/approval${qs}`),
          req(`/analytics/alerts${qs}`),
          req('/squads/designations')
        ]);
        setCharts({ clients, approval });
        setAlerts(alertData || []);
        setDesignations(desigData || []);
      } catch (err) {
        console.error("Failed to load overview charts", err);
      }
    }
    fetchCharts();
  }, [selectedMonths, loadingInitial, req]);

  // Fetch temporal KPI data
  useEffect(() => {
    async function fetchTrends() {
      if (loadingInitial || availableMonths.length === 0) return;
      try {
        const allMonths = availableMonths.join(',');
        const data = await req(`/analytics/kpi-trends?months=${allMonths}`);
        setKpiTrends(data || []);
      } catch (err) {
        console.error("Failed to load KPI trends", err);
      }
    }
    fetchTrends();
  }, [availableMonths, loadingInitial, req]);

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Loading global analytics...</p>
      </div>
    );
  }

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const fmtNum = (n) => (n || 0).toLocaleString();

  // Derive MoM data from kpiTrends
  const latestMonth = selectedMonths.length > 0 ? selectedMonths[selectedMonths.length - 1] : null;
  const latestTrend = kpiTrends.find(t => t.yearMonth === latestMonth || t.year_month === latestMonth);
  const sortedTrends = [...kpiTrends].sort((a, b) => (a.yearMonth || a.year_month || '').localeCompare(b.yearMonth || b.year_month || ''));
  const latestIdx = sortedTrends.findIndex(t => (t.yearMonth || t.year_month) === latestMonth);
  const prevTrend = latestIdx > 0 ? sortedTrends[latestIdx - 1] : null;

  // Approval % calculation
  const appValues = charts.approval;
  const hasApprovalData = Object.keys(appValues).length > 0;
  const totalApprovalHours = (appValues['Approved'] || 0) + (appValues['Pending'] || 0) + (appValues['Draft'] || 0) + (appValues['Not Submitted'] || 0);
  const approvedHours = appValues['Approved'] || 0;
  const approvalPct = totalApprovalHours > 0 ? Math.round((approvedHours / totalApprovalHours) * 100) : 0;
  const approvalColor = approvalPct >= 90 ? 'text-emerald-600' : approvalPct >= 70 ? 'text-amber-600' : 'text-red-600';
  const approvalBg = approvalPct >= 90 ? 'bg-emerald-500' : approvalPct >= 70 ? 'bg-amber-500' : 'bg-red-500';

  // Pending actions
  const pendingCount = (appValues['Pending'] || 0) + (appValues['Not Submitted'] || 0) + (appValues['Draft'] || 0);
  const pendingTimesheets = appValues['Pending'] || 0;
  const notSubmitted = appValues['Not Submitted'] || 0;
  const draftCount = appValues['Draft'] || 0;

  // Designation bar chart data
  const desigChartData = {
    labels: designations.map(d => d.designation.length > 25 ? d.designation.substring(0, 25) + '...' : d.designation),
    datasets: [{
      label: 'Resources',
      data: designations.map(d => d.count),
      backgroundColor: chartColors.primary,
      borderRadius: 4
    }]
  };

  const approvalData = {
    labels: ['Approved', 'Pending', 'Draft', 'Not Submitted'],
    datasets: [{
      data: [approvedHours, appValues['Pending'] || 0, appValues['Draft'] || 0, appValues['Not Submitted'] || 0],
      backgroundColor: [chartColors.emerald, chartColors.primary, chartColors.slate, chartColors.error],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>
      {/* Executive Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Executive Dashboard</h3>
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-none">Executive Summary</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-xs">info</span>
          Excluding Skye projects from all reports
        </div>
      </div>

      {/* PMO Alert Feed */}
      {alerts.length > 0 && (() => {
        const visibleAlerts = alerts.filter((_, i) => !dismissedAlerts.has(i));
        if (visibleAlerts.length === 0) return null;
        return (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-lg">notification_important</span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface">PMO Alerts</span>
                <span className="text-[9px] font-bold bg-error text-white px-1.5 py-0.5 rounded-full">{visibleAlerts.length}</span>
              </div>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alerts.map((alert, i) => {
                if (dismissedAlerts.has(i)) return null;
                const isCritical = alert.severity === 'critical';
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${isCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <span className={`material-symbols-outlined text-sm ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                      {isCritical ? 'error' : 'warning'}
                    </span>
                    <span className={`font-semibold flex-1 ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>{alert.message}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {alert.type.replace('_', ' ')}
                    </span>
                    <button onClick={() => setDismissedAlerts(prev => new Set([...prev, i]))}
                      className="text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Temporal KPI Cards — 6 cards now (added Approval %) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <TemporalKpiCard
          title="Total Hours"
          value={fmtHr(kpis?.totalHours)}
          icon="history"
          highlight
          trend={latestTrend ? { current: latestTrend.totalHours, previous: prevTrend?.totalHours, label: 'vs prior month' } : null}
          sparklineData={sortedTrends.map(t => t.totalHours)}
          sparklineColor={chartColors.primary}
        />
        <TemporalKpiCard
          title="Billable Hours"
          value={fmtHr(kpis?.billableHours)}
          icon="payments"
          trend={latestTrend ? { current: latestTrend.billableHours, previous: prevTrend?.billableHours, label: `${kpis?.billablePct || 0}% rate` } : null}
          sparklineData={sortedTrends.map(t => t.billableHours)}
          sparklineColor={chartColors.emerald}
          thresholds={{ green: 70, yellow: 50 }}
        />
        <TemporalKpiCard
          title="Active Projects"
          value={fmtNum(kpis?.uniqueProjects)}
          icon="rocket_launch"
          trend={latestTrend ? { current: latestTrend.uniqueProjects, previous: prevTrend?.uniqueProjects } : null}
          sparklineData={sortedTrends.map(t => t.uniqueProjects)}
          sparklineColor={chartColors.secondary}
        />
        <TemporalKpiCard
          title="Attendance Pulse"
          value={`${latestTrend?.attendanceRate || 0}%`}
          icon="person_check"
          trend={latestTrend ? { current: latestTrend.attendanceRate, previous: prevTrend?.attendanceRate, label: `${fmtNum(kpis?.totalPresent)} present` } : null}
          sparklineData={sortedTrends.map(t => t.attendanceRate)}
          sparklineColor={chartColors.emerald}
          thresholds={{ green: 95, yellow: 85 }}
        />
        <TemporalKpiCard
          title="Headcount"
          value={fmtNum(kpis?.uniqueEmployees)}
          icon="groups"
          trend={latestTrend ? { current: latestTrend.uniqueEmployees, previous: prevTrend?.uniqueEmployees, label: `${kpis?.attendanceEmployees || 0} tracked` } : null}
          sparklineData={sortedTrends.map(t => t.uniqueEmployees)}
          sparklineColor={chartColors.tertiary}
        />

        {/* NEW: Timesheet Approval % KPI */}
        <div className={`bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 shadow-sm flex flex-col gap-2 transition-all hover:bg-surface-bright border-l-4 ${approvalPct >= 90 ? 'border-l-emerald-500' : approvalPct >= 70 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] font-bold uppercase tracking-widest">Approval Status</span>
            <span className="material-symbols-outlined text-lg">fact_check</span>
          </div>
          <div>
            <span className={`text-3xl font-extrabold tracking-tight ${approvalColor}`}>{approvalPct}%</span>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {fmtHr(approvedHours)}h / {fmtHr(totalApprovalHours)}h approved
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${approvalBg}`} style={{ width: `${approvalPct}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NEW: Designation-wise Resource Count Bar Chart (replaces Client Allocation) */}
        <ChartCard
          title="Designation-wise Resource Count"
          subtitle="Resource distribution across job roles"
          className="lg:col-span-2"
        >
          {designations.length > 0 ? (
            <Bar
              data={desigChartData}
              options={{
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.raw} resources`
                    }
                  }
                },
                scales: {
                  x: { grid: { color: chartColors.gridLines, drawBorder: false }, ticks: { font: { size: 10 } } },
                  y: { grid: { display: false }, ticks: { font: { size: 10, weight: 600 } } }
                }
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 italic text-sm">
              No designation data — upload Demand Capacity file
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Timesheet Approvals"
          subtitle="Status breakdown by hours"
        >
          {hasApprovalData ? (
             <div className="h-full flex items-center justify-center pb-4 pt-2">
                <Doughnut
                  data={approvalData}
                  options={donutOptions}
                />
             </div>
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No approval data</div>
          )}
        </ChartCard>
      </div>

      {/* Bento-style Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Resource Insights Table */}
        <div className="bg-surface-container-low rounded-xl overflow-hidden flex flex-col">
          <div className="p-6">
            <h3 className="text-lg font-bold text-on-surface">Top Resource Insights</h3>
            <p className="text-xs text-on-surface-variant">Efficiency and output leaders for the period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Resource</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Efficiency</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(charts.clients || []).slice(0, 3).map((c, i) => {
                  const initials = (c.client || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                  const bgColors = ['bg-primary-fixed', 'bg-secondary-fixed', 'bg-tertiary-fixed'];
                  const textColors = ['text-primary', 'text-secondary', 'text-tertiary'];
                  const pct = c.hours ? Math.min(100, Math.round((c.hours / (charts.clients[0]?.hours || 1)) * 100)) : 0;
                  return (
                    <tr key={i} className="hover:bg-white transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded ${bgColors[i] || 'bg-surface-container'} flex items-center justify-center text-[10px] font-bold ${textColors[i] || 'text-outline'}`}>{initials}</div>
                          <div>
                            <p className="text-sm font-semibold">{c.client}</p>
                            <p className="text-[10px] text-on-surface-variant">Client Project</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-xs font-bold">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-bold text-on-surface">{fmtHr(c.hours)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval Breakdown + Pending Actions */}
        <div className="bg-surface-container-low rounded-xl p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Approval Breakdown</h3>
              <p className="text-xs text-on-surface-variant">Timesheet and expense reconciliation status</p>
            </div>
            <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
          </div>
          {(() => {
            const total = totalApprovalHours;
            const approvedPctBar = total > 0 ? Math.round((approvedHours / total) * 100) : 0;
            const pendingPct = total > 0 ? Math.round(((appValues['Pending'] || 0) / total) * 100) : 0;
            const rejectedPct = total > 0 ? Math.round((((appValues['Draft'] || 0) + (appValues['Not Submitted'] || 0)) / total) * 100) : 0;
            return (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span>Approved</span>
                    <span className="text-primary">{approvedPctBar}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-sm">
                    <div className="h-full bg-primary rounded-sm transition-all duration-500" style={{ width: `${approvedPctBar}%` }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span>Pending Review</span>
                    <span className="text-secondary">{pendingPct}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-sm">
                    <div className="h-full bg-secondary-container rounded-sm transition-all duration-500" style={{ width: `${pendingPct}%` }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span>Draft / Not Submitted</span>
                    <span className="text-error">{rejectedPct}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-sm">
                    <div className="h-full bg-error rounded-sm transition-all duration-500" style={{ width: `${rejectedPct}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FIXED: Pending Actions — now shows real breakdown */}
          <div className="mt-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined">assignment_late</span>
              </div>
              <div>
                <p className="text-xs font-bold">Pending Actions</p>
                <p className="text-[10px] text-on-surface-variant">{pendingCount > 0 ? `${pendingCount} items require attention` : 'All caught up!'}</p>
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="space-y-1.5 pl-[52px]">
                {pendingTimesheets > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                    <span className="text-on-surface-variant">{fmtHr(pendingTimesheets)}h pending review</span>
                  </div>
                )}
                {notSubmitted > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    <span className="text-on-surface-variant">{fmtHr(notSubmitted)}h not submitted</span>
                  </div>
                )}
                {draftCount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span className="text-on-surface-variant">{fmtHr(draftCount)}h in draft</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
