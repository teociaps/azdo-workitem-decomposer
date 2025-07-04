import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Card } from 'azure-devops-ui/Card';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Dropdown } from 'azure-devops-ui/Dropdown';
import { IListBoxItem } from 'azure-devops-ui/ListBox';
import { Icon } from 'azure-devops-ui/Icon';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { Status, StatusSize, Statuses } from 'azure-devops-ui/Status';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
import { TagPicker } from 'azure-devops-ui/TagPicker';
import { TagInheritance, IWorkItemTagSettings } from '../../core/models/tagSettings';
import { IWitSettings } from '../../core/models/witSettings';
import { ProjectTag, getProjectTags } from '../../services/tagService';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { initializeWitData } from '../../core/common/witDataInitializer';
import settingsService from '../../services/settingsService';
import { openHierarchyView } from '../../services/navigationService';
import { logger } from '../../core/common/logger';
import './WitSettingsSection.scss';

const witSectionLogger = logger.createChild('WitSettingsSection');

const inheritanceOptions: IListBoxItem[] = [
  { id: TagInheritance.NONE, text: 'Do not inherit tags from parents' },
  { id: TagInheritance.PARENT, text: 'Inherit from direct parent' },
  { id: TagInheritance.ANCESTORS, text: 'Inherit from all ancestors' },
];

interface WitSettingsSectionProps {
  isAdmin: boolean;
}

