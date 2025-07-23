import { useCallback, useMemo } from 'react';
import {
  TextHierarchyCreationManager,
  WorkItemHierarchyCreationResult,
} from '../../managers/textHierarchyCreationManager';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { WorkItemConfigurationsMap } from '../models/commonTypes';
import { logger } from '../common/logger';

const textHierarchyLogger = logger.createChild('WorkItemTextHierarchy');

interface UseWorkItemTextHierarchyParams {
  hierarchyManager: WorkItemHierarchyManager;
  workItemConfigurations: WorkItemConfigurationsMap;
  onHierarchyUpdate: (_result: WorkItemHierarchyCreationResult) => void;
  onError: (_error: string) => void;
  onSuccess: (_itemCount: number) => void;
}

interface UseWorkItemTextHierarchyReturn {
  textHierarchyManager: TextHierarchyCreationManager;
  createWorkItemHierarchyFromText: (_text?: string) => Promise<void>;
}

/**
 * Custom hook for managing work item text-to-hierarchy conversion functionality
 * Provides reliable text parsing for creating work item hierarchies from formatted text
 */
export function useWorkItemTextHierarchy({
  hierarchyManager,
  workItemConfigurations,
  onHierarchyUpdate,
  onError,
  onSuccess,
}: UseWorkItemTextHierarchyParams): UseWorkItemTextHierarchyReturn {
  // Create the text hierarchy manager instance
  const textHierarchyManager = useMemo(
    () => new TextHierarchyCreationManager(hierarchyManager, workItemConfigurations),
    [hierarchyManager, workItemConfigurations],
  );

  /**
   * Handles parsing errors with enhanced messaging for Azure DevOps extensions
   */
  const handleWorkItemParseErrors = useCallback(
    (errors?: string[]) => {
      const errorMessages = errors || ['Failed to create work item hierarchy from text'];
      onError(errorMessages.join(', '));
    },
    [onError],
  );

  /**
   * Creates work item hierarchy from text input
   * Direct processing without guidance messages
   */
  const createWorkItemHierarchyFromText = useCallback(
    async (text?: string) => {
      try {
        onError(''); // Clear previous errors

        if (!text?.trim()) {
          onError('No text provided. Please paste your formatted hierarchy text.');
          return;
        }

        textHierarchyLogger.debug('Processing text to create work item hierarchy');
        const result = textHierarchyManager.createWorkItemHierarchyFromText(text);

        if (result.success && result.updatedHierarchy) {
          onHierarchyUpdate(result);
          onSuccess(result.createdItemsCount || 0);

          // Clear error state on success
          onError('');

          // Show success feedback with created item count
          const itemText = result.createdItemsCount === 1 ? 'item' : 'items';
          textHierarchyLogger.info(
            `Successfully created ${result.createdItemsCount} work ${itemText} from text`,
          );
        } else {
          handleWorkItemParseErrors(result.errors || ['Failed to parse provided text']);
        }
      } catch (error) {
        textHierarchyLogger.error('Failed to create work item hierarchy from text:', error);
        onError(
          'Failed to create work item hierarchy from text. Please check the format and try again.',
        );
      }
    },
    [textHierarchyManager, onHierarchyUpdate, onSuccess, handleWorkItemParseErrors, onError],
  );

  return {
    textHierarchyManager,
    createWorkItemHierarchyFromText,
  };
}
