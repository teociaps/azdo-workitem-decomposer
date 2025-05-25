import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../../core/models/commonTypes';
import { ChildTypeSelectionModal } from '../modals';
import { PromoteDemoteTypePickerModal } from '../modals';
import { WorkItemTree } from '../tree';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { logger } from '../../core/common/logger';
import './DecomposerWorkItemTreeArea.scss';

const treeAreaLogger = logger.createChild('TreeArea');

interface DecomposerWorkItemTreeAreaProps {
  isLoading: boolean;
  hierarchyManager: WorkItemHierarchyManager;
  onSelectWorkItem: (workItemId: string) => void;
  canAdd: boolean;
  onHierarchyChange: (isEmpty: boolean) => void;
}

export interface DecomposerWorkItemTreeAreaRef {
  requestAddItemAtRoot: (
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
}

const DecomposerWorkItemTreeAreaWithRef = forwardRef<
  DecomposerWorkItemTreeAreaRef,
  DecomposerWorkItemTreeAreaProps
>((props, ref) => {
  const { isLoading, hierarchyManager, onSelectWorkItem, canAdd, onHierarchyChange } = props;

  const [newItemsHierarchy, setNewItemsHierarchy] = useState<WorkItemNode[]>([]);

  // State for child type selection
  const [isSelectingChildType, setIsSelectingChildType] = useState<boolean>(false);
  const [childTypeOptions, setChildTypeOptions] = useState<WorkItemTypeName[]>([]);
  const [currentParentIdForAddItem, setCurrentParentIdForAddItem] = useState<string | undefined>(
    undefined,
  );
  const [anchorElementForModal, setAnchorElementForModal] = useState<HTMLElement | null>(null);
  const [scrollableContainerForModal, setScrollableContainerForModal] =
    useState<HTMLElement | null>(null);

  const [promoteDemoteTypePickerItems, setPromoteDemoteTypePickerItems] = useState<null | Array<{
    node: WorkItemNode;
    possibleTypes: WorkItemTypeName[];
  }>>(null);
  const [pendingPromoteDemote, setPendingPromoteDemote] = useState<null | {
    action: 'promote' | 'demote';
    itemId: string;
  }>(null);

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
      event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    ) => {
      if (!canAdd) return;

      const possibleChildTypes = hierarchyManager.getPossibleChildTypes(parentId);
      if (possibleChildTypes.length === 0) {
        return;
      }

      if (possibleChildTypes.length === 1) {
        const updatedHierarchy = hierarchyManager.addItem(possibleChildTypes[0], parentId);
        setNewItemsHierarchy([...updatedHierarchy]);
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
    requestAddItemAtRoot: (
      event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    ) => {
      handleRequestAddItem(undefined, event); // Call internal handler with parentId = undefined
    },
  }));

