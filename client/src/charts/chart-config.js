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

// ── Global defaults ──
ChartJS.defaults.color = '#737686';
ChartJS.defaults.font.family = 'Inter, sans-serif';

// Tooltip styling
ChartJS.defaults.plugins.tooltip.backgroundColor = '#ffffff';
ChartJS.defaults.plugins.tooltip.titleColor = '#191c1e';
ChartJS.defaults.plugins.tooltip.bodyColor = '#434655';
ChartJS.defaults.plugins.tooltip.borderColor = '#e0e3e5';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.boxPadding = 6;
ChartJS.defaults.plugins.tooltip.usePointStyle = true;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: 600 };
ChartJS.defaults.plugins.tooltip.callbacks = {
  label: function(ctx) {
    const label = ctx.dataset.label || ctx.label || '';
    const val = typeof ctx.parsed === 'number' ? ctx.parsed : (ctx.parsed?.y ?? ctx.raw);
    const formatted = typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : val;
    return label ? `${label}: ${formatted}` : formatted;
  }
};

// Smooth entrance animations (300ms, ease-out)
ChartJS.defaults.animation = {
  duration: 600,
  easing: 'easeOutQuart',
};
ChartJS.defaults.transitions = {
  active: { animation: { duration: 200 } },
  resize: { animation: { duration: 0 } },
};

// Bar element defaults
ChartJS.defaults.elements.bar.borderRadius = 6;
ChartJS.defaults.elements.bar.borderSkipped = 'bottom';

// Arc/Donut defaults — spacing between segments
ChartJS.defaults.elements.arc.borderWidth = 3;
ChartJS.defaults.elements.arc.borderColor = '#ffffff';
ChartJS.defaults.elements.arc.hoverBorderWidth = 0;
ChartJS.defaults.elements.arc.hoverOffset = 6;

// Line defaults
ChartJS.defaults.elements.line.tension = 0.3;
ChartJS.defaults.elements.point.radius = 3;
ChartJS.defaults.elements.point.hoverRadius = 6;

// Custom Palette for Tinubu Light Dashboard
export const chartColors = {
  primary: '#004ac6',
  primaryLight: 'rgba(0, 74, 198, 0.15)',
  secondary: '#2563eb',
  tertiary: '#943700',
  emerald: '#10b981',
  error: '#ba1a1a',
  slate: '#c3c6d7',
  surface: '#ffffff',
  gridLines: 'rgba(195, 198, 215, 0.35)'
};

export const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 600,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: { size: 11, weight: 600 }
      }
    },
    tooltip: {
      cornerRadius: 8,
      titleFont: { weight: 600, size: 12 },
      bodyFont: { size: 11 },
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

// Donut-specific options with increased spacing
export const donutOptions = {
  ...commonOptions,
  cutout: '72%',
  plugins: {
    ...commonOptions.plugins,
    legend: { ...commonOptions.plugins.legend, position: 'bottom' }
  },
  scales: {},
  elements: {
    arc: {
      borderWidth: 4,
      borderColor: '#ffffff',
    }
  }
};
