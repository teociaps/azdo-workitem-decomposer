import SDK, { IUserContext } from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService } from 'azure-devops-extension-api';
import { GraphRestClient } from 'azure-devops-extension-api/Graph';
import { getClient } from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';
import { AdminPermissionResult, UserEntitlement } from '../core/models/userModels';

const permissionLogger = logger.createChild('PermissionService');

/**
 * Permission service implementing comprehensive admin permission checking.
 * Uses API-first approach with hardcoded fallbacks for maximum compatibility.
 */
export class PermissionService {
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000;

  private static readonly PROJECT_ADMIN_GROUPS = [
    'Project Administrators',
    'Project Administrator',
    '[PROJECT]\\Project Administrators',
    'Administrators',
  ];

  private static readonly ORGANIZATION_ADMIN_GROUPS = [
    'Project Collection Administrators',
    '[TEAM FOUNDATION]\\Project Collection Administrators',
    'Collection Administrators',
    'Organization Administrators',
  ];

  private static adminCache: { value: AdminPermissionResult; timestamp: number } | null = null;

  /**
   * Check if the current user has admin permissions.
   */
  public static async isProjectAdmin(): Promise<boolean> {
    const result = await this.getAdminPermissions();
    return result.isAdmin;
  }

  /**
   * Get comprehensive admin permission information.
   */
  public static async getAdminPermissions(): Promise<AdminPermissionResult> {
    if (this.adminCache && this.isCacheValid(this.adminCache.timestamp)) {
      permissionLogger.debug('Returning cached admin permission result');
      return this.adminCache.value;
    }

    const startTime = Date.now();

    try {
      await SDK.ready();

      const [user, project] = await Promise.all([this.getCurrentUser(), this.getCurrentProject()]);

      if (!user || !project) {
        return this.cacheResult({
          isAdmin: false,
          source: 'none',
          details: { method: 'no-context' },
        });
      }

      // Execute permission check following the specified flow
      const result = await this.executePermissionFlow(user, project.id);

      const duration = Date.now() - startTime;
      permissionLogger.info(
        `Permission check completed in ${duration}ms: ${result.isAdmin} (${result.source})`,
      );

      return this.cacheResult(result);
    } catch (error) {
      permissionLogger.error('Error checking admin permissions:', error);
      return this.cacheResult({
        isAdmin: false,
        source: 'none',
        details: { method: 'error' },
      });
    }
  }

  /**
   * Check if user can edit settings (admin or explicitly granted).
   */
  public static async canEditSettings(allowedUsers: string[] = []): Promise<boolean> {
    try {
      const isAdmin = await this.isProjectAdmin();
      if (isAdmin) return true;

      const user = await this.getCurrentUser();
      return user ? allowedUsers.includes(user.id) : false;
    } catch (error) {
      permissionLogger.error('Error checking edit permissions:', error);
      return false;
    }
  }

  /**
   * Clear all cached data.
   */
  public static clearCache(): void {
    this.adminCache = null;
    permissionLogger.debug('Permission cache cleared');
  }

  // Private helper methods

  private static async getCurrentUser(): Promise<IUserContext | null> {
    try {
      const user = SDK.getUser();
      if (!user?.id) {
        permissionLogger.warn('No valid user context available');
        return null;
      }
      return user;
    } catch (error) {
      permissionLogger.error('Error getting current user:', error);
      return null;
    }
  }

  private static async getCurrentProject(): Promise<{ id: string; name: string } | null> {
    try {
      const projectService = await SDK.getService<IProjectPageService>(
        CommonServiceIds.ProjectPageService,
      );
      const project = await projectService.getProject();

      if (!project?.id) {
        permissionLogger.warn('No valid project context available');
        return null;
      }

      return { id: project.id, name: project.name };
    } catch (error) {
      permissionLogger.error('Error getting current project:', error);
      return null;
    }
  }

