import { useState, useEffect } from 'react'
import { useData } from './context/DataContext'
import MonthPicker from './components/MonthPicker'
import ChatBot from './components/ChatBot'
import HelpPanel from './components/HelpPanel'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import TimesheetsAttendance from './pages/TimesheetsAttendance'
import Analytics from './pages/Analytics'
import DataManagement from './pages/DataManagement'

const TABS = [
  { id: 'dashboard',   label: 'Dashboard',    icon: 'dashboard', active: true },
  { id: 'people',      label: 'People',       icon: 'groups', active: true },
  { id: 'timesheets',  label: 'Timesheets',   icon: 'schedule', active: true },
  { id: 'analytics',   label: 'Analytics',    icon: 'analytics', active: true },
  { id: 'data',        label: 'Data',         icon: 'cloud_upload', active: true },
]

function TabContent({ tabId }) {
  const tab = TABS.find(t => t.id === tabId)
  if (!tab || !tab.active) return null

  const Page = () => {
    if (tabId === 'dashboard') return <Dashboard />
    if (tabId === 'people') return <People />
    if (tabId === 'timesheets') return <TimesheetsAttendance />
    if (tabId === 'analytics') return <Analytics />
    if (tabId === 'data') return <DataManagement />
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
  const [activeTab, setActiveTab] = useState('dashboard')
  const [helpOpen, setHelpOpen] = useState(false)

  // Sidebar collapse state
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('pmo_sidebar_collapsed') === 'true'; } catch { return false; }
  })

  useEffect(() => {
    try { localStorage.setItem('pmo_sidebar_collapsed', String(collapsed)); } catch {}
  }, [collapsed])

  const sidebarW = collapsed ? 'w-16' : 'w-52'

  return (
    <div className="bg-background text-on-surface flex min-h-screen overflow-hidden font-inter">
      {/* ── Side Nav Bar ── */}
      <aside className={`h-screen ${sidebarW} bg-slate-100 flex flex-col py-4 border-r border-slate-200/50 sticky top-0 shrink-0 sidebar-transition`}>
        {/* Brand */}
        <div className={`${collapsed ? 'px-3' : 'px-4'} mb-6`}>
          <div className="flex items-center gap-2.5">
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
          <div className={`space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
            <button onClick={() => setHelpOpen(true)} className={`${collapsed ? 'p-2' : 'w-full flex items-center py-1.5'} text-slate-500 hover:text-slate-900`} title="Help">
              <span className="material-symbols-outlined text-lg">help</span>
              {!collapsed && <span className="text-[10px] font-semibold uppercase tracking-widest ml-2">Help</span>}
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
                placeholder="Search..."
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
