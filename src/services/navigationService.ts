import SDK from 'azure-devops-extension-sdk';
import { logger } from '../core/common/logger';

const navigationLogger = logger.createChild('Navigation');

/**
 * Interface for navigation context information
 */
interface NavigationContext {
  extensionContext: unknown;
  webContext: unknown;
  host: unknown;
  organizationUri: string;
}

/**
 * Initializes the Azure DevOps SDK and retrieves context information
 * @returns Promise that resolves to navigation context
 */
async function initializeNavigationContext(): Promise<NavigationContext> {
  await SDK.init({ loaded: false });
  await SDK.ready();

  const extensionContext = SDK.getExtensionContext();
  const webContext = SDK.getWebContext();
  const host = SDK.getHost();

  let organizationUri = '';
  const hostContext = host as { name?: string };
  if (hostContext && hostContext.name) {
    organizationUri = `https://dev.azure.com/${hostContext.name}`;
  } else {
    navigationLogger.warn(
      'Could not reliably determine organization URI from any available source.',
    );
  }

  return {
    extensionContext,
    webContext,
    host,
    organizationUri,
  };
}

/**
 * Validates that the project context is available
 * @param webContext The web context from Azure DevOps
 * @param onError Optional error callback
 * @returns True if project context is valid, false otherwise
 */
function validateProjectContext(webContext: unknown, onError?: (_error: string) => void): boolean {
  const context = webContext as { project?: { name?: string } };
  if (!context.project || !context.project.name) {
    const errorMessage = 'Project name is not available in webContext.';
    navigationLogger.error(errorMessage);
    if (onError) {
      onError('Could not determine project context.');
    }
    return false;
  }
  return true;
}

/**
 * Opens a hub URL in a new browser tab
 * @param context Navigation context
 * @param hubId The hub identifier
 * @param hubName Display name for the hub (for logging)
 */
function openHubUrl(context: NavigationContext, hubId: string, hubName: string): void {
  const webContext = context.webContext as { project: { name: string } };
  const hubUrl = `${context.organizationUri}/${webContext.project.name}/_settings/${hubId}`;
  navigationLogger.debug(`Opening ${hubName} URL:`, hubUrl);
  window.open(hubUrl, '_blank');
}

/**
 * Common navigation function that handles the full flow
 * @param hubSuffix The suffix to append to the extension ID for the hub
 * @param hubName Display name for the hub (for logging and error messages)
 * @param onError Optional error callback
 */
async function navigateToHub(
  hubSuffix: string,
  hubName: string,
  onError?: (_error: string) => void,
): Promise<void> {
  try {
    const context = await initializeNavigationContext();

    if (!validateProjectContext(context.webContext, onError)) {
      return;
    }

    const extensionContext = context.extensionContext as { id: string };
    const hubId = `${extensionContext.id}.${hubSuffix}`;
    openHubUrl(context, hubId, hubName);
  } catch (error) {
    navigationLogger.error(`Error opening ${hubName.toLowerCase()}:`, error);
    if (onError) {
      onError(`Failed to open ${hubName.toLowerCase()}. See console for details.`);
    }
  }
}

/**
 * Opens the extension settings page in a new browser tab.
 * @param onError Optional callback for handling errors.
 * @returns Promise that resolves when the settings page is opened.
 */
export async function openSettingsPage(onError?: (_error: string) => void): Promise<void> {
  return navigateToHub('settings-hub', 'Settings Page', onError);
}

/**
 * Opens the hierarchy view in a new browser tab.
 * @param onError Optional callback for handling errors.
 * @returns Promise that resolves when the hierarchy view is opened.
 */
export async function openHierarchyView(onError?: (_error: string) => void): Promise<void> {
  return navigateToHub('wit-hierarchy-viewer-hub', 'Hierarchy View', onError);
}
