import { useState, useEffect } from 'react'
import { useData } from './context/DataContext'
import MonthPicker from './components/MonthPicker'
import ChatBot from './components/ChatBot'
import HelpPanel from './components/HelpPanel'
import Overview from './pages/Overview'
import Resources from './pages/Resources'
import Utilization from './pages/Utilization'
import Timesheet from './pages/Timesheet'
import Analytics from './pages/Analytics'

const TABS = [
  { id: 'overview',    label: 'Portfolio',    icon: 'dashboard', active: true },
  { id: 'resources',   label: 'Resources',    icon: 'group', active: true },
  { id: 'utilization', label: 'Utilization',  icon: 'speed', active: true },
  { id: 'analytics',   label: 'Analytics',    icon: 'insights', active: true },
  { id: 'timesheet',   label: 'Timesheet',    icon: 'schedule', active: true },
  { id: 'reports',     label: 'Reports',      icon: 'folder_special', active: false },
  { id: 'finance',     label: 'Finance',      icon: 'payments', active: false },
  { id: 'amm',         label: 'AMM',          icon: 'analytics', active: false },
]

function Placeholder({ title, icon }) {
  return (
    <div className="flex items-center justify-center h-[600px] w-full animate-fade-in">
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

  if (!tab || !tab.active) {
    const titles = {
      portfolio: 'Portfolio Management',
      finance: 'Financial Orchestrator',
      sow: 'SOW Document Holder',
      amm: 'Agile Maturity Model',
    }
    return <Placeholder title={titles[tabId] || tabId} icon={tab?.icon || 'help'} />
  }

  // Wrap each page in a fade transition container
  const Page = () => {
    if (tabId === 'overview') return <Overview />
    if (tabId === 'resources') return <Resources />
    if (tabId === 'utilization') return <Utilization />
    if (tabId === 'analytics') return <Analytics />
    if (tabId === 'timesheet') return <Timesheet />
    return null
  }

  return (
    <div key={tabId} className="page-enter">
      <Page />
    </div>
  )
}

export default function App() {
  const { groupBy, setGroupBy } = useData()
  const [activeTab, setActiveTab] = useState('overview')
  const [helpOpen, setHelpOpen] = useState(false)

  // Sidebar collapse state — persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('pmo_sidebar_collapsed') === 'true'; } catch { return false; }
  })

  useEffect(() => {
    try { localStorage.setItem('pmo_sidebar_collapsed', String(collapsed)); } catch {}
  }, [collapsed])

  const sidebarW = collapsed ? 'w-16' : 'w-52'

  return (
    <div className="bg-background text-on-surface flex min-h-screen overflow-hidden font-inter">
      {/* ── Side Nav Bar (collapsible) ── */}
      <aside className={`h-screen ${sidebarW} bg-slate-100 flex flex-col py-4 border-r border-slate-200/50 sticky top-0 shrink-0 sidebar-transition`}>
        {/* Brand */}
        <div className={`${collapsed ? 'px-3' : 'px-4'} mb-6`}>
          <div className="flex items-center gap-2.5">
            {/* TODO: Replace logo — required: 32x32px SVG or PNG, placed in client/public/logo.svg
                Currently using a gradient "T" placeholder. When the asset is ready,
                replace the div below with: <img src="/logo.svg" alt="Tinubu" className="w-8 h-8" /> */}
            <div className="w-8 h-8 primary-gradient rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">T</div>
            {!collapsed && (
              <div className="sidebar-label">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">Tinubu PMO</h1>
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Command Center</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`mx-auto mb-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors ${collapsed ? 'mx-auto' : 'ml-auto mr-3'}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-lg">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="space-y-0.5">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={collapsed ? tab.label : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'} text-left group relative ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-[3px] border-blue-600'
                    : 'text-slate-500 hover:bg-slate-200/60'
                }`}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <span className={`material-symbols-outlined ${collapsed ? '' : 'mr-2.5'} text-[20px] ${activeTab === tab.id ? '' : 'text-slate-400 group-hover:text-slate-500'}`}>
                  {tab.icon}
                </span>
                {!collapsed && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest flex-1 sidebar-label">
                    {tab.label}
                  </span>
                )}
                {!collapsed && !tab.active && (
                  <span className="text-[8px] bg-surface-container text-on-surface-variant px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                    Soon
                  </span>
                )}
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-semibold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {tab.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className={`mt-auto ${collapsed ? 'px-2' : 'px-4'} pt-3 border-t border-slate-200/50`}>
          {!collapsed && (
            <button className="w-full py-2 mb-3 primary-gradient text-white text-[10px] font-bold uppercase tracking-tight rounded shadow-sm hover:opacity-90 flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-sm">add</span> New Project
            </button>
          )}
          <div className={`space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
            <button onClick={() => setHelpOpen(true)} className={`${collapsed ? 'p-2' : 'w-full flex items-center py-1.5'} text-slate-500 hover:text-slate-900`} title="Help">
              <span className="material-symbols-outlined text-lg">help</span>
              {!collapsed && <span className="text-[10px] font-semibold uppercase tracking-widest ml-2">Help</span>}
            </button>
            <button className={`${collapsed ? 'p-2' : 'w-full flex items-center py-1.5'} text-slate-500 hover:text-slate-900`} title="Logout">
              <span className="material-symbols-outlined text-lg">logout</span>
              {!collapsed && <span className="text-[10px] font-semibold uppercase tracking-widest ml-2">Logout</span>}
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
                className="pl-10 pr-4 py-1.5 bg-slate-200/40 border-none rounded-full text-xs w-64 focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center">
              <MonthPicker lightTheme={true} />
            </div>
            <div className="flex items-center bg-slate-200/50 rounded-full p-0.5">
              <button
                onClick={() => setGroupBy('dept')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
                  groupBy === 'dept' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Department
              </button>
              <button
                onClick={() => setGroupBy('squad')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
                  groupBy === 'squad' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Squad
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full">
              <span className="material-symbols-outlined text-xl">light_mode</span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full relative">
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border border-white"></span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full">
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/10 ml-1 flex items-center justify-center border border-primary/20">
              <span className="text-xs font-bold text-primary">RU</span>
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
      <ChatBot />
      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
