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
import './SettingsPanel.scss';
import { Tab, TabBar } from 'azure-devops-ui/Tabs';
import { BaseSettingsPage } from './BaseSettingsPage';

export function SettingsPanel() {
  const [settings, setSettings] = useState<DecomposerSettings>(() => ({
    ...DEFAULT_SETTINGS,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    message: string | null;
    type: IStatusProps | null;
  }>({ message: null, type: null });
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [commentTabId, setCommentTabId] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        await SDK.ready();
        const currentSettings = await settingsService.getSettings();
        setSettings(currentSettings);
        setError(null);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    SDK.init({ loaded: false });
    fetchSettings()
      .then(() => {
        SDK.notifyLoadSucceeded();
      })
      .catch((err) => {
        SDK.notifyLoadFailed('SettingsPanel load failed');
        console.error('SettingsPanel load failed', err);
      });

    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const handleToggleChange = useCallback(
    (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, checked: boolean) => {
      setSettings((prev) => ({ ...prev, addCommentsToWorkItems: checked }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [],
  );

  const handleCommentTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
      setSettings((prev) => ({ ...prev, commentText: newValue }));
      setError(null);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setSaveStatus({ message: null, type: null });
    },
    [],
  );

  const handleSave = useCallback(async () => {
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
      console.error('Failed to save settings:', err);
      setSaveStatus({ message: 'Save failed.', type: Statuses.Failed });
    } finally {
      setIsSaving(false);
    }
  }, [settings]);
  const initialSettingsLoaded = settings && settings.hasOwnProperty('addCommentsToWorkItems');

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
          disabled={isSaving || isLoading}
          iconProps={{ iconName: 'Save' }}
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
    >
      {' '}
      {isLoading && !initialSettingsLoaded && (
        <Spinner label="Loading settings..." size={SpinnerSize.large} />
      )}
      {!isLoading && !error && settings && (
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
                    disabled={!settings.addCommentsToWorkItems}
                    inputClassName={
                      settings.addCommentsToWorkItems ? 'settings-resizable-textfield' : ''
                    }
                    aria-label="Comment text for new work items"
                  />
                ) : (
                  <div className="settings-html-preview">
                    <div
                      className="settings-html-preview-content"
                      dangerouslySetInnerHTML={{
                        __html:
                          settings.commentText ||
                          '<span class="secondary-text">Nothing to preview</span>',
                      }}
                    />
                  </div>
                )}
              </div>
            </FormItem>
          </div>
        </Card>
      )}
    </BaseSettingsPage>
  );
}
