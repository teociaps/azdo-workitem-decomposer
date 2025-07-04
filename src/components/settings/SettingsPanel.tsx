import React, { useState, useEffect, useCallback, useRef } from 'react';
import SDK from 'azure-devops-extension-sdk';
import { Button } from 'azure-devops-ui/Button';
import { Card } from 'azure-devops-ui/Card';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { TextField, TextFieldWidth } from 'azure-devops-ui/TextField';
import { Toggle } from 'azure-devops-ui/Toggle';
import { Status, StatusSize, Statuses, IStatusProps } from 'azure-devops-ui/Status';
import settingsService, {
  DecomposerSettings,
  DEFAULT_SETTINGS,
} from '../../services/settingsService';
import { WitSettingsSection } from './WitSettingsSection';
import './SettingsPanel.scss';
import { Tab, TabBar } from 'azure-devops-ui/Tabs';
import { logger } from '../../core/common/logger';
import { BaseSettingsPage } from './BaseSettingsPage';

const settingsPanelLogger = logger.createChild('SettingsPanel');

export function SettingsPanel() {
  const [settings, setSettings] = useState<DecomposerSettings>(() => ({
    ...DEFAULT_SETTINGS,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{
    message: string | null;
    type: IStatusProps | null;
  }>({ message: null, type: null });
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentTabId, setCommentTabId] = useState<'edit' | 'preview'>('edit');

  const handlePermissionCheck = useCallback((hasAdminPermissions: boolean) => {
    setIsAdmin(hasAdminPermissions);
    settingsPanelLogger.info(`User is admin: ${hasAdminPermissions}`);
  }, []);

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

    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);
  const handleToggleChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!isAdmin) return; // Prevent changes if not admin
      setSettings((prev) => ({ ...prev, addCommentsToWorkItems: checked }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [isAdmin],
  );
  const handleCommentTextChange = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
      if (!isAdmin) return; // Prevent changes if not admin
      setSettings((prev) => ({ ...prev, commentText: newValue }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [isAdmin],
  );

  const handleDeleteConfirmationEnabledChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!isAdmin) return; // Prevent changes if not admin
      setSettings((prev) => ({
        ...prev,
        deleteConfirmation: { ...prev.deleteConfirmation, enabled: checked },
      }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [isAdmin],
  );

  const handleDeleteConfirmationOnlyWithChildrenChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!isAdmin) return; // Prevent changes if not admin
      setSettings((prev) => ({
        ...prev,
        deleteConfirmation: { ...prev.deleteConfirmation, onlyForItemsWithChildren: checked },
      }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [isAdmin],
  );

  const handleDeleteConfirmationVisualCuesChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!isAdmin) return; // Prevent changes if not admin
      setSettings((prev) => ({
        ...prev,
        deleteConfirmation: { ...prev.deleteConfirmation, showVisualCues: checked },
      }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [isAdmin],
  );

  const handleSave = useCallback(async () => {
    if (!isAdmin) return; // Prevent save if not admin

    setIsSaving(true);
    setError(null);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    setSaveStatus({ message: null, type: null });

    try {
      await settingsService.saveSettings(settings);
      setSaveStatus({ type: Statuses.Success, message: 'Settings saved successfully!' });
      statusTimerRef.current = setTimeout(() => {
        setSaveStatus({ type: null, message: null });
      }, 3000);
    } catch (err) {
      settingsPanelLogger.error('Failed to save settings:', err);
      setSaveStatus({ message: 'Save failed.', type: Statuses.Failed });
    } finally {
      setIsSaving(false);
    }
  }, [settings, isAdmin]);

  const initialSettingsLoaded =
    settings && Object.prototype.hasOwnProperty.call(settings, 'addCommentsToWorkItems');

  // Create header actions for the save button and status
  const headerActions = (
    <div className="flex-row flex-center">
      {saveStatus.type && saveStatus.message && (
        <div className="flex-row flex-wrap margin-right-8 padding-6">
          <Status
            {...saveStatus.type}
            text={saveStatus.message}
            size={StatusSize.l}
            className="success-status"
          />
        </div>
      )}
      <div className="flex-row flex-center">
        {isSaving && (
          <div className="margin-left-8">
            <Spinner size={SpinnerSize.small} className="margin-right-8" />
          </div>
        )}
        <Button
          primary
          text="Save Settings"
          onClick={handleSave}
          disabled={isSaving || isLoading || !isAdmin}
          iconProps={{ iconName: 'Save' }}
          tooltipProps={
            !isAdmin ? { text: 'Only project administrators can save settings' } : undefined
          }
        />
      </div>
    </div>
  );
  return (
    <BaseSettingsPage
      title="Work Item Decomposer"
      isLoading={isLoading && !initialSettingsLoaded}
      loadingLabel="Loading settings..."
      error={error}
      className="settings-container"
      headerActions={headerActions}
      checkPermissions
      onPermissionCheck={handlePermissionCheck}
      showPermissionMessage
    >
      {isLoading && !initialSettingsLoaded && (
        <Spinner label="Loading settings..." size={SpinnerSize.large} />
      )}
      {!isLoading && !error && settings && (
        <>
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
                    disabled={!isAdmin}
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
                      disabled={!settings.addCommentsToWorkItems || !isAdmin}
                      inputClassName={
                        settings.addCommentsToWorkItems && isAdmin
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
                    disabled={!isAdmin}
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
                        disabled={!isAdmin}
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
                        disabled={!isAdmin}
                      />
                    </div>
                  </FormItem>
                </div>
              )}
            </div>
          </Card>

          {/* WIT Settings Section */}
          <WitSettingsSection isAdmin={isAdmin} />
        </>
      )}
    </BaseSettingsPage>
  );
}
