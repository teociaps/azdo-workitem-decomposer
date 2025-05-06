import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { WorkItemConfigurationsMap, WorkItemTypeConfiguration, WorkItemTypeName } from '../core/models/commonTypes';

interface GlobalStateContextProps {
  workItemConfigurations: WorkItemConfigurationsMap;
  setWorkItemConfiguration: (workItemTypeName: WorkItemTypeName, configuration: WorkItemTypeConfiguration) => void;
  getWorkItemConfiguration: (workItemTypeName: WorkItemTypeName) => WorkItemTypeConfiguration | undefined;
  setHierarchyRules: (workItemTypeName: WorkItemTypeName, rules: string[]) => void;
  setWorkItemTypeColor: (workItemTypeName: WorkItemTypeName, color: string) => void;
}

const GlobalStateContext = createContext<GlobalStateContextProps | undefined>(undefined);

export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workItemConfigurations, setWorkItemConfigurationsState] = useState<WorkItemConfigurationsMap>(new Map());

  const setWorkItemConfiguration = useCallback((workItemTypeName: WorkItemTypeName, configuration: WorkItemTypeConfiguration) => {
    setWorkItemConfigurationsState(prev => new Map(prev).set(workItemTypeName, { ...prev.get(workItemTypeName), ...configuration }));
  }, []);

  const getWorkItemConfiguration = useCallback((workItemTypeName: WorkItemTypeName) => {
    return workItemConfigurations.get(workItemTypeName);
  }, [workItemConfigurations]);

  const setHierarchyRules = useCallback((workItemTypeName: WorkItemTypeName, rules: string[]) => {
    setWorkItemConfiguration(workItemTypeName, { hierarchyRules: rules });
  }, [setWorkItemConfiguration]);

  const setWorkItemTypeColor = useCallback((workItemTypeName: WorkItemTypeName, color: string) => {
    setWorkItemConfiguration(workItemTypeName, { color: color });
  }, [setWorkItemConfiguration]);

  const value = useMemo(
    () => ({ workItemConfigurations, setWorkItemConfiguration, getWorkItemConfiguration, setHierarchyRules, setWorkItemTypeColor }),
    [workItemConfigurations, setWorkItemConfiguration, getWorkItemConfiguration, setHierarchyRules, setWorkItemTypeColor]
  );

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
};

export function useGlobalState() {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error('useGlobalState must be used within a GlobalStateProvider');
  return ctx;
}
