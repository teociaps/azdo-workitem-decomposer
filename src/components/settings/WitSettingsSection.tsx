import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Card } from 'azure-devops-ui/Card';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Dropdown } from 'azure-devops-ui/Dropdown';
import { IListBoxItem } from 'azure-devops-ui/ListBox';
import { Icon } from 'azure-devops-ui/Icon';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
import { TagPicker } from 'azure-devops-ui/TagPicker';
import { Dialog } from 'azure-devops-ui/Dialog';
import { TagInheritance, IWorkItemTagSettings } from '../../core/models/tagSettings';
import {
  AssignmentBehavior,
  IWorkItemAssignmentSettings,
} from '../../core/models/assignmentSettings';
import { DecomposerSettings } from '../../services/settingsService';
import { ProjectTag, getProjectTags } from '../../services/tagService';
import { AreaPathNode, getProjectAreaPaths } from '../../services/areaPathService';
import { AreaPathSelector } from './AreaPathSelector';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { initializeWitData } from '../../core/common/witDataInitializer';
import { useAutoSave } from '../../context';
import { openHierarchyView } from '../../services/navigationService';
import { logger } from '../../core/common/logger';
import './WitSettingsSection.scss';

const witSectionLogger = logger.createChild('WitSettingsSection');

const inheritanceOptions: IListBoxItem[] = [
  { id: TagInheritance.NONE, text: 'Do not inherit tags from parents' },
  { id: TagInheritance.PARENT, text: 'Inherit from direct parent' },
  { id: TagInheritance.ANCESTORS, text: 'Inherit from all ancestors' },
];

const assignmentOptions: IListBoxItem[] = [
  { id: AssignmentBehavior.NONE, text: 'No automatic assignment' },
  { id: AssignmentBehavior.DECOMPOSING_ITEM, text: 'Assign to decomposing work item assignee' },
  { id: AssignmentBehavior.CREATOR, text: 'Assign to current user (creator)' },
];

interface WitSettingsSectionProps {
  canEdit: boolean;
  settings: DecomposerSettings;
  onSettingsChange: (_settings: DecomposerSettings) => void;
}

