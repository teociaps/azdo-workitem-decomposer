import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../core/models/commonTypes';
import { WorkItemHierarchyStateManager } from './workItemHierarchyStateManager';
import { WorkItemTypeManager } from './workItemTypeManager';
import { WorkItemFlagManager } from './workItemFlagManager';
import { WorkItemNodeFinder } from './workItemNodeFinder';
import { logger } from '../core/common/logger';

const operationsLogger = logger.createChild('Operations');

/**
 * Manages operations on the work item hierarchy like add, remove, promote, and demote.
 */
export class WorkItemHierarchyOperationsManager {
  private stateManager: WorkItemHierarchyStateManager;
  private typeManager: WorkItemTypeManager;
  private flagManager: WorkItemFlagManager;

  constructor(
    stateManager: WorkItemHierarchyStateManager,
    typeManager: WorkItemTypeManager,
    flagManager: WorkItemFlagManager,
  ) {
    this.stateManager = stateManager;
    this.typeManager = typeManager;
    this.flagManager = flagManager;
  }

  /**
   * Adds a new item of a specific type to the hierarchy.
   * @param childTypeToAdd The type of the child work item to add.
   * @param parentId The temporary ID of the parent node, or undefined to add to the root.
   * @param title The initial title for the new work item. Defaults to "New [childTypeToAdd]".
   * @returns The updated hierarchy.
   */
  addItem(childTypeToAdd: WorkItemTypeName, parentId?: string, title?: string): WorkItemNode[] {
    const itemTitle = title || `New ${childTypeToAdd}`;
    const hierarchy = this.stateManager.getHierarchyRef();

    const newItem: WorkItemNode = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: itemTitle,
      type: childTypeToAdd,
      children: [],
      parentId, // undefined for root nodes
      canPromote: false,
      canDemote: false,
    };

