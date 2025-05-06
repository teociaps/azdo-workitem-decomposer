export interface WorkItemNode {
  id: string; // Temporary ID for UI state management
  title: string;
  type: string; // Work item type (e.g., 'User Story', 'Task')
  children: WorkItemNode[];
  parentId?: string; // Temporary ID of the parent in the hierarchy
}