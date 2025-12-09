import { useState, useEffect } from 'react';

interface MonitoringState {
  isActive: boolean;
  startTime: string | null;
  shouldRun: boolean;
}

export const useMonitoringState = () => {
  // Initialize with default state
  const [monitoringState, setMonitoringState] = useState<MonitoringState>({
    isActive: false,
    startTime: null,
    shouldRun: false
  });

  // Effect to load state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('monitoringState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.startTime) {
          const startTime = new Date(parsed.startTime);
          const currentTime = new Date();
          const hoursDiff = (currentTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff >= 6) {
            setMonitoringState({
              isActive: false,
              startTime: null,
              shouldRun: false
            });
          } else {
            setMonitoringState(parsed);
          }
        }
      }
    } catch (error) {
      console.error('Error loading monitoring state:', error);
    }
  }, []);

  // Effect to save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('monitoringState', JSON.stringify(monitoringState));
    } catch (error) {
      console.error('Error saving monitoring state:', error);
    }
  }, [monitoringState]);

  return [monitoringState, setMonitoringState] as const;
};