  /**
   * Permission flow:
   * 1. Check project admin perms (Member Entitlement Management API)
   * 2. Check project admin perms (hardcoded groups via Graph API)
   * 3. Check organization admin perms (API - skipped, no reliable method)
   * 4. Check organization admin perms (hardcoded groups via Graph API)
   */
  private static async executePermissionFlow(
    user: IUserContext,
    projectId: string,
  ): Promise<AdminPermissionResult> {
    // Step 1: Check project admin permissions using APIs
    const projectApiResult = await this.checkProjectAdminPermissionsApi(user, projectId);
    if (projectApiResult.isAdmin) {
      permissionLogger.debug('✅ User has project admin permissions via API');
      return projectApiResult;
    }

    // Step 2: Check project admin permissions using hardcoded groups
    const projectHardcodedResult = await this.checkProjectAdminPermissionsHardcoded(
      user,
      projectId,
    );
    if (projectHardcodedResult.isAdmin) {
      permissionLogger.debug('✅ User has project admin permissions via hardcoded groups');
      return projectHardcodedResult;
    }

    // Step 3: Skip organization admin API check (no reliable method available)
    const orgApiResult = await this.checkOrganizationAdminPermissionsApi(user);
    if (orgApiResult.isAdmin) {
      permissionLogger.debug('✅ User has organization admin permissions via API');
      return orgApiResult;
    }

    // Step 4: Check organization admin permissions using hardcoded groups
    const orgHardcodedResult = await this.checkOrganizationAdminPermissionsHardcoded(user);
    if (orgHardcodedResult.isAdmin) {
      permissionLogger.debug('✅ User has organization admin permissions via hardcoded groups');
      return orgHardcodedResult;
    }

    // No admin permissions found
    permissionLogger.debug('❌ No admin permissions found through any method');
    return {
      isAdmin: false,
      source: 'none',
      details: { method: 'no-admin-permissions' },
    };
  }

  /**
   * Check project admin permissions using Member Entitlement Management API.
   */
  private static async checkProjectAdminPermissionsApi(
    user: IUserContext,
    projectId: string,
  ): Promise<AdminPermissionResult> {
    try {
      const organization = SDK.getHost().name;
      const accessToken = await SDK.getAccessToken();

      if (!organization || !accessToken) {
        throw new Error('Missing organization or access token');
      }

      // Use Search User Entitlements API as per Microsoft documentation
      const searchUrl = `https://vsaex.dev.azure.com/${organization}/_apis/userentitlements`;

      const response = await fetch(`${searchUrl}?$filter=name eq '${user.name}'&select=Projects`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        permissionLogger.debug(`Search User Entitlements API failed: ${response.status}`);
        return { isAdmin: false, source: 'none', details: { method: 'entitlements-api-failed' } };
      }

      const result = await response.json();
      permissionLogger.debug('Search User Entitlements API succeeded:', result);
      const userEntitlement: UserEntitlement | null = result.items?.[0];

      if (!userEntitlement) {
        return { isAdmin: false, source: 'none', details: { method: 'no-user-entitlement' } };
      }

      // Check project entitlements for ProjectAdministrator GroupType
      if (userEntitlement.projectEntitlements) {
        for (const projectEntitlement of userEntitlement.projectEntitlements) {
          if (
            projectEntitlement.projectRef?.id === projectId &&
            projectEntitlement.group?.groupType === 'projectAdministrator'
          ) {
            permissionLogger.debug('✅ User has ProjectAdministrator GroupType for project', {
              userId: user.id,
              projectId,
              groupType: projectEntitlement.group.groupType,
              groupDisplayName: projectEntitlement.group.displayName,
            });

            return {
              isAdmin: true,
              source: 'project',
              details: {
                method: 'project-entitlements-api',
                groupName: projectEntitlement.group.displayName,
                groupType: 'projectAdministrator',
              },
            };
          }
        }
      }

      // Check group assignments for ProjectAdministrator GroupType
      if (userEntitlement.groupAssignments) {
        for (const groupAssignment of userEntitlement.groupAssignments) {
          if (groupAssignment.group?.groupType === 'projectAdministrator') {
            permissionLogger.debug(
              '✅ User has ProjectAdministrator GroupType in group assignments',
              {
                userId: user.id,
                groupType: groupAssignment.group.groupType,
                groupDisplayName: groupAssignment.group.displayName,
              },
            );

            return {
              isAdmin: true,
              source: 'project',
              details: {
                method: 'group-assignments-api',
                groupName: groupAssignment.group.displayName,
                groupType: 'projectAdministrator',
              },
            };
          }
        }
      }

      return { isAdmin: false, source: 'none', details: { method: 'project-api-no-admin' } };
    } catch (error) {
      permissionLogger.debug('Project admin API check failed:', error);
      return { isAdmin: false, source: 'none', details: { method: 'project-api-error' } };
    }
  }

