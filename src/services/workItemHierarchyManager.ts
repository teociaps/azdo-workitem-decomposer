import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemConfigurationsMap, WorkItemTypeName } from '../core/models/commonTypes';
import { cloneDeep } from 'lodash';

/**
 * Manages the state and operations for the work item hierarchy tree.
 */
export class WorkItemHierarchyManager {
  private hierarchy: WorkItemNode[] = [];
  private parentWorkItemType: WorkItemTypeName | null = null;
  private workItemConfigurations: WorkItemConfigurationsMap;
  private hierarchyCount: number = 0;
  private errorHandler?: (error: string) => void;

  constructor(
    workItemConfigurations: WorkItemConfigurationsMap,
    initialHierarchy: WorkItemNode[] = [],
    parentWorkItemType?: WorkItemTypeName,
    errorHandler?: (error: string) => void,
  ) {
    this.hierarchy = initialHierarchy ? cloneDeep(initialHierarchy) : [];
    this.workItemConfigurations = workItemConfigurations;
    this.parentWorkItemType = parentWorkItemType || null;
    this.hierarchyCount = this._countNodesRecursive(this.hierarchy);
    this._updateAllPromoteDemoteFlags();
    this.errorHandler = errorHandler;
  }

  private _raiseError(message: string) {
    if (this.errorHandler) {
      this.errorHandler(message);
    } else {
      console.error(message);
    }
  }

  /**
   * Sets the type of the root parent work item.
   * @param type The work item type string.
   */
  setParentWorkItemType(type: WorkItemTypeName): void {
    this.parentWorkItemType = type;
  }

  /**
   * Gets the type of the root parent work item.
   * @returns The work item type string, or null if not set.
   */
  getParentWorkItemType(): WorkItemTypeName | null {
    return this.parentWorkItemType;
  }

  /**
   * Returns the current hierarchy state.
   */
  getHierarchy(): WorkItemNode[] {
    return cloneDeep(this.hierarchy); // Return a copy to prevent direct mutation
  }

  /**
   * Returns the current count of all nodes in the hierarchy.
   */
  getHierarchyCount(): number {
    return this.hierarchyCount;
  }

  /**
   * Sets the initial hierarchy and updates the flags.
   * @param nodes The initial hierarchy nodes.
   * @param parentWorkItemType The type of the root parent work item.
   */
  setInitialHierarchy(nodes: WorkItemNode[], parentWorkItemType?: WorkItemTypeName): void {
    this.hierarchy = cloneDeep(nodes);
    this.parentWorkItemType = parentWorkItemType || null;
    this.hierarchyCount = this._countNodesRecursive(this.hierarchy);
    this._updateAllPromoteDemoteFlags();
  }

  /**
   * Clears the hierarchy and resets the flags.
   */
  clearHierarchy(): void {
    this.hierarchy = [];
    this.hierarchyCount = 0;
    this._updateAllPromoteDemoteFlags();
  }

  /**
   * Recursively counts all nodes in the hierarchy.
   */
  private _countNodesRecursive(nodes: WorkItemNode[]): number {
    return nodes.reduce((acc, node) => acc + 1 + this._countNodesRecursive(node.children || []), 0);
  }

