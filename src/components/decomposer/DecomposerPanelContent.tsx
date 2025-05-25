import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SDK from 'azure-devops-extension-sdk';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import Draggable from 'react-draggable';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { getParentWorkItemDetails } from '../../services/workItemDataService';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { initializeWitData } from '../../core/common/witDataInitializer';
import { ErrorDisplay } from '../common/ErrorDisplay';
import { WitHierarchyViewer } from '../hierarchy/WitHierarchyViewer';
import { DecomposerPanelHeader } from './DecomposerPanelHeader';
import { DecomposerPanelActionBar } from './DecomposerPanelActionBar';
import {
  DecomposerWorkItemTreeArea,
  DecomposerWorkItemTreeAreaRef,
} from './DecomposerWorkItemTreeArea';
import { logger } from '../../core/common/logger';

const decomposerLogger = logger.createChild('Decomposer');

export function DecomposerPanelContent({ initialContext }: { initialContext?: any }) {
  const workItemIds = initialContext?.workItemIds || [initialContext.workItemId] || [];
  const parentWorkItemId = workItemIds.length > 0 ? workItemIds[0] : null;

  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [showWitHierarchyViewer, setShowWitHierarchyViewer] = useState<boolean>(false);
  const [witHierarchyViewerPosition, setWitHierarchyViewerPosition] = useState<{
    x: number;
    y: number;
  }>({
    x: 0,
    y: 0,
  });
  const [isMetadataLoading, setIsMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isHierarchyEmpty, setIsHierarchyEmpty] = useState<boolean>(true);
  const [hierarchyCount, setHierarchyCount] = useState<number>(0);

  const { batchSetWorkItemConfigurations, workItemConfigurations } = useGlobalState();
  const hierarchyAreaRef = useRef<DecomposerWorkItemTreeAreaRef>(null);

  const hierarchyManager = useMemo(
    () => new WorkItemHierarchyManager(workItemConfigurations, [], undefined, setError),
    [workItemConfigurations, setError],
  );
  // Callback for selecting items (can be passed down if needed)
  const handleSelectWorkItem = useCallback((workItemId: string) => {
    decomposerLogger.debug('Work item selected in parent:', workItemId);
    // TODO: Potentially fetch details or perform other actions here
  }, []);

  // Callback for HierarchyArea to signal changes
  const handleHierarchyChange = useCallback(
    (isEmpty: boolean) => {
      setIsHierarchyEmpty(isEmpty);
      setHierarchyCount(hierarchyManager.getHierarchyCount());
    },
    [hierarchyManager],
  );

  // Fetch project name on mount
  useEffect(() => {
    const webContext = SDK.getWebContext();
    if (webContext?.project?.name) {
      setProjectName(webContext.project.name);
    }
  }, []);

  // Function to close the panel (passed to action bar)
  const closePanel = useCallback(async (result?: any) => {
    decomposerLogger.debug('Panel closed with result:', result);
    const config = SDK.getConfiguration();
    if (config.panel && typeof config.panel.close === 'function') {
      config.panel.close(result);
    } else {
      decomposerLogger.warn(
        'Panel close function not provided or not a function in configuration.',
      );
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
        decomposerLogger.debug('Parent Work Item:', wi);

        const parentType = wi.fields['System.WorkItemType'];
        hierarchyManager.setParentWorkItemType(parentType);
      } catch (err: any) {
        decomposerLogger.error('Error fetching data:', err);
        setError(err.message || 'Failed to load work item data');
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchData();
  }, [parentWorkItemId, hierarchyManager]);
  // Fetch metadata (rules and colors) using centralized initializer
  useEffect(() => {
    if (!projectName) {
      return;
    }

    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchMetadata = async () => {
      setIsMetadataLoading(true);
      setMetadataError(null);

      try {
        const result = await initializeWitData(batchSetWorkItemConfigurations);

        if (signal.aborted) return;

        if (!result.success) {
          setMetadataError(result.error || 'Failed to load work item metadata');
        }
      } catch (err: any) {
        if (signal.aborted) return;
        decomposerLogger.error('Failed to fetch metadata:', err);
        setMetadataError(
          err.message || 'An unknown error occurred while fetching work item metadata.',
        );
      } finally {
        if (!signal.aborted) {
          setIsMetadataLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      abortController.abort();
    };
  }, [projectName, batchSetWorkItemConfigurations]);

  // Handlers for showing/hiding the type hierarchy popup
  const handleShowWitHierarchyViewer = useCallback((position: { x: number; y: number }) => {
    setWitHierarchyViewerPosition(position);
    setShowWitHierarchyViewer(true);
  }, []);

  const handleCloseTypeHierarchy = useCallback(() => {
    setShowWitHierarchyViewer(false);
  }, []);

  const canAdd = useMemo(
    () => !!parentWorkItem && !isInitialLoading && !isMetadataLoading,
    [parentWorkItem, isInitialLoading, isMetadataLoading],
  );

  const handleAddRootItemRequest = useCallback(
    (event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      if (hierarchyAreaRef.current) {
        hierarchyAreaRef.current.requestAddItemAtRoot(event);
      }
    },
    [],
  );

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

      <DecomposerPanelHeader
        parentWorkItem={parentWorkItem}
        projectName={projectName}
        onShowWitHierarchyViewer={handleShowWitHierarchyViewer}
        onAddRootItem={handleAddRootItemRequest}
        canAdd={canAdd}
        hierarchyCount={hierarchyCount}
      />

      {showWitHierarchyViewer && projectName && !isMetadataLoading && !metadataError && (
        <Draggable
          handle=".wit-hierarchy-header-title"
          position={witHierarchyViewerPosition}
          bounds="parent"
          onStop={(e, data) => setWitHierarchyViewerPosition({ x: data.x, y: data.y })}
        >
          <div style={{ position: 'absolute', zIndex: 100 }}>
            <WitHierarchyViewer
              projectName={projectName}
              onClose={handleCloseTypeHierarchy}
              selectedWit={parentWorkItem?.fields['System.WorkItemType']}
            />
          </div>
        </Draggable>
      )}

      <DecomposerWorkItemTreeArea
        ref={hierarchyAreaRef}
        isLoading={isInitialLoading}
        hierarchyManager={hierarchyManager}
        onSelectWorkItem={handleSelectWorkItem}
        onHierarchyChange={handleHierarchyChange}
        canAdd={!!projectName && !!parentWorkItem}
      />

      <DecomposerPanelActionBar
        hierarchyManager={hierarchyManager}
        parentWorkItemId={parentWorkItemId}
        projectName={projectName}
        onClosePanel={closePanel}
        onError={setError}
        canSave={canSave}
      />
    </div>
  );
}
