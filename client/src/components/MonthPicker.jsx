import { useData } from '../context/DataContext';

export default function MonthPicker({ lightTheme = false }) {
  const { availableMonths, selectedMonths, setSelectedMonths } = useData();

  const toggleMonth = (m) => {
    if (selectedMonths.includes(m)) {
      setSelectedMonths(selectedMonths.filter(x => x !== m));
    } else {
      setSelectedMonths([...selectedMonths, m]);
    }
  };

  if (availableMonths.length === 0) return null;

  if (lightTheme) {
    return (
      <nav className="flex gap-6 h-full items-center">
        <button 
          onClick={() => setSelectedMonths([])}
          className={`text-sm tracking-tight transition-colors h-14 flex items-center ${
            selectedMonths.length === 0 
              ? 'text-blue-700 font-bold border-b-2 border-blue-700' 
              : 'text-slate-500 font-medium hover:text-blue-600'
          }`}
        >
          All Time
        </button>
        {availableMonths.map(m => {
          const isActive = selectedMonths.includes(m);
          return (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`text-sm tracking-tight transition-colors h-14 flex items-center ${
                isActive 
                  ? 'text-blue-700 font-bold border-b-2 border-blue-700' 
                  : 'text-slate-500 font-medium hover:text-blue-600'
              }`}
            >
              {m}
            </button>
          );
        })}
      </nav>
    );
  }

  // --- Legacy Dark Theme Pills ---
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-bold uppercase tracking-widest text-[#737686] mr-2">
        Filters
      </div>
      <div className="flex flex-wrap gap-2">
        {availableMonths.map(m => {
          const isActive = selectedMonths.includes(m);
          return (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                isActive 
                  ? 'bg-[#004ac6] text-white border-[#004ac6] shadow-md shadow-[#004ac6]/20' 
                  : 'bg-transparent text-[#737686] border-[#c3c6d7]/30 hover:bg-[#eceef0]/10'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
