import SDK from 'azure-devops-extension-sdk';
import { logger } from '../core/common/logger';

const navigationLogger = logger.createChild('Navigation');

/**
 * Opens the extension settings page in a new browser tab.
 * @param onError Optional callback for handling errors.
 * @returns Promise that resolves when the settings page is opened.
 */
export async function openSettingsPage(onError?: (_error: string) => void): Promise<void> {
  try {
    await SDK.init({ loaded: false });
    await SDK.ready();

    const extensionContext = SDK.getExtensionContext();
    const webContext = SDK.getWebContext();
    const host = SDK.getHost();

    const hubId = `${extensionContext.id}.settings-hub`;

    let organizationUri = '';

    if (host && host.name) {
      organizationUri = `https://dev.azure.com/${host.name}`;
    } else {
      navigationLogger.warn(
        'Could not reliably determine organization URI from any available source.',
      );
    }

    if (!webContext.project || !webContext.project.name) {
      const errorMessage = 'Project name is not available in webContext.';
      navigationLogger.error(errorMessage);
      if (onError) {
        onError('Could not determine project context to open settings.');
      }
      return;
    }
    const settingsUrl = `${organizationUri}/${webContext.project.name}/_settings/${hubId}`;
    navigationLogger.debug('Opening settings URL:', settingsUrl);
    window.open(settingsUrl, '_blank');
  } catch (error) {
    navigationLogger.error('Error opening settings page:', error);
    if (onError) {
      onError('Failed to open settings page. See console for details.');
    }
  }
}
