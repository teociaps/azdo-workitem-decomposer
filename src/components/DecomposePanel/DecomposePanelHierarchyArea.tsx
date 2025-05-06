import React, { useState, useCallback, useEffect } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemTree } from '../WorkItemTree/WorkItemTree';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { WorkItemHierarchyManager } from '../../services/workItemHierarchyManager';

interface DecomposePanelHierarchyAreaProps {
  isLoading: boolean;
  hierarchyManager: WorkItemHierarchyManager;
  onSelectWorkItem: (workItemId: string) => void;
  canAdd: boolean;
  onHierarchyChange: (isEmpty: boolean) => void;
}

export function DecomposePanelHierarchyArea(props: DecomposePanelHierarchyAreaProps) {
  const {
    isLoading,
    hierarchyManager,
    onSelectWorkItem,
    canAdd,
    onHierarchyChange,
  } = props;

  const [newItemsHierarchy, setNewItemsHierarchy] = useState<WorkItemNode[]>(
    hierarchyManager.getHierarchy(),
  );

  useEffect(() => {
    onHierarchyChange(newItemsHierarchy.length === 0);
  }, [newItemsHierarchy, onHierarchyChange]);

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
    <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto' }}>
      {isLoading && <p>Loading...</p>}
      {!isLoading && (
        <>
          {newItemsHierarchy.length === 0 && (
            <Button
              text="Add First Child Item"
              onClick={() => handleAddItem()}
              disabled={!canAdd}
              primary
              style={{ marginBottom: '15px' }}
            />
          )}
          <WorkItemTree
            hierarchy={newItemsHierarchy}
            onAddItem={handleAddItem}
            onTitleChange={handleTitleChange}
            onSelectWorkItem={onSelectWorkItem}
          />
        </>
      )}
    </div>
  );
}
