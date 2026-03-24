import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useApi } from '../hooks/useApi';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { chartColors, commonOptions } from '../charts/chart-config';
import { Bar } from 'react-chartjs-2';

export default function Utilization() {
  const { loadingInitial, isRefreshing, selectedMonths } = useData();
  const { req } = useApi();
  
  const [heatmap, setHeatmap] = useState([]);
  const [timelogs, setTimelogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (loadingInitial) return;
      setLoading(true);
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      
      try {
        const [heatData, logsData] = await Promise.all([
          req(`/heatmap${qs}`),
          req(`/timelog${qs}?pageSize=200`) // Limit to prevent massive client lag on massive datasets
        ]);
        setHeatmap(heatData || []);
        setTimelogs(logsData?.rows || []);
      } catch (err) {
        console.error("Failed to load utilization", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonths, loadingInitial, req]);

  if (loadingInitial || (loading && !isRefreshing && heatmap.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
        <p>Analyzing utilization data...</p>
      </div>
    );
  }

  // --- Heatmap Chart Setup ---
  // A grouped bar chart for Daily Billable vs Daily Non-Billable
  const heatChartData = {
    labels: heatmap.map(d => d.dateStr.substring(5)), // MM-DD
    datasets: [
      {
        label: 'Billable Hours',
        data: heatmap.map(d => d.billableHours),
        backgroundColor: chartColors.emerald,
        stack: 'Stack 0',
      },
      {
        label: 'Non-Billable Hours',
        data: heatmap.map(d => d.nonBillableHours),
        backgroundColor: chartColors.slate,
        stack: 'Stack 0',
      }
    ]
  };

  const heatOptions = {
    ...commonOptions,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: { stacked: true, grid: { display: false, drawBorder: false }, ticks: { font: { size: 9 } } },
      y: { stacked: true, grid: { color: chartColors.gridLines, drawBorder: false } }
    }
  };

  const fmtHr = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // --- Timelog Table Columns Setup ---
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
        }`}>
          {val}
        </span>
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

  return (
    <div className={`space-y-8 transition-opacity duration-300 w-full ${isRefreshing || loading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">Workload Intensity & Allocation</h2>
        <p className="text-on-surface-variant text-sm">Real-time resource distribution across technical and analytical domains.</p>
      </div>

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
    </div>
  );
}
