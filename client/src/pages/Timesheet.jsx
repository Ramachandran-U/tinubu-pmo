import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import UploadZone from '../components/UploadZone';
import DataTable from '../components/DataTable';

export default function Timesheet() {
  const { loadingInitial, isRefreshing, selectedMonths, refetchAll } = useData();
  const { req } = useApi();

  const [attendance, setAttendance] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';

      try {
        const [attData, historyData] = await Promise.all([
          req(`/attendance${qs}`),
          req('/months/active-versions')
        ]);
        const emps = attData?.employees || [];
        const mapped = emps.map(e => ({
          employeeId: e.employeeId,
          employeeName: e.name,
          totalPresent: e.presentDays,
          totalAbsent: e.absentDays,
          totalLeave: 0,
          totalHalfDay: 0,
          totalHoliday: 0,
          totalWeekend: 0
        }));
        setAttendance(mapped);
        setUploadHistory(historyData || []);
      } catch (err) {
        console.error("Failed to load attendance", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  const handleUploadSuccess = () => {
    refetchAll();
  };

  const tableColumns = [
    { key: 'employeeId', label: 'Emp ID' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'totalPresent', label: 'Present', rightAlign: true, render: (_, val) => <span className="font-bold text-emerald-600">{val}</span> },
    { key: 'totalAbsent', label: 'Absent', rightAlign: true, render: (_, val) => <span className="font-bold text-error">{val}</span> },
    { key: 'totalLeave', label: 'Leave', rightAlign: true },
    { key: 'totalHalfDay', label: 'Half Day', rightAlign: true },
    { key: 'totalHoliday', label: 'Holiday', rightAlign: true },
    { key: 'totalWeekend', label: 'Weekend', rightAlign: true }
  ];

  // Group upload history by year_month for display
  const activeVersions = uploadHistory.filter(u =>
    selectedMonths.length === 0 || selectedMonths.includes(u.year_month)
  );

  return (
    <div className={`space-y-8 transition-opacity duration-300 ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>

      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
            <span>Data Operations</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">Import & Upload</span>
          </nav>
          <h2 className="text-2xl font-semibold text-on-surface tracking-tight">Data Management Hub</h2>
          <p className="text-on-surface-variant text-sm mt-1">Upload Zoho exports and manage attendance data pipelines.</p>
        </div>
      </div>

      {/* Upload Zones Container */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
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
                  v.file_type === 'timelog' ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-700'
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

      {/* Attendance Grid */}
      <div className="pt-4 border-t border-outline-variant/10">
        <DataTable
          title="Attendance Muster Roll"
          subtitle="Aggregated status counts for the selected periods"
          data={attendance}
          columns={tableColumns}
          isLoading={loading}
        />
      </div>

    </div>
  );
}
