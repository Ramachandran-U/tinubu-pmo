export default function Placeholder({ title, icon, description }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center h-full rounded-2xl border-2 border-dashed border-[#2D3343] bg-[#0F1117]/50 mt-8">
      <div className="w-16 h-16 bg-[#1A1D27] rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-[#2D3343]">
        <span className="material-symbols-outlined text-blue-500 text-3xl">{icon || 'build'}</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title || 'Under Construction'}</h2>
      <p className="text-sm text-slate-400 max-w-sm">
        {description || 'This module is currently being developed and will be available in a future update.'}
      </p>
    </div>
  );
}