  const handleConfirmChildTypeSelection = useCallback(
    (selectedType: WorkItemTypeName) => {
      const updatedHierarchy = hierarchyManager.addItem(selectedType, currentParentIdForAddItem);
      setNewItemsHierarchy([...updatedHierarchy]);
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
      setNewItemsHierarchy([...updatedHierarchy]);
    },
    [hierarchyManager, setNewItemsHierarchy],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const updatedHierarchy = hierarchyManager.removeItem(itemId);
      setNewItemsHierarchy([...updatedHierarchy]);
    },
    [hierarchyManager, setNewItemsHierarchy],
  );
  const collectAffectedNodes = useCallback(
    (itemId: string): WorkItemNode[] => {
      const node = hierarchyManager.findNodeById(itemId);
      if (!node) return [];
      const result: WorkItemNode[] = [];
      const traverse = (n: WorkItemNode) => {
        result.push(n);
        n.children?.forEach(traverse);
      };
      traverse(node);
      treeAreaLogger.debug('Affected nodes:', result);
      return result;
    },
    [hierarchyManager],
  );

  const getPossibleTypesForNodes = useCallback(
    (nodes: WorkItemNode[], action: 'promote' | 'demote') => {
      return nodes.map((node, index) => {
        const isCascadingOperation = index > 0; // True for children (index > 0), false for the main node (index === 0)
        const possibleTypes =
          action === 'promote'
            ? hierarchyManager.getPossiblePromoteTypes(node.id)
            : hierarchyManager.getPossibleDemoteTypes(node.id, isCascadingOperation);
        return { node, possibleTypes };
      });
    },
    [hierarchyManager],
  );

  const handlePromoteItem = useCallback(
    (itemId: string) => {
      const affectedNodes = collectAffectedNodes(itemId);
      const typeOptions = getPossibleTypesForNodes(affectedNodes, 'promote');
      if (typeOptions.some(({ possibleTypes }) => possibleTypes.length > 1)) {
        setPromoteDemoteTypePickerItems(typeOptions);
        setPendingPromoteDemote({ action: 'promote', itemId });
      } else {
        const updatedHierarchy = hierarchyManager.promoteItem(itemId);
        setNewItemsHierarchy([...updatedHierarchy]);
      }
    },
    [collectAffectedNodes, getPossibleTypesForNodes, hierarchyManager, setNewItemsHierarchy],
  );

  const handleDemoteItem = useCallback(
    (itemId: string) => {
      const affectedNodes = collectAffectedNodes(itemId);
      const typeOptions = getPossibleTypesForNodes(affectedNodes, 'demote');
      if (typeOptions.some(({ possibleTypes }) => possibleTypes.length > 1)) {
        setPromoteDemoteTypePickerItems(typeOptions);
        setPendingPromoteDemote({ action: 'demote', itemId });
      } else {
        const updatedHierarchy = hierarchyManager.demoteItem(itemId);
        setNewItemsHierarchy([...updatedHierarchy]);
      }
    },
    [collectAffectedNodes, getPossibleTypesForNodes, hierarchyManager, setNewItemsHierarchy],
  );

  const handlePromoteDemoteTypePickerConfirm = useCallback(
    (selectedTypes: Record<string, WorkItemTypeName>) => {
      if (!pendingPromoteDemote) return;
      let updatedHierarchy: WorkItemNode[] = [];
      if (pendingPromoteDemote.action === 'promote') {
        updatedHierarchy = hierarchyManager.promoteItem(pendingPromoteDemote.itemId, selectedTypes);
      } else {
        updatedHierarchy = hierarchyManager.demoteItem(pendingPromoteDemote.itemId, selectedTypes);
      }
      setNewItemsHierarchy([...updatedHierarchy]);
      setPromoteDemoteTypePickerItems(null);
      setPendingPromoteDemote(null);
    },
    [pendingPromoteDemote, hierarchyManager, setNewItemsHierarchy],
  );

  const handlePromoteDemoteTypePickerCancel = useCallback(() => {
    setPromoteDemoteTypePickerItems(null);
    setPendingPromoteDemote(null);
  }, []);
  return (
    <div ref={scrollableContainerRef} className="decomposer-tree-area-container">
      <ChildTypeSelectionModal
        isOpen={isSelectingChildType}
        types={childTypeOptions}
        onSelect={handleConfirmChildTypeSelection}
        onDismiss={handleDismissChildTypeSelection}
        anchorElement={anchorElementForModal}
        scrollableContainer={scrollableContainerForModal}
      />

      {promoteDemoteTypePickerItems && (
        <PromoteDemoteTypePickerModal
          operation={pendingPromoteDemote?.action || 'promote'}
          targetTitle={promoteDemoteTypePickerItems[0]?.node.title || ''}
          items={promoteDemoteTypePickerItems}
          onConfirm={handlePromoteDemoteTypePickerConfirm}
          onCancel={handlePromoteDemoteTypePickerCancel}
        />
      )}

      {!isLoading && (
        <>
          <WorkItemTree
            hierarchy={newItemsHierarchy}
            onAddItem={handleRequestAddItem}
            onTitleChange={handleTitleChange}
            onSelectWorkItem={onSelectWorkItem}
            onRemoveItem={handleRemoveItem}
            onPromoteItem={handlePromoteItem}
            onDemoteItem={handleDemoteItem}
          />
        </>
      )}
    </div>
  );
});

DecomposerWorkItemTreeAreaWithRef.displayName = 'DecomposerWorkItemTreeArea';
export { DecomposerWorkItemTreeAreaWithRef as DecomposerWorkItemTreeArea };
