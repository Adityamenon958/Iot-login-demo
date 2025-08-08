import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ✅ Custom hook for background data refresh
export const useBackgroundRefresh = (fetchFunction, intervalMs = 30000) => {
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const intervalRef = useRef(null);

  // ✅ Initial data fetch with loading state
  const fetchInitialData = async () => {
    try {
      setError(null);
      const result = await fetchFunction();
      setData(result);
      setLastUpdated(new Date());
      setIsInitialized(true);
    } catch (err) {
      console.error('❌ Initial data fetch failed:', err);
      setError(err.message);
    }
  };

  // ✅ Background refresh without loading state
  const backgroundRefresh = async () => {
    try {
      const result = await fetchFunction();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
      console.log('✅ Background refresh completed at:', new Date().toLocaleTimeString());
    } catch (err) {
      console.error('❌ Background refresh failed:', err);
      // Don't update error state for background refreshes to avoid UI disruption
    }
  };

  // ✅ Start background refresh interval
  const startBackgroundRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      console.log('🔄 Starting background refresh...');
      backgroundRefresh();
    }, intervalMs);
  };

  // ✅ Stop background refresh interval
  const stopBackgroundRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // ✅ Manual refresh function
  const manualRefresh = async () => {
    console.log('🔄 Manual refresh triggered...');
    await backgroundRefresh();
  };

  // ✅ Initialize on mount
  useEffect(() => {
    fetchInitialData();
    
    // Start background refresh after initial load
    const timer = setTimeout(() => {
      startBackgroundRefresh();
    }, 1000); // Start after 1 second

    return () => {
      clearTimeout(timer);
      stopBackgroundRefresh();
    };
  }, []);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundRefresh();
    };
  }, []);

  return {
    data,
    lastUpdated,
    error,
    isInitialized,
    manualRefresh,
    startBackgroundRefresh,
    stopBackgroundRefresh
  };
}; 