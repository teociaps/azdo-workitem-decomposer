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
import { WorkItemTree, WorkItemTreeRef } from '../tree';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { logger } from '../../core/common/logger';
import './DecomposerWorkItemTreeArea.scss';

const treeAreaLogger = logger.createChild('TreeArea');

interface DecomposerWorkItemTreeAreaProps {
  isLoading: boolean;
  hierarchyManager: WorkItemHierarchyManager;
  onSelectWorkItem: (_workItemId: string) => void;
  canAdd: boolean;
  onHierarchyChange: (_isEmpty: boolean) => void;
  onDeleteConfirmationChange?: (_isAnyNodeInDeleteConfirmation: boolean) => void;
}

export interface DecomposerWorkItemTreeAreaRef {
  requestAddItemAtRoot: (
    _event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  navigateUp: () => void;
  navigateDown: () => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  navigateHome: () => void;
  navigateEnd: () => void;
  navigatePageUp: () => void;
  navigatePageDown: () => void;
  requestEditFocused: () => void;
  requestAddChildToFocused: () => void;
  requestRemoveFocused: () => void;
  requestPromoteFocused: () => void;
  requestDemoteFocused: () => void;
  isAnyNodeInDeleteConfirmation: () => boolean;
  commitPendingTitleChanges: () => void;
}

const DecomposerWorkItemTreeAreaWithRef = forwardRef<
  DecomposerWorkItemTreeAreaRef,
  DecomposerWorkItemTreeAreaProps
>((props, ref) => {
  const {
    isLoading,
    hierarchyManager,
    onSelectWorkItem,
    canAdd,
    onHierarchyChange,
    onDeleteConfirmationChange,
  } = props;

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

  const [promoteDemoteTypePickerItems, setPromoteDemoteTypePickerItems] = useState<
    | null
    | {
        node: WorkItemNode;
        possibleTypes: WorkItemTypeName[];
      }[]
  >(null);
  const [pendingPromoteDemote, setPendingPromoteDemote] = useState<null | {
    action: 'promote' | 'demote';
    itemId: string;
  }>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [showFocusIndicator, setShowFocusIndicator] = useState<boolean>(false);
  const [siblingCreationContext, setSiblingCreationContext] = useState<{
    afterNodeId: string;
    selectedType: WorkItemTypeName;
  } | null>(null);

  // Track global delete confirmation state
  const [nodeInDeleteConfirmation, setNodeInDeleteConfirmation] = useState<string | null>(null);

  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<WorkItemTreeRef>(null);
  useEffect(() => {
    onHierarchyChange(newItemsHierarchy.length === 0);
  }, [newItemsHierarchy, onHierarchyChange]);

  // Report delete confirmation state changes to parent
  useEffect(() => {
    onDeleteConfirmationChange?.(nodeInDeleteConfirmation !== null);
  }, [nodeInDeleteConfirmation, onDeleteConfirmationChange]);

  const navigateToNode = useCallback((nodeId: string | null, viaKeyboard = false) => {
    setFocusedNodeId(nodeId);
    setShowFocusIndicator(viaKeyboard);
    if (viaKeyboard && nodeId) {
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
      if (nodeElement) {
        nodeElement.focus();
      }
    }
  }, []);

  const focusNewlyCreatedItem = useCallback(
    (parentId: string | undefined, viaKeyboard: boolean) => {
      setTimeout(() => {
        let newItemId: string | null = null;

        if (parentId) {
          const parentNode = hierarchyManager.findNodeById(parentId);
          if (parentNode && parentNode.children && parentNode.children.length > 0) {
            newItemId = parentNode.children[parentNode.children.length - 1].id;
          }
        } else {
          const hierarchy = hierarchyManager.getHierarchy();
          if (hierarchy.length > 0) {
            newItemId = hierarchy[hierarchy.length - 1].id;
          }
        }

        if (newItemId) {
          navigateToNode(newItemId, viaKeyboard);
          if (treeRef.current) {
            treeRef.current.focusNodeTitle(newItemId);
          }
        }
      }, 50);
    },
    [hierarchyManager, navigateToNode, treeRef],
  );
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

      // Detect from event
      const viaKeyboard = event ? 'key' in event : false;
      setFocusedNodeId(parentId || null);
      if (possibleChildTypes.length === 1) {
        const updatedHierarchy = hierarchyManager.addItem(possibleChildTypes[0], parentId);
        setNewItemsHierarchy([...updatedHierarchy]);
        focusNewlyCreatedItem(parentId, viaKeyboard);
      } else {
        setChildTypeOptions(possibleChildTypes);
        setCurrentParentIdForAddItem(parentId);

        let anchorElement = event?.currentTarget as HTMLElement | null;
        if (!anchorElement) {
          if (parentId) {
            anchorElement = document.querySelector(`[data-node-id="${parentId}"]`) as HTMLElement;
          } else {
            // parentId is undefined (adding at root).
            anchorElement = scrollableContainerRef.current;
          }
          if (!anchorElement && focusedNodeId) {
            anchorElement = document.querySelector(
              `[data-node-id="${focusedNodeId}"]`,
            ) as HTMLElement;
          }
          if (!anchorElement) {
            anchorElement = scrollableContainerRef.current;
          }
        }

        setAnchorElementForModal(anchorElement);
        setScrollableContainerForModal(scrollableContainerRef.current);
        setIsSelectingChildType(true);
      }
    },
    [
      hierarchyManager,
      canAdd,
      setNewItemsHierarchy,
      scrollableContainerRef,
      focusedNodeId,
      focusNewlyCreatedItem,
    ],
  );

