import React, { createContext, useContext, type ReactNode } from 'react';
import { useAutoSaveWithToast, type AutoSaveConfig } from '../core/hooks';
import { AutosaveToast } from '../components/common';

export interface AutoSaveContextType {
  saveSettings: (_data: unknown) => void;
  saveSettingsImmediately: (_data: unknown) => Promise<void>;
  isSaving: boolean;
  hasPendingChanges: boolean;
}

const AutoSaveContext = createContext<AutoSaveContextType | null>(null);

// Provider that handles everything internally
interface AutoSaveProviderProps<T> {
  children: ReactNode;
  saveFunction: (_data: T) => Promise<void>;
  config?: AutoSaveConfig;
}

export function AutoSaveProvider<T = unknown>({
  children,
  saveFunction,
  config,
}: AutoSaveProviderProps<T>) {
  const autoSave = useAutoSaveWithToast(saveFunction, config);

  // Simple context value - no toast exposure
  const contextValue: AutoSaveContextType = {
    saveSettings: (data: unknown) => autoSave.triggerAutoSave(data as T),
    saveSettingsImmediately: (data: unknown) => autoSave.saveImmediately(data as T),
    isSaving: autoSave.isSaving,
    hasPendingChanges: autoSave.hasPendingChanges,
  };

  return (
    <AutoSaveContext.Provider value={contextValue}>
      {children}
      <AutosaveToast
        isVisible={autoSave.toastState.isVisible}
        type={autoSave.toastState.type}
        message={autoSave.toastState.message}
        onDismiss={autoSave.dismissToast}
      />
    </AutoSaveContext.Provider>
  );
}

// Simple hook for components
export function useAutoSave(): AutoSaveContextType {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error('useAutoSave must be used within an AutoSaveProvider');
  }
  return context;
}
