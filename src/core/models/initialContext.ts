export interface InitialContext {
  workItemIds?: number[];
  workItemId?: number;
  id?: number;
  // Optional team information
  team?: {
    id: string;
    name: string;
  };
}
