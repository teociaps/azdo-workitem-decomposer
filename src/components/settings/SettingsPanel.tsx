import React, { useState, useEffect, useCallback } from 'react';
import SDK from 'azure-devops-extension-sdk';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { TextField, TextFieldWidth } from 'azure-devops-ui/TextField';
import { Toggle } from 'azure-devops-ui/Toggle';
import { Card } from 'azure-devops-ui/Card';
import settingsService, {
  DecomposerSettings,
  DEFAULT_SETTINGS,
} from '../../services/settingsService';
import { WitSettingsSection } from './WitSettingsSection';
import { UserPermissionsSection } from './UserPermissionsSection';
import { PermissionMessage } from './PermissionMessage';
import { BatchCreationSection } from './BatchCreationSection';
import { PermissionService } from '../../services/permissionService';
import './SettingsPanel.scss';
import { Tab, TabBar } from 'azure-devops-ui/Tabs';
import { logger } from '../../core/common/logger';
import { BaseSettingsPage } from './BaseSettingsPage';
import { useAutoSave } from '../../context';

const settingsPanelLogger = logger.createChild('SettingsPanel');

function SettingsPanelContent({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<DecomposerSettings>(() => ({
    ...DEFAULT_SETTINGS,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [commentTabId, setCommentTabId] = useState<'edit' | 'preview'>('edit');

  // Get autosave functionality
  const autoSave = useAutoSave();

  // Check edit permissions whenever settings change
  useEffect(() => {
    const checkEditPermissions = async () => {
      try {
        const canEditSettings = await PermissionService.canEditSettings(
          settings.userPermissions.allowedUsers,
        );
        setCanEdit(canEditSettings);
        settingsPanelLogger.info(`User can edit settings: ${canEditSettings}`);
      } catch (err) {
        settingsPanelLogger.error('Failed to check edit permissions:', err);
        setCanEdit(isAdmin); // Fallback to admin check
      }
    };

    if (settings.userPermissions?.allowedUsers) {
      checkEditPermissions();
    }
  }, [settings.userPermissions.allowedUsers, isAdmin]);

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setIsLoading(true);
        await SDK.ready();

        const projectName = SDK.getPageContext().webContext.project?.name;
        if (!projectName) {
          settingsPanelLogger.error('No project context available');
          setError('No project context available');
          return;
        }

        // Load settings
        const currentSettings = await settingsService.getSettings();

        setSettings(currentSettings);
        setError(null);
      } catch (err) {
        settingsPanelLogger.error('Failed to initialize settings:', err);
        setError('Failed to load settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    SDK.init({ loaded: false });
    initializeComponent()
      .then(() => {
        SDK.notifyLoadSucceeded();
      })
      .catch((err) => {
        SDK.notifyLoadFailed('SettingsPanel load failed');
        settingsPanelLogger.error('SettingsPanel load failed', err);
      });
  }, []);

  const handleToggleChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!canEdit) return; // Prevent changes if user can't edit
      const newSettings = { ...settings, addCommentsToWorkItems: checked };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, autoSave],
  );

  const handleCommentTextChange = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
      if (!canEdit) return; // Prevent changes if user can't edit
      const newSettings = { ...settings, commentText: newValue };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, autoSave],
  );

  const handleDeleteConfirmationEnabledChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!canEdit) return; // Prevent changes if user can't edit
      const newSettings = {
        ...settings,
        deleteConfirmation: { ...settings.deleteConfirmation, enabled: checked },
      };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, autoSave],
  );

  const handleDeleteConfirmationOnlyWithChildrenChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!canEdit) return; // Prevent changes if user can't edit
      const newSettings = {
        ...settings,
        deleteConfirmation: { ...settings.deleteConfirmation, onlyForItemsWithChildren: checked },
      };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, autoSave],
  );

  const handleDeleteConfirmationVisualCuesChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!canEdit) return; // Prevent changes if user can't edit
      const newSettings = {
        ...settings,
        deleteConfirmation: { ...settings.deleteConfirmation, showVisualCues: checked },
      };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, autoSave],
  );

  /**
   * Handle changes to the allowed users list from the UserPermissionsSection
   */
  const handleAllowedUsersChange = useCallback(
    (userIds: string[]) => {
      if (!isAdmin) return; // Only admins can change user permissions
      const newSettings = {
        ...settings,
        userPermissions: { ...settings.userPermissions, allowedUsers: userIds },
      };
      setSettings(newSettings);
      setError(null);
      autoSave.saveSettings(newSettings);
    },
    [isAdmin, settings, autoSave],
  );

  const initialSettingsLoaded =
    settings && Object.prototype.hasOwnProperty.call(settings, 'addCommentsToWorkItems');

  return (
    <>
      {isLoading && !initialSettingsLoaded && (
        <Spinner label="Loading settings..." size={SpinnerSize.large} />
      )}

      <PermissionMessage
        isAdmin={isAdmin}
        canEdit={canEdit}
        isLoading={isLoading}
        hasError={!!error}
      />

      {!isLoading && !error && settings && (
        <>
          {/* User Permissions Settings - Only visible to admins */}
          <UserPermissionsSection
            allowedUsers={settings.userPermissions.allowedUsers}
            onAllowedUsersChange={handleAllowedUsersChange}
            isAdmin={isAdmin}
            isLoading={isLoading}
          />

          {/* Comments Settings */}
          <Card
            className="settings-card margin-bottom-16"
            contentProps={{ className: 'flex-column' }}
          >
            <div>
              <FormItem className="margin-bottom-8">
                <div className="flex-row flex-center justify-space-between">
                  <HeaderTitle titleSize={TitleSize.Large}>
                    Add comments to created Work Items
                  </HeaderTitle>
                  <Toggle
                    checked={settings.addCommentsToWorkItems}
                    onChange={handleToggleChange}
                    onText="On"
                    offText="Off"
                    disabled={!canEdit}
                  />
                </div>
              </FormItem>
              <p className="secondary-text">
                When enabled, a comment will be added to each created child work item with the text
                specified below. This is useful for tracking purposes.
              </p>
              <p className="secondary-text">
                <strong>Note:</strong> The comment text supports HTML formatting.
              </p>
              <FormItem>
                <TabBar
                  className="transparent"
                  selectedTabId={commentTabId}
                  onSelectedTabChanged={(id) => setCommentTabId(id as 'edit' | 'preview')}
                >
                  <Tab id="edit" name="Edit" />
                  <Tab id="preview" name="Preview" />
                </TabBar>
                <div className="margin-top-4 margin-bottom-4">
                  {commentTabId === 'edit' ? (
                    <TextField
                      value={settings.commentText}
                      onChange={handleCommentTextChange}
                      multiline
                      rows={9}
                      placeholder="Enter comment text to be automatically added to new child work items."
                      width={TextFieldWidth.auto}
                      resizable
                      disabled={!settings.addCommentsToWorkItems || !canEdit}
                      inputClassName={
                        settings.addCommentsToWorkItems && canEdit
                          ? 'settings-resizable-textfield'
                          : ''
                      }
                      aria-label="Comment text for new work items"
                    />
                  ) : (
                    <div className="settings-html-preview">
                      <div
                        className="settings-html-preview-content"
                        dangerouslySetInnerHTML={{
                          __html:
                            settings.commentText?.trim() ||
                            '<span class="secondary-text"><em>Nothing to preview</em></span>',
                        }}
                      />
                    </div>
                  )}
                </div>
              </FormItem>
            </div>
          </Card>

          {/* Batch Creation Settings */}
          <BatchCreationSection
            settings={settings}
            onSettingsChange={setSettings}
            canEdit={canEdit}
          />

          {/* Delete Confirmation Settings */}
          <Card
            className="settings-card margin-bottom-16"
            contentProps={{ className: 'flex-column' }}
          >
            <div>
              <FormItem className="margin-bottom-8">
                <div className="flex-row flex-center justify-space-between">
                  <HeaderTitle titleSize={TitleSize.Large}>Delete Confirmation</HeaderTitle>
                  <Toggle
                    checked={settings.deleteConfirmation.enabled}
                    onChange={handleDeleteConfirmationEnabledChange}
                    onText="On"
                    offText="Off"
                    disabled={!canEdit}
                  />
                </div>
              </FormItem>
              <p className="secondary-text">
                When enabled, deletion operations will show confirmation dialogs before removing
                work items. You can also enable visual cues to highlight items that will be deleted.
              </p>

              {settings.deleteConfirmation.enabled && (
                <div className="margin-top-16">
                  <FormItem className="margin-bottom-12">
                    <div className="flex-row flex-center justify-space-between">
                      <div>
                        <label className="settings-label">
                          Ask confirmation only for items with children
                        </label>
                        <p className="secondary-text margin-top-4">
                          When enabled, only items that have child items will show confirmation
                          dialogs. Items without children can be deleted directly.
                        </p>
                      </div>
                      <Toggle
                        checked={settings.deleteConfirmation.onlyForItemsWithChildren}
                        onChange={handleDeleteConfirmationOnlyWithChildrenChange}
                        onText="On"
                        offText="Off"
                        disabled={!canEdit}
                      />
                    </div>
                  </FormItem>

                  <FormItem className="margin-bottom-12">
                    <div className="flex-row flex-center justify-space-between">
                      <div>
                        <label className="settings-label">
                          Show visual cues for delete operations
                        </label>
                        <p className="secondary-text margin-top-4">
                          When enabled, work items marked for deletion (along with all their child
                          items) will be highlighted with a red background to clearly show what will
                          be removed.
                        </p>
                      </div>
                      <Toggle
                        checked={settings.deleteConfirmation.showVisualCues}
                        onChange={handleDeleteConfirmationVisualCuesChange}
                        onText="On"
                        offText="Off"
                        disabled={!canEdit}
                      />
                    </div>
                  </FormItem>
                </div>
              )}
            </div>
          </Card>

          {/* WIT Settings Section */}
          <WitSettingsSection
            canEdit={canEdit}
            settings={settings}
            onSettingsChange={setSettings}
          />
        </>
      )}
    </>
  );
}

export function SettingsPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const handlePermissionCheck = useCallback((hasAdminPermissions: boolean) => {
    setIsAdmin(hasAdminPermissions);
    settingsPanelLogger.info(`User is admin: ${hasAdminPermissions}`);
  }, []);

  return (
    <BaseSettingsPage
      title="Work Item Decomposer"
      loadingLabel="Loading settings..."
      className="settings-container"
      checkPermissions
      onPermissionCheck={handlePermissionCheck}
      showPermissionMessage={false}
      enableAutoSave
      autoSaveFunction={async (settingsToSave: DecomposerSettings) => {
        await settingsService.saveSettings(settingsToSave);
      }}
      autoSaveConfig={{
        debounceMs: 1000,
        successDurationMs: 3000,
        autoDismissErrors: false,
        successMessage: 'Settings saved successfully!',
        loadingMessage: 'Saving settings...',
      }}
    >
      <SettingsPanelContent isAdmin={isAdmin} />
    </BaseSettingsPage>
  );
}
