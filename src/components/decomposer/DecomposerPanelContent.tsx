import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SDK from 'azure-devops-extension-sdk';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import Draggable from 'react-draggable';
import { WorkItemHierarchyManager } from '../../managers/workItemHierarchyManager';
import { WorkItemHierarchyCreationResult } from '../../managers/textHierarchyCreationManager';
import { getParentWorkItemDetails } from '../../services/workItemDataService';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { initializeWitData } from '../../core/common/witDataInitializer';
import { ErrorDisplay } from '../common/ErrorDisplay';
import { WitHierarchyViewer } from '../hierarchy/WitHierarchyViewer';
import { DecomposerPanelHeader } from './DecomposerPanelHeader';
import { DecomposerPanelActionBar } from './DecomposerPanelActionBar';
import {
  DecomposerWorkItemTreeArea,
  DecomposerWorkItemTreeAreaRef,
} from './DecomposerWorkItemTreeArea';
import { logger } from '../../core/common/logger';
import { InitialContext } from '../../core/models/initialContext';
import { useContextShortcuts } from '../../core/shortcuts/useShortcuts';
import { ShortcutHelpModal } from '../modals/ShortcutHelpModal/ShortcutHelpModal';
import { openSettingsPage, openHierarchyView } from '../../services/navigationService';
import { ShortcutCode } from '../../core/shortcuts/shortcutConfiguration';
import { useWorkItemTextHierarchy } from '../../core/hooks';

const decomposerLogger = logger.createChild('Decomposer');

