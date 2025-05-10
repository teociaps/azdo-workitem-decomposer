import React, { useRef, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';

interface DecomposePanelHeaderProps {
  parentWorkItem: any;
  projectName: string;
  onShowTypeHierarchy: (position: { x: number; y: number }) => void;
}

export function DecomposePanelHeader(props: DecomposePanelHeaderProps) {
  const { parentWorkItem, projectName, onShowTypeHierarchy } = props;
  const hierarchyButtonContainerRef = useRef<HTMLDivElement>(null);
  const { getWorkItemConfiguration } = useGlobalState();

  const handleShowTypeHierarchy = useCallback(() => {
    if (hierarchyButtonContainerRef.current) {
      const panel = hierarchyButtonContainerRef.current.closest('.view-type-hierarchy-viewer');
      const buttonRect = hierarchyButtonContainerRef.current.getBoundingClientRect();
      let panelRect = { top: 0, left: 0 };
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
  let textColor = '#000000';

  if (parentWorkItem) {
    parentType = parentWorkItem.fields['System.WorkItemType'];
    parentTitle = parentWorkItem.fields['System.Title'];
    const config = getWorkItemConfiguration(parentType);
    if (config?.color) {
      parentColor = config.color;
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
          style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}
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
        <p style={{ margin: 0, color: '#555555' }}>Loading parent info...</p>
      )}
      <div ref={hierarchyButtonContainerRef}>
        <Button
          text="View Type Hierarchy"
          onClick={handleShowTypeHierarchy}
          disabled={!projectName}
          iconProps={{ iconName: 'ViewListTree' }}
          subtle
        />
      </div>
    </div>
  );
}
