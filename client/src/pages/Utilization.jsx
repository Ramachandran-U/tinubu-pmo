import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Line } from 'react-chartjs-2';

// Heatmap color helper
const getHeatmapColor = (pct) => {
  if (pct >= 100) return 'bg-red-500 text-white';
  if (pct >= 85)  return 'bg-blue-500 text-white';
  if (pct >= 70)  return 'bg-blue-200 text-blue-900';
  if (pct >= 50)  return 'bg-blue-50 text-blue-800';
  if (pct > 0)    return 'bg-surface-container-highest text-outline';
  return 'bg-surface-container text-slate-300';
};

export default function Utilization() {
  const { loadingInitial, isRefreshing, selectedMonths, availableMonths } = useData();
  const { req } = useApi();

  const [heatmap, setHeatmap] = useState([]);
  const [timelogs, setTimelogs] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [deptHeatmap, setDeptHeatmap] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('daily');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      const allQs = availableMonths.length > 0 ? `?months=${availableMonths.join(',')}` : qs;

      try {
        // Use Promise.allSettled so one failed endpoint doesn't kill the rest
        const [heatRes, logsRes, compRes, deptRes, attRes] = await Promise.allSettled([
          req(`/heatmap${qs}`),
          req(`/timelog${qs}${qs ? '&' : '?'}pageSize=200`),
          req(`/analytics/compliance${allQs}`),
          req(`/analytics/dept-heatmap${allQs}`),
          req(`/analytics/attendance-trend${allQs}`)
        ]);
        setHeatmap(heatRes.status === 'fulfilled' ? (heatRes.value || []) : []);
        setTimelogs(logsRes.status === 'fulfilled' ? (logsRes.value?.rows || []) : []);
        setCompliance(compRes.status === 'fulfilled' ? (compRes.value || []) : []);
        setDeptHeatmap(deptRes.status === 'fulfilled' ? (deptRes.value || []) : []);
        setAttendanceTrend(attRes.status === 'fulfilled' ? (attRes.value || []) : []);
      } catch (err) {
        console.error("Failed to load utilization", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req, availableMonths]);

  if (loadingInitial || (loading && !isRefreshing && heatmap.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Analyzing utilization data...</p>
      </div>
    );
  }

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // --- Daily Effort Chart ---
  const heatChartData = {
    labels: heatmap.map(d => d.dateStr.substring(5)),
    datasets: [
      { label: 'Billable Hours', data: heatmap.map(d => d.billableHours), backgroundColor: chartColors.emerald, stack: 'Stack 0' },
      { label: 'Non-Billable Hours', data: heatmap.map(d => d.nonBillableHours), backgroundColor: chartColors.slate, stack: 'Stack 0' }
    ]
  };
  const heatOptions = {
    ...commonOptions,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { stacked: true, grid: { display: false, drawBorder: false }, ticks: { font: { size: 9 } } },
      y: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } }
    }
  };

  // --- Compliance Funnel ---
  const complianceChartData = {
    labels: compliance.map(c => c.yearMonth),
    datasets: [
      { label: 'Approved', data: compliance.map(c => c.approved), backgroundColor: chartColors.primary },
      { label: 'Submitted (not approved)', data: compliance.map(c => c.submitted - c.approved), backgroundColor: '#acbfff' },
      { label: 'Not Submitted', data: compliance.map(c => c.notSubmitted), backgroundColor: chartColors.error },
    ]
  };
  const complianceLineData = {
    labels: compliance.map(c => c.yearMonth),
    datasets: [{
      label: 'Compliance Rate %',
      data: compliance.map(c => c.complianceRate),
      borderColor: chartColors.primary,
      backgroundColor: chartColors.primaryLight,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: chartColors.primary
    }]
  };

  // --- Department Heatmap ---
  const { heatmapDepts, heatmapMonths, heatmapGrid } = useMemo(() => {
    const months = [...new Set(deptHeatmap.map(d => d.yearMonth))].sort();
    const depts = [...new Set(deptHeatmap.map(d => d.department))].sort();
    const grid = {};
    deptHeatmap.forEach(d => {
      if (!grid[d.department]) grid[d.department] = {};
      grid[d.department][d.yearMonth] = d;
    });
    return { heatmapDepts: depts, heatmapMonths: months, heatmapGrid: grid };
  }, [deptHeatmap]);

  // --- Attendance Trend ---
  const { attTrendMonths, attTrendDepts, attTrendLines } = useMemo(() => {
    const months = [...new Set(attendanceTrend.map(d => d.yearMonth))].sort();
    const deptMap = {};
    attendanceTrend.forEach(d => {
      if (!deptMap[d.department]) deptMap[d.department] = {};
      deptMap[d.department][d.yearMonth] = d.attendanceRate;
    });
    // Top 8 depts by total tracked days
    const deptTotals = {};
    attendanceTrend.forEach(d => { deptTotals[d.department] = (deptTotals[d.department] || 0) + d.totalTrackedDays; });
    const topDepts = Object.entries(deptTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(d => d[0]);
    const palette = [chartColors.primary, chartColors.emerald, chartColors.tertiary, chartColors.secondary, chartColors.error, '#8b5cf6', '#f59e0b', '#06b6d4'];
    const lines = topDepts.map((dept, i) => ({
      label: dept.length > 20 ? dept.substring(0, 20) + '...' : dept,
      data: months.map(m => deptMap[dept]?.[m] ?? null),
      borderColor: palette[i % palette.length],
      tension: 0.3,
      spanGaps: true,
      pointRadius: 3
    }));
    return { attTrendMonths: months, attTrendDepts: topDepts, attTrendLines: lines };
  }, [attendanceTrend]);

  const attTrendChartData = {
    labels: attTrendMonths,
    datasets: attTrendLines
  };

  // --- Timelog Table Columns ---
  const tableColumns = [
    { key: 'employeeId', label: 'Emp ID' },
    { key: 'fullName', label: 'Employee Name' },
    { key: 'projectName', label: 'Project' },
    { key: 'clientName', label: 'Client' },
    { key: 'taskName', label: 'Task' },
    { key: 'billableStatus', label: 'Billing Status',
      render: (row, val) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          val === 'Billable' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>{val}</span>
      )
    },
    { key: 'approvalStatus', label: 'Approval Status',
      render: (row, val) => {
        let colors = 'bg-slate-100 text-slate-600 border border-slate-200';
        if (val === 'Approved') colors = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        if (val === 'Pending') colors = 'bg-blue-50 text-blue-700 border border-blue-200';
        if (val === 'Not Submitted') colors = 'bg-red-50 text-red-700 border border-red-200';
        return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors}`}>{val}</span>;
      }
    },
    { key: 'hours', label: 'Hours', rightAlign: true, render: (_, val) => <span className="font-bold">{fmtHr(val)}</span> }
  ];

  const sections = [
    { id: 'daily', label: 'Daily Effort', icon: 'bar_chart' },
    { id: 'compliance', label: 'Compliance Funnel', icon: 'fact_check' },
    { id: 'heatmap', label: 'Dept Heatmap', icon: 'grid_on' },
    { id: 'attendance', label: 'Attendance Trend', icon: 'trending_up' },
  ];

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">Workload Intensity & Allocation</h2>
        <p className="text-on-surface-variant text-sm">Real-time resource distribution, compliance tracking, and utilization analytics.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-outline-variant/10 pb-0">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeSection === s.id
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Daily Effort Section */}
      {activeSection === 'daily' && (
        <>
          <ChartCard
            title="Daily Effort Distribution"
            subtitle="Tracking billable vs non-billable efforts over time"
            className="h-[400px]"
          >
            {heatmap.length > 0 ? (
              <Bar data={heatChartData} options={heatOptions} />
            ) : (
              <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No utilization data for selected period</div>
            )}
          </ChartCard>

          <DataTable
            title="Raw Timesheet Entries"
            subtitle="Showing top 200 logs matching active filters"
            data={timelogs}
            columns={tableColumns}
            isLoading={loading}
          />
        </>
      )}

      {/* Compliance Funnel Section */}
      {activeSection === 'compliance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Timesheet Compliance Funnel"
              subtitle="Approved vs Submitted vs Not Submitted entries per month"
              className="h-[380px]"
            >
              {compliance.length > 0 ? (
                <Bar
                  data={complianceChartData}
                  options={{
                    ...commonOptions,
                    indexAxis: 'y',
                    scales: {
                      x: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } },
                      y: { stacked: true, grid: { display: false } }
                    }
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No compliance data</div>
              )}
            </ChartCard>

            <ChartCard
              title="Compliance Rate Trend"
              subtitle="Approval rate % over time"
              className="h-[380px]"
            >
              {compliance.length > 0 ? (
                <Line
                  data={complianceLineData}
                  options={{
                    ...commonOptions,
                    scales: {
                      ...commonOptions.scales,
                      y: { ...commonOptions.scales.y, min: 0, max: 100, ticks: { callback: v => v + '%' } }
                    }
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No compliance data</div>
              )}
            </ChartCard>
          </div>

          {/* Compliance Summary Cards */}
          {compliance.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const c = compliance[compliance.length - 1];
                return <>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Entries</p>
                    <p className="text-2xl font-extrabold text-on-surface mt-1">{c.totalEntries.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Approved</p>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{c.approved.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pending</p>
                    <p className="text-2xl font-extrabold text-blue-600 mt-1">{c.pending.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Compliance Rate</p>
                    <p className={`text-2xl font-extrabold mt-1 ${c.complianceRate >= 70 ? 'text-emerald-600' : c.complianceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.complianceRate}%</p>
                  </div>
                </>;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Department Utilization Heatmap Section */}
      {activeSection === 'heatmap' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="text-lg font-bold text-on-surface">Department Utilization Heatmap</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Cross-month utilization % per department (based on 160h/month FTE capacity).
              {heatmapDepts.length > 0 && ` ${heatmapDepts.length} departments across ${heatmapMonths.length} month${heatmapMonths.length !== 1 ? 's' : ''}.`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-10 min-w-[200px]">Department</th>
                  {heatmapMonths.map(m => (
                    <th key={m} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center min-w-[80px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {heatmapDepts.map(dept => (
                  <tr key={dept} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-on-surface sticky left-0 bg-surface-container-lowest z-10 border-r border-outline-variant/10">
                      {dept}
                    </td>
                    {heatmapMonths.map(m => {
                      const cell = heatmapGrid[dept]?.[m];
                      const pct = cell?.utilizationPct || 0;
                      return (
                        <td key={m} className="px-1 py-1 text-center">
                          <div
                            className={`rounded px-2 py-1.5 text-[11px] font-bold ${getHeatmapColor(pct)}`}
                            title={`${dept} — ${m}: ${pct}% utilization (${fmtHr(cell?.deptHours || 0)}h, ${cell?.headcount || 0} FTE)`}
                          >
                            {pct > 0 ? `${pct}%` : '-'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {heatmapDepts.length === 0 && (
                  <tr>
                    <td colSpan={1 + heatmapMonths.length} className="px-6 py-8 text-center text-sm text-on-surface-variant italic">
                      No department utilization data available
                    </td>
                  </tr>
                )}
                {/* Company Average Footer */}
                {heatmapDepts.length > 0 && (
                  <tr className="bg-surface-container font-bold">
                    <td className="px-4 py-2.5 sticky left-0 bg-surface-container z-10 border-r border-outline-variant/10 text-on-surface">
                      Company Average
                    </td>
                    {heatmapMonths.map(m => {
                      const monthData = deptHeatmap.filter(d => d.yearMonth === m);
                      const totalHrs = monthData.reduce((s, d) => s + d.deptHours, 0);
                      const totalHc = monthData.reduce((s, d) => s + d.headcount, 0);
                      const avgPct = totalHc > 0 ? Math.round(totalHrs / (totalHc * 160) * 100 * 10) / 10 : 0;
                      return (
                        <td key={m} className="px-1 py-1 text-center">
                          <div className={`rounded px-2 py-1.5 text-[11px] font-bold ${getHeatmapColor(avgPct)}`}>
                            {avgPct > 0 ? `${avgPct}%` : '-'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="p-4 border-t border-outline-variant/10 flex items-center gap-4 text-[10px] text-on-surface-variant">
            <span className="font-bold uppercase tracking-wider">Legend:</span>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-surface-container-highest rounded"></div> &lt;50%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-50 rounded"></div> 50-70%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-200 rounded"></div> 70-85%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-blue-500 rounded"></div> 85-100%</div>
            <div className="flex items-center gap-1"><div className="w-4 h-3 bg-red-500 rounded"></div> &gt;100%</div>
          </div>
        </div>
      )}

      {/* Attendance Trend Section */}
      {activeSection === 'attendance' && (
        <div className="space-y-6">
          <ChartCard
            title="Attendance Rate Trend"
            subtitle="Monthly attendance rate % by department (top 8 by headcount)"
            className="h-[450px]"
          >
            {attTrendLines.length > 0 ? (
              <Line
                data={attTrendChartData}
                options={{
                  ...commonOptions,
                  plugins: { legend: { position: 'right', labels: { font: { size: 10 }, usePointStyle: true, padding: 8 } } },
                  scales: {
                    ...commonOptions.scales,
                    y: { ...commonOptions.scales.y, min: 0, max: 105, ticks: { callback: v => v + '%' } }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No attendance trend data</div>
            )}
          </ChartCard>

          {/* Attendance Summary Table */}
          {attendanceTrend.length > 0 && (() => {
            // Aggregate by dept across all months
            const deptAgg = {};
            attendanceTrend.forEach(d => {
              if (!deptAgg[d.department]) deptAgg[d.department] = { present: 0, absent: 0, leave: 0, tracked: 0 };
              deptAgg[d.department].present += d.totalPresent;
              deptAgg[d.department].absent += d.totalAbsent;
              deptAgg[d.department].leave += d.totalLeave;
              deptAgg[d.department].tracked += d.totalTrackedDays;
            });
            const deptRows = Object.entries(deptAgg).map(([dept, v]) => ({
              department: dept,
              present: v.present,
              absent: v.absent,
              leave: v.leave,
              tracked: v.tracked,
              rate: v.tracked > 0 ? Math.round((v.present / v.tracked) * 100 * 10) / 10 : 0
            })).sort((a, b) => a.rate - b.rate);

            return (
              <DataTable
                title="Department Attendance Summary"
                subtitle="Aggregated across all loaded months"
                data={deptRows}
                columns={[
                  { key: 'department', label: 'Department' },
                  { key: 'present', label: 'Present Days', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{v}</span> },
                  { key: 'absent', label: 'Absent Days', rightAlign: true, render: (_, v) => <span className="font-bold text-red-600">{v}</span> },
                  { key: 'leave', label: 'Leave Days', rightAlign: true },
                  { key: 'tracked', label: 'Total Tracked', rightAlign: true },
                  { key: 'rate', label: 'Attendance %', rightAlign: true,
                    render: (_, v) => (
                      <span className={`font-bold ${v >= 95 ? 'text-emerald-600' : v >= 85 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span>
                    )
                  }
                ]}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
