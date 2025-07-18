import SDK, { IUserContext } from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService } from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';
import { GraphGroup } from '../core/models/userModels';

const permissionLogger = logger.createChild('PermissionService');

/**
 * Service for checking user permissions and admin status in Azure DevOps projects.
 * Uses the Graph API for reliable permission checking with intelligent caching.
 */
export class PermissionService {
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly PROJECT_ADMIN_GROUP_NAME = 'Project Administrators';

  private static adminPermissionCache: { value: boolean; timestamp: number } | null = null;
  private static projectScopeDescriptorCache: Map<string, { value: string; timestamp: number }> =
    new Map();
  private static projectGroupsCache: Map<string, { value: GraphGroup[]; timestamp: number }> =
    new Map();

  /**
   * Check if the current user has project administrator permissions.
   */
  public static async isProjectAdmin(): Promise<boolean> {
    // Check cache validity and clear if expired
    if (this.adminPermissionCache) {
      if (this.isCacheValid(this.adminPermissionCache.timestamp)) {
        permissionLogger.debug(
          `Returning cached admin permission: ${this.adminPermissionCache.value}`,
        );
        return this.adminPermissionCache.value;
      } else {
        // Clear expired cache
        this.clearCache();
      }
    }

    const startTime = Date.now();

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

      // Enhanced user logging for debugging
      permissionLogger.debug('Current user information:', {
        userId: user.id,
        userDescriptor: user.descriptor,
        userDisplayName: user.displayName,
        userName: user.name,
        userImageUrl: user.imageUrl,
        projectId: project.id,
        projectName: project.name,
      });

      // Execute permission check
      const isAdmin = await this.checkProjectAdminMembership(user.id, project.id);

      const duration = Date.now() - startTime;
      permissionLogger.info(
        `Permission check completed in ${duration}ms: User ${user.displayName} admin status: ${isAdmin}`,
      );

      return this.cacheAndReturn(isAdmin);
    } catch (error) {
      const duration = Date.now() - startTime;
      permissionLogger.error(`Error checking admin permissions after ${duration}ms:`, error);
      return this.cacheAndReturn(false);
    }
  }

  /**
   * Check if the current user can edit settings (either admin or granted permission).
   */
  public static async canEditSettings(allowedUsers: string[] = []): Promise<boolean> {
    try {
      // First check if user is admin (fastest path)
      const isAdmin = await this.isProjectAdmin();
      if (isAdmin) {
        permissionLogger.debug('User has admin permissions, can edit settings');
        return true;
      }

      // If not admin, check if user is in allowed users list
      const user = SDK.getUser();
      if (!user) {
        permissionLogger.warn('Could not retrieve current user from SDK');
        return false;
      }

      const canEdit = allowedUsers.includes(user.id);
      permissionLogger.debug(
        `Settings edit permission check: User ${user.displayName} can edit: ${canEdit}`,
        {
          userId: user.id,
          isAdmin,
          inAllowedList: allowedUsers.includes(user.id),
          allowedUsersCount: allowedUsers.length,
        },
      );

      return canEdit;
    } catch (error) {
      permissionLogger.error('Error checking edit permissions:', error);
      return false;
    }
  }

  /**
   * Clear all cached permission data.
   */
  public static clearCache(): void {
    this.adminPermissionCache = null;
    this.projectScopeDescriptorCache.clear();
    this.projectGroupsCache.clear();
    permissionLogger.debug('Permission cache cleared');
  }

  /**
   * Get cache statistics for monitoring and debugging.
   */
  public static getCacheStats(): {
    adminCacheValid: boolean;
    scopeDescriptorCacheSize: number;
    projectGroupsCacheSize: number;
    cacheAgeMs: number | null;
  } {
    const adminCacheValid =
      this.adminPermissionCache !== null && this.isCacheValid(this.adminPermissionCache.timestamp);
    const cacheAgeMs = this.adminPermissionCache
      ? Date.now() - this.adminPermissionCache.timestamp
      : null;

    return {
      adminCacheValid,
      scopeDescriptorCacheSize: this.projectScopeDescriptorCache.size,
      projectGroupsCacheSize: this.projectGroupsCache.size,
      cacheAgeMs,
    };
  }

  // Private utility methods

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION_MS;
  }

  private static cacheAndReturn(isAdmin: boolean): boolean {
    this.adminPermissionCache = {
      value: isAdmin,
      timestamp: Date.now(),
    };
    return isAdmin;
  }

  /**
   * Execute the complete project administrator membership check.
   */
  private static async checkProjectAdminMembership(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    try {
      // Get the current user object for detailed comparison
      const user = SDK.getUser();
      if (!user) {
        permissionLogger.warn(
          'Could not retrieve current user from SDK in checkProjectAdminMembership',
        );
        return false;
      }

      // Step 1: Get Project ID (already have this)
      permissionLogger.debug('Step 1: Using project ID', { projectId });

      // Step 2: Get Project's scope descriptor value
      const scopeDescriptor = await this.getProjectScopeDescriptor(projectId);
      if (!scopeDescriptor) {
        permissionLogger.warn('Could not get project scope descriptor');
        return false;
      }

      // Step 3: Get Project's groups using the scope descriptor
      const projectGroups = await this.getProjectGroups(projectId, scopeDescriptor);
      if (projectGroups.length === 0) {
        permissionLogger.warn('No project groups found');
        return false;
      }

      // Step 4: Find Project Administrator group and check membership
      const adminGroup = projectGroups.find(
        (group) => group.displayName === this.PROJECT_ADMIN_GROUP_NAME,
      );

      if (!adminGroup) {
        permissionLogger.warn('Project Administrators group not found', {
          projectId,
          availableGroups: projectGroups.map((g) => g.displayName),
          searchedFor: this.PROJECT_ADMIN_GROUP_NAME,
        });
        return false;
      }

      // Check if user is member of the Project Administrator group
      const isAdmin = await this.checkGroupMembership(adminGroup.descriptor, user);

      permissionLogger.debug(
        isAdmin ? '✅ User is Project Administrator' : 'User is not Project Administrator',
        {
          userId,
          projectId,
          groupName: adminGroup.displayName,
          groupDescriptor: adminGroup.descriptor,
          userDescriptor: user.descriptor,
        },
      );

      return isAdmin;
    } catch (error) {
      permissionLogger.error('Error checking project admin membership:', error);
      return false;
    }
  }

  private static async getProjectScopeDescriptor(projectId: string): Promise<string | null> {
    // Check cache validity and clear if expired
    const cached = this.projectScopeDescriptorCache.get(projectId);
    if (cached) {
      if (this.isCacheValid(cached.timestamp)) {
        permissionLogger.debug('Returning cached scope descriptor', {
          projectId,
          scopeDescriptor: cached.value,
          cacheAge: Date.now() - cached.timestamp,
        });
        return cached.value;
      } else {
        // Clear expired cache entry
        this.projectScopeDescriptorCache.delete(projectId);
      }
    }

    try {
      const host = SDK.getHost();
      const organization = host.name;
      const accessToken = await SDK.getAccessToken();

      if (!organization) {
        throw new Error('Organization name not available from SDK host');
      }

      const apiUrl = `https://vssps.dev.azure.com/${organization}/_apis/graph/descriptors/${projectId}`;

      permissionLogger.debug('Fetching project scope descriptor', { projectId, apiUrl });

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const scopeDescriptor = result.value;

      if (!scopeDescriptor) {
        permissionLogger.warn('No scope descriptor found in API response', { projectId });
        return null;
      }

      // Cache the result with timestamp
      this.projectScopeDescriptorCache.set(projectId, {
        value: scopeDescriptor,
        timestamp: Date.now(),
      });

      permissionLogger.debug('Retrieved and cached project scope descriptor', {
        projectId,
        scopeDescriptor,
      });
      return scopeDescriptor;
    } catch (error) {
      permissionLogger.error('Failed to retrieve project scope descriptor:', error);
      return null;
    }
  }

  private static async getProjectGroups(
    projectId: string,
    scopeDescriptor: string,
  ): Promise<GraphGroup[]> {
    // Check cache validity
    const cached = this.projectGroupsCache.get(projectId);
    if (cached && this.isCacheValid(cached.timestamp)) {
      permissionLogger.debug('✅ Returning cached project groups', {
        projectId,
        groupCount: cached.value.length,
        cacheAge: Date.now() - cached.timestamp,
      });
      return cached.value;
    }

    try {
      const host = SDK.getHost();
      const organization = host.name;
      const accessToken = await SDK.getAccessToken();

      if (!organization) {
        throw new Error('Organization name not available from SDK host');
      }

      const apiUrl = `https://vssps.dev.azure.com/${organization}/_apis/graph/groups?scopeDescriptor=${scopeDescriptor}`;

      permissionLogger.debug('🔍 Fetching project groups', { projectId, scopeDescriptor, apiUrl });

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const groups = (result.value || []) as GraphGroup[];

      // Cache the result with timestamp
      this.projectGroupsCache.set(projectId, {
        value: groups,
        timestamp: Date.now(),
      });

      permissionLogger.debug('✅ Retrieved and cached project groups', {
        projectId,
        scopeDescriptor,
        totalGroups: groups.length,
        groups: groups.map((g) => ({
          displayName: g.displayName,
          principalName: g.principalName,
          descriptor: g.descriptor,
          origin: g.origin,
        })),
      });

      return groups;
    } catch (error) {
      permissionLogger.error('❌ Failed to retrieve project groups:', error);
      return [];
    }
  }

  private static async checkGroupMembership(
    groupDescriptor: string,
    user: IUserContext,
  ): Promise<boolean> {
    try {
      const host = SDK.getHost();
      const organization = host.name;
      const accessToken = await SDK.getAccessToken();

      if (!organization) {
        throw new Error('Organization name not available from SDK host');
      }

      // Use user descriptor if available, otherwise fallback to user ID
      // The descriptor is more reliable for Graph API calls
      const userDescriptor = user.descriptor || user.id;

      if (!userDescriptor) {
        throw new Error('Neither user descriptor nor user ID available');
      }

      // Use Graph API to check membership existence with HEAD request
      const apiUrl = `https://vssps.dev.azure.com/${organization}/_apis/graph/memberships/${userDescriptor}/${groupDescriptor}`;

      permissionLogger.debug('🔍 Checking group membership via Graph API', {
        groupDescriptor,
        userDescriptor,
        userId: user.id,
        userDisplayName: user.displayName,
        apiUrl,
      });

      const response = await fetch(apiUrl, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      // Graph API returns 200 if membership exists, 404 if it doesn't
      const isMember = response.status === 200;

      if (response.status === 404) {
        permissionLogger.debug('ℹ️ User is not a member of the group (404 Not Found)', {
          groupDescriptor,
          userDescriptor,
          userId: user.id,
          status: response.status,
        });
        return false;
      }

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      permissionLogger.debug('✅ Group membership check completed', {
        groupDescriptor,
        userDescriptor,
        userId: user.id,
        userDisplayName: user.displayName,
        isMember,
        status: response.status,
        statusText: response.statusText,
      });

      return isMember;
    } catch (error) {
      permissionLogger.error('❌ Error checking group membership:', error);
      return false;
    }
  }
}
