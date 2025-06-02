import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  WorkItemConfigurationsMap,
  WorkItemTypeConfiguration,
  WorkItemTypeName,
} from '../core/models/commonTypes';

interface GlobalStateContextProps {
  workItemConfigurations: WorkItemConfigurationsMap;
  setWorkItemConfiguration: (
    _workItemTypeName: WorkItemTypeName,
    _configuration: WorkItemTypeConfiguration,
  ) => void;
  getWorkItemConfiguration: (
    _workItemTypeName: WorkItemTypeName,
  ) => WorkItemTypeConfiguration | undefined;
  setHierarchyRules: (_workItemTypeName: WorkItemTypeName, _rules: string[]) => void;
  setWorkItemTypeColor: (_workItemTypeName: WorkItemTypeName, _color: string) => void;
  setWorkItemTypeIconUrl: (_workItemTypeName: WorkItemTypeName, _iconUrl: string) => void;
  batchSetWorkItemConfigurations: (
    _updates: {
      workItemTypeName: WorkItemTypeName;
      configuration: Partial<WorkItemTypeConfiguration>;
    }[],
  ) => void;
  clearWorkItemConfigurations: () => void;
}

const GlobalStateContext = createContext<GlobalStateContextProps | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [workItemConfigurations, setWorkItemConfigurationsState] =
    useState<WorkItemConfigurationsMap>(new Map());

  const setWorkItemConfiguration = useCallback(
    (workItemTypeName: WorkItemTypeName, configuration: WorkItemTypeConfiguration) => {
      setWorkItemConfigurationsState((prev) => {
        const newMap = new Map(prev);
        const existingConfig = prev.get(workItemTypeName) || {};
        newMap.set(workItemTypeName, { ...existingConfig, ...configuration });
        return newMap;
      });
    },
    [],
  );

  const getWorkItemConfiguration = useCallback(
    (workItemTypeName: WorkItemTypeName) => {
      return workItemConfigurations.get(workItemTypeName);
    },
    [workItemConfigurations],
  );

  const setHierarchyRules = useCallback(
    (workItemTypeName: WorkItemTypeName, rules: string[]) => {
      setWorkItemConfiguration(workItemTypeName, { hierarchyRules: rules });
    },
    [setWorkItemConfiguration],
  );

  const setWorkItemTypeColor = useCallback(
    (workItemTypeName: WorkItemTypeName, color: string) => {
      setWorkItemConfiguration(workItemTypeName, { color });
    },
    [setWorkItemConfiguration],
  );

  const setWorkItemTypeIconUrl = useCallback(
    (workItemTypeName: WorkItemTypeName, iconUrl: string) => {
      setWorkItemConfiguration(workItemTypeName, { iconUrl });
    },
    [setWorkItemConfiguration],
  );
  const batchSetWorkItemConfigurations = useCallback(
    (
      updates: {
        workItemTypeName: WorkItemTypeName;
        configuration: Partial<WorkItemTypeConfiguration>;
      }[],
    ) => {
      setWorkItemConfigurationsState((prev) => {
        const newMap = new Map(prev);
        updates.forEach(({ workItemTypeName, configuration }) => {
          const existingConfig = newMap.get(workItemTypeName) || {};
          newMap.set(workItemTypeName, { ...existingConfig, ...configuration });
        });
        return newMap;
      });
    },
    [],
  );

  const clearWorkItemConfigurations = useCallback(() => {
    setWorkItemConfigurationsState(new Map());
  }, []);
  const value = useMemo(
    () => ({
      workItemConfigurations,
      setWorkItemConfiguration,
      getWorkItemConfiguration,
      setHierarchyRules,
      setWorkItemTypeColor,
      setWorkItemTypeIconUrl,
      batchSetWorkItemConfigurations,
      clearWorkItemConfigurations,
    }),
    [
      workItemConfigurations,
      setWorkItemConfiguration,
      getWorkItemConfiguration,
      setHierarchyRules,
      setWorkItemTypeColor,
      setWorkItemTypeIconUrl,
      batchSetWorkItemConfigurations,
      clearWorkItemConfigurations,
    ],
  );

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
}

export function useGlobalState() {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error('useGlobalState must be used within a GlobalStateProvider');
  return ctx;
}