  // Helper function to find the next sibling of a parent (or parent's parent, etc.)
  const findNextAncestorSibling = useCallback(
    (nodeId: string): string | null => {
      const node = hierarchyManager.findNodeById(nodeId);
      if (!node) return null;

      if (node.parentId) {
        const parentNode = hierarchyManager.findNodeById(node.parentId);
        if (parentNode && parentNode.children) {
          const nodeIndex = parentNode.children.findIndex((child) => child.id === nodeId);
          if (nodeIndex < parentNode.children.length - 1) {
            // Parent has a next sibling
            return parentNode.children[nodeIndex + 1].id;
          } else {
            // Parent is also the last child, check parent's parent
            return findNextAncestorSibling(node.parentId);
          }
        }
      } else {
        // Root node - find next root sibling
        const rootIndex = newItemsHierarchy.findIndex((rootNode) => rootNode.id === nodeId);
        if (rootIndex < newItemsHierarchy.length - 1) {
          return newItemsHierarchy[rootIndex + 1].id;
        }
      }

      return null;
    },
    [hierarchyManager, newItemsHierarchy],
  );

  // Helper function to get a flat list of all nodes in display order
  const getFlatNodeList = useCallback(() => {
    const flatList: { id: string; parentId: string | undefined; level: number }[] = [];

    const traverse = (nodes: WorkItemNode[], level = 0, parentId?: string) => {
      nodes.forEach((node) => {
        flatList.push({ id: node.id, parentId, level });
        if (node.children && node.children.length > 0) {
          traverse(node.children, level + 1, node.id);
        }
      });
    };

    traverse(newItemsHierarchy);
    return flatList;
  }, [newItemsHierarchy]);

  const getCurrentNodeIndex = useCallback(() => {
    if (!focusedNodeId) return -1;
    const flatList = getFlatNodeList();
    return flatList.findIndex((node) => node.id === focusedNodeId);
  }, [focusedNodeId, getFlatNodeList]);

  const createSiblingWorkItem = useCallback(
    (afterNodeId: string, type: WorkItemTypeName) => {
      const newItem = hierarchyManager.createWorkItem(type);
      const updatedHierarchy = hierarchyManager.addItemAfter(newItem, afterNodeId);
      setNewItemsHierarchy([...updatedHierarchy]);

      // Focus the newly created item and enable immediate editing
      setTimeout(() => {
        navigateToNode(newItem.id, true);
        if (treeRef.current) {
          treeRef.current.focusNodeTitle(newItem.id);
          treeAreaLogger.debug(
            `Created sibling work item of type ${type} after node ${afterNodeId}, focused on new item ${newItem.id}`,
          );
        }
      }, 50); // Small delay to ensure DOM is updated
    },
    [hierarchyManager, navigateToNode, treeRef],
  );
  const handleConfirmChildTypeSelection = useCallback(
    (selectedType: WorkItemTypeName, viaKeyboard: boolean) => {
      if (siblingCreationContext) {
        // Creating a sibling
        createSiblingWorkItem(siblingCreationContext.afterNodeId, selectedType);
        setSiblingCreationContext(null);
      } else {
        // Creating a child
        const updatedHierarchy = hierarchyManager.addItem(selectedType, currentParentIdForAddItem);
        setNewItemsHierarchy([...updatedHierarchy]);
        focusNewlyCreatedItem(currentParentIdForAddItem, viaKeyboard);
      }
      setIsSelectingChildType(false);
      setChildTypeOptions([]);
      setCurrentParentIdForAddItem(undefined);
      setAnchorElementForModal(null);
      setScrollableContainerForModal(null);
    },
    [
      siblingCreationContext,
      createSiblingWorkItem,
      hierarchyManager,
      currentParentIdForAddItem,
      focusNewlyCreatedItem,
    ],
  );
  const handleDismissChildTypeSelection = useCallback(() => {
    setIsSelectingChildType(false);
    setChildTypeOptions([]);
    setCurrentParentIdForAddItem(undefined);
    setAnchorElementForModal(null);
    setScrollableContainerForModal(null);
    setSiblingCreationContext(null);
  }, []);

