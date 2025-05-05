import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added useRef
import SDK from 'azure-devops-extension-sdk';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemNode } from '../models/workItemHierarchy';
import { WorkItemHierarchyManager } from '../services/workItemHierarchyManager';
import { createWorkItemHierarchy } from '../services/workItemCreationService';
import { getParentWorkItemDetails } from '../services/workItemDataService';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import { ErrorDisplay } from './errorDisplay';
import { WorkItemTree } from './workItemTree';
import { WorkItemTypeHierarchy } from './workItemTypeHierarchy';
import Draggable from 'react-draggable';

export function DecomposePanelContent({ initialContext }: { initialContext?: any }) {
  const workItemIds = initialContext?.workItemIds || [];
  const parentWorkItemId = workItemIds.length > 0 ? workItemIds[0] : null;

  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [newItemsHierarchy, setNewItemsHierarchy] = useState<WorkItemNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [showTypeHierarchy, setShowTypeHierarchy] = useState<boolean>(false);
  const [hierarchyPosition, setHierarchyPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  }); // State for position
  const hierarchyButtonContainerRef = useRef<HTMLDivElement | null>(null); // Ref for button container

  const hierarchyManager = useMemo(() => new WorkItemHierarchyManager(), []);

  const handleSelectWorkItem = useCallback((workItemId: string) => {
    console.log('Work item selected:', workItemId);
  }, []);

  useEffect(() => {
    const webContext = SDK.getWebContext();
    if (webContext?.project?.name) {
      setProjectName(webContext.project.name);
    }
  }, []);

  const closePanel = useCallback(async (result?: any) => {
    console.log('Panel closed with result:', result);
    const config = SDK.getConfiguration();
    if (config.panel && typeof config.panel.close === 'function') {
      config.panel.close(result);
    } else {
      console.warn('Panel close function not provided or not a function in configuration.');
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!parentWorkItemId || !projectName) return;

      setIsLoading(true);
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
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parentWorkItemId, projectName, hierarchyManager]);

  const handleSave = useCallback(async () => {
    if (!parentWorkItemId || !projectName) {
      setError('Cannot save: Parent work item ID or project name is missing.');
      return;
    }

    setIsLoading(true);
    setError(null);
    let saveSuccess = true;

    try {
      const currentHierarchy = hierarchyManager.getHierarchy();
      console.log('Starting save process via service for hierarchy:', currentHierarchy);
      const creationErrors = await createWorkItemHierarchy(
        currentHierarchy,
        parentWorkItemId,
        projectName,
      );

      console.log('Save process completed.');
      if (creationErrors.length > 0) {
        setError(creationErrors.join('; \n'));
        saveSuccess = false;
      }
    } catch (err: any) {
      console.error('Error during save setup:', err);
      setError(err.message || 'Failed to initiate save process');
      saveSuccess = false;
    } finally {
      setIsLoading(false);
      if (saveSuccess) {
        closePanel({ action: 'save', success: true });
      }
    }
  }, [hierarchyManager, closePanel, parentWorkItemId, projectName]);

  const handleAddItem = useCallback(
    (parentId?: string) => {
      console.log('Add item requested via manager for parent:', parentId || 'root');
      const updatedHierarchy = hierarchyManager.addItem(parentId);
      setNewItemsHierarchy(updatedHierarchy);
    },
    [hierarchyManager],
  );

  const handleTitleChange = useCallback(
    (itemId: string, newTitle: string) => {
      const updatedHierarchy = hierarchyManager.updateItemTitle(itemId, newTitle);
      setNewItemsHierarchy(updatedHierarchy);
    },
    [hierarchyManager],
  );

  // TODO: handle resize of the component to recalculate position
  const handleShowTypeHierarchy = useCallback(() => {
    if (hierarchyButtonContainerRef.current) {
      // Find the panel container using the class name. This is the bounds parent for Draggable
      const panel = hierarchyButtonContainerRef.current.closest('.view-type-hierarchy-viewer');
      const buttonRect = hierarchyButtonContainerRef.current.getBoundingClientRect();
      let panelRect = { top: 0, left: 0 }; // Default if panel not found

      if (panel) {
        panelRect = panel.getBoundingClientRect();
      }

      // Calculate position relative to the panel (the Draggable bounds parent), so it appears near the button
      // Bottom / right edge under the button
      const y = buttonRect.bottom - panelRect.top + 10;

      // *NOTE*: For dynamic precision, measure the rendered element's offsetWidth using a ref and useEffect after the component mounts or becomes visible.
      const hierarchyComponentWidth = 400; // Width in pixels (defined in the child's scss file)
      const x = buttonRect.right - panelRect.left - hierarchyComponentWidth;

      setHierarchyPosition({ x, y });
    }
    setShowTypeHierarchy(true);
  }, []);

  const handleCloseTypeHierarchy = useCallback(() => {
    setShowTypeHierarchy(false);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
      className="view-type-hierarchy-viewer" // class for easier DOM selection
    >
      <ErrorDisplay error={error} />

      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #ccc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {parentWorkItem ? (
          <p style={{ margin: 0, color: '#555' }}>
            Parent: {parentWorkItem.fields['System.Title']} (
            {parentWorkItem.fields['System.WorkItemType']})
          </p>
        ) : (
          <p style={{ margin: 0, color: '#555' }}>Loading parent info...</p>
        )}
        <div ref={hierarchyButtonContainerRef}>
          <Button
            text="View Type Hierarchy"
            onClick={handleShowTypeHierarchy}
            disabled={!projectName}
            iconProps={{ iconName: 'ViewListTree' }}
          />
        </div>
      </div>

      {showTypeHierarchy && projectName && (
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

      <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto' }}>
        {isLoading && <p>Loading...</p>}

        {!isLoading && (
          <>
            {newItemsHierarchy.length === 0 && (
              <Button
                text="Add First Child Item"
                onClick={() => handleAddItem()}
                disabled={!projectName || !parentWorkItem}
                primary
                style={{ marginBottom: '15px' }}
              />
            )}
            <WorkItemTree
              hierarchy={newItemsHierarchy}
              onAddItem={handleAddItem}
              onTitleChange={handleTitleChange}
              onSelectWorkItem={handleSelectWorkItem}
            />
          </>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid #ccc',
          padding: '8px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={handleSave}
          primary
          style={{ marginRight: '8px' }}
          disabled={isLoading || newItemsHierarchy.length === 0 || !projectName}
          text="Save Changes"
        />
        <Button
          onClick={() => closePanel({ action: 'discard' })}
          style={{ marginRight: '8px' }}
          disabled={isLoading}
          text="Discard Changes"
        />
        <Button
          onClick={() => closePanel({ action: 'cancel' })}
          disabled={isLoading}
          text="Cancel"
        />
      </div>
    </div>
  );
}
