import React, { useState, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { createWorkItemHierarchy } from '../../services/workItemCreationService';
import { ButtonGroup } from 'azure-devops-ui/ButtonGroup';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner'; // Import Spinner and SpinnerSize
import { openSettingsPage } from '../../services/navigationService'; // Import the new function
import { IconSize } from 'azure-devops-ui/Icon';

interface DecomposerPanelActionBarProps {
  hierarchyManager: WorkItemHierarchyManager;
  parentWorkItemId: number | null;
  projectName: string;
  onClosePanel: (result?: any) => void;
  onError: (error: string | null) => void;
  canSave: boolean;
}

export function DecomposerPanelActionBar(props: DecomposerPanelActionBarProps) {
  const { hierarchyManager, parentWorkItemId, projectName, onClosePanel, onError, canSave } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenSettings = useCallback(() => {
    openSettingsPage(onError);
  }, [onError]);

  const handleSave = useCallback(async () => {
    if (!parentWorkItemId || !projectName) {
      onError('Cannot save: Parent work item ID or project name is missing.');
      return;
    }

    setIsLoading(true);
    onError(null);
    let saveSuccess = true;

    const currentHierarchy = hierarchyManager.getHierarchy();
    console.log('Starting save process via service for hierarchy:', currentHierarchy);

    try {
      const creationErrors = await createWorkItemHierarchy(
        currentHierarchy,
        parentWorkItemId,
        projectName,
      );

      console.log('Save process completed.');
      if (creationErrors.length > 0) {
        onError(creationErrors.join('; \n'));
        saveSuccess = false;
      }
    } catch (err: any) {
      console.error('Error during save setup:', err);
      onError(err.message || 'Failed to initiate save process');
      saveSuccess = false;
    } finally {
      setIsLoading(false);
      if (saveSuccess) {
        onClosePanel({ action: 'save', success: true });
      }
    }
  }, [hierarchyManager, onClosePanel, parentWorkItemId, projectName, onError]);

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
        justifyContent: 'space-between',
      }}
    >
      <Button
        iconProps={{ iconName: 'Settings', size: IconSize.large }}
        onClick={handleOpenSettings}
        subtle
        tooltipProps={{ text: 'Open Decomposer Settings' }}
        ariaLabel="Open Decomposer Settings"
        className="action-bar-settings-button"
      />
      <div className="flex-row flex-center rhythm-horizontal-8">
        <ButtonGroup className="flex-grow">
          <Button
            text="Save"
            primary
            onClick={handleSave}
            disabled={!canSave || isLoading}
            iconProps={isLoading ? undefined : { iconName: 'Save' }}
          />
          {isLoading && <Spinner size={SpinnerSize.small} className="action-bar-spinner" />}
          <Button text="Discard" onClick={handleDiscard} disabled={isLoading} subtle />
          <Button text="Cancel" onClick={handleCancel} disabled={isLoading} subtle />
        </ButtonGroup>
      </div>
    </div>
  );
}