  const handleTitleChange = useCallback(
    (itemId: string, newTitle: string) => {
      const updatedHierarchy = hierarchyManager.updateItemTitle(itemId, newTitle);
      setNewItemsHierarchy([...updatedHierarchy]);
    },
    [hierarchyManager, setNewItemsHierarchy],
  );

  const handleCreateSibling = useCallback(
    (currentNodeId: string) => {
      const currentNode = hierarchyManager.findNodeById(currentNodeId);
      if (!currentNode) {
        return;
      }

      let possibleTypes: WorkItemTypeName[];
      possibleTypes = hierarchyManager.getPossibleChildTypes(currentNode.parentId);

      // Fallback: if no root types are configured, use the current node's type
      if (possibleTypes.length === 0) {
        possibleTypes = [currentNode.type];
      }

      if (possibleTypes.length === 0) {
        return;
      }

      if (possibleTypes.length === 1) {
        createSiblingWorkItem(currentNodeId, possibleTypes[0]);
        return;
      }

      // Multiple types available - show child type modal
      const defaultType = possibleTypes.includes(currentNode.type)
        ? currentNode.type
        : possibleTypes[0];

      // Find the anchor element for modal positioning (use the current node)
      const anchorElement = document.querySelector(
        `[data-node-id="${currentNodeId}"]`,
      ) as HTMLElement;

      // Configure modal state
      setChildTypeOptions(possibleTypes);
      setCurrentParentIdForAddItem(currentNode.parentId);
      setAnchorElementForModal(anchorElement || scrollableContainerRef.current);
      setScrollableContainerForModal(scrollableContainerRef.current);
      setIsSelectingChildType(true);
      setSiblingCreationContext({
        afterNodeId: currentNodeId,
        selectedType: defaultType,
      });
    },
    [createSiblingWorkItem, hierarchyManager],
  );

  // Helper function to check if a node is a descendant of another node
  const isNodeDescendant = useCallback(
    (node: WorkItemNode, ancestorId: string): boolean => {
      if (!node.parentId) return false;
      if (node.parentId === ancestorId) return true;

      const parentNode = hierarchyManager.findNodeById(node.parentId);
      if (!parentNode) return false;

      return isNodeDescendant(parentNode, ancestorId);
    },
    [hierarchyManager],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      // TODO: Find a good alternative focus target before removing the node
      let newFocusNodeId: string | null = null;

      if (focusedNodeId) {
        const flatList = getFlatNodeList();
        const currentIndex = flatList.findIndex((node) => node.id === focusedNodeId);

        // Try to find a node that won't be removed
        if (currentIndex >= 0) {
          // Try the next node first (that's not being removed)
          for (let i = currentIndex + 1; i < flatList.length; i++) {
            const candidate = flatList[i];
            const candidateNode = hierarchyManager.findNodeById(candidate.id);
            if (
              candidateNode &&
              candidate.id !== itemId &&
              !isNodeDescendant(candidateNode, itemId)
            ) {
              newFocusNodeId = candidate.id;
              break;
            }
          }

          // If no suitable next node, try previous nodes
          if (!newFocusNodeId) {
            for (let i = currentIndex - 1; i >= 0; i--) {
              const candidate = flatList[i];
              const candidateNode = hierarchyManager.findNodeById(candidate.id);
              if (
                candidateNode &&
                candidate.id !== itemId &&
                !isNodeDescendant(candidateNode, itemId)
              ) {
                newFocusNodeId = candidate.id;
                break;
              }
            }
          }
        }
      }

      const updatedHierarchy = hierarchyManager.removeItem(itemId);
      setNewItemsHierarchy([...updatedHierarchy]);

      // Update focus state after removal
      if (focusedNodeId) {
        // Check if the currently focused node still exists in the updated hierarchy
        const focusedNodeStillExists =
          updatedHierarchy.length > 0 && hierarchyManager.findNodeById(focusedNodeId);

        if (!focusedNodeStillExists) {
          if (newFocusNodeId) {
            setFocusedNodeId(newFocusNodeId);
            setShowFocusIndicator(true);
          } else {
            setFocusedNodeId(null);
            setShowFocusIndicator(false);
          }
        }
      }
    },
    [focusedNodeId, hierarchyManager, getFlatNodeList, isNodeDescendant],
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
      setFocusedNodeId(itemId);
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
      setFocusedNodeId(itemId);
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

