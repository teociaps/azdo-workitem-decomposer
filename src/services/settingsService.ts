import SDK from 'azure-devops-extension-sdk';
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';

const settingsLogger = logger.createChild('Settings');

export interface DecomposerSettings {
  addCommentsToWorkItems: boolean;
  commentText: string;
  deleteConfirmation: {
    enabled: boolean;
    onlyForItemsWithChildren: boolean;
    showVisualCues: boolean;
  };
}

export const DEFAULT_SETTINGS: DecomposerSettings = {
  addCommentsToWorkItems: true,
  commentText:
    '<i>Created automatically via <strong><a href="https://marketplace.visualstudio.com/items?itemName=teociaps.work-item-decomposer" target="_blank">Work Item Decomposer Extension</a></strong> as part of a hierarchy breakdown.</i>',
  deleteConfirmation: {
    enabled: true,
    onlyForItemsWithChildren: false,
    showVisualCues: true,
  },
};

export const SETTINGS_KEY = 'decomposer-settings-v1'; // Versioned to avoid conflicts with old settings if any

class SettingsService {
  private dataManagerPromise: Promise<IExtensionDataManager> | undefined;

  private async getDataManager(): Promise<IExtensionDataManager> {
    if (!this.dataManagerPromise) {
      await SDK.init({ loaded: false });
      await SDK.ready();
      const accessToken = await SDK.getAccessToken();
      this.dataManagerPromise = SDK.getService<IExtensionDataService>(
        CommonServiceIds.ExtensionDataService,
      ).then((dataService) =>
        dataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken),
      );
    }
    return this.dataManagerPromise;
  }

  public async getSettings(): Promise<DecomposerSettings> {
    try {
      const dataManager = await this.getDataManager();
      const settings = await dataManager.getValue<DecomposerSettings>(SETTINGS_KEY, {
        scopeType: 'Default',
      }); // Merge with defaults to ensure all keys are present if settings were saved with an older version
      return { ...DEFAULT_SETTINGS, ...(settings || {}) };
    } catch (error) {
      settingsLogger.error('Failed to get settings, returning default settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  public async saveSettings(settings: DecomposerSettings): Promise<DecomposerSettings> {
    try {
      const dataManager = await this.getDataManager();
      await dataManager.setValue(SETTINGS_KEY, settings, { scopeType: 'Default' });
      return settings;
    } catch (error) {
      settingsLogger.error('Failed to save settings:', error);
      throw error;
    }
  }
}

const settingsService = new SettingsService();
export default settingsService;
