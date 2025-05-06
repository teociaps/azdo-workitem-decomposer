import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SDK from 'azure-devops-extension-sdk';
import {
  WorkItem,
  WorkItemType,
} from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import Draggable from 'react-draggable';
import { WorkItemHierarchyManager } from '../../services/workItemHierarchyManager';
import { getParentWorkItemDetails } from '../../services/workItemDataService';
import {
  getWorkItemHierarchyRules,
  getWorkItemTypes,
} from '../../services/workItemMetadataService';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { ErrorDisplay } from '../ErrorDisplay/ErrorDisplay';
import { WorkItemTypeHierarchy } from '../WorkItemTypeHierarchy/WorkItemTypeHierarchy';
import { DecomposePanelHeader } from './DecomposePanelHeader';
import { DecomposePanelActionBar } from './DecomposePanelActionBar';
import { DecomposePanelHierarchyArea } from './DecomposePanelHierarchyArea';

export function DecomposePanelContent({ initialContext }: { initialContext?: any }) {
  const workItemIds = initialContext?.workItemIds || [initialContext.workItemId] || [];
  const parentWorkItemId = workItemIds.length > 0 ? workItemIds[0] : null;

  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [showTypeHierarchy, setShowTypeHierarchy] = useState<boolean>(false);
  const [hierarchyPosition, setHierarchyPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isMetadataLoading, setIsMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isHierarchyEmpty, setIsHierarchyEmpty] = useState<boolean>(true);

  const hierarchyManager = useMemo(() => new WorkItemHierarchyManager(), []);
  const { setHierarchyRules, setWorkItemTypeColor } = useGlobalState();

  // Callback for selecting items (can be passed down if needed)
  const handleSelectWorkItem = useCallback((workItemId: string) => {
    console.log('Work item selected in parent:', workItemId);
    // TODO: Potentially fetch details or perform other actions here
  }, []);

  // Callback for HierarchyArea to signal changes
  const handleHierarchyChange = useCallback((isEmpty: boolean) => {
    setIsHierarchyEmpty(isEmpty);
  }, []);

  // Fetch project name on mount
  useEffect(() => {
    const webContext = SDK.getWebContext();
    if (webContext?.project?.name) {
      setProjectName(webContext.project.name);
    }
  }, []);

  // Function to close the panel (passed to action bar)
  const closePanel = useCallback(async (result?: any) => {
    console.log('Panel closed with result:', result);
    const config = SDK.getConfiguration();
    if (config.panel && typeof config.panel.close === 'function') {
      config.panel.close(result);
    } else {
      console.warn('Panel close function not provided or not a function in configuration.');
    }
  }, []);

  // Fetch initial parent work item data
  useEffect(() => {
    const fetchData = async () => {
      if (!parentWorkItemId || !projectName) return;

      setIsInitialLoading(true);
      setError(null);
      try {
        const wi = await getParentWorkItemDetails(parentWorkItemId, projectName);
        setParentWorkItem(wi);
        console.log('Parent Work Item:', wi);

        const parentType = wi.fields['System.WorkItemType'];
        hierarchyManager.setParentWorkItemType(parentType);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load work item data');
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchData();
  }, [parentWorkItemId, projectName, hierarchyManager]);

  // Fetch metadata (rules and colors)
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!projectName) return;

      setIsMetadataLoading(true);
      setMetadataError(null);
      try {
        const [rules, types] = await Promise.all([
          getWorkItemHierarchyRules(),
          getWorkItemTypes(projectName),
        ]);
        // Update how hierarchy rules are set
        rules.forEach((children, parent) => {
          setHierarchyRules(parent, children);
        });

        const colorMap = new Map<string, string>();
        types.forEach((type: WorkItemType) => {
          if (type.name && type.color) {
            colorMap.set(type.name, type.color.startsWith('#') ? type.color : `#${type.color}`);
          }
        });
        // Update how work item type colors are set
        colorMap.forEach((color, typeName) => {
          setWorkItemTypeColor(typeName, color);
        });
        console.log('Metadata loaded: Rules and Colors');
      } catch (err: any) {
        console.error('Error fetching work item metadata:', err);
        setMetadataError(err.message || 'Failed to load work item type hierarchy or colors');
      } finally {
        setIsMetadataLoading(false);
      }
    };

    fetchMetadata();
  }, [projectName, setHierarchyRules, setWorkItemTypeColor]);

  // Handlers for showing/hiding the type hierarchy popup
  const handleShowTypeHierarchy = useCallback((position: { x: number; y: number }) => {
    setHierarchyPosition(position);
    setShowTypeHierarchy(true);
  }, []);

  const handleCloseTypeHierarchy = useCallback(() => {
    setShowTypeHierarchy(false);
  }, []);

  // Save is possible if the hierarchy is not empty
  const canSave = useMemo(() => {
    return !isHierarchyEmpty;
  }, [isHierarchyEmpty]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
      className="view-type-hierarchy-viewer"
    >
      <ErrorDisplay error={error || metadataError} />

      <DecomposePanelHeader
        parentWorkItem={parentWorkItem}
        projectName={projectName}
        onShowTypeHierarchy={handleShowTypeHierarchy}
      />

      {showTypeHierarchy && projectName && !isMetadataLoading && !metadataError && (
        <Draggable
          handle=".wit-hierarchy-header-title"
          position={hierarchyPosition}
          bounds="parent"
          onStop={(e, data) => setHierarchyPosition({ x: data.x, y: data.y })}
        >
          <div style={{ position: 'absolute', zIndex: 100 }}>
            <WorkItemTypeHierarchy
              projectName={projectName}
              onClose={handleCloseTypeHierarchy}
              selectedWit={parentWorkItem?.fields['System.WorkItemType']}
            />
          </div>
        </Draggable>
      )}

      <DecomposePanelHierarchyArea
        isLoading={isInitialLoading}
        hierarchyManager={hierarchyManager}
        onSelectWorkItem={handleSelectWorkItem}
        onHierarchyChange={handleHierarchyChange}
        canAdd={!!projectName && !!parentWorkItem}
      />

      <DecomposePanelActionBar
        hierarchyManager={hierarchyManager}
        parentWorkItemId={parentWorkItemId}
        projectName={projectName}
        onClosePanel={closePanel}
        onSetError={setError}
        canSave={canSave}
      />
    </div>
  );
}