export function WitSettingsSection({ isAdmin }: WitSettingsSectionProps) {
  const { workItemConfigurations, batchSetWorkItemConfigurations } = useGlobalState();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [witSettings, setWitSettings] = useState<IWitSettings>({ tags: {} });
  const [projectTags, setProjectTags] = useState<ProjectTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<Record<string, string>>({});
  const [tagSearchTerms, setTagSearchTerms] = useState<Record<string, string>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section title for the settings card
  const sectionTitle = 'Work Item Types Management';

  // Filter work item types to only those that appear in hierarchies (can be created)
  const boardWorkItemTypes = useMemo(() => {
    const types = new Set<string>();

    workItemConfigurations.forEach((config, typeName) => {
      if (config.hierarchyRules) {
        // Add the parent type (has hierarchy rules)
        types.add(typeName);
        // Add all child types (appear in hierarchy rules)
        config.hierarchyRules.forEach((childType) => {
          types.add(childType);
        });
      }
    });

    return Array.from(types).sort();
  }, [workItemConfigurations]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [witSettingsData, projectTagsData] = await Promise.all([
          settingsService.getWitSettings(),
          getProjectTags(),
        ]);

        setWitSettings(witSettingsData);
        setProjectTags(projectTagsData);
      } catch (error) {
        witSectionLogger.error('Failed to load initial WIT data:', error);
        setSaveError('Failed to load WIT settings');
      }
    };

    loadInitialData();
  }, []);

  // Initialize work item types if needed
  useEffect(() => {
    const initializeData = async () => {
      if (boardWorkItemTypes.length === 0 && !isInitializing) {
        setIsInitializing(true);
        setInitializationError(null);
        try {
          witSectionLogger.debug('Initializing work item type data for WIT settings...');
          const result = await initializeWitData(batchSetWorkItemConfigurations);
          if (!result.success) {
            setInitializationError(result.error || 'Failed to load work item types');
            witSectionLogger.error('Failed to initialize work item types:', result.error);
          }
        } catch (error) {
          const errorMessage = 'Error initializing work item types data';
          setInitializationError(errorMessage);
          witSectionLogger.error(errorMessage, error);
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeData();
  }, [boardWorkItemTypes.length, isInitializing, batchSetWorkItemConfigurations]);

  // Auto-save logic
  const autoSave = useCallback(
    async (newWitSettings: IWitSettings) => {
      if (!isAdmin) return;

      setIsSaving(true);
      setSaveSuccess(false);
      setSaveError(null);

      try {
        await settingsService.saveWitSettings(newWitSettings);
        setSaveSuccess(true);

        // Clear success state after 2 seconds
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
        }, 2000);
      } catch (error) {
        witSectionLogger.error('Failed to auto-save WIT settings:', error);
        setSaveError('Failed to save settings. Try again later.');

        // Clear error state after 5 seconds
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setSaveError(null);
        }, 5000);
      } finally {
        setIsSaving(false);
      }
    },
    [isAdmin],
  );

  // Tag setting change handler with auto-save
  const handleTagSettingChange = useCallback(
    async (
      witName: string,
      setting: keyof IWorkItemTagSettings,
      value: TagInheritance | string[],
    ) => {
      const newWitSettings = {
        ...witSettings,
        tags: {
          ...witSettings.tags,
          [witName]: {
            ...witSettings.tags[witName],
            [setting]: value,
          },
        },
      };
      setWitSettings(newWitSettings);
      await autoSave(newWitSettings);
    },
    [witSettings, autoSave],
  );

  // Tag management functions
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

  // Navigation handler
  const handleViewHierarchy = useCallback(async () => {
    try {
      await openHierarchyView();
    } catch (error) {
      witSectionLogger.error('Failed to open hierarchy view:', error);
    }
  }, []);

  // Tag search handler
  const handleTagSearch = useCallback((witName: string, searchTerm: string) => {
    setTagSearchTerms((prev) => ({
      ...prev,
      [witName]: searchTerm,
    }));
  }, []);

  // Get filtered suggestions for a specific WIT
  const getFilteredSuggestions = useCallback(
    (witName: string, witTagSettings: IWorkItemTagSettings) => {
      if (!isAdmin) return [];

      const searchTerm = tagSearchTerms[witName] || '';
      const availableTags = projectTags
        .map((tag) => tag.name)
        .filter((tagName) => !(witTagSettings.tags || []).includes(tagName));

      if (!searchTerm.trim()) {
        return availableTags;
      }

      return availableTags.filter((tagName) =>
        tagName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    },
    [isAdmin, tagSearchTerms, projectTags],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
        <div className="flex-row flex-center justify-center padding-16">
          <Spinner size={SpinnerSize.medium} className="margin-right-8" />
          <span>Loading work item types...</span>
        </div>
      </Card>
    );
  }

  // Show error state if initialization failed
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

  // Show empty state if no work item types are available
  if (boardWorkItemTypes.length === 0) {
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
        {/* Header with auto-save status */}
        <FormItem className="margin-bottom-8">
          <div className="flex-row flex-center justify-space-between">
            <div className="flex-row flex-center overflow-hidden">
              <HeaderTitle titleSize={TitleSize.Large} className="wit-section-title">
                {sectionTitle}
              </HeaderTitle>
              <div className="auto-save-status padding-4 margin-right-8">
                {isSaving && (
                  <div className="flex-row flex-center auto-save-status-item">
                    <Spinner size={SpinnerSize.small} className="margin-right-4" />
                    <span className="secondary-text auto-save-text">Saving...</span>
                  </div>
                )}
                {saveSuccess && (
                  <div className="flex-row flex-center auto-save-status-success auto-save-status-item">
                    <Status {...Statuses.Success} size={StatusSize.m} className="margin-right-4" />
                    <span className="secondary-text auto-save-text">Saved</span>
                  </div>
                )}
                {saveError && (
                  <div className="flex-row flex-center auto-save-status-error auto-save-status-item">
                    <Status {...Statuses.Failed} size={StatusSize.m} className="margin-right-4" />
                    <span className="secondary-text auto-save-text" title={saveError}>
                      {saveError}
                    </span>
                  </div>
                )}
              </div>
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

        <p className="secondary-text">
          Manage configuration for work item types that can be created in hierarchies. These
          settings are automatically applied when related work items are created through the
          decomposer.
        </p>

        <div className="wit-settings-grid">
          {boardWorkItemTypes.map((witName: string) => {
            const witTagSettings = witSettings.tags[witName] || {
              inheritance: TagInheritance.NONE,
              tags: [],
            };

            const tagCount = witTagSettings.tags?.length || 0;
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
                  <span className="wit-info secondary-text margin-top-8 margin-bottom-16">
                    {tagCount} tag{tagCount !== 1 ? 's' : ''} configured
                  </span>
                </div>

                <div className="wit-card-content">
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
                            disabled={!isAdmin}
                          />
                        </div>

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
                                text: 'If specific tags are added and an inheritance option is selected, both the specific and inherited tags will be applied to the work item.',
                              }}
                            />
                          </div>
                          <TagPicker
                            selectedTags={witTagSettings.tags || []}
                            suggestions={getFilteredSuggestions(witName, witTagSettings)}
                            suggestionsLoading={false}
                            renderSuggestionItem={(props: { item: unknown }) => (
                              <span>{String(props.item)}</span>
                            )}
                            onTagAdded={
                              isAdmin
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
                              isAdmin
                                ? (tag: unknown) => {
                                    const tagString = String(tag);
                                    const currentTags = witTagSettings.tags || [];
                                    handleTagsChange(
                                      witName,
                                      currentTags.filter((t) => t !== tagString),
                                    );
                                  }
                                : () => {}
                            }
                            areTagsEqual={(tag1: unknown, tag2: unknown) =>
                              String(tag1) === String(tag2)
                            }
                            convertItemToPill={(tag: unknown) => ({ content: String(tag) })}
                            noResultsFoundText={isAdmin ? 'No matching tags found' : ''}
                            onSearchChanged={(searchValue: string) =>
                              handleTagSearch(witName, searchValue)
                            }
                            className={`tag-picker-container ${!isAdmin ? 'tag-picker-disabled' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