  /**
   * Check project admin permissions using hardcoded group names and Graph API.
   */
  private static async checkProjectAdminPermissionsHardcoded(
    user: IUserContext,
    projectId: string,
  ): Promise<AdminPermissionResult> {
    try {
      const graphClient = getClient(GraphRestClient);

      // Get project scope descriptor
      const scopeDescriptor = await this.getProjectScopeDescriptor(graphClient, projectId);
      if (!scopeDescriptor) {
        permissionLogger.debug('Could not get project scope descriptor');
        return { isAdmin: false, source: 'none', details: { method: 'no-project-scope' } };
      }

      // Check each project admin group
      for (const adminGroupName of this.PROJECT_ADMIN_GROUPS) {
        try {
          const groups = await graphClient.querySubjects({
            query: adminGroupName,
            subjectKind: ['Group'],
            scopeDescriptor,
          });

          if (groups && groups.length > 0) {
            for (const group of groups) {
              if (group.displayName === adminGroupName) {
                const isMember = await this.checkGroupMembership(
                  graphClient,
                  group.descriptor,
                  user,
                );

                if (isMember) {
                  permissionLogger.debug('✅ User is member of project admin group', {
                    userId: user.id,
                    projectId,
                    groupName: group.displayName,
                    groupDescriptor: group.descriptor,
                  });

                  return {
                    isAdmin: true,
                    source: 'project',
                    details: {
                      method: 'project-hardcoded-groups',
                      groupName: group.displayName,
                    },
                  };
                }
              }
            }
          }
        } catch (groupError) {
          permissionLogger.debug(
            `Failed to check project admin group "${adminGroupName}":`,
            groupError,
          );
        }
      }

      return { isAdmin: false, source: 'none', details: { method: 'project-hardcoded-no-admin' } };
    } catch (error) {
      permissionLogger.debug('Project admin hardcoded check failed:', error);
      return { isAdmin: false, source: 'none', details: { method: 'project-hardcoded-error' } };
    }
  }

  /**
   * Organization admin API check (intentional no-op).
   * No reliable API method exists for organization admin detection.
   */
  private static async checkOrganizationAdminPermissionsApi(
    _user: IUserContext,
  ): Promise<AdminPermissionResult> {
    permissionLogger.debug('Skipping organization admin API check');
    return {
      isAdmin: false,
      source: 'none',
      details: { method: 'org-api-skipped' },
    };
  }

  /**
   * Check organization admin permissions using hardcoded groups.
   */
  private static async checkOrganizationAdminPermissionsHardcoded(
    user: IUserContext,
  ): Promise<AdminPermissionResult> {
    try {
      const graphClient = getClient(GraphRestClient);

      // Check each organization admin group
      for (const adminGroupName of this.ORGANIZATION_ADMIN_GROUPS) {
        try {
          const groups = await graphClient.querySubjects({
            query: adminGroupName,
            subjectKind: ['Group'],
            scopeDescriptor: '',
          });

          if (groups && groups.length > 0) {
            for (const group of groups) {
              if (group.displayName === adminGroupName) {
                const isMember = await this.checkGroupMembership(
                  graphClient,
                  group.descriptor,
                  user,
                );

                if (isMember) {
                  permissionLogger.debug('✅ User is member of organization admin group', {
                    userId: user.id,
                    groupName: group.displayName,
                    groupDescriptor: group.descriptor,
                  });

                  return {
                    isAdmin: true,
                    source: 'organization',
                    details: {
                      method: 'organization-hardcoded-groups',
                      groupName: group.displayName,
                    },
                  };
                }
              }
            }
          }
        } catch (groupError) {
          permissionLogger.debug(
            `Failed to check organization admin group "${adminGroupName}":`,
            groupError,
          );
        }
      }

      return { isAdmin: false, source: 'none', details: { method: 'org-hardcoded-no-admin' } };
    } catch (error) {
      permissionLogger.debug('Organization admin hardcoded check failed:', error);
      return { isAdmin: false, source: 'none', details: { method: 'org-hardcoded-error' } };
    }
  }

  /**
   * Get project scope descriptor using Graph API.
   */
  private static async getProjectScopeDescriptor(
    graphClient: GraphRestClient,
    projectId: string,
  ): Promise<string | null> {
    try {
      const result = await graphClient.getDescriptor(projectId);
      return result.value || null;
    } catch (error) {
      permissionLogger.debug('Failed to get project scope descriptor:', error);
      return null;
    }
  }

  /**
   * Check group membership using Graph API.
   */
  private static async checkGroupMembership(
    graphClient: GraphRestClient,
    groupDescriptor: string,
    user: IUserContext,
  ): Promise<boolean> {
    try {
      const userDescriptor = user.descriptor || user.id;
      return await graphClient.checkMembershipExistence(userDescriptor, groupDescriptor);
    } catch (error) {
      permissionLogger.debug('Group membership check failed:', error);
      return false;
    }
  }

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION_MS;
  }

  private static cacheResult(result: AdminPermissionResult): AdminPermissionResult {
    this.adminCache = { value: result, timestamp: Date.now() };
    return result;
  }
}
