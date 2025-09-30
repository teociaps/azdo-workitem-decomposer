import SDK from 'azure-devops-extension-sdk';
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';
import {
  IWitSettings,
  IAreaBasedWitSettings,
  DEFAULT_AREA_BASED_WIT_SETTINGS,
} from '../core/models/witSettings';
import { findBestMatchingAreaPath } from './areaPathService';

const settingsLogger = logger.createChild('Settings');

export interface DecomposerSettings {
  addCommentsToWorkItems: boolean;
  commentText: string;
  deleteConfirmation: {
    enabled: boolean;
    onlyForItemsWithChildren: boolean;
    showVisualCues: boolean;
  };
  userPermissions: {
    allowedUsers: string[]; // Array of user entity IDs who can edit settings
  };
  witSettings: IAreaBasedWitSettings;
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
  userPermissions: {
    allowedUsers: [], // Initially empty - only admins can edit
  },
  witSettings: DEFAULT_AREA_BASED_WIT_SETTINGS,
};

export const SETTINGS_KEY = 'decomposer-settings-v1'; // Versioned to avoid conflicts with old settings if any

/**
 * Deep merge function that properly handles merging saved settings with defaults.
 * Saved settings take priority, but missing properties are filled from defaults.
 */
function deepMergeSettings(
  defaults: DecomposerSettings,
  saved: Partial<DecomposerSettings>,
): DecomposerSettings {
  const result: DecomposerSettings = { ...defaults };

  // Handle top-level primitive properties
  if (saved.addCommentsToWorkItems !== undefined) {
    result.addCommentsToWorkItems = saved.addCommentsToWorkItems;
  }
  if (saved.commentText !== undefined) {
    result.commentText = saved.commentText;
  }

  // Handle nested objects - merge them properly
  if (saved.deleteConfirmation) {
    result.deleteConfirmation = { ...result.deleteConfirmation, ...saved.deleteConfirmation };
  }
  if (saved.userPermissions) {
    result.userPermissions = { ...result.userPermissions, ...saved.userPermissions };
  }

  // Handle witSettings migration from old format to new area-based format
  if (saved.witSettings) {
    // Check if this is the old format (direct IWitSettings) or new format (IAreaBasedWitSettings)
    if (isOldWitSettingsFormat(saved.witSettings)) {
      // Migrate old format to new format
      settingsLogger.debug('Migrating old WIT settings format to area-based format');
      result.witSettings = {
        default: saved.witSettings as unknown as IWitSettings,
        byAreaPath: {},
      };
    } else {
      // New format - merge properly
      const areaBasedSettings = saved.witSettings as IAreaBasedWitSettings;
      result.witSettings = {
        default: { ...result.witSettings.default, ...areaBasedSettings.default },
        byAreaPath: { ...areaBasedSettings.byAreaPath },
      };
    }
  }

  return result;
}

/**
 * Checks if the witSettings is in the old format (direct IWitSettings)
 */
function isOldWitSettingsFormat(witSettings: IWitSettings | IAreaBasedWitSettings): boolean {
  // Old format has 'tags' and 'assignments' directly
  // New format has 'default' and 'byAreaPath'
  return (
    (witSettings as IWitSettings).tags !== undefined ||
    (witSettings as IWitSettings).assignments !== undefined
  );
}

/**
 * Gets the appropriate WIT settings for a given area path
 * @param settings The decomposer settings
 * @param workItemAreaPath The area path of the work item
 * @returns The appropriate IWitSettings to use
 */
export function getWitSettingsForAreaPath(
  settings: DecomposerSettings,
  workItemAreaPath: string | null,
): IWitSettings {
  if (!workItemAreaPath || Object.keys(settings.witSettings.byAreaPath).length === 0) {
    return settings.witSettings.default;
  }

  const availableAreaPaths = Object.keys(settings.witSettings.byAreaPath);
  const matchingAreaPath = findBestMatchingAreaPath(workItemAreaPath, availableAreaPaths);

  if (matchingAreaPath) {
    return settings.witSettings.byAreaPath[matchingAreaPath];
  }

  return settings.witSettings.default;
}

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
      });

      // Use deep merge to properly handle nested objects when merging with defaults
      const mergedSettings = deepMergeSettings(DEFAULT_SETTINGS, settings || {});

      return mergedSettings;
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
