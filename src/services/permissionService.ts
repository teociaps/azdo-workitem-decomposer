import SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService } from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';
import { UserEntitlement } from '../core/models/userModels';

const permissionLogger = logger.createChild('PermissionService');

/**
 * Service for checking user permissions and admin status in Azure DevOps projects.
 * Uses SDK.getUser() for user context and User Entitlements API for detailed permissions.
 */
export class PermissionService {
  private static adminPermissionCache: boolean | null = null;
  private static userEntitlementCache: UserEntitlement | null = null;

  /**
   * Check if the current user has project administrator permissions.
   * Results are cached for performance.
   */
  public static async isProjectAdmin(): Promise<boolean> {
    if (this.adminPermissionCache !== null) {
      permissionLogger.debug(`Returning cached admin permission: ${this.adminPermissionCache}`);
      return this.adminPermissionCache;
    }

    try {
      await SDK.ready();

      // Get project context
      const projectService = await SDK.getService<IProjectPageService>(
        CommonServiceIds.ProjectPageService,
      );
      const project = await projectService.getProject();

      if (!project) {
        permissionLogger.warn('No project context available');
        return this.cacheAndReturn(false);
      }

      // Get current user
      const user = SDK.getUser();
      if (!user) {
        permissionLogger.warn('Could not retrieve current user from SDK');
        return this.cacheAndReturn(false);
      }

      // Get user entitlements to check admin permissions
      const userEntitlement = await this.getUserEntitlement(user.id);
      if (!userEntitlement) {
        permissionLogger.warn('Could not retrieve user entitlements');
        return this.cacheAndReturn(false);
      }

      const isAdmin = this.checkAdminPermissions(userEntitlement, project.id);

      permissionLogger.info(`User ${user.displayName} admin status: ${isAdmin}`);
      return this.cacheAndReturn(isAdmin);
    } catch (error) {
      permissionLogger.error('Error checking admin permissions:', error);
      return this.cacheAndReturn(false);
    }
  }

  // Private methods

  private static cacheAndReturn(isAdmin: boolean): boolean {
    this.adminPermissionCache = isAdmin;
    return isAdmin;
  }

  private static async getUserEntitlement(userId: string): Promise<UserEntitlement | null> {
    if (this.userEntitlementCache?.id === userId) {
      permissionLogger.debug('Returning cached user entitlement');
      return this.userEntitlementCache;
    }

    try {
      const host = SDK.getHost();
      const organization = host.name;
      const accessToken = await SDK.getAccessToken();

      if (!organization) {
        throw new Error('Organization name not available');
      }

      const apiUrl = `https://vsaex.dev.azure.com/${organization}/_apis/userentitlements/${userId}?api-version=7.2-preview.5`;

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const entitlement = (await response.json()) as UserEntitlement;
      this.userEntitlementCache = entitlement;

      permissionLogger.debug('Retrieved user entitlement:', {
        userId,
        origin: entitlement.user.origin,
        accessLevel: entitlement.accessLevel.accountLicenseType,
        projectEntitlements: entitlement.projectEntitlements?.length || 0,
      });

      return entitlement;
    } catch (error) {
      permissionLogger.error('Failed to retrieve user entitlement:', error);
      return null;
    }
  }

  private static checkAdminPermissions(
    userEntitlement: UserEntitlement,
    projectId: string,
  ): boolean {
    // Check if user has project administrator role in the current project
    const hasProjectAdminRole = userEntitlement.projectEntitlements?.some(
      (entitlement) =>
        entitlement.projectRef.id === projectId &&
        entitlement.group.groupType === 'projectAdministrator',
    );

    if (hasProjectAdminRole) {
      permissionLogger.debug('User has projectAdministrator role in current project');
      return true;
    }

    permissionLogger.debug('User does not have project administrator permissions');
    return false;
  }
}
