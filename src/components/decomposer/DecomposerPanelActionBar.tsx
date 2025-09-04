import React, { useState, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { createWorkItemHierarchy } from '../../services/workItemCreationService';
import { ButtonGroup } from 'azure-devops-ui/ButtonGroup';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { openSettingsPage } from '../../services/navigationService';
import { IconSize } from 'azure-devops-ui/Icon';
import { logger } from '../../core/common/logger';
import { useContextShortcuts } from '../../core/shortcuts/useShortcuts';
import { ShortcutCode } from '../../core/shortcuts/shortcutConfiguration';
import { DecomposerWorkItemTreeAreaRef } from './DecomposerWorkItemTreeArea';

const actionBarLogger = logger.createChild('ActionBar');

interface DecomposerPanelActionBarProps {
  hierarchyManager: WorkItemHierarchyManager;
  parentWorkItemId: number | null;
  projectName: string;
  onClosePanel: (_result?: unknown) => void;
  onError: (_error: string | null) => void;
  canSave: boolean;
  onShowShortcutsHelp: () => void;
  isAnyNodeInDeleteConfirmation?: boolean;
  hierarchyAreaRef?: React.RefObject<DecomposerWorkItemTreeAreaRef>;
}

export function DecomposerPanelActionBar(props: DecomposerPanelActionBarProps) {
  const {
    hierarchyManager,
    parentWorkItemId,
    projectName,
    onClosePanel,
    onError,
    canSave,
    onShowShortcutsHelp,
    isAnyNodeInDeleteConfirmation,
    hierarchyAreaRef,
  } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenSettings = useCallback(() => {
    openSettingsPage(onError);
  }, [onError]);

  const handleSave = useCallback(async () => {
    if (!parentWorkItemId || !projectName) {
      onError('Cannot save: Parent work item ID or project name is missing.');
      return;
    }

    // Commit any pending title changes before saving
    if (hierarchyAreaRef?.current) {
      hierarchyAreaRef.current.commitPendingTitleChanges();
    }

    setIsLoading(true);
    onError(null);
    let saveSuccess = true;
    const currentHierarchy = hierarchyManager.getHierarchy();
    actionBarLogger.debug('Starting save process via service for hierarchy:', currentHierarchy);

    try {
      const creationErrors = await createWorkItemHierarchy(
        currentHierarchy,
        parentWorkItemId,
        projectName,
      );

      actionBarLogger.debug('Save process completed.');
      if (creationErrors.length > 0) {
        onError(creationErrors.join('; \n'));
        saveSuccess = false;
      }
    } catch (err: unknown) {
      actionBarLogger.error('Error during save setup:', err);
      onError((err as Error).message || 'Failed to initiate save process');
      saveSuccess = false;
    } finally {
      setIsLoading(false);
      if (saveSuccess) {
        onClosePanel({ action: 'save', success: true });
      }
    }
  }, [hierarchyManager, onClosePanel, parentWorkItemId, projectName, onError, hierarchyAreaRef]);

  const handleDiscard = useCallback(() => {
    onClosePanel({ action: 'discard' });
  }, [onClosePanel]);

  const handleCancel = useCallback(() => {
    onClosePanel({ action: 'cancel' });
  }, [onClosePanel]);
  useContextShortcuts(
    'actionBar',
    [{ code: ShortcutCode.ALT_SHIFT_S, callback: handleSave }],
    !isLoading && canSave && !isAnyNodeInDeleteConfirmation,
  );

  return (
    <div
      style={{
        borderTop: '1px solid #ccc',
        padding: '8px',
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          iconProps={{ iconName: 'Settings', size: IconSize.large }}
          onClick={handleOpenSettings}
          subtle
          tooltipProps={{ text: 'Open Decomposer Settings' }}
          ariaLabel="Open Decomposer Settings"
          className="action-bar-settings-button"
        />
        <Button
          iconProps={{ iconName: 'KeyboardClassic', size: IconSize.large }}
          onClick={onShowShortcutsHelp}
          subtle
          tooltipProps={{ text: 'Show Keyboard Shortcuts' }}
          ariaLabel="Show Keyboard Shortcuts"
          className="action-bar-help-button"
        />
      </div>
      <div className="flex-row flex-center rhythm-horizontal-8">
        <ButtonGroup className="flex-grow">
          <Button
            text="Save"
            primary
            onClick={handleSave}
            disabled={!canSave || isLoading || isAnyNodeInDeleteConfirmation}
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