export function WitSettingsSection({
  canEdit,
  settings,
  onSettingsChange,
}: WitSettingsSectionProps) {
  const { workItemConfigurations, batchSetWorkItemConfigurations } = useGlobalState();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [projectTags, setProjectTags] = useState<ProjectTag[]>([]);
  const [projectAreaPaths, setProjectAreaPaths] = useState<AreaPathNode[]>([]);
  const [selectedAreaPath, setSelectedAreaPath] = useState<string>('DEFAULT'); // DEFAULT or specific area path
  const [selectedTabs, setSelectedTabs] = useState<Record<string, string>>({});
  const [tagSearchTerms, setTagSearchTerms] = useState<Record<string, string>>({});
  const [tagPickerKeys, setTagPickerKeys] = useState<Record<string, number>>({});
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isConfirmClearDialogOpen, setIsConfirmClearDialogOpen] = useState(false);

  // Get autosave functionality
  const autoSave = useAutoSave();

  const witSettings = settings.witSettings;

  const sectionTitle = 'Work Item Types Management';

  // Get current area path settings (either default or specific area path)
  const currentAreaSettings = useMemo(() => {
    return selectedAreaPath === 'DEFAULT'
      ? witSettings.default
      : witSettings.byAreaPath[selectedAreaPath] || { tags: {}, assignments: {} };
  }, [selectedAreaPath, witSettings]);

  /**
   * Precompute hierarchy relationships and ordered WIT display
   */
  const hierarchyRelationships = useMemo(() => {
    const allTypes = new Set<string>();
    const childTypes = new Set<string>();
    const parentChildMap = new Map<string, string[]>();

    workItemConfigurations.forEach((config, typeName) => {
      if (config.hierarchyRules && config.hierarchyRules.length > 0) {
        allTypes.add(typeName);
        parentChildMap.set(typeName, config.hierarchyRules);
        config.hierarchyRules.forEach((childType) => {
          allTypes.add(childType);
          childTypes.add(childType);
        });
      }
    });

    // Order types hierarchically: parents before children
    const orderedTypes: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visitType = (typeName: string) => {
      if (visited.has(typeName) || visiting.has(typeName)) return;

      visiting.add(typeName);

      // First, visit all types that have this type as a child (parents)
      parentChildMap.forEach((children, parentType) => {
        if (children.includes(typeName) && !visited.has(parentType)) {
          visitType(parentType);
        }
      });

      visiting.delete(typeName);
      visited.add(typeName);
      orderedTypes.push(typeName);
    };

    // Visit all types to ensure hierarchy ordering
    Array.from(allTypes).sort().forEach(visitType);

    return {
      allTypes: orderedTypes,
      childTypes,
      parentChildMap,
    };
  }, [workItemConfigurations]);

  const boardWorkItemTypes = hierarchyRelationships.allTypes;

  /**
   * Check if a WIT can have parent items using Set lookup
   */
  const canWitHaveParents = useCallback(
    (witName: string): boolean => {
      return hierarchyRelationships.childTypes.has(witName);
    },
    [hierarchyRelationships.childTypes],
  );

  /**
   * Check if a WIT is top-level (cannot be created from within the decomposer)
   */
  const isTopLevelWit = useCallback(
    (witName: string): boolean => {
      return !hierarchyRelationships.childTypes.has(witName);
    },
    [hierarchyRelationships.childTypes],
  );

  /**
   * Initialize component data preventing circular dependencies
   */
  useEffect(() => {
    const initializeAllData = async () => {
      if (isInitializing || hasInitialized) return;

      try {
        setIsInitializing(true);
        setInitializationError(null);

        // Load project tags
        const projectTagsData = await getProjectTags();
        setProjectTags(projectTagsData);

        // Load project area paths
        try {
          const areaPathsData = await getProjectAreaPaths();
          setProjectAreaPaths(areaPathsData);
        } catch (error) {
          witSectionLogger.warn('Failed to load project area paths:', error);
          // Continue without area paths - user will only see default settings
        }

        // Initialize work item types if configurations are empty
        if (workItemConfigurations.size === 0) {
          witSectionLogger.debug('Initializing work item type data for WIT settings...');
          const result = await initializeWitData(batchSetWorkItemConfigurations);

          if (!result.success) {
            setInitializationError(result.error || 'Failed to load work item types');
            witSectionLogger.error('Failed to initialize work item types:', result.error);
          }
        }

        setHasInitialized(true);
      } catch (error) {
        const errorMessage = 'Error initializing WIT settings data';
        setInitializationError(errorMessage);
        witSectionLogger.error(errorMessage, error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAllData();
  }, [workItemConfigurations.size, batchSetWorkItemConfigurations, isInitializing, hasInitialized]);

  /**
   * Tag setting change handler with autosave
   */
  const handleTagSettingChange = useCallback(
    async (
      witName: string,
      setting: keyof IWorkItemTagSettings,
      value: TagInheritance | string[],
    ) => {
      const currentWitTags = currentAreaSettings.tags[witName] || {};
      const updatedAreaSettings = {
        ...currentAreaSettings,
        tags: {
          ...currentAreaSettings.tags,
          [witName]: {
            ...currentWitTags,
            [setting]: value,
          },
        },
      };

      // Update the appropriate area path settings
      let newWitSettings;
      if (selectedAreaPath === 'DEFAULT') {
        newWitSettings = {
          ...witSettings,
          default: updatedAreaSettings,
        };
      } else {
        newWitSettings = {
          ...witSettings,
          byAreaPath: {
            ...witSettings.byAreaPath,
            [selectedAreaPath]: updatedAreaSettings,
          },
        };
      }

      const newSettings = {
        ...settings,
        witSettings: newWitSettings,
      };

      onSettingsChange(newSettings);
      autoSave.saveSettings(newSettings);
    },
    [currentAreaSettings, witSettings, settings, selectedAreaPath, onSettingsChange, autoSave],
  );

  /**
   * Tag management handlers
   */
  const handleTagsChange = useCallback(
    (witName: string, tags: string[]) => {
      handleTagSettingChange(witName, 'tags', tags);
    },
    [handleTagSettingChange],
  );

  const handleInheritanceChange = useCallback(
    (witName: string, selectedItem: IListBoxItem) => {
      handleTagSettingChange(witName, 'inheritance', selectedItem.id as TagInheritance);
    },
    [handleTagSettingChange],
  );

  /**
   * Assignment setting change handler with autosave
   */
  const handleAssignmentSettingChange = useCallback(
    async (
      witName: string,
      setting: keyof IWorkItemAssignmentSettings,
      value: AssignmentBehavior,
    ) => {
      const currentWitAssignments = currentAreaSettings.assignments[witName] || {};
      const updatedAreaSettings = {
        ...currentAreaSettings,
        assignments: {
          ...currentAreaSettings.assignments,
          [witName]: {
            ...currentWitAssignments,
            [setting]: value,
          },
        },
      };

      // Update the appropriate area path settings
      let newWitSettings;
      if (selectedAreaPath === 'DEFAULT') {
        newWitSettings = {
          ...witSettings,
          default: updatedAreaSettings,
        };
      } else {
        newWitSettings = {
          ...witSettings,
          byAreaPath: {
            ...witSettings.byAreaPath,
            [selectedAreaPath]: updatedAreaSettings,
          },
        };
      }

      const newSettings = {
        ...settings,
        witSettings: newWitSettings,
      };

      onSettingsChange(newSettings);
      autoSave.saveSettings(newSettings);
    },
    [currentAreaSettings, witSettings, settings, selectedAreaPath, onSettingsChange, autoSave],
  );

  /**
   * Assignment behavior change handler
   */
  const handleAssignmentBehaviorChange = useCallback(
    (witName: string, selectedItem: IListBoxItem) => {
      handleAssignmentSettingChange(witName, 'behavior', selectedItem.id as AssignmentBehavior);
    },
    [handleAssignmentSettingChange],
  );

  const handleViewHierarchy = useCallback(async () => {
    try {
      await openHierarchyView();
    } catch (error) {
      witSectionLogger.error('Failed to open hierarchy view:', error);
    }
  }, []);

  const handleTagSearch = useCallback((witName: string, searchTerm: string) => {
    setTagSearchTerms((prev) => ({
      ...prev,
      [witName]: searchTerm,
    }));
  }, []);

  /**
   * Memoized available tags excluding selected ones
   */
  const availableTagsMap = useMemo(() => {
    const map = new Map<string, string[]>();

    boardWorkItemTypes.forEach((witName) => {
      const selectedTags = currentAreaSettings.tags[witName]?.tags || [];
      const selectedTagsSet = new Set(selectedTags.map((tag: string) => tag.toLowerCase()));

      const availableTags = projectTags
        .map((tag) => tag.name)
        .filter((tagName) => !selectedTagsSet.has(tagName.toLowerCase()));

      map.set(witName, availableTags);
    });

    return map;
  }, [boardWorkItemTypes, currentAreaSettings.tags, projectTags]);

  /**
   * Get filtered tag suggestions with real-time search
   */
  const getFilteredSuggestions = useCallback(
    (witName: string): string[] => {
      if (!canEdit) return [];

      const availableTags = availableTagsMap.get(witName) || [];
      const searchTerm = tagSearchTerms[witName]?.toLowerCase().trim();

      if (!searchTerm) return availableTags;

      return availableTags.filter((tagName) => tagName.toLowerCase().includes(searchTerm));
    },
    [canEdit, tagSearchTerms, availableTagsMap],
  );

  /**
   * TagPicker dropdown control using requestAnimationFrame
   */
  const showTagPickerDropdown = useCallback((witName: string) => {
    requestAnimationFrame(() => {
      const input = document.querySelector(
        `[data-wit-name="${witName}"] .tag-picker-container input`,
      ) as HTMLInputElement;
      if (input) {
        input.focus();
        input.click();
      }
    });
  }, []);

  /**
   * Reset TagPicker state and restore focus
   */
  const forceTagPickerReset = useCallback(
    (witName: string) => {
      setTagPickerKeys((prev) => ({
        ...prev,
        [witName]: (prev[witName] || 0) + 1,
      }));

      setTagSearchTerms((prev) => ({
        ...prev,
        [witName]: '',
      }));

      showTagPickerDropdown(witName);
    },
    [showTagPickerDropdown],
  );

  /**
   * Enter key handler for tag input with exact matching and dropdown control
   */
  const handleTagInputKeyDown = useCallback(
    (witName: string, event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' || !canEdit) return;

      const target = event.target as HTMLElement;
      if (!target.matches('input[type="text"]') && !target.matches('input:not([type])')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const searchTerm = tagSearchTerms[witName]?.trim();
      const availableTags = availableTagsMap.get(witName) || [];

      const addTagAndReset = (tagToAdd: string) => {
        const currentTags = currentAreaSettings.tags[witName]?.tags || [];
        handleTagsChange(witName, [...currentTags, tagToAdd]);
        forceTagPickerReset(witName);
      };

      if (!searchTerm) {
        // Empty input: add single tag or show dropdown
        if (availableTags.length === 1) {
          addTagAndReset(availableTags[0]);
        } else if (availableTags.length > 1) {
          showTagPickerDropdown(witName);
        }
        return;
      }

      // Search term exists: check for exact match first
      const lowerSearchTerm = searchTerm.toLowerCase();
      const exactMatch = availableTags.find((tag) => tag.toLowerCase() === lowerSearchTerm);

      if (exactMatch) {
        addTagAndReset(exactMatch);
        return;
      }

      // Filter matches and handle single/multiple results
      const filteredTags = availableTags.filter((tagName) =>
        tagName.toLowerCase().includes(lowerSearchTerm),
      );

      if (filteredTags.length === 1) {
        addTagAndReset(filteredTags[0]);
      } else if (filteredTags.length > 1) {
        showTagPickerDropdown(witName);
      }
    },
    [
      canEdit,
      tagSearchTerms,
      availableTagsMap,
      currentAreaSettings.tags,
      handleTagsChange,
      forceTagPickerReset,
      showTagPickerDropdown,
    ],
  );

  /**
   * Area path selection change handler
   */
  const handleAreaPathChange = useCallback((areaPath: string) => {
    setSelectedAreaPath(areaPath);
  }, []);

  /**
   * Clear settings for current area path
   */
  const handleClearSettings = useCallback(async () => {
    let newWitSettings;

    if (selectedAreaPath === 'DEFAULT') {
      // Clear default settings
      newWitSettings = {
        ...witSettings,
        default: { tags: {}, assignments: {} },
      };
    } else {
      // Remove specific area path settings
      const remainingAreaPaths = { ...witSettings.byAreaPath };
      delete remainingAreaPaths[selectedAreaPath];
      newWitSettings = {
        ...witSettings,
        byAreaPath: remainingAreaPaths,
      };
    }

    const newSettings = {
      ...settings,
      witSettings: newWitSettings,
    };

    onSettingsChange(newSettings);
    autoSave.saveSettings(newSettings);
    setIsConfirmClearDialogOpen(false);
  }, [selectedAreaPath, witSettings, settings, onSettingsChange, autoSave]);

  /**
   * Check if current area path has specific settings
   */
  const hasAreaPathSettings =
    selectedAreaPath === 'DEFAULT'
      ? Object.keys(witSettings.default.tags).length > 0 ||
        Object.keys(witSettings.default.assignments).length > 0
      : selectedAreaPath in witSettings.byAreaPath;

  // Loading state with flicker prevention
  if (isInitializing || (!hasInitialized && workItemConfigurations.size === 0)) {
    return (
      <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
        <div className="flex-row flex-center justify-center padding-16">
          <Spinner size={SpinnerSize.medium} className="margin-right-8" />
          <span>Loading work item types...</span>
        </div>
      </Card>
    );
  }

  // Initialization error state
  if (initializationError) {
    return (
      <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
        <div className="padding-16">
          <HeaderTitle titleSize={TitleSize.Large}>{sectionTitle}</HeaderTitle>
          <p className="secondary-text text-color-error margin-top-8">{initializationError}</p>
        </div>
      </Card>
    );
  }

  // Empty state after initialization
  if (hasInitialized && boardWorkItemTypes.length === 0) {
    return (
      <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
        <div className="padding-16">
          <HeaderTitle titleSize={TitleSize.Large}>{sectionTitle}</HeaderTitle>
          <p className="secondary-text margin-top-8">
            No work item types found that can be created in hierarchies for this project.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
      <div>
        {/* Section header */}
        <FormItem className="margin-bottom-8">
          <div className="flex-row flex-center justify-space-between">
            <div className="flex-row flex-center overflow-hidden">
              <HeaderTitle titleSize={TitleSize.Large} className="wit-section-title">
                {sectionTitle}
              </HeaderTitle>
            </div>
            <div className="flex-row flex-center">
              <Button
                text="View Hierarchy Tree"
                iconProps={{ iconName: 'ViewListTree' }}
                onClick={handleViewHierarchy}
              />
            </div>
          </div>
        </FormItem>

        <p className="secondary-text margin-bottom-24">
          Manage configuration for work item types that can be created in hierarchies. These
          settings are automatically applied when related work items are created through the
          decomposer.
        </p>

        {/* Area Path Selection */}
        <FormItem className="margin-bottom-16">
          <div className="area-path-selection-container">
            <div className="area-path-selector-wrapper">
              <AreaPathSelector
                selectedAreaPath={selectedAreaPath}
                projectAreaPaths={projectAreaPaths}
                onAreaPathChange={handleAreaPathChange}
                disabled={!canEdit}
              />
              <div className="secondary-text margin-top-4">
                Configure settings for specific area paths or use global defaults.
              </div>
            </div>
            {hasAreaPathSettings && (
              <div className="clear-settings-wrapper">
                <Button
                  text="Clear Settings"
                  iconProps={{ iconName: 'Clear' }}
                  onClick={() => setIsConfirmClearDialogOpen(true)}
                  disabled={!canEdit}
                  subtle
                />
              </div>
            )}
          </div>
        </FormItem>

        <div className="wit-settings-grid">
          {boardWorkItemTypes.map((witName: string) => {
            const witTagSettings = currentAreaSettings.tags[witName] || {
              inheritance: TagInheritance.NONE,
              tags: [],
            };

            const witAssignmentSettings = currentAreaSettings.assignments[witName] || {
              behavior: AssignmentBehavior.NONE,
            };

            const tagCount = witTagSettings.tags?.length || 0;
            const assignmentBehaviorText =
              assignmentOptions.find((opt) => opt.id === witAssignmentSettings.behavior)?.text ||
              'No automatic assignment';

            const witConfig = workItemConfigurations.get(witName);
            const witIconUrl = witConfig?.iconUrl;
            const witColor = witConfig?.color;

            return (
              <Card
                key={witName}
                className="wit-management-card"
                contentProps={{ className: 'flex-column' }}
              >
                <div className="wit-card-header flex-column">
                  <div className="flex-row flex-space-between flex-center">
                    <div
                      className="wit-icon-container margin-right-12"
                      style={{ borderColor: witColor || '#d4d4d4' }}
                    >
                      {witIconUrl ? (
                        <img src={witIconUrl} alt={`${witName} icon`} className="wit-icon" />
                      ) : (
                        <Icon iconName="WorkItem" className="wit-icon-fallback" />
                      )}
                    </div>
                    <h3 className="wit-title">{witName}</h3>
                  </div>
                  <div className="wit-info secondary-text margin-top-8 margin-bottom-16">
                    {isTopLevelWit(witName) ? (
                      <div className="flex-row flex-center">
                        <span>Top-level work item type (cannot be created from decomposer)</span>
                      </div>
                    ) : (
                      <div className="flex-row flex-center">
                        <span>
                          {tagCount} tag{tagCount !== 1 ? 's' : ''} configured
                        </span>
                        <span className="margin-left-8 margin-right-8">|</span>
                        <span>{assignmentBehaviorText}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="wit-card-content">
                  {/* Show informational message for top-level work item types */}
                  {isTopLevelWit(witName) ? (
                    <div className="tab-content">
                      <div className="flex-row flex-center margin-16">
                        <Icon iconName="Info" className="margin-right-8" />
                        <span className="secondary-text">
                          No options available since it cannot be created from within the
                          decomposer.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <TabBar
                        className="wit-tab-bar"
                        selectedTabId={selectedTabs[witName] || 'tags'}
                        onSelectedTabChanged={(newTabId) => {
                          setSelectedTabs((prev) => ({
                            ...prev,
                            [witName]: newTabId,
                          }));
                        }}
                        tabSize={TabSize.Compact}
                      >
                        <Tab name="Tags Management" id="tags" />
                        <Tab name="Assignment" id="assignments" />
                      </TabBar>

                      {/* Tags Management Tab Content */}
                      {(selectedTabs[witName] || 'tags') === 'tags' && (
                        <div className="tab-content">
                          <div className="tab-description margin-bottom-16">
                            <span className="secondary-text">
                              Configure automatic tagging for work items of this type.
                            </span>
                          </div>

                          <div className="setting-section">
                            {/* Inheritance configuration for child WITs */}
                            {canWitHaveParents(witName) && (
                              <div className="setting-row margin-bottom-16">
                                <div className="setting-label-row">
                                  <span className="setting-label">Inheritance Option</span>
                                  <Icon
                                    iconName="Info"
                                    className="setting-info-icon"
                                    tabIndex={0}
                                    role="button"
                                    ariaLabel="Show inheritance options help"
                                    tooltipProps={{
                                      text: 'Options: Do not inherit tags from parents (work items only get manually added tags), Inherit from direct parent (tags from immediate parent), Inherit from all ancestors (tags from all parent work items in hierarchy).',
                                    }}
                                  />
                                </div>
                                <Dropdown
                                  className="inheritance-dropdown"
                                  items={inheritanceOptions}
                                  onSelect={(_, item) => handleInheritanceChange(witName, item)}
                                  placeholder={
                                    inheritanceOptions.find(
                                      (opt) => opt.id === witTagSettings.inheritance,
                                    )?.text || 'Select inheritance option'
                                  }
                                  disabled={!canEdit}
                                />
                              </div>
                            )}

                            {/* Specific tags configuration */}
                            <div className="setting-row">
                              <div className="setting-label-row">
                                <span className="setting-label">Specific Tags</span>
                                <Icon
                                  iconName="Info"
                                  className="setting-info-icon"
                                  tabIndex={0}
                                  role="button"
                                  ariaLabel="Show tags information"
                                  tooltipProps={{
                                    text: canWitHaveParents(witName)
                                      ? 'If specific tags are added and an inheritance option is selected, both the specific and inherited tags will be applied to the work item.'
                                      : 'Specific tags that will be automatically applied to work items of this type when created through the decomposer.',
                                  }}
                                />
                              </div>
                              <div
                                className={`tag-picker-wrapper ${!canEdit ? 'tag-picker-wrapper-disabled' : ''}`}
                                data-wit-name={witName}
                                onKeyDown={(event) => handleTagInputKeyDown(witName, event)}
                              >
                                <TagPicker
                                  key={`tagpicker-${witName}-${tagPickerKeys[witName] || 0}`}
                                  selectedTags={witTagSettings.tags || []}
                                  suggestions={getFilteredSuggestions(witName)}
                                  suggestionsLoading={false}
                                  renderSuggestionItem={(props: { item: unknown }) => (
                                    <span>{String(props.item)}</span>
                                  )}
                                  onTagAdded={
                                    canEdit
                                      ? (tag: unknown) => {
                                          const tagString = String(tag);
                                          const currentTags = witTagSettings.tags || [];
                                          if (!currentTags.includes(tagString)) {
                                            handleTagsChange(witName, [...currentTags, tagString]);
                                          }
                                        }
                                      : () => {}
                                  }
                                  onTagRemoved={
                                    canEdit
                                      ? (tag: unknown) => {
                                          const tagString = String(tag);
                                          const currentTags = witTagSettings.tags || [];
                                          handleTagsChange(
                                            witName,
                                            currentTags.filter((t: string) => t !== tagString),
                                          );
                                        }
                                      : () => {}
                                  }
                                  areTagsEqual={(tag1: unknown, tag2: unknown) =>
                                    String(tag1) === String(tag2)
                                  }
                                  convertItemToPill={(tag: unknown) => ({ content: String(tag) })}
                                  noResultsFoundText={canEdit ? 'No matching tags found' : ''}
                                  onSearchChanged={(searchValue: string) =>
                                    handleTagSearch(witName, searchValue)
                                  }
                                  className={`tag-picker-container ${!canEdit ? 'tag-picker-disabled' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Assignment Tab Content */}
                      {selectedTabs[witName] === 'assignments' && (
                        <div className="tab-content">
                          <div className="tab-description margin-bottom-16">
                            <span className="secondary-text">
                              Configure automatic assignment for work items of this type when
                              created through the decomposer.
                            </span>
                          </div>

                          <div className="setting-section">
                            <div className="setting-row">
                              <div className="setting-label-row">
                                <span className="setting-label">Assignment Behavior</span>
                                <Icon
                                  iconName="Info"
                                  className="setting-info-icon"
                                  tabIndex={0}
                                  role="button"
                                  ariaLabel="Show assignment behavior help"
                                  tooltipProps={{
                                    text: 'Choose how work items should be assigned when created: No automatic assignment (manual assignment only), Assign to the same person as the work item being decomposed, or Assign to current user (creator of the work item).',
                                  }}
                                />
                              </div>
                              <Dropdown
                                className="inheritance-dropdown"
                                items={assignmentOptions}
                                onSelect={(_, item) =>
                                  handleAssignmentBehaviorChange(witName, item)
                                }
                                placeholder={
                                  assignmentOptions.find(
                                    (opt) =>
                                      opt.id ===
                                      (currentAreaSettings.assignments[witName]?.behavior ||
                                        AssignmentBehavior.NONE),
                                  )?.text || 'Select assignment behavior'
                                }
                                disabled={!canEdit}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Clear Settings Confirmation Dialog */}
      {isConfirmClearDialogOpen && (
        <Dialog
          titleProps={{ text: 'Clear Settings Confirmation' }}
          footerButtonProps={[
            {
              text: 'Cancel',
              onClick: () => setIsConfirmClearDialogOpen(false),
            },
            {
              text: 'Clear Settings',
              onClick: handleClearSettings,
              primary: true,
              danger: true,
            },
          ]}
          onDismiss={() => setIsConfirmClearDialogOpen(false)}
        >
          <p>
            Are you sure you want to clear all settings for "
            {selectedAreaPath === 'DEFAULT' ? 'Global Settings (default)' : selectedAreaPath}"?
          </p>
          <p>This action cannot be undone.</p>
        </Dialog>
      )}
    </Card>
  );
}
