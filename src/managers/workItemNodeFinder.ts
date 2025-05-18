import { WorkItemNode } from '../core/models/workItemHierarchy';

/**
 * Provides utilities for finding and traversing nodes in a work item hierarchy.
 */
export class WorkItemNodeFinder {
  /**
   * Finds a node by its ID in the hierarchy.
   * @param nodes The array of nodes to search.
   * @param id The ID of the node to find.
   * @returns The found node or null if not found.
   */
  static findNodeRecursive(nodes: WorkItemNode[], id: string): WorkItemNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const foundInChildren = this.findNodeRecursive(node.children, id);
        if (foundInChildren) {
          return foundInChildren;
        }
      }
    }
    return null;
  }

  /**
   * Recursively counts all nodes in the hierarchy.
   */
  static countNodesRecursive(nodes: WorkItemNode[]): number {
    return nodes.reduce((acc, node) => acc + 1 + this.countNodesRecursive(node.children || []), 0);
  }

  /**
   * Checks if targetId is a descendant of nodeToCheck.
   * @param nodeToCheck The node to check descendants of.
   * @param targetId The target ID to look for.
   * @returns True if targetId is a descendant of nodeToCheck.
   */
  static isDescendant(nodeToCheck: WorkItemNode, targetId: string): boolean {
    if (!nodeToCheck.children) return false;
    for (const child of nodeToCheck.children) {
      if (child.id === targetId || this.isDescendant(child, targetId)) {
        return true;
      }
    }
    return false;
  }
}
