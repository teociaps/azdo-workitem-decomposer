import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemHierarchyStateManager } from './workItemHierarchyStateManager';
import { WorkItemTypeManager } from './workItemTypeManager';
import { WorkItemNodeFinder } from './workItemNodeFinder';

/**
 * Manages promotion and demotion flags for work items.
 */
export class WorkItemFlagManager {
  private stateManager: WorkItemHierarchyStateManager;
  private typeManager: WorkItemTypeManager;

  constructor(stateManager: WorkItemHierarchyStateManager, typeManager: WorkItemTypeManager) {
    this.stateManager = stateManager;
    this.typeManager = typeManager;
  }

  /**
   * Updates promotion and demotion flags for a specific node.
   * @param node The node to update flags for
   * @param parentNode The parent node or null for root nodes
   * @param siblings The siblings array
   */
  updateNodePromoteDemoteFlagsRecursive(
    node: WorkItemNode,
    parentNode: WorkItemNode | null,
    siblings: WorkItemNode[],
  ): void {
    node.canPromote = !!parentNode; // Can promote if has parent

    let canDemoteThisNode = false;
    if (parentNode) {
      const nodeIndex = siblings.findIndex((s) => s.id === node.id);
      if (nodeIndex > 0) {
        const precedingSibling = siblings[nodeIndex - 1];
        // Only allow demote if the preceding sibling is not a descendant of this node (to avoid cycles)
        if (!WorkItemNodeFinder.isDescendant(node, precedingSibling.id)) {
          const possibleChildTypesForPrecedingSibling = this.typeManager.getPossibleChildTypes(
            precedingSibling.id,
          );
          if (possibleChildTypesForPrecedingSibling.length > 0) {
            canDemoteThisNode = true;
          }
        }
      }
    } else if (siblings && siblings.length > 0) {
      // Root nodes can be demoted if they have a preceding sibling that can have children
      const nodeIndex = siblings.findIndex((s) => s.id === node.id);
      if (nodeIndex > 0) {
        const precedingSibling = siblings[nodeIndex - 1];
        const possibleChildTypesForPrecedingSibling = this.typeManager.getPossibleChildTypes(
          precedingSibling.id,
        );
        if (possibleChildTypesForPrecedingSibling.length > 0) {
          canDemoteThisNode = true;
        }
      }
    }
    node.canDemote = canDemoteThisNode;

    // Update flags for children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) =>
        this.updateNodePromoteDemoteFlagsRecursive(child, node, node.children),
      );
    }
  }

  /**
   * Updates promotion and demotion flags for all nodes in the hierarchy.
   */
  updateAllPromoteDemoteFlags(): void {
    const rootNodes = this.stateManager.getHierarchyRef();
    rootNodes.forEach((rootNode) =>
      this.updateNodePromoteDemoteFlagsRecursive(rootNode, null, rootNodes),
    );
  }
}
