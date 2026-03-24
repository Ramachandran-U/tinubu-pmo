import { useState } from 'react'
import MonthPicker from './components/MonthPicker'
import Overview from './pages/Overview'
import Resources from './pages/Resources'
import Utilization from './pages/Utilization'
import Timesheet from './pages/Timesheet'
import Analytics from './pages/Analytics'

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: 'dashboard', active: true },
  { id: 'resources',   label: 'Resources',    icon: 'group', active: true },
  { id: 'utilization', label: 'Utilization',  icon: 'speed', active: true },
  { id: 'analytics',   label: 'Analytics',    icon: 'insights', active: true },
  { id: 'timesheet',   label: 'Timesheet',    icon: 'schedule', active: true },
  { id: 'portfolio',   label: 'Portfolio',    icon: 'folder_special', active: false },
  { id: 'finance',     label: 'Finance',      icon: 'payments', active: false },
  { id: 'amm',         label: 'AMM',          icon: 'analytics', active: false },
]

function Placeholder({ title, icon }) {
  return (
    <div className="flex items-center justify-center h-[600px] w-full">
      <div className="text-center bg-surface-container-lowest rounded-xl p-12 border border-outline-variant/10 shadow-sm max-w-md">
        <span className="material-symbols-outlined text-6xl text-outline mb-4 block" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>{icon}</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">{title}</h2>
        <p className="text-on-surface-variant text-sm mb-6">
          This module is ready for integration. Upload the corresponding data source when available.
        </p>
        <div className="inline-block px-4 py-1.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
          Coming Soon
        </div>
      </div>
    </div>
  )
}

function TabContent({ tabId }) {
  const tab = TABS.find(t => t.id === tabId)

  if (!tab.active) {
    const titles = {
      portfolio: 'Portfolio Management',
      finance: 'Financial Orchestrator',
      sow: 'SOW Document Holder',
      amm: 'Agile Maturity Model',
    }
    return <Placeholder title={titles[tabId]} icon={tab.icon} />
  }

  if (tabId === 'overview') return <Overview />
  if (tabId === 'resources') return <Resources />
  if (tabId === 'utilization') return <Utilization />
  if (tabId === 'analytics') return <Analytics />
  if (tabId === 'timesheet') return <Timesheet />

  return null
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="bg-background text-on-surface flex min-h-screen overflow-hidden font-inter">
      {/* ── Side Nav Bar ── */}
      <aside className="h-screen w-64 bg-slate-100 flex flex-col py-4 border-r border-slate-200/50 sticky top-0 shrink-0">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 primary-gradient rounded flex items-center justify-center text-white font-bold">T</div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tighter">Tinubu PMO</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Command Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors group ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className={`material-symbols-outlined mr-3 text-xl ${activeTab === tab.id ? '' : 'text-slate-400 group-hover:text-slate-500'}`}>
                  {tab.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest flex-1">
                  {tab.label}
                </span>
                {!tab.active && (
                  <span className="text-[9px] bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-auto px-6 pt-4 border-t border-slate-200/50">
          <button className="w-full py-2 mb-4 primary-gradient text-white text-xs font-bold uppercase tracking-tighter rounded shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span> New Project
          </button>
          <div className="space-y-2">
            <button className="w-full flex items-center text-slate-500 hover:text-slate-900 transition-colors">
              <span className="material-symbols-outlined text-lg mr-2">help</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest">Help</span>
            </button>
            <button className="w-full flex items-center text-slate-500 hover:text-slate-900 transition-colors">
              <span className="material-symbols-outlined text-lg mr-2">logout</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ── Top Nav Bar ── */}
        <header className="w-full bg-slate-50 border-b border-slate-200/50 flex justify-between items-center px-6 py-2 shrink-0">
          <div className="flex items-center gap-8">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-lg">search</span>
              <input 
                type="text"
                placeholder="Search portfolio..." 
                className="pl-10 pr-4 py-1.5 bg-slate-200/40 border-none rounded-full text-xs w-64 focus:ring-1 focus:ring-primary transition-all outline-none"
              />
            </div>
            <div className="flex items-center">
              <MonthPicker lightTheme={true} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors">
              <span className="material-symbols-outlined">light_mode</span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border border-white"></span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-slate-200 ml-2 overflow-hidden border border-slate-300">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnr2cNKYgr-f0Z-6q0HI7JJ3zUJJV0EerXiQaaNEKS-o1WPzsTHrI89il6k_qSSlwL6MPHyiNXJxFgSYGugIgOCZfVJCL0sS8H5HhVyReONO0d6GX66F34Da-NIccntwRQ1dBfXFz98iSxHb1YZCDR9hKLQByCDnr3HvOyDXSrA8IBI6YhfyKwkxC7L30k_UYd1klASQnCFPZwuzX9qH5YMbChx7hdh8bJzXN6PH5qCzyajbRNT3Ws4jjtfCrf3LzJoWuz8EW1MJs" 
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* ── Content Area ── */}
        <div className="flex-1 overflow-y-auto bg-background hide-scrollbar w-full">
          <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
            <TabContent tabId={activeTab} />
          </div>
        </div>
      </main>
    </div>
  )
}