    if (parentId) {
      const parentNode = this.stateManager.findNodeById(parentId);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(newItem);
      } else {
        this.stateManager.raiseError(`Parent with id ${parentId} not found. Adding item to root.`);
        hierarchy.push(newItem);
        newItem.parentId = undefined;
      }
    } else {
      hierarchy.push(newItem);
    }

    this.stateManager.updateHierarchyCount(1);
    this.flagManager.updateAllPromoteDemoteFlags();
    return this.stateManager.getHierarchy();
  }

  /**
   * Removes an item from the hierarchy by its ID.
   * Also removes all children of the specified item.
   * @param itemId The temporary ID of the item to remove.
   * @returns The updated hierarchy.
   */
  removeItem(itemId: string): WorkItemNode[] {
    let removedCount = 0;
    const hierarchy = this.stateManager.getHierarchyRef();

    const removeRecursive = (nodes: WorkItemNode[], idToRemove: string): WorkItemNode[] => {
      return nodes.filter((node) => {
        if (node.id === idToRemove) {
          removedCount += 1 + WorkItemNodeFinder.countNodesRecursive(node.children || []);
          return false;
        }
        if (node.children) {
          node.children = removeRecursive(node.children, idToRemove);
        }
        return true;
      });
    };

    this.stateManager
      .getHierarchyRef()
      .splice(0, hierarchy.length, ...removeRecursive(hierarchy, itemId));

    this.stateManager.updateHierarchyCount(-removedCount);
    this.flagManager.updateAllPromoteDemoteFlags();
    return this.stateManager.getHierarchy();
  }

  /**
   * Promotes an item in the hierarchy.
   * @param itemId The ID of the item to promote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  promoteItem(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    return this._promoteItemInternal(itemId, typeMap);
  }

  /**
   * Demotes an item in the hierarchy.
   * @param itemId The ID of the item to demote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  demoteItem(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    return this._demoteItemInternal(itemId, typeMap);
  }

  /**
   * Internal logic for promoting an item.
   * @param itemId The ID of the item to promote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  private _promoteItemInternal(
    itemId: string,
    typeMap?: Record<string, WorkItemTypeName>,
  ): WorkItemNode[] {
    const hierarchy = this.stateManager.getHierarchyRef();

    if (typeMap) {
      this.typeManager.applyTypeMapToAffectedNodes(typeMap);
    }

    const nodeToPromote = this.stateManager.findNodeById(itemId);
    if (!nodeToPromote || !nodeToPromote.parentId) {
      if (nodeToPromote) {
        operationsLogger.warn(
          `Item ${itemId} (${nodeToPromote.type}: "${nodeToPromote.title}") is a root item and cannot be promoted.`,
        );
      }
      return this.stateManager.getHierarchy();
    }

    const currentParentNode = this.stateManager.findNodeById(nodeToPromote.parentId);
    if (!currentParentNode) {
      this.stateManager.raiseError(
        `Parent node ${nodeToPromote.parentId} not found for item ${itemId}. Promotion failed.`,
      );
      return this.stateManager.getHierarchy();
    }

    const nodeIndexInCurrentParent = currentParentNode.children.findIndex(
      (child) => child.id === itemId,
    );
    if (nodeIndexInCurrentParent === -1) {
      this.stateManager.raiseError(
        `Item ${itemId} not found in parent ${currentParentNode.id}'s children. Promotion failed.`,
      );
      return this.stateManager.getHierarchy();
    }

    // Remove the node to promote from its parent's children
    currentParentNode.children.splice(nodeIndexInCurrentParent, 1);
    // Move all siblings after the promoted node as its children
    const siblingsToMove = currentParentNode.children.splice(nodeIndexInCurrentParent);
    if (!nodeToPromote.children) nodeToPromote.children = [];
    siblingsToMove.forEach((sibling) => {
      sibling.parentId = nodeToPromote.id;
      nodeToPromote.children.push(sibling);
    });

    const grandParentId = currentParentNode.parentId;
    let newParentOfPromotedNode: WorkItemNode | null = null;

    if (grandParentId) {
      const grandParentNode = this.stateManager.findNodeById(grandParentId);
      if (grandParentNode) {
        if (!grandParentNode.children) {
          grandParentNode.children = [];
        }
        // Insert at the same position as the old parent in the grandparent's children array
        const parentIndexInGrandParent = grandParentNode.children.findIndex(
          (child) => child.id === currentParentNode.id,
        );
        // If found, insert right after the parent; otherwise, push to end
        const insertIndex =
          parentIndexInGrandParent !== -1
            ? parentIndexInGrandParent + 1
            : grandParentNode.children.length;
        grandParentNode.children.splice(insertIndex, 0, nodeToPromote);
        nodeToPromote.parentId = grandParentId;
        newParentOfPromotedNode = grandParentNode;
      } else {
        operationsLogger.warn(
          `Grandparent node ${grandParentId} not found. Promoting ${itemId} to root.`,
        );
        // Insert at the same position as the old parent in the root array
        const parentIndexInRoot = hierarchy.findIndex((child) => child.id === currentParentNode.id);
        const insertIndex = parentIndexInRoot !== -1 ? parentIndexInRoot + 1 : hierarchy.length;
        hierarchy.splice(insertIndex, 0, nodeToPromote);
        nodeToPromote.parentId = undefined;
      }
    } else {
      // Insert at the same position as the old parent in the root array
      const parentIndexInRoot = hierarchy.findIndex((child) => child.id === currentParentNode.id);
      const insertIndex = parentIndexInRoot !== -1 ? parentIndexInRoot + 1 : hierarchy.length;
      hierarchy.splice(insertIndex, 0, nodeToPromote);
      nodeToPromote.parentId = undefined;
    }

    this.typeManager.recursivelyUpdateTypeAndChildren(
      nodeToPromote,
      newParentOfPromotedNode,
      typeMap,
    );
    this.flagManager.updateAllPromoteDemoteFlags();
    return this.stateManager.getHierarchy();
  }

  /**
   * Internal logic for demoting an item.
   * @param itemId The ID of the item to demote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  private _demoteItemInternal(
    itemId: string,
    typeMap?: Record<string, WorkItemTypeName>,
  ): WorkItemNode[] {
    const hierarchy = this.stateManager.getHierarchyRef();

    if (typeMap) {
      this.typeManager.applyTypeMapToAffectedNodes(typeMap);
    }

    const nodeToDemote = this.stateManager.findNodeById(itemId);

    if (!nodeToDemote) {
      return this.stateManager.getHierarchy();
    }

    // Handle root node demotion
    if (!nodeToDemote.parentId) {
      // Find index in root array
      const rootIndex = hierarchy.findIndex((n) => n.id === itemId);
      if (rootIndex === -1) return this.stateManager.getHierarchy();
      if (rootIndex === 0) {
        // First root node, can't demote
        operationsLogger.warn(
          `Item ${itemId} (${nodeToDemote.type}: "${nodeToDemote.title}") is the first root item and cannot be demoted under a preceding sibling.`,
        );
        return this.stateManager.getHierarchy();
      }
      const newParentNodeCandidate = hierarchy[rootIndex - 1];

      // Prevent cycles
      if (WorkItemNodeFinder.isDescendant(nodeToDemote, newParentNodeCandidate.id)) {
        operationsLogger.warn(
          `Cannot demote item ${itemId} under its own descendant ${newParentNodeCandidate.id}.`,
        );
        return this.stateManager.getHierarchy();
      }

      // Check if possible to add as child
      const possibleChildTypesForNewParent = this.typeManager.getPossibleChildTypes(
        newParentNodeCandidate.id,
      );
      if (possibleChildTypesForNewParent.length === 0) {
        operationsLogger.warn(
          `Cannot demote item ${itemId} (${nodeToDemote.type}) under ${newParentNodeCandidate.id} (type: ${newParentNodeCandidate.type}) because the potential new parent is configured to have no children.`,
        );
        return this.stateManager.getHierarchy();
      }

      // Remove from root
      hierarchy.splice(rootIndex, 1);
      // Add as last child of previous root sibling
      if (!newParentNodeCandidate.children) newParentNodeCandidate.children = [];
      newParentNodeCandidate.children.push(nodeToDemote);
      nodeToDemote.parentId = newParentNodeCandidate.id;

      this.typeManager.recursivelyUpdateTypeAndChildren(
        nodeToDemote,
        newParentNodeCandidate,
        typeMap,
      );
      this.flagManager.updateAllPromoteDemoteFlags();
      return this.stateManager.getHierarchy();
    }

    // Handle non-root node demotion
    const currentParentNode = this.stateManager.findNodeById(nodeToDemote.parentId);
    if (!currentParentNode) {
      this.stateManager.raiseError(
        `Parent node ${nodeToDemote.parentId} not found for item ${itemId}. Demotion failed.`,
      );
      return this.stateManager.getHierarchy();
    }

    const siblings = currentParentNode.children;
    const nodeIndex = siblings.findIndex((child) => child.id === itemId);

    if (nodeIndex === -1) {
      this.stateManager.raiseError(
        `Item ${itemId} not found in its parent's children list. Demotion failed.`,
      );
      return this.stateManager.getHierarchy();
    }
    if (nodeIndex === 0) {
      operationsLogger.warn(
        `Item ${itemId} (${nodeToDemote.type}: "${nodeToDemote.title}") is the first child and cannot be demoted under a preceding sibling.`,
      );
      return this.stateManager.getHierarchy();
    }

    const newParentNodeCandidate = siblings[nodeIndex - 1]; // Prevent cycles
    if (WorkItemNodeFinder.isDescendant(nodeToDemote, newParentNodeCandidate.id)) {
      operationsLogger.warn(
        `Cannot demote item ${itemId} under its own descendant ${newParentNodeCandidate.id}.`,
      );
      return this.stateManager.getHierarchy();
    }

    // Check if possible to add as child
    const possibleChildTypesForNewParent = this.typeManager.getPossibleChildTypes(
      newParentNodeCandidate.id,
    );
    if (possibleChildTypesForNewParent.length === 0) {
      operationsLogger.warn(
        `Cannot demote item ${itemId} (${nodeToDemote.type}) under ${newParentNodeCandidate.id} (type: ${newParentNodeCandidate.type}) because the potential new parent is configured to have no children.`,
      );
      return this.stateManager.getHierarchy();
    }

    // Remove the node from its current siblings
    siblings.splice(nodeIndex, 1);
    // Add as last child of the previous sibling
    if (!newParentNodeCandidate.children) {
      newParentNodeCandidate.children = [];
    }
    newParentNodeCandidate.children.push(nodeToDemote);
    nodeToDemote.parentId = newParentNodeCandidate.id;

    this.typeManager.recursivelyUpdateTypeAndChildren(
      nodeToDemote,
      newParentNodeCandidate,
      typeMap,
    );
    this.flagManager.updateAllPromoteDemoteFlags();
    return this.stateManager.getHierarchy();
  }
}
