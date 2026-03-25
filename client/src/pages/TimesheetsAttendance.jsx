import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

const palette = ['#004ac6', '#10b981', '#943700', '#2563eb', '#ba1a1a', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

const STATUS_COLORS = {
  P: 'bg-blue-500 text-white', PDA: 'bg-blue-400 text-white', W: 'bg-gray-200 text-gray-500',
  A: 'bg-red-500 text-white', H: 'bg-purple-500 text-white', VH: 'bg-orange-400 text-white',
  VRL: 'bg-orange-300 text-orange-900', VEL: 'bg-orange-300 text-orange-900', VHK: 'bg-teal-400 text-white',
  SLR: 'bg-yellow-400 text-yellow-900', SL: 'bg-yellow-400 text-yellow-900', CL: 'bg-pink-300 text-pink-900',
  '-': 'bg-gray-100 text-gray-300', '': 'bg-gray-50 text-gray-200',
};
const STATUS_LABELS = { P: 'Present', PDA: 'Present (PDA)', W: 'Weekend', A: 'Absent', H: 'Holiday', VH: 'Vacation', VRL: 'Earned Leave', VEL: 'Earned Leave', VHK: 'Vacation HK', SLR: 'Sick Leave', SL: 'Sick Leave', CL: 'Casual Leave' };
function getStatusColor(status) { return STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'; }

export default function TimesheetsAttendance() {
  const { loadingInitial, isRefreshing, selectedMonths, availableMonths, groupBy, squadMap } = useData();
  const { req } = useApi();
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(true);

  // Daily Effort
  const [heatmap, setHeatmap] = useState([]);
  const [timelogs, setTimelogs] = useState([]);
  // Compliance
  const [compliance, setCompliance] = useState([]);
  const [employeeCompliance, setEmployeeCompliance] = useState([]);
  // Attendance
  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [managerData, setManagerData] = useState([]);
  // Leave
  const [leaveCalendar, setLeaveCalendar] = useState({});
  const [leaveForecast, setLeaveForecast] = useState(null);
  const [leaveDept, setLeaveDept] = useState('');

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      const allQs = availableMonths.length > 0 ? `?months=${availableMonths.join(',')}` : qs;

      try {
        const results = await Promise.allSettled([
          req(`/heatmap${qs}`),
          req(`/timelog${qs}${qs ? '&' : '?'}pageSize=200`),
          req(`/analytics/compliance${allQs}`),
          req(`/analytics/timesheet-compliance${qs}`),
          req(`/attendance${qs}`),
          req(`/analytics/attendance-trend${allQs}`),
          req(`/analytics/manager-scorecard${qs}`),
          req('/analytics/leave-forecast')
        ]);
        setHeatmap(results[0].status === 'fulfilled' ? (results[0].value || []) : []);
        setTimelogs(results[1].status === 'fulfilled' ? (results[1].value?.rows || results[1].value || []) : []);
        setCompliance(results[2].status === 'fulfilled' ? (results[2].value || []) : []);
        setEmployeeCompliance(results[3].status === 'fulfilled' ? (results[3].value || []) : []);
        setAttendanceData(results[4].status === 'fulfilled' ? (results[4].value || { employees: [], dates: [] }) : { employees: [], dates: [] });
        setAttendanceTrend(results[5].status === 'fulfilled' ? (results[5].value || []) : []);
        setManagerData(results[6].status === 'fulfilled' ? (results[6].value || []) : []);
        setLeaveForecast(results[7].status === 'fulfilled' ? (results[7].value || null) : null);
      } catch (err) { console.error("Timesheets fetch error", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req, availableMonths]);

  // Leave calendar (depends on dept filter)
  useEffect(() => {
    if (loadingInitial) return;
    const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '?';
    const deptQs = leaveDept ? `&dept=${encodeURIComponent(leaveDept)}` : '';
    req(`/analytics/leave-calendar${qs}${deptQs}`).then(d => setLeaveCalendar(d || {})).catch(() => {});
  }, [selectedMonths, leaveDept, loadingInitial, req]);

  // All useMemo hooks BEFORE early returns
  const { attTrendMonths, attTrendLines } = useMemo(() => {
    const months = [...new Set(attendanceTrend.map(d => d.yearMonth))].sort();
    const deptMap = {};
    attendanceTrend.forEach(d => { if (!deptMap[d.department]) deptMap[d.department] = {}; deptMap[d.department][d.yearMonth] = d.attendanceRate; });
    const deptTotals = {};
    attendanceTrend.forEach(d => { deptTotals[d.department] = (deptTotals[d.department] || 0) + d.totalTrackedDays; });
    const topDepts = Object.entries(deptTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(d => d[0]);
    const lines = topDepts.map((dept, i) => ({
      label: dept.length > 20 ? dept.substring(0, 20) + '...' : dept,
      data: months.map(m => deptMap[dept]?.[m] ?? null),
      borderColor: palette[i % palette.length], tension: 0.3, spanGaps: true, pointRadius: 3
    }));
    return { attTrendMonths: months, attTrendLines: lines };
  }, [attendanceTrend]);

  const uniqueDepts = useMemo(() => [...new Set(attendanceData.employees.map(e => e.department))].filter(Boolean).sort(), [attendanceData.employees]);

  const filteredEmployees = useMemo(() => attendanceData.employees.filter(e => {
    const matchName = !filterName || (e.name || '').toLowerCase().includes(filterName.toLowerCase()) || (e.employeeId || '').toLowerCase().includes(filterName.toLowerCase());
    const matchDept = !filterDept || e.department === filterDept;
    return matchName && matchDept;
  }), [attendanceData.employees, filterName, filterDept]);

  const groupedByDept = useMemo(() => {
    const groups = {};
    filteredEmployees.forEach(emp => {
      const key = groupBy === 'squad' ? (squadMap[emp.employeeId] || 'Unassigned') : (emp.department || 'Unassigned');
      if (!groups[key]) groups[key] = [];
      groups[key].push(emp);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees, groupBy, squadMap]);

  const dayColumns = useMemo(() => attendanceData.dates.map(d => {
    const date = new Date(d);
    return { dateStr: d, day: date.getDate(), dow: date.getDay() };
  }), [attendanceData.dates]);

  const uniqueLeaveDepts = useMemo(() => [...new Set(attendanceTrend.map(d => d.department))].filter(Boolean).sort(), [attendanceTrend]);

  if (loadingInitial || (loading && !isRefreshing && heatmap.length === 0 && attendanceData.employees.length === 0)) {
    return <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant"><span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span><p>Loading timesheet data...</p></div>;
  }

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // Chart data
  const heatChartData = {
    labels: heatmap.map(d => d.dateStr.substring(5)),
    datasets: [
      { label: 'Billable Hours', data: heatmap.map(d => d.billableHours), backgroundColor: chartColors.emerald, stack: 'Stack 0' },
      { label: 'Non-Billable Hours', data: heatmap.map(d => d.nonBillableHours), backgroundColor: chartColors.slate, stack: 'Stack 0' }
    ]
  };

  const complianceChartData = {
    labels: compliance.map(c => c.yearMonth),
    datasets: [
      { label: 'Approved', data: compliance.map(c => c.approved), backgroundColor: chartColors.primary },
      { label: 'Submitted (not approved)', data: compliance.map(c => (c.submitted || 0) - c.approved), backgroundColor: '#acbfff' },
      { label: 'Not Submitted', data: compliance.map(c => c.notSubmitted), backgroundColor: chartColors.error },
    ]
  };
  const complianceLineData = {
    labels: compliance.map(c => c.yearMonth),
    datasets: [{ label: 'Compliance Rate %', data: compliance.map(c => c.complianceRate), borderColor: chartColors.primary, backgroundColor: chartColors.primaryLight, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: chartColors.primary }]
  };

  const tableColumns = [
    { key: 'employeeId', label: 'Emp ID' },
    { key: 'fullName', label: 'Employee Name' },
    { key: 'projectName', label: 'Project' },
    { key: 'clientName', label: 'Client' },
    { key: 'taskName', label: 'Task' },
    { key: 'billableStatus', label: 'Billing', render: (_, val) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${val === 'Billable' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{val}</span> },
    { key: 'approvalStatus', label: 'Approval', render: (_, val) => { let c = 'bg-slate-100 text-slate-600 border border-slate-200'; if (val === 'Approved') c = 'bg-emerald-50 text-emerald-700 border border-emerald-200'; if (val === 'Pending') c = 'bg-blue-50 text-blue-700 border border-blue-200'; if (val === 'Not Submitted') c = 'bg-red-50 text-red-700 border border-red-200'; return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c}`}>{val}</span>; } },
    { key: 'hours', label: 'Hours', rightAlign: true, render: (_, val) => <span className="font-bold">{fmtHr(val)}</span> }
  ];

  const calendarDates = Object.keys(leaveCalendar).sort();
  const calendarMonths = [...new Set(calendarDates.map(d => d.substring(0, 7)))].sort();

  const tabs = [
    { id: 'daily', label: 'Daily View', icon: 'bar_chart' },
    { id: 'compliance', label: 'Compliance', icon: 'fact_check' },
    { id: 'attendance', label: 'Attendance', icon: 'calendar_month' },
    { id: 'leave', label: 'Leave', icon: 'event_repeat' },
  ];

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      <header>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Time Tracking & Attendance</h3>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Timesheets & Attendance</h1>
      </header>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-outline-variant/10 pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-slate-300'
            }`}>
            <span className="material-symbols-outlined text-sm">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ═══ DAILY VIEW ═══ */}
      {activeTab === 'daily' && (
        <>
          <ChartCard title="Daily Effort Distribution" subtitle="Billable vs non-billable hours per day" className="h-[400px]">
            {heatmap.length > 0 ? (
              <Bar data={heatChartData} options={{ ...commonOptions, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } }, y: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
          </ChartCard>
          <DataTable title="Raw Timesheet Entries" subtitle="Top 200 entries" data={timelogs} columns={tableColumns} isLoading={loading} />
        </>
      )}

      {/* ═══ COMPLIANCE ═══ */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {compliance.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const latest = compliance[compliance.length - 1];
                const totalHrs = latest.totalHours || 0;
                const approvedHrs = latest.approvedHours || 0;
                const approvalPct = totalHrs > 0 ? Math.round((approvedHrs / totalHrs) * 100) : 0;
                return <>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Entries</p><p className="text-2xl font-extrabold text-on-surface mt-1">{latest.totalEntries.toLocaleString()}</p></div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Approved</p><p className="text-2xl font-extrabold text-emerald-600 mt-1">{latest.approved.toLocaleString()}</p></div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Not Submitted</p><p className="text-2xl font-extrabold text-red-600 mt-1">{latest.notSubmitted.toLocaleString()}</p></div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Approval Rate</p><p className={`text-2xl font-extrabold mt-1 ${approvalPct >= 90 ? 'text-emerald-600' : approvalPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{approvalPct}%</p></div>
                </>;
              })()}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Compliance Funnel" subtitle="Approved vs Submitted vs Not Submitted" className="h-[380px]">
              {compliance.length > 0 ? <Bar data={complianceChartData} options={{ ...commonOptions, indexAxis: 'y', scales: { x: { stacked: true, grid: { color: chartColors.gridLines } }, y: { stacked: true, grid: { display: false } } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
            </ChartCard>
            <ChartCard title="Compliance Rate Trend" subtitle="Approval rate % over time" className="h-[380px]">
              {compliance.length > 0 ? <Line data={complianceLineData} options={{ ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 100, ticks: { callback: v => v + '%' } } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
            </ChartCard>
          </div>

          {/* Per-Employee Missed Timesheet */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="p-6 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold text-on-surface">Per-Employee Missed Timesheet Report</h3>
              <p className="text-xs text-on-surface-variant mt-1">Working days vs days with timesheets. {employeeCompliance.filter(e => e.compliancePct < 80).length} employees below 80%.</p>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10"><tr className="bg-surface-container border-b border-outline-variant/10">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Squad</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Working Days</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Days Logged</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Missed</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Compliance</th>
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {employeeCompliance.map(e => (
                    <tr key={e.employeeId} className="hover:bg-surface-container-low/50">
                      <td className="px-4 py-3"><p className="text-xs font-semibold">{e.name}</p><p className="text-[9px] text-on-surface-variant">{e.employeeId}</p></td>
                      <td className="px-4 py-3 text-xs">{e.squad || '-'}</td>
                      <td className="px-4 py-3 text-xs text-right font-semibold">{e.totalWorkingDays}</td>
                      <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600">{e.daysLogged}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold">{e.missedDays > 0 ? <span className="text-red-600">{e.missedDays}</span> : <span className="text-emerald-600">0</span>}</td>
                      <td className="px-4 py-3 text-right"><span className={`text-xs font-bold px-2 py-0.5 rounded ${e.compliancePct >= 95 ? 'bg-emerald-50 text-emerald-700' : e.compliancePct >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{e.compliancePct}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ATTENDANCE ═══ */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase">Search</label>
              <div className="relative"><span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant">search</span>
              <input type="text" placeholder="Name or ID..." value={filterName} onChange={e => setFilterName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm rounded-lg pl-10 pr-3 py-2 outline-none focus:border-primary placeholder-on-surface-variant" /></div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase">Department</label>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm rounded-lg px-3 py-2 outline-none focus:border-primary">
                <option value="">All</option>{uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-on-surface-variant px-2">
            <span className="font-bold uppercase tracking-wider">Legend:</span>
            {Object.entries(STATUS_LABELS).map(([code, label]) => (
              <div key={code} className="flex items-center gap-1"><div className={`w-5 h-4 rounded text-[8px] font-bold flex items-center justify-center ${getStatusColor(code)}`}>{code}</div><span>{label}</span></div>
            ))}
          </div>

          {/* Grid */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="text-left border-collapse text-[11px]">
                <thead className="sticky top-0 z-20"><tr className="bg-surface-container">
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-30 min-w-[180px]">Employee</th>
                  <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant min-w-[80px]">{groupBy === 'squad' ? 'Squad' : 'Dept'}</th>
                  {dayColumns.map(d => <th key={d.dateStr} className={`px-0.5 py-2 text-[9px] font-bold text-center min-w-[28px] ${d.dow === 0 || d.dow === 6 ? 'text-slate-400' : 'text-on-surface-variant'}`}>{d.day}</th>)}
                  <th className="px-2 py-2 text-[9px] font-bold uppercase text-center bg-surface-container">P</th>
                  <th className="px-2 py-2 text-[9px] font-bold uppercase text-center bg-surface-container">A</th>
                  <th className="px-2 py-2 text-[9px] font-bold uppercase text-center bg-surface-container">LV</th>
                </tr></thead>
                <tbody>
                  {groupedByDept.map(([dept, employees]) => (
                    <React.Fragment key={`dept-${dept}`}>
                      <tr className="bg-surface-container-low/60"><td colSpan={3 + dayColumns.length + 3} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{dept} ({employees.length})</td></tr>
                      {employees.map(emp => {
                        const leaveDays = Object.values(emp.days || {}).filter(s => s && !['P','PDA','W','H','-','A',''].includes(s)).length;
                        return (
                          <tr key={emp.employeeId} className="hover:bg-surface-container-low/30 border-b border-outline-variant/5">
                            <td className="px-3 py-1 sticky left-0 bg-surface-container-lowest z-10"><span className="font-semibold text-on-surface">{emp.name}</span></td>
                            <td className="px-2 py-1 text-on-surface-variant truncate max-w-[80px]">{(groupBy === 'squad' ? (squadMap[emp.employeeId] || '-') : (emp.department || '-')).substring(0, 12)}</td>
                            {dayColumns.map(d => {
                              const status = emp.days?.[d.dateStr] || '-';
                              return <td key={d.dateStr} className="px-0 py-0.5 text-center"><div className={`mx-auto w-6 h-5 rounded-sm text-[8px] font-bold flex items-center justify-center ${getStatusColor(status)}`} title={`${emp.name} — ${d.dateStr}: ${STATUS_LABELS[status] || status}`}>{status === '-' ? '' : status.substring(0, 2)}</div></td>;
                            })}
                            <td className="px-2 py-1 text-center font-bold text-emerald-600">{emp.presentDays || 0}</td>
                            <td className="px-2 py-1 text-center font-bold text-red-600">{emp.absentDays || 0}</td>
                            <td className="px-2 py-1 text-center font-bold text-amber-600">{leaveDays}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance Trend */}
          <ChartCard title="Attendance Rate Trend" subtitle="Monthly attendance % by department (top 8)" className="h-[400px]">
            {attTrendLines.length > 0 ? (
              <Line data={{ labels: attTrendMonths, datasets: attTrendLines }} options={{ ...commonOptions, plugins: { legend: { position: 'right', labels: { font: { size: 10 }, usePointStyle: true, padding: 8 } } }, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 105, ticks: { callback: v => v + '%' } } } }} />
            ) : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
          </ChartCard>

          {/* Manager Scorecard */}
          <DataTable title="Department Attendance Scorecard" subtitle="Sorted by lowest attendance rate" data={managerData} columns={[
            { key: 'managerGroup', label: 'Department' },
            { key: 'directReports', label: 'Employees', rightAlign: true },
            { key: 'totalPresent', label: 'Present', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{v}</span> },
            { key: 'totalAbsent', label: 'Absent', rightAlign: true, render: (_, v) => <span className="font-bold text-red-600">{v}</span> },
            { key: 'totalLeave', label: 'Leave', rightAlign: true },
            { key: 'attendanceRate', label: 'Rate %', rightAlign: true, render: (_, v) => <span className={`font-bold ${v >= 95 ? 'text-emerald-600' : v >= 85 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span> }
          ]} />
        </div>
      )}

      {/* ═══ LEAVE ═══ */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          {/* Leave Calendar */}
          <div className="flex items-center gap-4">
            <select value={leaveDept} onChange={e => setLeaveDept(e.target.value)} className="bg-surface-container-lowest border border-outline-variant/30 text-sm rounded-lg px-3 py-2 outline-none focus:border-primary">
              <option value="">All Departments</option>
              {uniqueLeaveDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {calendarMonths.map(month => {
            const year = parseInt(month.split('-')[0]);
            const mon = parseInt(month.split('-')[1]) - 1;
            const daysInMonth = new Date(year, mon + 1, 0).getDate();
            const firstDay = new Date(year, mon, 1).getDay();
            const weeks = []; let week = new Array(firstDay).fill(null);
            for (let d = 1; d <= daysInMonth; d++) { week.push(d); if (week.length === 7) { weeks.push(week); week = []; } }
            if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
            return (
              <div key={month} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
                <h3 className="text-sm font-bold text-on-surface mb-3">{month}</h3>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-[9px] font-bold text-on-surface-variant uppercase py-1">{d}</div>)}
                  {weeks.flat().map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
                    const info = leaveCalendar[dateStr];
                    const count = info?.onLeave || 0;
                    let bg = 'bg-surface-container-low text-on-surface';
                    if (count >= 6) bg = 'bg-red-500 text-white'; else if (count >= 4) bg = 'bg-blue-500 text-white'; else if (count >= 2) bg = 'bg-blue-200 text-blue-900'; else if (count >= 1) bg = 'bg-blue-50 text-blue-800';
                    return <div key={i} className={`rounded p-1.5 text-[11px] font-semibold cursor-default ${bg}`} title={info ? `${count} on leave: ${info.employees.slice(0, 5).join(', ')}` : dateStr}>{day}</div>;
                  })}
                </div>
              </div>
            );
          })}

          {/* Leave Patterns */}
          {leaveForecast && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Leave by Day of Week" subtitle="Average employees on leave per weekday" className="h-[350px]">
                  {leaveForecast.byDayOfWeek.length > 0 ? <Bar data={{ labels: leaveForecast.byDayOfWeek.map(d => d.dayName.substring(0, 3)), datasets: [{ label: 'Avg/Day', data: leaveForecast.byDayOfWeek.map(d => d.avgPerDay), backgroundColor: palette.slice(0, 7), borderRadius: 4 }] }} options={{ ...commonOptions, plugins: { legend: { display: false } } }} /> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
                </ChartCard>
                <ChartCard title="Leave Type Distribution" subtitle="Breakdown by leave code">
                  {leaveForecast.leaveTypes.length > 0 ? <div className="h-full flex items-center justify-center pb-4 pt-2"><Doughnut data={{ labels: leaveForecast.leaveTypes.map(t => t.type), datasets: [{ data: leaveForecast.leaveTypes.map(t => t.count), backgroundColor: palette, borderWidth: 0 }] }} options={{ ...commonOptions, cutout: '60%', plugins: { legend: { position: 'right', labels: { font: { size: 10 }, padding: 6 } } } }} /></div> : <div className="flex h-full items-center justify-center text-on-surface-variant italic text-sm">No data</div>}
                </ChartCard>
              </div>
              {leaveForecast.topLeaveTakers.length > 0 && (
                <DataTable title="Top Leave Takers" data={leaveForecast.topLeaveTakers} columns={[
                  { key: 'name', label: 'Employee' }, { key: 'department', label: 'Department' },
                  { key: 'totalLeaveDays', label: 'Leave Days', rightAlign: true, render: (_, v) => <span className="font-bold text-error">{v}</span> },
                  { key: 'leaveTypes', label: 'Types', render: (_, v) => <div className="flex gap-1 flex-wrap">{(v || []).map((t, i) => <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">{t}</span>)}</div> }
                ]} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
