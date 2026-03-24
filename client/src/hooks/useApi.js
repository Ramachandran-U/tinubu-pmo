import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to handle API calls with loading/error states.
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const req = useCallback(async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const finalHeaders = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (finalHeaders['Content-Type'] === undefined) {
        delete finalHeaders['Content-Type'];
      }

      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers: finalHeaders,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { req, loading, error };
}
