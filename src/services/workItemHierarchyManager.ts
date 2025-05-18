import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemConfigurationsMap, WorkItemTypeName } from '../core/models/commonTypes';
import { cloneDeep } from 'lodash';

// TODO: refactor this manager class, too big and too many responsibilities...

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

  /**
   * Returns possible types for a node if promoted.
   * @param itemId The ID of the item to check.
   * @returns An array of possible types.
   */
  getPossiblePromoteTypes(itemId: string): WorkItemTypeName[] {
    const node = this.findNodeById(itemId);
    if (!node) return [];

    // Standard promotion logic (applies whether the promotion is direct or cascading):
    // The node attempts to become a sibling of its current parent.
    // Its new parent would be its current grandparent, or the root project type if its parent is a root node.
    let newPotentialParentType: WorkItemTypeName | null = null;

    if (node.parentId) {
      const parent = this.findNodeById(node.parentId);
      if (parent) {
        if (parent.parentId) {
          const grandParent = this.findNodeById(parent.parentId);
          if (grandParent) {
            newPotentialParentType = grandParent.type;
          }
        } else {
          newPotentialParentType = this.parentWorkItemType;
        }
      }
    }

    if (newPotentialParentType) {
      const config = this.workItemConfigurations.get(newPotentialParentType);
      // The node can become any type that is a valid child of this newPotentialParentType
      if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
        return config.hierarchyRules;
      }
    }

    // If the node is already a root node, or if its parent is a root node and no parentWorkItemType is defined,
    // or if the new potential parent context has no defined child types,
    // then the node cannot be promoted further by this mechanism and can only remain its current type.
    return [node.type];
  }

  /**
   * Returns possible types for a node if demoted.
   * @param itemId The ID of the item to check.
   * @param isCascading Whether this is part of a cascading operation.
   * @returns An array of possible types.
   */
  getPossibleDemoteTypes(itemId: string, isCascading: boolean = false): WorkItemTypeName[] {
    const node = this.findNodeById(itemId);
    if (!node) return [];

    if (isCascading) {
      // If a parent item is demoted, its children might need to change type.
      // The child node can become any type that is one of its own defined child types.
      // Example: Parent Feature demotes. Child User Story needs to change.
      // Child User Story can become a Task or Bug (if these are in UserStoryConfig.hierarchyRules).
      const config = this.workItemConfigurations.get(node.type);
      if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
        return config.hierarchyRules;
      }
      return [node.type]; // If no children defined, can only be its own type.
    } else {
      // Standard demotion: Can it become a child of its preceding sibling?
      let precedingSiblingType: WorkItemTypeName | null = null;
      if (node.parentId) {
        const parent = this.findNodeById(node.parentId);
        if (parent?.children) {
          const idx = parent.children.findIndex((c) => c.id === itemId);
          if (idx > 0) {
            precedingSiblingType = parent.children[idx - 1].type;
          }
        }
      } else {
        // Root node, check preceding sibling in the root list
        const idx = this.hierarchy.findIndex((n) => n.id === itemId);
        if (idx > 0) {
          precedingSiblingType = this.hierarchy[idx - 1].type;
        }
      }

      if (precedingSiblingType) {
        const config = this.workItemConfigurations.get(precedingSiblingType);
        // The node can become any type that is a valid child of its preceding sibling.
        if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
          return config.hierarchyRules;
        }
      }
      return [node.type]; // Cannot be demoted or no valid context.
    }
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
   * Applies the type map to the affected nodes, updating their types and titles if necessary.
   * @param typeMap The map of node IDs to new work item types.
   */
  private _applyTypeMapToAffectedNodes(typeMap: Record<string, WorkItemTypeName>): void {
    for (const nodeId in typeMap) {
      if (Object.prototype.hasOwnProperty.call(typeMap, nodeId)) {
        const node = this.findNodeById(nodeId);
        if (!node) {
          console.warn(`[WorkItemHierarchyManager._applyTypeMapToAffectedNodes] Node with ID ${nodeId} from typeMap not found in hierarchy.`);
          continue;
        }

        const newTypeFromModal = typeMap[nodeId];
        // newTypeFromModal is guaranteed to be valid as we are iterating keys of typeMap.

        const originalTypeBeforeModal = node.type;
        const originalTitle = node.title;

        // Only apply changes if the new type from modal is different from the current type
        if (originalTypeBeforeModal !== newTypeFromModal) {
          node.type = newTypeFromModal; // Apply the new type from modal

          // If the original title was the default for the original type, update it
          const expectedOldDefaultTitle = `New ${originalTypeBeforeModal}`;
          if (originalTitle.trim().toLowerCase() === expectedOldDefaultTitle.toLowerCase()) {
            node.title = `New ${newTypeFromModal}`;
          }
        }
        // If newTypeFromModal is the same as originalTypeBeforeModal, no changes to type or title are needed here.
      }
    }
  }

  /**
   * Internal logic for promoting an item.
   * @param itemId The ID of the item to promote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  private _promoteItemInternal(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    if (typeMap) {
      this._applyTypeMapToAffectedNodes(typeMap);
    }

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

    this._recursivelyUpdateTypeAndChildren(nodeToPromote, newParentOfPromotedNode, typeMap);
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  /**
   * Internal logic for demoting an item.
   * @param itemId The ID of the item to demote.
   * @param typeMap Optional map of types to update.
   * @returns The updated hierarchy.
   */
  private _demoteItemInternal(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    if (typeMap) {
      this._applyTypeMapToAffectedNodes(typeMap);
    }

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
      this._recursivelyUpdateTypeAndChildren(nodeToDemote, newParentNodeCandidate, typeMap);
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

    this._recursivelyUpdateTypeAndChildren(nodeToDemote, newParentNodeCandidate, typeMap);
    this._updateAllPromoteDemoteFlags();
    return this.getHierarchy();
  }

  private _recursivelyUpdateTypeAndChildren(
    node: WorkItemNode,
    newParentNode: WorkItemNode | null,
    typeMap?: Record<string, WorkItemTypeName> // Added typeMap parameter
  ): void {
    const newParentId = newParentNode ? newParentNode.id : undefined;
    const newParentTypeInfo = newParentNode
      ? `parent ${newParentNode.id} (type: ${newParentNode.type})`
      : 'root';
    const allowedChildTypes = this.getPossibleChildTypes(newParentId);

    // typeBeforeHierarchyRules is the node's type after _applyTypeMapToAffectedNodes might have changed it based on modal.
    const typeBeforeHierarchyRules = node.type;
    // titleBeforeHierarchyRules is the node's title after _applyTypeMapToAffectedNodes might have changed it.
    const titleBeforeHierarchyRules = node.title;

    // Check if the titleBeforeHierarchyRules was a default title for typeBeforeHierarchyRules.
    const expectedOldDefaultTitleForTypeBeforeHierarchyRules = `New ${typeBeforeHierarchyRules}`;
    const wasTitleDefaultForTypeBeforeHierarchyRules =
      titleBeforeHierarchyRules.trim().toLowerCase() === expectedOldDefaultTitleForTypeBeforeHierarchyRules.toLowerCase();

    let finalEffectiveType = typeBeforeHierarchyRules;

    // Check if the user made an explicit choice for this node in the modal.
    const userMadeExplicitChoiceForThisNodeInModal = typeMap && Object.prototype.hasOwnProperty.call(typeMap, node.id);

    if (userMadeExplicitChoiceForThisNodeInModal) {
      // User made a choice. This choice (typeBeforeHierarchyRules) must be valid in the new location.
      if (!allowedChildTypes.includes(typeBeforeHierarchyRules as WorkItemTypeName)) {
        // This is a conflict: modal offered/user chose a type that's not actually allowed here.
        // This should ideally be prevented by the modal's logic.
        if (allowedChildTypes.length > 0) {
          finalEffectiveType = allowedChildTypes[0];
          console.warn(
            `[WorkItemHierarchyManager] Modal-selected type ${typeBeforeHierarchyRules} for node ${node.id} is not valid as child of ${newParentTypeInfo}. Changed to ${finalEffectiveType}. Allowed: ${allowedChildTypes.join(', ')}`,
          );
        } else {
          this._raiseError(
            `[WorkItemHierarchyManager] Modal-selected type ${typeBeforeHierarchyRules} for node ${node.id} is not valid as child of ${newParentTypeInfo}, and no other child types are allowed.`,
          );
          // Keep the problematic type, error is raised.
        }
      }
      // Else: User's explicit choice is valid, so finalEffectiveType remains typeBeforeHierarchyRules.
    } else {
      // User did NOT make an explicit choice for this node in the modal for its new position.
      // We prefer the first allowed child type if the current type isn't it, or if the current type is not allowed.
      if (allowedChildTypes.length > 0) {
        if (
          typeBeforeHierarchyRules !== allowedChildTypes[0] ||
          !allowedChildTypes.includes(typeBeforeHierarchyRules as WorkItemTypeName)
        ) {
          finalEffectiveType = allowedChildTypes[0];
        }
        // Else: current type is already the primary allowed type (and is valid), or it's some other valid secondary type (which we allow to persist if no explicit modal choice was made to change it from that secondary type)
        // Correction: The above comment was slightly off. If it's not the primary, but it IS allowed, we should still change it to primary if no explicit choice was made.
        // The condition `typeBeforeHierarchyRules !== allowedChildTypes[0] || !allowedChildTypes.includes(...)` covers this:
        // - If current is not primary AND current is not allowed -> change to primary.
        // - If current is not primary BUT current IS allowed -> change to primary.
        // - If current IS primary (and thus allowed) -> no change from this rule.
      } else {
        // No allowed child types for the new parent.
        // If the node's current type is (consequently) not in the empty list, it's an issue.
        // This check is implicitly: if !allowedChildTypes.includes(typeBeforeHierarchyRules)
        this._raiseError(
          `[WorkItemHierarchyManager] Node ${node.id} (type ${typeBeforeHierarchyRules}) cannot be a child of ${newParentTypeInfo} as it allows no configured child types. Type not changed by hierarchy rule.`,
        );
        // finalEffectiveType remains typeBeforeHierarchyRules
      }
    }

    node.type = finalEffectiveType;

    // If the title *before this function* was a default for the type it had *before this function*,
    // then update the title to be the default for the new finalEffectiveType.
    if (wasTitleDefaultForTypeBeforeHierarchyRules) {
      node.title = `New ${finalEffectiveType}`;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this._recursivelyUpdateTypeAndChildren(child, node, typeMap);
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
