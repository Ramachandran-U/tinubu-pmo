import { createContext, useContext, useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { req } = useApi();
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load of available months
  useEffect(() => {
    async function init() {
      try {
        const { months } = await req('/months');
        setAvailableMonths(months || []);
        if (months && months.length > 0) {
          // Default to latest month
          setSelectedMonths([months[0]]);
        }
      } catch (err) {
        console.error('Failed to load months:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    init();
  }, [req]);

  // Refetch KPIs when selected months change
  const refreshGlobalKpis = async (monthsString) => {
    setIsRefreshing(true);
    try {
      const qs = monthsString ? `?months=${monthsString}` : '';
      const data = await req(`/kpis${qs}`);
      setKpis(data);
    } catch (err) {
      console.error('Failed to load KPIs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loadingInitial) {
      const qs = selectedMonths.length > 0 ? selectedMonths.join(',') : '';
      refreshGlobalKpis(qs);
    }
  }, [selectedMonths, loadingInitial, req]);

  // Method to force deep refresh (e.g. after fresh upload)
  const refetchAll = async () => {
    setLoadingInitial(true);
    try {
        const { months } = await req('/months');
        setAvailableMonths(months || []);
        const qs = selectedMonths.length > 0 ? selectedMonths.join(',') : '';
        await refreshGlobalKpis(qs);
    } finally {
        setLoadingInitial(false);
    }
  };

  const value = {
    availableMonths,
    selectedMonths,
    setSelectedMonths,
    kpis,
    loadingInitial,
    isRefreshing,
    refetchAll
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
