import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SDK from 'azure-devops-extension-sdk'; // Keep SDK import if needed for types like IWebContext, but not for init/ready
import { Button } from 'azure-devops-ui/Button';
import { WorkItemNode } from '../models/workItemHierarchy';
import { WorkItemHierarchyManager } from '../services/workItemHierarchyManager';
import { getParentWorkItemDetails, createWorkItemHierarchy } from '../services/workItemService';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import { ErrorDisplay } from './errorDisplay';
import { WorkItemTree } from './workItemTree';

export function DecomposePanelContent({ initialContext }: { initialContext?: any }) {
  const workItemIds = initialContext?.workItemIds || [];
  const parentWorkItemId = workItemIds.length > 0 ? workItemIds[0] : null;

  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [newItemsHierarchy, setNewItemsHierarchy] = useState<WorkItemNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');

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
        projectName
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #ccc' }}>
        <h2>Decompose Work Item {parentWorkItemId}</h2>
        {parentWorkItem && (
          <p style={{ margin: 0, color: '#555' }}>
            Parent: {parentWorkItem.fields['System.Title']} (
            {parentWorkItem.fields['System.WorkItemType']})
          </p>
        )}
      </div>

      <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto' }}>
        {isLoading && <p>Loading...</p>}
        <ErrorDisplay error={error} />

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
          primary={true}
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
