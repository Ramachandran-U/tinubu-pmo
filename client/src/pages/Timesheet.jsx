import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import UploadZone from '../components/UploadZone';
import DataTable from '../components/DataTable';

// Attendance status color map
const STATUS_COLORS = {
  P:   'bg-blue-500 text-white',
  PDA: 'bg-blue-400 text-white',
  W:   'bg-gray-200 text-gray-500',
  A:   'bg-red-500 text-white',
  H:   'bg-purple-500 text-white',
  VH:  'bg-orange-400 text-white',
  VRL: 'bg-orange-300 text-orange-900',
  VEL: 'bg-orange-300 text-orange-900',
  VHK: 'bg-teal-400 text-white',
  SLR: 'bg-yellow-400 text-yellow-900',
  SL:  'bg-yellow-400 text-yellow-900',
  CL:  'bg-pink-300 text-pink-900',
  '-': 'bg-gray-100 text-gray-300',
  '':  'bg-gray-50 text-gray-200',
};

const STATUS_LABELS = {
  P: 'Present', PDA: 'Present (PDA)', W: 'Weekend', A: 'Absent',
  H: 'Holiday', VH: 'Vacation', VRL: 'Earned Leave', VEL: 'Earned Leave',
  VHK: 'Vacation HK', SLR: 'Sick Leave', SL: 'Sick Leave', CL: 'Casual Leave',
};

function getStatusColor(status) {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
}

