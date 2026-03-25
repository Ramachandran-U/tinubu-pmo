import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import UploadZone from '../components/UploadZone';

export default function DataManagement() {
  const { loadingInitial, isRefreshing, selectedMonths, refetchAll } = useData();
  const { req } = useApi();
  const [uploadHistory, setUploadHistory] = useState([]);
  const [dataSummary, setDataSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      try {
        const [history, months] = await Promise.all([
          req('/months/active-versions'),
          req('/months')
        ]);
        setUploadHistory(history || []);
        setDataSummary(months || null);
      } catch (err) { console.error("Data management fetch error", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [loadingInitial, req, isRefreshing]);

  const handleUploadSuccess = () => refetchAll();

  const activeVersions = uploadHistory.filter(u =>
    selectedMonths.length === 0 || selectedMonths.includes(u.year_month)
  );

  return (
    <div className={`space-y-10 transition-opacity duration-300 ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>
      <header>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-outline mb-1">Data Operations</h3>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Data Management</h1>
        <p className="text-on-surface-variant text-sm mt-2">Upload Zoho exports and manage your data pipeline. All dashboards refresh automatically after upload.</p>
      </header>

      {/* Upload Zones — prominently displayed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UploadZone
          title="Upload Zoho Time Log"
          info="Monthly timesheet export (.xlsx). Contains hours, projects, billing status, and approval status for every employee."
          endpoint="/upload/timelog"
          onUploadSuccess={handleUploadSuccess}
        />
        <UploadZone
          title="Upload Zoho Attendance"
          info="Monthly muster roll export (.xlsx). Contains daily presence/absence/leave status per employee."
          endpoint="/upload/attendance"
          onUploadSuccess={handleUploadSuccess}
        />
        <UploadZone
          title="Upload Demand Capacity"
          info="Squad allocation file (.xlsx). Maps employees to projects/squads, designations, and billability status."
          endpoint="/upload/demand-capacity"
          onUploadSuccess={handleUploadSuccess}
        />
      </div>

      {/* Data Summary */}
      {dataSummary && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-lg">storage</span>
            <h3 className="text-sm font-bold text-on-surface">Data Coverage</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Available Periods</p>
              <p className="text-xl font-extrabold text-on-surface mt-1">{dataSummary.months?.length || 0}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{dataSummary.months?.length > 0 ? `${dataSummary.months[dataSummary.months.length - 1]} to ${dataSummary.months[0]}` : 'No data'}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Active Uploads</p>
              <p className="text-xl font-extrabold text-on-surface mt-1">{uploadHistory.length}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Timelog Uploads</p>
              <p className="text-xl font-extrabold text-on-surface mt-1">{uploadHistory.filter(u => u.file_type === 'timelog').length}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Attendance Uploads</p>
              <p className="text-xl font-extrabold text-on-surface mt-1">{uploadHistory.filter(u => u.file_type === 'attendance').length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Versions */}
      {activeVersions.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-lg">history</span>
            <h3 className="text-sm font-bold text-on-surface">Active Data Versions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeVersions.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold ${
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

      {/* Upload Instructions */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">info</span>
          <h3 className="text-sm font-bold text-on-surface">How It Works</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-on-surface-variant">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm">1</span>
            <p>Export the Time Log and Attendance Muster Roll from Zoho People as .xlsx files (monthly).</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm">2</span>
            <p>Drag and drop each file onto the corresponding upload zone above. Upload takes ~2 seconds.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm">3</span>
            <p>All dashboards refresh automatically. Each upload creates a new version — previous data is preserved in the audit trail.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