  const handleSelectWorkItem = useCallback(
    (workItemId: string) => {
      setFocusedNodeId(workItemId);
      setShowFocusIndicator(false);
      onSelectWorkItem(workItemId);
    },
    [onSelectWorkItem],
  );

  const handleMouseInteraction = useCallback(() => {
    // Hide visual indicator on mouse interaction but maintain focus
    setShowFocusIndicator(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      requestAddItemAtRoot: (
        event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      ) => {
        handleRequestAddItem(undefined, event);
      },

      navigateUp: () => {
        if (!focusedNodeId) {
          // No focus, go to first item
          const flatList = getFlatNodeList();
          if (flatList.length > 0) {
            navigateToNode(flatList[0].id, true);
          }
          return;
        }

        const focusedNode = hierarchyManager.findNodeById(focusedNodeId);
        if (!focusedNode) return;

        // Find previous sibling
        if (focusedNode.parentId) {
          const parentNode = hierarchyManager.findNodeById(focusedNode.parentId);
          if (parentNode && parentNode.children) {
            const currentIndex = parentNode.children.findIndex(
              (child) => child.id === focusedNodeId,
            );
            if (currentIndex > 0) {
              // Move to previous sibling
              navigateToNode(parentNode.children[currentIndex - 1].id, true);
            } else {
              // First child - go to parent
              navigateToNode(focusedNode.parentId, true);
            }
            // If already at first sibling, do nothing (stay at current position)
          }
        } else {
          // Root node - find previous root sibling
          const rootIndex = newItemsHierarchy.findIndex((node) => node.id === focusedNodeId);
          if (rootIndex > 0) {
            navigateToNode(newItemsHierarchy[rootIndex - 1].id, true);
          }
          // If already at first root, do nothing
        }
        setShowFocusIndicator(true);
      },

      navigateDown: () => {
        if (!focusedNodeId) {
          // No focus, go to first item
          const flatList = getFlatNodeList();
          if (flatList.length > 0) {
            navigateToNode(flatList[0].id, true);
          }
          return;
        }

        const focusedNode = hierarchyManager.findNodeById(focusedNodeId);
        if (!focusedNode) return;

        // Find next sibling
        if (focusedNode.parentId) {
          const parentNode = hierarchyManager.findNodeById(focusedNode.parentId);
          if (parentNode && parentNode.children) {
            const currentIndex = parentNode.children.findIndex(
              (child) => child.id === focusedNodeId,
            );
            if (currentIndex < parentNode.children.length - 1) {
              // Move to next sibling
              navigateToNode(parentNode.children[currentIndex + 1].id, true);
            } else {
              // Last child - find next sibling of parent (or parent's parent, etc.)
              const nextSiblingId = findNextAncestorSibling(focusedNode.parentId);
              if (nextSiblingId) {
                navigateToNode(nextSiblingId, true);
              }
            }
          }
        } else {
          // Root node - find next root sibling
          const rootIndex = newItemsHierarchy.findIndex((node) => node.id === focusedNodeId);
          if (rootIndex < newItemsHierarchy.length - 1) {
            navigateToNode(newItemsHierarchy[rootIndex + 1].id, true);
          } else {
            // At last root node, do nothing or could wrap to first
          }
        }
        setShowFocusIndicator(true);
      },

      navigateLeft: () => {
        if (!focusedNodeId) return;

        const focusedNode = hierarchyManager.findNodeById(focusedNodeId);
        if (focusedNode?.parentId) {
          navigateToNode(focusedNode.parentId, true);
        }
        setShowFocusIndicator(true);
      },

      navigateRight: () => {
        if (!focusedNodeId) return;

        const focusedNode = hierarchyManager.findNodeById(focusedNodeId);
        if (focusedNode?.children && focusedNode.children.length > 0) {
          navigateToNode(focusedNode.children[0].id, true);
        }
        setShowFocusIndicator(true);
      },

      navigateHome: () => {
        const flatList = getFlatNodeList();
        if (flatList.length > 0) {
          navigateToNode(flatList[0].id, true);
        }
      },

      navigateEnd: () => {
        const flatList = getFlatNodeList();
        if (flatList.length > 0) {
          navigateToNode(flatList[flatList.length - 1].id, true);
        }
      },

      navigatePageUp: () => {
        const flatList = getFlatNodeList();
        if (flatList.length === 0) return;

        const currentIndex = getCurrentNodeIndex();
        const targetIndex = Math.max(0, currentIndex - 10);
        navigateToNode(flatList[targetIndex].id, true);
      },

      navigatePageDown: () => {
        const flatList = getFlatNodeList();
        if (flatList.length === 0) return;

        const currentIndex = getCurrentNodeIndex();
        const targetIndex = Math.min(flatList.length - 1, currentIndex + 10);
        navigateToNode(flatList[targetIndex].id, true);
      },

      requestEditFocused: () => {
        if (!focusedNodeId) return;
        if (treeRef.current) {
          treeRef.current.focusNodeTitle(focusedNodeId);
        }
      },
      requestAddChildToFocused: () => {
        if (!focusedNodeId) return;
        // Create a synthetic keyboard event to indicate this is via keyboard
        const syntheticKeyboardEvent = { key: 'Alt' } as React.KeyboardEvent<HTMLElement>;
        handleRequestAddItem(focusedNodeId, syntheticKeyboardEvent);
      },

      requestRemoveFocused: () => {
        if (!focusedNodeId) return;

        // Use the tree API to request delete confirmation for the focused node
        if (treeRef.current) {
          treeRef.current.requestDeleteConfirmation(focusedNodeId);
        } else {
          // Fallback to direct delete if tree ref not available
          handleRemoveItem(focusedNodeId);
        }
      },

      requestPromoteFocused: () => {
        if (!focusedNodeId) return;
        const node = hierarchyManager.findNodeById(focusedNodeId);
        if (!node?.canPromote) return;
        setShowFocusIndicator(true);
        handlePromoteItem(focusedNodeId);
      },

      requestDemoteFocused: () => {
        if (!focusedNodeId) return;
        const node = hierarchyManager.findNodeById(focusedNodeId);
        if (!node?.canDemote) return;
        setShowFocusIndicator(true);
        handleDemoteItem(focusedNodeId);
      },

      isAnyNodeInDeleteConfirmation: () => {
        return nodeInDeleteConfirmation !== null;
      },

      commitPendingTitleChanges: () => {
        // Commit all pending title changes in the tree
        if (treeRef.current) {
          treeRef.current.commitAllPendingTitleChanges();
        }
      },
    }),
    [
      handleRequestAddItem,
      focusedNodeId,
      getFlatNodeList,
      navigateToNode,
      hierarchyManager,
      newItemsHierarchy,
      getCurrentNodeIndex,
      treeRef,
      handleRemoveItem,
      handlePromoteItem,
      handleDemoteItem,
      findNextAncestorSibling,
      nodeInDeleteConfirmation,
    ],
  );
  return (
    <div
      ref={scrollableContainerRef}
      className="decomposer-tree-area-container"
      onMouseDown={handleMouseInteraction}
      onClick={handleMouseInteraction}
    >
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
          isOpen={!!promoteDemoteTypePickerItems}
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
            ref={treeRef}
            hierarchy={newItemsHierarchy}
            onAddItem={handleRequestAddItem}
            onTitleChange={handleTitleChange}
            onSelectWorkItem={handleSelectWorkItem}
            onRemoveItem={handleRemoveItem}
            onPromoteItem={handlePromoteItem}
            onDemoteItem={handleDemoteItem}
            onCreateSibling={handleCreateSibling}
            focusedNodeId={focusedNodeId}
            showFocusIndicator={showFocusIndicator}
            nodeInDeleteConfirmation={nodeInDeleteConfirmation}
            onNodeDeleteConfirmationChange={setNodeInDeleteConfirmation}
          />
        </>
      )}
    </div>
  );
});

DecomposerWorkItemTreeAreaWithRef.displayName = 'DecomposerWorkItemTreeArea';
export { DecomposerWorkItemTreeAreaWithRef as DecomposerWorkItemTreeArea };
