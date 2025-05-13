import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemConfigurationsMap, WorkItemTypeName } from '../core/models/commonTypes';

/**
 * Manages the state and operations for the work item hierarchy tree.
 */
export class WorkItemHierarchyManager {
  private hierarchy: WorkItemNode[] = [];
  private parentWorkItemType: string | null = null;
  private workItemConfigurations: WorkItemConfigurationsMap;
  private hierarchyCount: number = 0; // Track the count of all added nodes

  constructor(
    workItemConfigurations: WorkItemConfigurationsMap,
    initialHierarchy: WorkItemNode[] = [],
  ) {
    this.hierarchy = initialHierarchy;
    this.workItemConfigurations = workItemConfigurations;
    this.hierarchyCount = this.countNodes(this.hierarchy);
  }

  /**
   * Sets the type of the root parent work item to help determine default child types.
   * @param type The work item type string.
   */
  setParentWorkItemType(type: string | null): void {
    this.parentWorkItemType = type;
  }

  /**
   * Gets the type of the root parent work item.
   * @returns The work item type string, or null if not set.
   */
  getParentWorkItemType(): string | null {
    return this.parentWorkItemType;
  }

  /**
   * Returns the current hierarchy state.
   */
  getHierarchy(): WorkItemNode[] {
    return [...this.hierarchy]; // Return a copy to prevent direct mutation
  }

  /**
   * Returns the current count of all nodes in the hierarchy.
   */
  getHierarchyCount(): number {
    return this.hierarchyCount;
  }

  /**
   * Recursively counts all nodes in the hierarchy.
   */
  private countNodes(nodes: WorkItemNode[]): number {
    return nodes.reduce((acc, node) => acc + 1 + this.countNodes(node.children || []), 0);
  }

  /**
   * Finds a node within the hierarchy by its temporary ID.
   * @param id The temporary ID of the node to find.
   * @returns The found node or null.
   */
  findNodeById(id: string): WorkItemNode | null {
    const findRecursive = (nodes: WorkItemNode[], targetId: string): WorkItemNode | null => {
      for (const node of nodes) {
        if (node.id === targetId) return node;
        const foundInChildren = findRecursive(node.children, targetId);
        if (foundInChildren) return foundInChildren;
      }
      return null;
    };
    return findRecursive(this.hierarchy, id);
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
      // No parentId means we are considering adding to the root or based on the overall parent work item type
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
        // No specific rules for this parent type, or rules are not defined.
        return ['Task']; // Default fallback
      }
    } else {
      // This case means we're adding to root and parentWorkItemType was never set, or an unknown scenario.
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
      id: `temp-${Date.now()}-${Math.random()}`,
      title: itemTitle,
      type: childTypeToAdd,
      children: [],
      parentId: parentId,
    };

    const addRecursive = (
      nodes: WorkItemNode[],
      targetParentId: string | undefined,
      nodeToAdd: WorkItemNode,
    ): WorkItemNode[] => {
      if (!targetParentId) {
        return [...nodes, nodeToAdd]; // Add to root
      }
      return nodes.map((node) => {
        if (node.id === targetParentId) {
          return { ...node, children: [...node.children, nodeToAdd] };
        }
        if (node.children.length > 0) {
          return { ...node, children: addRecursive(node.children, targetParentId, nodeToAdd) };
        }
        return node;
      });
    };

    this.hierarchy = addRecursive(this.hierarchy, parentId, newItem);
    this.hierarchyCount = this.countNodes(this.hierarchy);
    console.log('Hierarchy after adding item:', this.hierarchy);
    return this.getHierarchy();
  }

  /**
   * Updates the title of an item in the hierarchy.
   * @param itemId The temporary ID of the item to update.
   * @param newTitle The new title string.
   * @returns The updated hierarchy.
   */
  updateItemTitle(itemId: string, newTitle: string): WorkItemNode[] {
    const updateRecursive = (
      nodes: WorkItemNode[],
      targetItemId: string,
      title: string,
    ): WorkItemNode[] => {
      return nodes.map((node) => {
        if (node.id === targetItemId) {
          return { ...node, title: title };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateRecursive(node.children, targetItemId, title) };
        }
        return node;
      });
    };

    this.hierarchy = updateRecursive(this.hierarchy, itemId, newTitle);
    return this.getHierarchy();
  }

  /**
   * Removes an item from the hierarchy by its ID.
   * Also removes all children of the specified item.
   * @param itemId The temporary ID of the item to remove.
   * @returns The updated hierarchy.
   */
  removeItem(itemId: string): WorkItemNode[] {
    // Helper function to recursively remove an item and its children
    // Returns:
    //   - updatedNodes: The new list of nodes for the current level.
    //   - changed: A boolean indicating if any change (removal) occurred at or below this level.
    const removeRecursive = (
      nodes: WorkItemNode[],
      targetId: string,
    ): { updatedNodes: WorkItemNode[]; changed: boolean } => {
      let hasChangedAtThisLevel = false;
      const newNodesList: WorkItemNode[] = [];

      for (const node of nodes) {
        if (node.id === targetId) {
          this.hierarchyCount -= 1 + this.countNodes(node.children || []);
          hasChangedAtThisLevel = true;
          continue;
        }

        if (node.children && node.children.length > 0) {
          const recursiveResult = removeRecursive(node.children, targetId);
          if (recursiveResult.changed) {
            newNodesList.push({ ...node, children: recursiveResult.updatedNodes });
            hasChangedAtThisLevel = true;
          } else {
            newNodesList.push(node);
          }
        } else {
          newNodesList.push(node);
        }
      }
      return { updatedNodes: newNodesList, changed: hasChangedAtThisLevel };
    };

    const result = removeRecursive(this.hierarchy, itemId);

    // Only update the main hierarchy if a change actually occurred.
    if (result.changed) {
      this.hierarchy = result.updatedNodes;
    }

    console.log('Hierarchy after removing item:', itemId, this.hierarchy);
    return this.getHierarchy();
  }

  promoteItem(itemId: string): WorkItemNode[] {
    console.log('Promoting item:', this.findNodeById(itemId));
    return this.hierarchy; // TODO: Placeholder for actual implementation
  }

  demoteItem(itemId: string): WorkItemNode[] {
    console.log('Demoting item:', this.findNodeById(itemId));
    return this.hierarchy; // TODO: Placeholder for actual implementation
  }
}
