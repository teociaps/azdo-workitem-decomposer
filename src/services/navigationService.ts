import SDK from 'azure-devops-extension-sdk';
import { logger } from '../core/common/logger';

const navigationLogger = logger.createChild('Navigation');

/**
 * Opens the extension settings page in a new browser tab.
 * @param onError Optional callback for handling errors.
 * @returns Promise that resolves when the settings page is opened.
 */
export async function openSettingsPage(onError?: (error: string) => void): Promise<void> {
  try {
    await SDK.init({ loaded: false });
    await SDK.ready();

    const extensionContext = SDK.getExtensionContext();
    const webContext = SDK.getWebContext() as any;
    const hubId = `${extensionContext.id}.settings-hub`;

    let organizationUri = '';

    // Try to get the organization URI from common IWebContext properties
    if (webContext.host && webContext.host.uri) {
      organizationUri = webContext.host.uri;
    } else if (webContext.collection && webContext.collection.uri) {
      // If host.uri is not available, try collection.uri and remove the collection name if present
      const collectionUri = webContext.collection.uri;
      const collectionName = webContext.collection.name;
      if (collectionName && collectionUri.endsWith('/' + collectionName)) {
        organizationUri = collectionUri.substring(
          0,
          collectionUri.lastIndexOf('/' + collectionName),
        );
      } else {
        organizationUri = collectionUri; // Use as is, or it might be the org URI already
      }
    } else {
      // Fallback: Construct from SDK.getHost().name if other properties are missing
      // This is a common pattern but might not cover all Azure DevOps configurations (e.g., on-premise)      organizationUri = `https://dev.azure.com/${SDK.getHost().name}`;
      navigationLogger.warn(
        'Could not reliably determine organization URI from webContext.host or webContext.collection. Falling back to constructed URI.',
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
