import React, { useRef, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Pill, PillVariant } from 'azure-devops-ui/Pill';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';
import './DecomposerPanelHeader.scss';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import { IconSize } from 'azure-devops-ui/Icon';

interface DecomposerPanelHeaderProps {
  parentWorkItem: WorkItem | null;
  projectName: string;
  onShowWitHierarchyViewer: (_position: { x: number; y: number }) => void;
  onAddRootItem: (
    _event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  onCreateHierarchyFromText: () => void;
  onShowFormatHelp: () => void;
  canAdd: boolean;
  hierarchyCount: number;
  isAnyNodeInDeleteConfirmation?: boolean;
}

export function DecomposerPanelHeader(props: DecomposerPanelHeaderProps) {
  const {
    parentWorkItem,
    projectName,
    onShowWitHierarchyViewer,
    onAddRootItem,
    onCreateHierarchyFromText,
    onShowFormatHelp,
    canAdd,
    hierarchyCount,
    isAnyNodeInDeleteConfirmation,
  } = props;
  const showWitHierarchyViewerButtonContainerRef = useRef<HTMLDivElement>(null);
  const { getWorkItemConfiguration } = useGlobalState();

  const handleCreateHierarchyFromTextClick = useCallback(() => {
    onCreateHierarchyFromText();
  }, [onCreateHierarchyFromText]);

  const handleShowWitHierarchyViewerClick = useCallback(() => {
    if (showWitHierarchyViewerButtonContainerRef.current) {
      const panel = showWitHierarchyViewerButtonContainerRef.current.closest(
        '.decomposer-panel-content',
      );
      const buttonRect = showWitHierarchyViewerButtonContainerRef.current.getBoundingClientRect();
      let panelRect = { top: 0, left: 0, width: 0, height: 0 };
      if (panel) {
        panelRect = panel.getBoundingClientRect();
      }
      const y = buttonRect.bottom - panelRect.top;
      const hierarchyComponentWidth = 350; // This is the width of the wit hierarchy viewer component
      const x = buttonRect.right - panelRect.left - hierarchyComponentWidth - 3;
      onShowWitHierarchyViewer({ x, y });
    }
  }, [onShowWitHierarchyViewer]);

  let parentType = '';
  let parentTitle = 'Loading parent info...';
  let parentColor = '#000000';
  let textColor = getTextColorForBackground(parentColor);
  let parentIconUrl: string | undefined = undefined;

  if (parentWorkItem) {
    parentType = parentWorkItem.fields['System.WorkItemType'];
    parentTitle = parentWorkItem.fields['System.Title'];
    const config = getWorkItemConfiguration(parentType);
    if (config) {
      parentColor = config.color || '#f0f0f0';
      textColor = getTextColorForBackground(parentColor);
      parentIconUrl = config.iconUrl;
    } else {
      parentColor = '#f0f0f0';
      textColor = getTextColorForBackground(parentColor);
    }
  }

  return (
    <div className="decomposer-panel-header">
      {parentWorkItem ? (
        <div
          className="decomposer-panel-header-info"
          title="You are decomposing this item"
          style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', overflow: 'hidden' }}
        >
          {parentIconUrl ? (
            <img className="wit-icon" src={parentIconUrl} alt={parentType} title={parentType} />
          ) : (
            <span
              className="decomposer-panel-header-type"
              style={{
                backgroundColor: parentColor,
                color: textColor,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '2px 5px',
              }}
              title={parentType}
            >
              {parentType}
            </span>
          )}
          <span className="decomposer-panel-header-title" title={parentTitle}>
            {parentTitle}
          </span>
          <span title="These are the items you are decomposing, not all items that might exist under this work item">
            <Pill
              className="decomposer-panel-header-count"
              containsCount
              variant={PillVariant.outlined}
              excludeTabStop
            >
              {hierarchyCount} item{hierarchyCount !== 1 ? 's' : ''}
            </Pill>
          </span>
        </div>
      ) : (
        <Spinner size={SpinnerSize.small} />
      )}
      <div className="decomposer-panel-header-actions">
        <Button
          tooltipProps={{ text: 'Add Child' }}
          onClick={(event) => onAddRootItem(event)}
          disabled={!canAdd || !parentWorkItem || isAnyNodeInDeleteConfirmation}
          iconProps={{ iconName: 'Add' }}
          subtle
        />
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Button
            tooltipProps={{ text: 'Create Hierarchy from text' }}
            onClick={handleCreateHierarchyFromTextClick}
            disabled={!canAdd || !parentWorkItem || isAnyNodeInDeleteConfirmation}
            iconProps={{ className: 'ms-Icon ms-Icon--ClipboardListAdd' }}
            subtle
          />
          <Button
            tooltipProps={{ text: 'Text Format Help' }}
            onClick={onShowFormatHelp}
            iconProps={{ iconName: 'Help', size: IconSize.small }}
            className="decomposer-panel-header-help-button"
          />
        </div>
        <div ref={showWitHierarchyViewerButtonContainerRef}>
          <Button
            tooltipProps={{ text: 'View Type Hierarchy' }}
            onClick={handleShowWitHierarchyViewerClick}
            disabled={!projectName || !parentWorkItem}
            iconProps={{ iconName: 'ViewListTree' }}
            subtle
          />
        </div>
      </div>
    </div>
  );
}
