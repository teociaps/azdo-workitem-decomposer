import React, { useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../../core/models/commonTypes';
import { ChildTypeSelectionModal } from '../ChildTypeSelectionModal/ChildTypeSelectionModal';
import { WorkItemTree } from '../WorkItemTree/WorkItemTree';
import { WorkItemHierarchyManager } from '../../services/workItemHierarchyManager';

interface DecomposePanelHierarchyAreaProps {
  isLoading: boolean;
  hierarchyManager: WorkItemHierarchyManager;
  onSelectWorkItem: (workItemId: string) => void;
  canAdd: boolean;
  onHierarchyChange: (isEmpty: boolean) => void;
}

export interface DecomposePanelHierarchyAreaRef {
  requestAddItemAtRoot: (event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
}

const DecomposePanelHierarchyAreaWithRef = forwardRef<DecomposePanelHierarchyAreaRef, DecomposePanelHierarchyAreaProps>((props, ref) => {
  const {
    isLoading,
    hierarchyManager,
    onSelectWorkItem,
    canAdd,
    onHierarchyChange,
  } = props;

  const [newItemsHierarchy, setNewItemsHierarchy] = useState<WorkItemNode[]>([]);

  // State for child type selection
  const [isSelectingChildType, setIsSelectingChildType] = useState<boolean>(false);
  const [childTypeOptions, setChildTypeOptions] = useState<WorkItemTypeName[]>([]);
  const [currentParentIdForAddItem, setCurrentParentIdForAddItem] = useState<string | undefined>(undefined);
  const [anchorElementForModal, setAnchorElementForModal] = useState<HTMLElement | null>(null);
  const [scrollableContainerForModal, setScrollableContainerForModal] = useState<HTMLElement | null>(null);

  const scrollableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNewItemsHierarchy(hierarchyManager.getHierarchy());
  }, [hierarchyManager]); // Re-sync if hierarchyManager instance changes

  useEffect(() => {
    onHierarchyChange(newItemsHierarchy.length === 0);
  }, [newItemsHierarchy, onHierarchyChange]);

  const handleRequestAddItem = useCallback(
    (
      parentId?: string,
      event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
    ) => {
      if (!canAdd) return;

      const possibleChildTypes = hierarchyManager.getPossibleChildTypes(parentId);

      if (possibleChildTypes.length === 0) {
        alert('No child work item types can be added here according to the current configuration.');
        return;
      }

      if (possibleChildTypes.length === 1) {
        const updatedHierarchy = hierarchyManager.addItem(possibleChildTypes[0], parentId);
        setNewItemsHierarchy([...updatedHierarchy]); // Ensure re-render by creating new array
      } else {
        setChildTypeOptions(possibleChildTypes);
        setCurrentParentIdForAddItem(parentId);
        setAnchorElementForModal(event?.currentTarget || null);
        setScrollableContainerForModal(scrollableContainerRef.current);
        setIsSelectingChildType(true);
      }
    },
    [hierarchyManager, canAdd, setNewItemsHierarchy, scrollableContainerRef],
  );

  useImperativeHandle(ref, () => ({
    requestAddItemAtRoot: (event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      handleRequestAddItem(undefined, event); // Call internal handler with parentId = undefined
    }
  }));

  const handleConfirmChildTypeSelection = useCallback(
    (selectedType: WorkItemTypeName) => {
      const updatedHierarchy = hierarchyManager.addItem(
        selectedType,
        currentParentIdForAddItem,
      );
      setNewItemsHierarchy([...updatedHierarchy]); // Ensure re-render
      setIsSelectingChildType(false);
      setChildTypeOptions([]);
      setCurrentParentIdForAddItem(undefined);
      setAnchorElementForModal(null);
      setScrollableContainerForModal(null);
    },
    [hierarchyManager, currentParentIdForAddItem, setNewItemsHierarchy],
  );

  const handleDismissChildTypeSelection = useCallback(() => {
    setIsSelectingChildType(false);
    setChildTypeOptions([]);
    setCurrentParentIdForAddItem(undefined);
    setAnchorElementForModal(null);
    setScrollableContainerForModal(null);
  }, []);

  const handleTitleChange = useCallback(
    (itemId: string, newTitle: string) => {
      const updatedHierarchy = hierarchyManager.updateItemTitle(itemId, newTitle);
      setNewItemsHierarchy([...updatedHierarchy]); // Ensure re-render
    },
    [hierarchyManager, setNewItemsHierarchy],
  );

  return (
    <div ref={scrollableContainerRef} style={{ flexGrow: 1, padding: '1rem .2rem', overflowY: 'auto', position: 'relative' }}>
      <ChildTypeSelectionModal
        isOpen={isSelectingChildType}
        types={childTypeOptions}
        onSelect={handleConfirmChildTypeSelection}
        onDismiss={handleDismissChildTypeSelection}
        anchorElement={anchorElementForModal}
        scrollableContainer={scrollableContainerForModal}
      />

      {!isLoading && (
        <>
          <WorkItemTree
            hierarchy={newItemsHierarchy}
            onAddItem={handleRequestAddItem} // This is for adding children to existing items in the tree
            onTitleChange={handleTitleChange}
            onSelectWorkItem={onSelectWorkItem}
          />
        </>
      )}
    </div>
  );
});

DecomposePanelHierarchyAreaWithRef.displayName = 'DecomposePanelHierarchyArea';
export { DecomposePanelHierarchyAreaWithRef as DecomposePanelHierarchyArea };
