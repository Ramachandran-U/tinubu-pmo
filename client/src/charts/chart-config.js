import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';

// Register all charts globally
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Global Chart.js defaults tailored for the Light Theme dashboard
ChartJS.defaults.color = '#737686';
ChartJS.defaults.font.family = 'Inter, sans-serif';
ChartJS.defaults.plugins.tooltip.backgroundColor = '#ffffff';
ChartJS.defaults.plugins.tooltip.titleColor = '#191c1e';
ChartJS.defaults.plugins.tooltip.bodyColor = '#434655';
ChartJS.defaults.plugins.tooltip.borderColor = '#e0e3e5';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.boxPadding = 6;
ChartJS.defaults.plugins.tooltip.usePointStyle = true;

// Custom Palette for Tinubu Light Dashboard
export const chartColors = {
  primary: '#004ac6',
  primaryLight: 'rgba(0, 74, 198, 0.2)',
  secondary: '#2563eb',
  tertiary: '#943700',
  emerald: '#10b981',
  error: '#ba1a1a',
  slate: '#c3c6d7',
  surface: '#ffffff',
  gridLines: 'rgba(195, 198, 215, 0.5)'
};

export const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: { size: 11, weight: 600 }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false, drawBorder: false },
      ticks: { font: { size: 10, weight: 600 } }
    },
    y: {
      grid: { color: chartColors.gridLines, drawBorder: false },
      ticks: { font: { size: 10 }, maxTicksLimit: 6 }
    }
  }
};
