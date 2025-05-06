import React, { useRef, useCallback } from 'react';
import { Button } from 'azure-devops-ui/Button';

interface DecomposePanelHeaderProps {
  parentWorkItem: any;
  projectName: string;
  onShowTypeHierarchy: (position: { x: number; y: number }) => void;
}

export function DecomposePanelHeader(props: DecomposePanelHeaderProps) {
  const { parentWorkItem, projectName, onShowTypeHierarchy } = props;
  const hierarchyButtonContainerRef = useRef<HTMLDivElement>(null);

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

  return (
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
  );
}