export default function Timesheet() {
  const { loadingInitial, isRefreshing, selectedMonths, refetchAll, groupBy, squadMap } = useData();
  const { req } = useApi();

  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [uploadHistory, setUploadHistory] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [employeeCompliance, setEmployeeCompliance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grid');

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLoc, setFilterLoc] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [attData, historyData, compData, empCompData] = await Promise.allSettled([
          req(`/attendance${qs}`),
          req('/months/active-versions'),
          req(`/analytics/compliance${qs}`),
          req(`/analytics/timesheet-compliance${qs}`)
        ]);
        setAttendanceData(attData.status === 'fulfilled' ? (attData.value || { employees: [], dates: [] }) : { employees: [], dates: [] });
        setUploadHistory(historyData.status === 'fulfilled' ? (historyData.value || []) : []);
        setCompliance(compData.status === 'fulfilled' ? (compData.value || []) : []);
        setEmployeeCompliance(empCompData.status === 'fulfilled' ? (empCompData.value || []) : []);
      } catch (err) {
        console.error("Failed to load timesheet data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  const handleUploadSuccess = () => refetchAll();

  // Derive filter options
  const uniqueDepts = useMemo(() =>
    [...new Set(attendanceData.employees.map(e => e.department))].filter(Boolean).sort(),
    [attendanceData.employees]
  );
  const uniqueLocs = useMemo(() =>
    [...new Set(attendanceData.employees.map(e => e.location))].filter(Boolean).sort(),
    [attendanceData.employees]
  );

  // Filter employees
  const filteredEmployees = useMemo(() =>
    attendanceData.employees.filter(e => {
      const matchName = !filterName || (e.name || '').toLowerCase().includes(filterName.toLowerCase()) || (e.employeeId || '').toLowerCase().includes(filterName.toLowerCase());
      const matchDept = !filterDept || e.department === filterDept;
      const matchLoc = !filterLoc || e.location === filterLoc;
      return matchName && matchDept && matchLoc;
    }),
    [attendanceData.employees, filterName, filterDept, filterLoc]
  );

  // Group by department or squad based on toggle
  const groupedByDept = useMemo(() => {
    const groups = {};
    filteredEmployees.forEach(emp => {
      const key = groupBy === 'squad'
        ? (squadMap[emp.employeeId] || 'Unassigned')
        : (emp.department || 'Unassigned');
      if (!groups[key]) groups[key] = [];
      groups[key].push(emp);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees, groupBy, squadMap]);

  // Get day numbers from dates
  const dayColumns = useMemo(() => {
    return attendanceData.dates.map(d => {
      const date = new Date(d);
      return { dateStr: d, day: date.getDate(), dow: date.getDay() };
    });
  }, [attendanceData.dates]);

  // Compliance table columns
  const complianceColumns = [
    { key: 'yearMonth', label: 'Month' },
    { key: 'totalEntries', label: 'Total Entries', rightAlign: true },
    { key: 'approved', label: 'Approved', rightAlign: true, render: (_, v) => <span className="font-bold text-emerald-600">{v.toLocaleString()}</span> },
    { key: 'pending', label: 'Pending', rightAlign: true, render: (_, v) => <span className="font-bold text-blue-600">{v.toLocaleString()}</span> },
    { key: 'notSubmitted', label: 'Not Submitted', rightAlign: true, render: (_, v) => <span className="font-bold text-red-600">{v.toLocaleString()}</span> },
    { key: 'complianceRate', label: 'Compliance %', rightAlign: true,
      render: (_, v) => (
        <span className={`font-bold ${v >= 95 ? 'text-emerald-600' : v >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{v}%</span>
      )
    }
  ];

  // Active upload versions
  const activeVersions = uploadHistory.filter(u =>
    selectedMonths.length === 0 || selectedMonths.includes(u.year_month)
  );

  const tabs = [
    { id: 'grid', label: 'Attendance Grid', icon: 'calendar_month' },
    { id: 'compliance', label: 'Submission Compliance', icon: 'fact_check' },
    { id: 'upload', label: 'Data Upload', icon: 'cloud_upload' },
  ];

  return (
    <div className={`space-y-8 transition-opacity duration-300 ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>

      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
            <span>Data Operations</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">Timesheet & Attendance</span>
          </nav>
          <h2 className="text-2xl font-semibold text-on-surface tracking-tight">Data Management Hub</h2>
          <p className="text-on-surface-variant text-sm mt-1">Upload Zoho exports, track attendance, and monitor submission compliance.</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b border-outline-variant/10 pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ ATTENDANCE GRID TAB ═══ */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Search</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant">search</span>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg pl-10 pr-3 py-2 outline-none focus:border-primary transition-colors placeholder-on-surface-variant"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Department</label>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors">
                <option value="">All Departments</option>
                {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
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
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-on-surface-variant px-2">
            <span className="font-bold uppercase tracking-wider">Legend:</span>
            {Object.entries(STATUS_LABELS).map(([code, label]) => (
              <div key={code} className="flex items-center gap-1">
                <div className={`w-5 h-4 rounded text-[8px] font-bold flex items-center justify-center ${getStatusColor(code)}`}>{code}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* The Grid */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Attendance Muster Roll</h3>
                <p className="text-[10px] text-on-surface-variant">
                  {filteredEmployees.length} employees, {dayColumns.length} days
                </p>
              </div>
              {loading && <span className="material-symbols-outlined text-sm text-slate-500 animate-spin">sync</span>}
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="text-left border-collapse text-[11px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-surface-container">
                    <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant sticky left-0 bg-surface-container z-30 min-w-[180px]">Employee</th>
                    <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant min-w-[80px]">{groupBy === 'squad' ? 'Squad' : 'Dept'}</th>
                    {dayColumns.map(d => (
                      <th key={d.dateStr} className={`px-0.5 py-2 text-[9px] font-bold text-center min-w-[28px] ${d.dow === 0 || d.dow === 6 ? 'text-slate-400' : 'text-on-surface-variant'}`}>
                        {d.day}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant text-center bg-surface-container">P</th>
                    <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant text-center bg-surface-container">A</th>
                    <th className="px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant text-center bg-surface-container">LV</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByDept.map(([dept, employees]) => (
                    <React.Fragment key={`dept-${dept}`}>
                      {/* Department header row */}
                      <tr className="bg-surface-container-low/60">
                        <td colSpan={3 + dayColumns.length + 3} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {dept} ({employees.length})
                        </td>
                      </tr>
                      {employees.map(emp => {
                        const leaveDays = Object.values(emp.days || {}).filter(s => s && !['P','PDA','W','H','-','A',''].includes(s)).length;
                        return (
                          <tr key={emp.employeeId} className="hover:bg-surface-container-low/30 transition-colors border-b border-outline-variant/5">
                            <td className="px-3 py-1 sticky left-0 bg-surface-container-lowest z-10">
                              <div className="truncate max-w-[170px]">
                                <span className="font-semibold text-on-surface">{emp.name}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1 text-on-surface-variant truncate max-w-[80px]" title={groupBy === 'squad' ? (squadMap[emp.employeeId] || '-') : emp.department}>
                              {(groupBy === 'squad' ? (squadMap[emp.employeeId] || '-') : (emp.department || '-')).substring(0, 12)}
                            </td>
                            {dayColumns.map(d => {
                              const status = emp.days?.[d.dateStr] || '-';
                              return (
                                <td key={d.dateStr} className="px-0 py-0.5 text-center">
                                  <div
                                    className={`mx-auto w-6 h-5 rounded-sm text-[8px] font-bold flex items-center justify-center ${getStatusColor(status)}`}
                                    title={`${emp.name} — ${d.dateStr}: ${STATUS_LABELS[status] || status}`}
                                  >
                                    {status === '-' ? '' : status.substring(0, 2)}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-center font-bold text-emerald-600">{emp.presentDays || 0}</td>
                            <td className="px-2 py-1 text-center font-bold text-red-600">{emp.absentDays || 0}</td>
                            <td className="px-2 py-1 text-center font-bold text-amber-600">{leaveDays}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                  {filteredEmployees.length === 0 && !loading && (
                    <tr>
                      <td colSpan={3 + dayColumns.length + 3} className="px-6 py-8 text-center text-sm text-on-surface-variant italic">
                        No attendance data for selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ COMPLIANCE TAB ═══ */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {/* Summary cards */}
          {compliance.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const latest = compliance[compliance.length - 1];
                const totalHrs = latest.totalHours || 0;
                const approvedHrs = latest.approvedHours || 0;
                const approvalPct = totalHrs > 0 ? Math.round((approvedHrs / totalHrs) * 100) : 0;
                return <>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Entries</p>
                    <p className="text-2xl font-extrabold text-on-surface mt-1">{latest.totalEntries.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Approved</p>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{latest.approved.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Not Submitted</p>
                    <p className="text-2xl font-extrabold text-red-600 mt-1">{latest.notSubmitted.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Approval Rate</p>
                    <p className={`text-2xl font-extrabold mt-1 ${approvalPct >= 90 ? 'text-emerald-600' : approvalPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {approvalPct}%
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{approvedHrs.toLocaleString()}h / {totalHrs.toLocaleString()}h</p>
                  </div>
                </>;
              })()}
            </div>
          )}

          <DataTable
            title="Monthly Approval Compliance"
            subtitle="Approval rate by month"
            data={compliance}
            columns={complianceColumns}
            isLoading={loading}
          />

          {/* Per-Employee Missed Timesheet Report */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="p-6 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold text-on-surface">Per-Employee Timesheet Submission Tracker</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Shows how many working days each resource missed updating their timesheet.
                {employeeCompliance.length > 0 && ` ${employeeCompliance.filter(e => e.compliancePct < 80).length} employees below 80% compliance.`}
              </p>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container border-b border-outline-variant/10">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Employee</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Squad</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Department</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Working Days</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Days Logged</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Missed Days</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {employeeCompliance.map(e => (
                    <tr key={e.employeeId} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-on-surface">{e.name}</p>
                        <p className="text-[9px] text-on-surface-variant">{e.employeeId}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface">{e.squad || '-'}</td>
                      <td className="px-4 py-3 text-xs text-on-surface">{e.department || '-'}</td>
                      <td className="px-4 py-3 text-xs text-right font-semibold">{e.totalWorkingDays}</td>
                      <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600">{e.daysLogged}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold">
                        {e.missedDays > 0 ? <span className="text-red-600">{e.missedDays}</span> : <span className="text-emerald-600">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          e.compliancePct >= 95 ? 'bg-emerald-50 text-emerald-700' :
                          e.compliancePct >= 80 ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {e.compliancePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {employeeCompliance.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant italic">
                        No compliance data for selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ UPLOAD TAB ═══ */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadZone
              title="Upload Zoho Time Log"
              info="Drag and drop the exported .xlsx timesheet report."
              endpoint="/upload/timelog"
              onUploadSuccess={handleUploadSuccess}
            />
            <UploadZone
              title="Upload Zoho Attendance"
              info="Drag and drop the exported .xlsx muster roll report."
              endpoint="/upload/attendance"
              onUploadSuccess={handleUploadSuccess}
            />
            <UploadZone
              title="Upload Demand Capacity"
              info="Drag and drop the Demand_Capacity .xlsx file for squad mapping."
              endpoint="/upload/demand-capacity"
              onUploadSuccess={handleUploadSuccess}
            />
          </div>

          {/* Active Upload Versions */}
          {activeVersions.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-lg">history</span>
                <h3 className="text-sm font-bold text-on-surface">Active Data Versions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeVersions.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
                    <div className={`h-8 w-8 rounded flex items-center justify-center text-[10px] font-bold ${
                      v.file_type === 'timelog' ? 'bg-primary/10 text-primary' : v.file_type === 'demand_capacity' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      v{v.version}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{v.file_name}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {v.year_month} &middot; {v.file_type} &middot; {v.row_count?.toLocaleString()} rows
                      </p>
                    </div>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
