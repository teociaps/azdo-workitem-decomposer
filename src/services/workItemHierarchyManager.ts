import { WorkItemNode } from '../core/models/workItemHierarchy';

/**
 * Manages the state and operations for the work item hierarchy tree.
 */
export class WorkItemHierarchyManager {
  private hierarchy: WorkItemNode[] = [];
  private parentWorkItemType: string | null = null;

  constructor(initialHierarchy: WorkItemNode[] = []) {
    this.hierarchy = initialHierarchy;
  }

  /**
   * Sets the type of the root parent work item to help determine default child types.
   * @param type The work item type string.
   */
  setParentWorkItemType(type: string | null): void {
    this.parentWorkItemType = type;
  }

  /**
   * Returns the current hierarchy state.
   */
  getHierarchy(): WorkItemNode[] {
    return [...this.hierarchy]; // Return a copy to prevent direct mutation
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
   * Adds a new item to the hierarchy.
   * @param parentId The temporary ID of the parent node, or undefined to add to the root.
   * @returns The updated hierarchy.
   */
  addItem(parentId?: string): WorkItemNode[] {
    let parentNodeType = this.parentWorkItemType;
    if (parentId) {
      const parentNode = this.findNodeById(parentId);
      if (parentNode) {
        parentNodeType = parentNode.type;
      }
    }

    // TODO: get work item types from API
    // For now, we will use a simplified logic to determine the child type based on parent type
    let childType = 'Task'; // Default fallback
    if (parentNodeType === 'Epic') childType = 'Feature';
    else if (parentNodeType === 'Feature') childType = 'User Story';
    else if (parentNodeType === 'User Story' || parentNodeType === 'Product Backlog Item')
      childType = 'Task';

    // TODO: add more children types based on parent type (Epic => Feature)

    const newItem: WorkItemNode = {
      id: `temp-${Date.now()}-${Math.random()}`, // TODO: don't show this in UI
      title: 'Test', // TODO: make editable in UI
      type: childType,
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

  // TODO: Add methods for deleting items, reordering (indent/outdent)
}
