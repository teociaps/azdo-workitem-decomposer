import React, { useState, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemHierarchyManager } from '../../services/workItemHierarchyManager';
import { createWorkItemHierarchy } from '../../services/workItemCreationService';

interface DecomposerPanelActionBarProps {
  hierarchyManager: WorkItemHierarchyManager;
  parentWorkItemId: number | null;
  projectName: string;
  onClosePanel: (result?: any) => void;
  onSetError: (error: string | null) => void;
  canSave: boolean;
}

export function DecomposerPanelActionBar(props: DecomposerPanelActionBarProps) {
  const { hierarchyManager, parentWorkItemId, projectName, onClosePanel, onSetError, canSave } =
    props;
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = useCallback(async () => {
    if (!parentWorkItemId || !projectName) {
      onSetError('Cannot save: Parent work item ID or project name is missing.');
      return;
    }

    setIsLoading(true);
    onSetError(null);
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
        onSetError(creationErrors.join('; \n'));
        saveSuccess = false;
      }
    } catch (err: any) {
      console.error('Error during save setup:', err);
      onSetError(err.message || 'Failed to initiate save process');
      saveSuccess = false;
    } finally {
      setIsLoading(false);
      if (saveSuccess) {
        onClosePanel({ action: 'save', success: true });
      }
    }
  }, [hierarchyManager, onClosePanel, parentWorkItemId, projectName, onSetError]);

  const handleDiscard = useCallback(() => {
    onClosePanel({ action: 'discard' });
  }, [onClosePanel]);

  const handleCancel = useCallback(() => {
    onClosePanel({ action: 'cancel' });
  }, [onClosePanel]);

  return (
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
        disabled={isLoading || !canSave || !projectName}
        text="Save Changes"
      />
      <Button
        onClick={handleDiscard}
        style={{ marginRight: '8px' }}
        disabled={isLoading}
        text="Discard Changes"
      />
      <Button onClick={handleCancel} disabled={isLoading} text="Cancel" />
    </div>
  );
}