export function DecomposerPanelContent({ initialContext }: { initialContext?: InitialContext }) {
  const workItemIds =
    initialContext?.workItemIds ||
    (initialContext?.workItemId
      ? [initialContext.workItemId]
      : initialContext?.id
        ? [initialContext.id]
        : []);
  const parentWorkItemId = workItemIds.length > 0 ? workItemIds[0] : null;

  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [showWitHierarchyViewer, setShowWitHierarchyViewer] = useState<boolean>(false);
  const [witHierarchyViewerPosition, setWitHierarchyViewerPosition] = useState<{
    x: number;
    y: number;
  }>({
    x: 0,
    y: 0,
  });
  const [isMetadataLoading, setIsMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isHierarchyEmpty, setIsHierarchyEmpty] = useState<boolean>(true);
  const [hierarchyCount, setHierarchyCount] = useState<number>(0);
  const [isShortcutHelpVisible, setIsShortcutHelpVisible] = useState<boolean>(false);
  const [isAnyNodeInDeleteConfirmation, setIsAnyNodeInDeleteConfirmation] =
    useState<boolean>(false);
  const { batchSetWorkItemConfigurations, workItemConfigurations } = useGlobalState();
  const hierarchyAreaRef = useRef<DecomposerWorkItemTreeAreaRef>(null);
  const panelContainerRef = useRef<HTMLDivElement>(null);
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);

  const hierarchyManager = useMemo(
    () => new WorkItemHierarchyManager(workItemConfigurations, [], undefined, setError),
    [workItemConfigurations, setError],
  );

  // Callback for selecting items (can be passed down if needed)
  const handleSelectWorkItem = useCallback((workItemId: string) => {
    decomposerLogger.debug('Work item selected in parent:', workItemId);
    // TODO: Potentially fetch details or perform other actions here
  }, []);

  // Callback for HierarchyArea to signal changes
  const handleHierarchyChange = useCallback(
    (isEmpty: boolean) => {
      setIsHierarchyEmpty(isEmpty);
      setHierarchyCount(hierarchyManager.getHierarchyCount());
    },
    [hierarchyManager],
  );

  /**
   * Updates hierarchy state after successful text parsing
   */
  const updateHierarchyState = useCallback(
    (result: WorkItemHierarchyCreationResult) => {
      if (!result.updatedHierarchy) return;

      // Update hierarchy area with new items
      hierarchyAreaRef.current?.updateHierarchy(result.updatedHierarchy);

      // Update state
      setHierarchyCount(hierarchyManager.getHierarchyCount());
      setIsHierarchyEmpty(result.updatedHierarchy.length === 0);

      // Handle warnings and errors
      const allMessages = [...(result.errors || []), ...(result.warnings || [])];
      if (allMessages.length > 0) {
        setError(`Hierarchy created with warnings: ${allMessages.join(', ')}`);
      } else {
        setError(null);
      }
    },
    [hierarchyManager],
  );

  /**
   * Logs successful hierarchy creation
   */
  const logSuccess = useCallback((itemCount: number) => {
    decomposerLogger.info(`Successfully created hierarchy from text with ${itemCount} items`);
  }, []);

  // Use the text hierarchy hook
  const { textHierarchyManager, createWorkItemHierarchyFromText } = useWorkItemTextHierarchy({
    hierarchyManager,
    workItemConfigurations,
    onHierarchyUpdate: updateHierarchyState,
    onError: setError,
    onSuccess: logSuccess,
  });

  /**
   * Handles clipboard paste events by extracting text and creating hierarchy
   */
  const handleClipboardPaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      const pastedText = event.clipboardData.getData('text/plain');

      if (pastedText?.trim()) {
        createWorkItemHierarchyFromText(pastedText);
      } else {
        setError('No text detected from paste. Please ensure you have copied formatted text.');
      }
    },
    [createWorkItemHierarchyFromText],
  );

  /**
   * Handles keyboard shortcut for creating hierarchy from text
   * Focuses hidden textarea and triggers automatic paste processing
   */
  const handleCreateHierarchyFromTextShortcut = useCallback(() => {
    if (hiddenTextareaRef.current) {
      hiddenTextareaRef.current.focus();
      hiddenTextareaRef.current.value = ''; // Clear previous content

      // Trigger paste command programmatically
      setTimeout(() => {
        if (hiddenTextareaRef.current) {
          // Execute paste command
          document.execCommand('paste');

          // After a short delay, check if text was pasted and process it
          setTimeout(() => {
            if (hiddenTextareaRef.current && hiddenTextareaRef.current.value.trim()) {
              const pastedText = hiddenTextareaRef.current.value;
              hiddenTextareaRef.current.value = ''; // Clear after processing
              createWorkItemHierarchyFromText(pastedText);
              // Return focus to main panel
              if (panelContainerRef.current) {
                panelContainerRef.current.focus();
              }
            }
          }, 100);
        }
      }, 50);
    }
  }, [createWorkItemHierarchyFromText]);

  /**
   * Handles button click for creating hierarchy from text
   * Focuses hidden textarea and triggers automatic paste processing
   */
  const handleCreateHierarchyFromTextClick = useCallback(() => {
    if (hiddenTextareaRef.current) {
      hiddenTextareaRef.current.focus();
      hiddenTextareaRef.current.value = ''; // Clear previous content

      // Trigger paste command programmatically
      setTimeout(() => {
        if (hiddenTextareaRef.current) {
          // Execute paste command
          document.execCommand('paste');

          // After a short delay, check if text was pasted and process it
          setTimeout(() => {
            if (hiddenTextareaRef.current && hiddenTextareaRef.current.value.trim()) {
              const pastedText = hiddenTextareaRef.current.value;
              hiddenTextareaRef.current.value = ''; // Clear after processing
              createWorkItemHierarchyFromText(pastedText);
              // Return focus to main panel
              if (panelContainerRef.current) {
                panelContainerRef.current.focus();
              }
            }
          }, 100);
        }
      }, 50);
    }
  }, [createWorkItemHierarchyFromText]);

  /**
   * Handles paste events in the hidden textarea
   */
  const handleHiddenTextareaPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData.getData('text/plain');
      if (pastedText?.trim()) {
        // Clear the textarea and process the text
        event.currentTarget.value = '';
        createWorkItemHierarchyFromText(pastedText);
        // Return focus to main panel
        if (panelContainerRef.current) {
          panelContainerRef.current.focus();
        }
      }
    },
    [createWorkItemHierarchyFromText],
  );

  // Fetch project name on mount
  useEffect(() => {
    const webContext = SDK.getWebContext();
    if (webContext?.project?.name) {
      setProjectName(webContext.project.name);
    }
  }, []);

  // Function to close the panel (passed to action bar)
  const closePanel = useCallback(async (result?: unknown) => {
    decomposerLogger.debug('Panel closed with result:', result);
    const config = SDK.getConfiguration();
    if (config.panel && typeof config.panel.close === 'function') {
      config.panel.close(result);
    } else {
      decomposerLogger.warn(
        'Panel close function not provided or not a function in configuration.',
      );
    }
  }, []);

  // Fetch initial parent work item data
  useEffect(() => {
    const fetchData = async () => {
      if (!parentWorkItemId || !projectName) return;

      setIsInitialLoading(true);
      setError(null);
      try {
        const wi = await getParentWorkItemDetails(parentWorkItemId, projectName);
        setParentWorkItem(wi);
        decomposerLogger.debug('Parent Work Item:', wi);

        const parentType = wi.fields['System.WorkItemType'];
        hierarchyManager.setParentWorkItemType(parentType);

        const areaPath = wi.fields['System.AreaPath'];
        const iterationPath = wi.fields['System.IterationPath'];
        hierarchyManager.setOriginalPaths(areaPath, iterationPath);
      } catch (err: unknown) {
        decomposerLogger.error('Error fetching data:', err);
        setError((err as Error).message || 'Failed to load work item data');
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentWorkItemId, hierarchyManager]);

  // Fetch metadata (rules and colors) using centralized initializer
  useEffect(() => {
    if (!projectName) {
      return;
    }

    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchMetadata = async () => {
      setIsMetadataLoading(true);
      setMetadataError(null);

      try {
        const result = await initializeWitData(batchSetWorkItemConfigurations);

        if (signal.aborted) return;

        if (!result.success) {
          setMetadataError(result.error || 'Failed to load work item metadata');
        }
      } catch (err: unknown) {
        if (signal.aborted) return;
        decomposerLogger.error('Failed to fetch metadata:', err);
        setMetadataError(
          (err as Error).message || 'An unknown error occurred while fetching work item metadata.',
        );
      } finally {
        if (!signal.aborted) {
          setIsMetadataLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      abortController.abort();
    };
  }, [projectName, batchSetWorkItemConfigurations]);

  const handleShowWitHierarchyViewer = useCallback(
    (position?: { x: number; y: number }) => {
      if (showWitHierarchyViewer) {
        setShowWitHierarchyViewer(false);
      } else {
        if (position) {
          setWitHierarchyViewerPosition(position);
        }
        // If no position is provided (e.g., from a shortcut before a click),
        // it will use the last known position or the default {0,0}.
        setShowWitHierarchyViewer(true);
      }
    },
    [showWitHierarchyViewer],
  );

  const handleCloseWitHierarchyViewer = useCallback(() => {
    setShowWitHierarchyViewer(false);
  }, []);

  const canAdd = useMemo(
    () => !!parentWorkItem && !isInitialLoading && !isMetadataLoading,
    [parentWorkItem, isInitialLoading, isMetadataLoading],
  );
  const handleAddRootItemRequest = useCallback(
    (event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      if (hierarchyAreaRef.current) {
        // If no event is provided (like from keyboard shortcut), create a synthetic keyboard event
        if (!event) {
          const syntheticEvent = { key: 'Alt' } as React.KeyboardEvent<HTMLElement>;
          hierarchyAreaRef.current.requestAddItemAtRoot(syntheticEvent);
        } else {
          hierarchyAreaRef.current.requestAddItemAtRoot(event);
        }
      }
    },
    [],
  );

  // Save is possible if the hierarchy is not empty
  const canSave = useMemo(() => {
    return !isHierarchyEmpty;
  }, [isHierarchyEmpty]);

  // Define shortcut action handlers
  const handleShowHelp = useCallback(() => {
    setIsShortcutHelpVisible(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    openSettingsPage(setError);
  }, []);

  const handleFormatHelp = useCallback(() => {
    openHierarchyView(setError);
  }, []);

  useContextShortcuts(
    'global',
    [
      { code: ShortcutCode.ALT_COMMA, callback: handleOpenSettings },
      { code: ShortcutCode.ALT_H, callback: handleShowHelp },
    ],
    true, // Always enabled
  );
  useContextShortcuts(
    'mainPanel',
    [
      { code: ShortcutCode.ARROW_UP, callback: () => hierarchyAreaRef.current?.navigateUp() },
      { code: ShortcutCode.ARROW_DOWN, callback: () => hierarchyAreaRef.current?.navigateDown() },
      { code: ShortcutCode.ARROW_LEFT, callback: () => hierarchyAreaRef.current?.navigateLeft() },
      { code: ShortcutCode.ARROW_RIGHT, callback: () => hierarchyAreaRef.current?.navigateRight() },
      { code: ShortcutCode.HOME, callback: () => hierarchyAreaRef.current?.navigateHome() },
      { code: ShortcutCode.END, callback: () => hierarchyAreaRef.current?.navigateEnd() },
      { code: ShortcutCode.PAGE_UP, callback: () => hierarchyAreaRef.current?.navigatePageUp() },
      {
        code: ShortcutCode.PAGE_DOWN,
        callback: () => hierarchyAreaRef.current?.navigatePageDown(),
      },
      { code: ShortcutCode.F2, callback: () => hierarchyAreaRef.current?.requestEditFocused() },
      {
        code: ShortcutCode.ALT_N,
        callback: () => hierarchyAreaRef.current?.requestAddChildToFocused(),
      },
      {
        code: ShortcutCode.ALT_DELETE,
        callback: () => hierarchyAreaRef.current?.requestRemoveFocused(),
      },
      {
        code: ShortcutCode.ALT_ARROW_LEFT,
        callback: () => hierarchyAreaRef.current?.requestPromoteFocused(),
      },
      {
        code: ShortcutCode.ALT_ARROW_RIGHT,
        callback: () => hierarchyAreaRef.current?.requestDemoteFocused(),
      },
      { code: ShortcutCode.ALT_SHIFT_N, callback: () => handleAddRootItemRequest() },
      { code: ShortcutCode.ALT_SHIFT_H, callback: () => handleShowWitHierarchyViewer() },
      { code: ShortcutCode.CTRL_V, callback: () => handleCreateHierarchyFromTextShortcut() },
    ],
    !isInitialLoading && !isMetadataLoading && !isAnyNodeInDeleteConfirmation,
  );

  // Update text hierarchy manager when configurations change
  useEffect(() => {
    if (workItemConfigurations.size > 0) {
      textHierarchyManager.updateConfigurations(workItemConfigurations);
    }
  }, [workItemConfigurations, textHierarchyManager]);

  // Focus the panel when it's ready for immediate keyboard shortcut access
  useEffect(() => {
    if (!isInitialLoading && !isMetadataLoading && panelContainerRef.current) {
      const timeoutId = setTimeout(() => {
        if (panelContainerRef.current) {
          panelContainerRef.current.focus();
          decomposerLogger.debug('Panel focused for immediate keyboard shortcut access');
        }
      }, 10);

      return () => clearTimeout(timeoutId);
    }
  }, [isInitialLoading, isMetadataLoading]);

  return (
    <div
      ref={panelContainerRef}
      tabIndex={0}
      onPaste={handleClipboardPaste} // Primary paste handler - extracts text from clipboard and creates hierarchy
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        outline: 'none',
      }}
      className="view-type-hierarchy-viewer"
    >
      {/* Hidden textarea for capturing paste events from keyboard shortcuts and button clicks */}
      <textarea
        ref={hiddenTextareaRef}
        onPaste={handleHiddenTextareaPaste}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '1px',
          height: '1px',
          opacity: 0,
          resize: 'none',
          border: 'none',
          outline: 'none',
          zIndex: -1,
        }}
        placeholder="Paste your hierarchy text here"
        aria-label="Hidden textarea for hierarchy text input"
      />
      <ErrorDisplay error={error || metadataError} />
      <DecomposerPanelHeader
        parentWorkItem={parentWorkItem}
        projectName={projectName}
        onShowWitHierarchyViewer={handleShowWitHierarchyViewer}
        onAddRootItem={handleAddRootItemRequest}
        onCreateHierarchyFromText={handleCreateHierarchyFromTextClick}
        onShowFormatHelp={handleFormatHelp}
        canAdd={canAdd}
        hierarchyCount={hierarchyCount}
        isAnyNodeInDeleteConfirmation={isAnyNodeInDeleteConfirmation}
      />
      {showWitHierarchyViewer && projectName && !isMetadataLoading && !metadataError && (
        <Draggable
          handle=".wit-hierarchy-header-title"
          position={witHierarchyViewerPosition}
          bounds="parent"
          onStop={(e, data) => setWitHierarchyViewerPosition({ x: data.x, y: data.y })}
        >
          <div style={{ position: 'absolute', zIndex: 100 }}>
            <WitHierarchyViewer
              onClose={handleCloseWitHierarchyViewer}
              selectedWit={parentWorkItem?.fields['System.WorkItemType']}
            />
          </div>
        </Draggable>
      )}
      <DecomposerWorkItemTreeArea
        ref={hierarchyAreaRef}
        isLoading={isInitialLoading}
        hierarchyManager={hierarchyManager}
        onSelectWorkItem={handleSelectWorkItem}
        onHierarchyChange={handleHierarchyChange}
        canAdd={!!projectName && !!parentWorkItem}
        onDeleteConfirmationChange={setIsAnyNodeInDeleteConfirmation}
      />
      <DecomposerPanelActionBar
        hierarchyManager={hierarchyManager}
        parentWorkItemId={parentWorkItemId}
        projectName={projectName}
        onClosePanel={closePanel}
        onError={setError}
        canSave={canSave}
        onShowHelp={handleShowHelp}
        isAnyNodeInDeleteConfirmation={isAnyNodeInDeleteConfirmation}
        hierarchyAreaRef={hierarchyAreaRef}
      />
      <ShortcutHelpModal
        isOpen={isShortcutHelpVisible}
        onClose={() => setIsShortcutHelpVisible(false)}
      />
    </div>
  );
}