  /**
   * Finds a node by its ID in the hierarchy.
   * @param nodes The array of nodes to search.
   * @param id The ID of the node to find.
   * @returns The found node or null if not found.
   */
  private _findNodeRecursive(nodes: WorkItemNode[], id: string): WorkItemNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const foundInChildren = this._findNodeRecursive(node.children, id);
        if (foundInChildren) {
          return foundInChildren;
        }
      }
    }
    return null;
  }

  /**
   * Finds a node within the hierarchy by its temporary ID.
   * @param id The temporary ID of the node to find.
   * @returns The found node or null.
   */
  findNodeById(id: string): WorkItemNode | null {
    return this._findNodeRecursive(this.hierarchy, id);
  }

  /**
   * Determines the possible child work item types for a given parent.
   * @param parentId The ID of the parent node. If undefined, assumes root (using parentWorkItemType).
   * @returns An array of possible child work item type names.
   */
  getPossibleChildTypes(parentId?: string): WorkItemTypeName[] {
    let parentNodeType: WorkItemTypeName | null = null;

    if (parentId) {
      const parentNode = this.findNodeById(parentId);
      if (parentNode) {
        parentNodeType = parentNode.type;
      } else {
        console.warn(
          `Parent node with ID ${parentId} not found when getting possible child types. Defaulting to ['Task'].`,
        );
        return ['Task']; // Fallback if specific parent not found
      }
    } else {
      parentNodeType = this.parentWorkItemType;
    }

    if (parentNodeType) {
      const parentConfig = this.workItemConfigurations.get(parentNodeType);
      if (parentConfig?.hierarchyRules && parentConfig.hierarchyRules.length > 0) {
        return parentConfig.hierarchyRules;
      } else if (
        parentConfig &&
        typeof parentConfig.hierarchyRules !== 'undefined' &&
        parentConfig.hierarchyRules.length === 0
      ) {
        // Explicitly defined as no children of configured types
        return [];
      } else {
        // No specific rules for this parent type, or rules are not defined
        return ['Task']; // Default fallback
      }
    } else {
      // This case means we're adding to root and parentWorkItemType was never set, or an unknown scenario
      return ['Task']; // Default for root if parentWorkItemType is not set
    }
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

    const newItem: WorkItemNode = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: itemTitle,
      type: childTypeToAdd,
      children: [],
      parentId: parentId, // undefined for root nodes
      canPromote: false,
      canDemote: false,
    };

    if (parentId) {
      const parentNode = this.findNodeById(parentId);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(newItem);
      } else {
        this._raiseError(`Parent with id ${parentId} not found. Adding item to root.`);
        this.hierarchy.push(newItem);
        newItem.parentId = undefined;
      }
    } else {
      this.hierarchy.push(newItem);
    }
    this.hierarchyCount++;
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  /**
   * Updates the title of an item in the hierarchy.
   * @param itemId The temporary ID of the item to update.
   * @param newTitle The new title string.
   * @returns The updated hierarchy.
   */
  updateItemTitle(itemId: string, newTitle: string): WorkItemNode[] {
    const node = this.findNodeById(itemId);
    if (node) {
      node.title = newTitle;
    }
    return this.getHierarchy();
  }

  /**
   * Removes an item from the hierarchy by its ID.
   * Also removes all children of the specified item.
   * @param itemId The temporary ID of the item to remove.
   * @returns The updated hierarchy.
   */
  removeItem(itemId: string): WorkItemNode[] {
    let removedCount = 0;
    const removeRecursive = (nodes: WorkItemNode[], idToRemove: string): WorkItemNode[] => {
      return nodes.filter((node) => {
        if (node.id === idToRemove) {
          removedCount += 1 + this._countNodesRecursive(node.children || []);
          return false;
        }
        if (node.children) {
          node.children = removeRecursive(node.children, idToRemove);
        }
        return true;
      });
    };

    this.hierarchy = removeRecursive(this.hierarchy, itemId);
    this.hierarchyCount -= removedCount;
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  promoteItem(itemId: string): WorkItemNode[] {
    const nodeToPromote = this.findNodeById(itemId);

    if (!nodeToPromote || !nodeToPromote.parentId) {
      if (nodeToPromote) {
        console.warn(
          `Item ${itemId} (${nodeToPromote.type}: "${nodeToPromote.title}") is a root item and cannot be promoted.`,
        );
      }
      return this.getHierarchy();
    }

    const currentParentNode = this.findNodeById(nodeToPromote.parentId);
    if (!currentParentNode) {
      this._raiseError(
        `Parent node ${nodeToPromote.parentId} not found for item ${itemId}. Promotion failed.`,
      );
      return this.getHierarchy();
    }

    const nodeIndexInCurrentParent = currentParentNode.children.findIndex(
      (child) => child.id === itemId,
    );
    if (nodeIndexInCurrentParent === -1) {
      this._raiseError(
        `Item ${itemId} not found in parent ${currentParentNode.id}'s children. Promotion failed.`,
      );
      return this.getHierarchy();
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
      const grandParentNode = this.findNodeById(grandParentId);
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
        console.warn(`Grandparent node ${grandParentId} not found. Promoting ${itemId} to root.`);
        // Insert at the same position as the old parent in the root array
        const parentIndexInRoot = this.hierarchy.findIndex(
          (child) => child.id === currentParentNode.id,
        );
        const insertIndex =
          parentIndexInRoot !== -1 ? parentIndexInRoot + 1 : this.hierarchy.length;
        this.hierarchy.splice(insertIndex, 0, nodeToPromote);
        nodeToPromote.parentId = undefined;
      }
    } else {
      // Insert at the same position as the old parent in the root array
      const parentIndexInRoot = this.hierarchy.findIndex(
        (child) => child.id === currentParentNode.id,
      );
      const insertIndex = parentIndexInRoot !== -1 ? parentIndexInRoot + 1 : this.hierarchy.length;
      this.hierarchy.splice(insertIndex, 0, nodeToPromote);
      nodeToPromote.parentId = undefined;
    }

    this._recursivelyUpdateTypeAndChildren(nodeToPromote, newParentOfPromotedNode);
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  demoteItem(itemId: string): WorkItemNode[] {
    const nodeToDemote = this.findNodeById(itemId);

    if (!nodeToDemote) {
      return this.getHierarchy();
    }

    // Handle root node demotion
    if (!nodeToDemote.parentId) {
      // Find index in root array
      const rootIndex = this.hierarchy.findIndex((n) => n.id === itemId);
      if (rootIndex === -1) return this.getHierarchy();
      if (rootIndex === 0) {
        // First root node, can't demote
        console.warn(
          `Item ${itemId} (${nodeToDemote.type}: "${nodeToDemote.title}") is the first root item and cannot be demoted under a preceding sibling.`,
        );
        return this.getHierarchy();
      }
      const newParentNodeCandidate = this.hierarchy[rootIndex - 1];
      // Prevent cycles
      const checkDescendant = (nodeToCheck: WorkItemNode, targetId: string): boolean => {
        if (!nodeToCheck.children) return false;
        for (const child of nodeToCheck.children) {
          if (child.id === targetId || checkDescendant(child, targetId)) {
            return true;
          }
        }
        return false;
      };
      if (checkDescendant(nodeToDemote, newParentNodeCandidate.id)) {
        console.warn(
          `Cannot demote item ${itemId} under its own descendant ${newParentNodeCandidate.id}.`,
        );
        return this.getHierarchy();
      }
      // Check type rules
      const possibleChildTypesForNewParent = this.getPossibleChildTypes(newParentNodeCandidate.id);
      if (
        possibleChildTypesForNewParent.length === 0 &&
        this.workItemConfigurations.get(newParentNodeCandidate.type as WorkItemTypeName)
          ?.hierarchyRules?.length === 0
      ) {
        console.warn(
          `Cannot demote item ${itemId} (${nodeToDemote.type}) under ${newParentNodeCandidate.id} (type: ${newParentNodeCandidate.type}) because the potential new parent is configured to have no children of specific types.`,
        );
        return this.getHierarchy();
      }
      // Remove from root
      this.hierarchy.splice(rootIndex, 1);
      // Add as last child of previous root sibling
      if (!newParentNodeCandidate.children) newParentNodeCandidate.children = [];
      newParentNodeCandidate.children.push(nodeToDemote);
      nodeToDemote.parentId = newParentNodeCandidate.id;
      this._recursivelyUpdateTypeAndChildren(nodeToDemote, newParentNodeCandidate);
      this._updateAllPromoteDemoteFlags();
      return this.getHierarchy();
    }

    const currentParentNode = this.findNodeById(nodeToDemote.parentId);
    if (!currentParentNode) {
      this._raiseError(
        `Parent node ${nodeToDemote.parentId} not found for item ${itemId}. Demotion failed.`,
      );
      return this.getHierarchy();
    }

    const siblings = currentParentNode.children;
    const nodeIndex = siblings.findIndex((child) => child.id === itemId);

    if (nodeIndex === -1) {
      this._raiseError(`Item ${itemId} not found in its parent's children list. Demotion failed.`);
      return this.getHierarchy();
    }

    if (nodeIndex === 0) {
      console.warn(
        `Item ${itemId} (${nodeToDemote.type}: "${nodeToDemote.title}") is the first child and cannot be demoted under a preceding sibling.`,
      );
      return this.getHierarchy();
    }

    const newParentNodeCandidate = siblings[nodeIndex - 1];

    // Prevent cycles: do not allow demote if the new parent is a descendant of the node to demote
    const checkDescendant = (nodeToCheck: WorkItemNode, targetId: string): boolean => {
      if (!nodeToCheck.children) return false;
      for (const child of nodeToCheck.children) {
        if (child.id === targetId || checkDescendant(child, targetId)) {
          return true;
        }
      }
      return false;
    };
    if (checkDescendant(nodeToDemote, newParentNodeCandidate.id)) {
      console.warn(
        `Cannot demote item ${itemId} under its own descendant ${newParentNodeCandidate.id}.`,
      );
      return this.getHierarchy();
    }

    const possibleChildTypesForNewParent = this.getPossibleChildTypes(newParentNodeCandidate.id);
    if (
      possibleChildTypesForNewParent.length === 0 &&
      this.workItemConfigurations.get(newParentNodeCandidate.type as WorkItemTypeName)
        ?.hierarchyRules?.length === 0
    ) {
      console.warn(
        `Cannot demote item ${itemId} (${nodeToDemote.type}) under ${newParentNodeCandidate.id} (type: ${newParentNodeCandidate.type}) because the potential new parent is configured to have no children of specific types.`,
      );
      return this.getHierarchy();
    }

    // Remove the node from its current siblings
    siblings.splice(nodeIndex, 1);
    // Add as last child of the previous sibling, regardless of whether it has children
    if (!newParentNodeCandidate.children) {
      newParentNodeCandidate.children = [];
    }
    newParentNodeCandidate.children.push(nodeToDemote);
    nodeToDemote.parentId = newParentNodeCandidate.id;

    this._recursivelyUpdateTypeAndChildren(nodeToDemote, newParentNodeCandidate);
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  private _recursivelyUpdateTypeAndChildren(
    node: WorkItemNode,
    newParentNode: WorkItemNode | null,
  ): void {
    const newParentId = newParentNode ? newParentNode.id : undefined;
    const newParentTypeInfo = newParentNode
      ? `parent ${newParentNode.id} (type: ${newParentNode.type})`
      : 'root';
    const allowedChildTypes = this.getPossibleChildTypes(newParentId);
    const originalNodeType = node.type;
    const originalTitle = node.title;
    // Only update the title if it is exactly 'New <oldType>' (case-insensitive, trimmed)
    const expectedDefaultTitle = `New ${originalNodeType}`;
    const isStrictDefaultTitle =
      originalTitle.trim().toLowerCase() === expectedDefaultTitle.toLowerCase();

    if (!allowedChildTypes.includes(node.type as WorkItemTypeName)) {
      if (allowedChildTypes.length > 0) {
        node.type = allowedChildTypes[0];
        // Update the title ONLY if it was the strict default one
        if (isStrictDefaultTitle) {
          node.title = `New ${node.type}`;
        }
        // TODO: handle multiple allowed types
        console.warn(
          `Item ${node.id} (original type: ${originalNodeType}) changed type to ${
            node.type
          } to be a valid child of ${newParentTypeInfo}. Allowed types: ${allowedChildTypes.join(
            ', ',
          )}.`,
        );
      } else {
        this._raiseError(
          `Item ${node.id} (type: ${originalNodeType}) cannot be a valid child of ${newParentTypeInfo} as it allows no configured child types. Type not changed.`,
        );
      }
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this._recursivelyUpdateTypeAndChildren(child, node);
      }
    }
  }

  private _updateNodePromoteDemoteFlagsRecursive(
    node: WorkItemNode,
    parentNode: WorkItemNode | null,
    siblings: WorkItemNode[],
  ): void {
    node.canPromote = !!parentNode;

    let canDemoteThisNode = false;
    if (parentNode) {
      const nodeIndex = siblings.findIndex((s) => s.id === node.id);
      if (nodeIndex > 0) {
        const precedingSibling = siblings[nodeIndex - 1];
        // Only allow demote if the preceding sibling is not a descendant of this node (to avoid cycles)
        const checkDescendant = (nodeToCheck: WorkItemNode, targetId: string): boolean => {
          if (!nodeToCheck.children) return false;
          for (const child of nodeToCheck.children) {
            if (child.id === targetId || checkDescendant(child, targetId)) {
              return true;
            }
          }
          return false;
        };
        // For root-level nodes, allow demote as long as not a cycle and type rules allow
        if (!checkDescendant(node, precedingSibling.id)) {
          const possibleChildTypesForPrecedingSibling = this.getPossibleChildTypes(
            precedingSibling.id,
          );
          if (possibleChildTypesForPrecedingSibling.length > 0) {
            canDemoteThisNode = true;
          } else {
            const precedingSiblingConfig = this.workItemConfigurations.get(
              precedingSibling.type as WorkItemTypeName,
            );
            if (!(precedingSiblingConfig?.hierarchyRules?.length === 0)) {
              canDemoteThisNode = true;
            }
          }
        }
      }
    } else if (siblings && siblings.length > 0) {
      // If parentNode is null (root), still allow demote if there is a previous sibling and type rules allow
      const nodeIndex = siblings.findIndex((s) => s.id === node.id);
      if (nodeIndex > 0) {
        const precedingSibling = siblings[nodeIndex - 1];
        const possibleChildTypesForPrecedingSibling = this.getPossibleChildTypes(
          precedingSibling.id,
        );
        if (possibleChildTypesForPrecedingSibling.length > 0) {
          canDemoteThisNode = true;
        } else {
          const precedingSiblingConfig = this.workItemConfigurations.get(
            precedingSibling.type as WorkItemTypeName,
          );
          if (!(precedingSiblingConfig?.hierarchyRules?.length === 0)) {
            canDemoteThisNode = true;
          }
        }
      }
    }
    node.canDemote = canDemoteThisNode;

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) =>
        this._updateNodePromoteDemoteFlagsRecursive(child, node, node.children),
      );
    }
  }

  private _updateAllPromoteDemoteFlags(): void {
    const rootNodes = this.hierarchy;
    rootNodes.forEach((rootNode) =>
      this._updateNodePromoteDemoteFlagsRecursive(rootNode, null, rootNodes),
    );
  }
}
