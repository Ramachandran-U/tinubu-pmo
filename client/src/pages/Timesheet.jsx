import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import UploadZone from '../components/UploadZone';
import DataTable from '../components/DataTable';

export default function Timesheet() {
  const { loadingInitial, isRefreshing, selectedMonths, refetchAll } = useData();
  const { req } = useApi();
  
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      
      try {
        const attData = await req(`/attendance${qs}`);
        const emps = attData?.employees || [];
        // Map backend properties (presentDays -> totalPresent) to match UI table schema
        const mapped = emps.map(e => ({
          employeeId: e.employeeId,
          employeeName: e.name,
          totalPresent: e.presentDays,
          totalAbsent: e.absentDays,
          totalLeave: 0, // Mock for now since backend only does P and A counts so far
          totalHalfDay: 0,
          totalHoliday: 0,
          totalWeekend: 0
        }));
        setAttendance(mapped);
      } catch (err) {
        console.error("Failed to load attendance", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  // When a new excel file is uploaded successfully, we trigger a global fresh fetch of KPIs and months.
  const handleUploadSuccess = () => {
    refetchAll();
  };

  // --- Attendance Table Columns Setup ---
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
