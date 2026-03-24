import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Doughnut } from 'react-chartjs-2';

export default function Overview() {
  const { kpis, loadingInitial, isRefreshing, selectedMonths } = useData();
  const { req } = useApi();
  const [charts, setCharts] = useState({ clients: [], approval: {} });

  useEffect(() => {
    async function fetchCharts() {
      if (loadingInitial) return;
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      
      try {
        const [clients, approval] = await Promise.all([
          req(`/charts/clients${qs}`),
          req(`/charts/approval${qs}`)
        ]);
        setCharts({ clients, approval });
      } catch (err) {
        console.error("Failed to load overview charts", err);
      }
    }
    fetchCharts();
  }, [selectedMonths, loadingInitial, req]);

  // Loading skeleton
  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Loading global analytics...</p>
      </div>
    );
  }

  // Formatting helpers
  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const fmtNum = (n) => (n || 0).toLocaleString();

  // Chart Data preparation
  const clientData = {
    labels: charts.clients.slice(0, 7).map(c => c.client.substring(0, 15) + (c.client.length > 15 ? '...' : '')),
    datasets: [{
      label: 'Total Hours',
      data: charts.clients.slice(0, 7).map(c => c.hours),
      backgroundColor: chartColors.primary,
      borderRadius: 4
    }]
  };

  const appValues = charts.approval;
  const hasApprovalData = Object.keys(appValues).length > 0;
  
  const approvalData = {
    labels: ['Approved', 'Pending', 'Draft', 'Not Submitted'],
    datasets: [{
      data: [
        appValues['Approved'] || 0,
        appValues['Pending'] || 0,
        appValues['Draft'] || 0,
        appValues['Not Submitted'] || 0
      ],
      backgroundColor: [
        chartColors.emerald,
        chartColors.primary,
        chartColors.slate,
        chartColors.error
      ],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>
      {/* Executive Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Analytical Overview</h3>
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-none">Executive Summary</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Hours" 
          value={fmtHr(kpis?.totalHours)} 
          icon="history" 
          highlight 
        />
        <KpiCard 
          title="Billable Hours" 
          value={fmtHr(kpis?.billableHours)} 
          icon="payments" 
          trend={`${kpis?.billablePct || 0}% billability rate`}
          trendIcon="check_circle"
          trendColor="text-blue-400"
        />
        <KpiCard 
          title="Active Projects" 
          value={fmtNum(kpis?.uniqueProjects)} 
          icon="rocket_launch" 
        />
        <KpiCard 
          title="Attendance Pulse" 
          value={`${fmtNum(kpis?.totalPresent)} present`}
          icon="person_check" 
          trend={`${fmtNum(kpis?.totalAbsent)} absent`}
          trendIcon="event_busy"
          trendColor="text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard 
          title="Client Allocation" 
          subtitle="Top 7 clients by executed hours"
          className="lg:col-span-2"
        >
          {charts.clients.length > 0 ? (
            <Bar 
              data={clientData} 
              options={{ ...commonOptions, plugins: { legend: { display: false } } }} 
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 italic text-sm">No client data</div>
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
                  options={{ ...commonOptions, cutout: '75%', plugins: { legend: { position: 'bottom' } } }} 
                />
             </div>
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No approval data</div>
          )}
        </ChartCard>
      </div>
      {/* ── Bento-style Bottom Section ── */}
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

        {/* Approval Breakdown Progress Bars */}
        <div className="bg-surface-container-low rounded-xl p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Approval Breakdown</h3>
              <p className="text-xs text-on-surface-variant">Timesheet and expense reconciliation status</p>
            </div>
            <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
          </div>
          {(() => {
            const total = (appValues['Approved'] || 0) + (appValues['Pending'] || 0) + (appValues['Draft'] || 0) + (appValues['Not Submitted'] || 0);
            const approvedPct = total > 0 ? Math.round(((appValues['Approved'] || 0) / total) * 100) : 0;
            const pendingPct = total > 0 ? Math.round(((appValues['Pending'] || 0) / total) * 100) : 0;
            const rejectedPct = total > 0 ? Math.round((((appValues['Draft'] || 0) + (appValues['Not Submitted'] || 0)) / total) * 100) : 0;
            return (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span>Approved</span>
                    <span className="text-primary">{approvedPct}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-sm">
                    <div className="h-full bg-primary rounded-sm transition-all duration-500" style={{ width: `${approvedPct}%` }}></div>
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
          <div className="mt-4 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined">assignment_late</span>
              </div>
              <div>
                <p className="text-xs font-bold">Pending Actions</p>
                <p className="text-[10px] text-on-surface-variant">{appValues['Pending'] || 0} timesheets need review</p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-primary underline">REVIEW ALL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
