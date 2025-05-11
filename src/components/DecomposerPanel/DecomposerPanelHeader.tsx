import React, { useRef, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';

interface DecomposerPanelHeaderProps {
  parentWorkItem: any;
  projectName: string;
  onShowTypeHierarchy: (position: { x: number; y: number }) => void;
  onAddRootItem: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  canAdd: boolean;
}

export function DecomposerPanelHeader(props: DecomposerPanelHeaderProps) {
  const { parentWorkItem, projectName, onShowTypeHierarchy, onAddRootItem, canAdd } = props;
  const hierarchyButtonContainerRef = useRef<HTMLDivElement>(null);
  const { getWorkItemConfiguration } = useGlobalState();

  const handleShowTypeHierarchyClick = useCallback(() => {
    if (hierarchyButtonContainerRef.current) {
      const panel = hierarchyButtonContainerRef.current.closest('.decomposer-panel-content');
      const buttonRect = hierarchyButtonContainerRef.current.getBoundingClientRect();
      let panelRect = { top: 0, left: 0, width: 0, height: 0 };
      if (panel) {
        panelRect = panel.getBoundingClientRect();
      }
      const y = buttonRect.bottom - panelRect.top + 10;
      const hierarchyComponentWidth = 400;
      const x = buttonRect.right - panelRect.left - hierarchyComponentWidth;
      onShowTypeHierarchy({ x, y });
    }
  }, [onShowTypeHierarchy]);

  let parentType = '';
  let parentTitle = 'Loading parent info...';
  let parentColor = '#000000';
  let textColor = getTextColorForBackground(parentColor);

  if (parentWorkItem) {
    parentType = parentWorkItem.fields['System.WorkItemType'];
    parentTitle = parentWorkItem.fields['System.Title'];
    const config = getWorkItemConfiguration(parentType);
    if (config?.color) {
      parentColor = config.color;
      textColor = getTextColorForBackground(parentColor);
    } else {
      parentColor = '#f0f0f0';
      textColor = getTextColorForBackground(parentColor);
    }
  }

  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {parentWorkItem ? (
        <div
          style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 1, marginRight: '10px' }}
          title="You are decomposing this item"
        >
          <span
            style={{
              backgroundColor: parentColor,
              color: textColor,
              padding: '2px 6px',
              borderRadius: '4px',
              marginRight: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            {parentType}
          </span>
          <span
            style={{
              color: '#333333',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={parentTitle}
          >
            {parentTitle}
          </span>
        </div>
      ) : (
        <p style={{ margin: 0, color: '#555555', flexShrink: 1, marginRight: '10px' }}>Loading parent info...</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Button
          text="Add Child"
          onClick={(event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => onAddRootItem(event)}
          disabled={!canAdd || !parentWorkItem}
          iconProps={{ iconName: 'Add' }}
          subtle
        />
        <div ref={hierarchyButtonContainerRef} style={{ marginLeft: '8px' }}>
          <Button
            text="View Type Hierarchy"
            onClick={handleShowTypeHierarchyClick}
            disabled={!projectName || !parentWorkItem}
            iconProps={{ iconName: 'ViewListTree' }}
            subtle
          />
        </div>
      </div>
    </div>
  );
}
