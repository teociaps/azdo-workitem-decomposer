import SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService, getClient } from 'azure-devops-extension-api';
import { CoreRestClient } from 'azure-devops-extension-api/Core';
import { IIdentity } from 'azure-devops-ui/IdentityPicker';
import { logger } from '../core/common/logger';

const userServiceLogger = logger.createChild('UserService');

/**
 * Project user information
 */
export interface ProjectUser {
  id: string;
  displayName: string;
  email: string;
  imageUrl?: string;
  uniqueName?: string;
}

/**
 * People picker provider interface for the Identity Picker component
 */
export interface IPeoplePickerProvider {
  onFilterIdentities: (_filter: string, _selectedItems?: IIdentity[]) => Promise<IIdentity[]>;
  onEmptyInputFocus: () => Promise<IIdentity[]>;
  onRequestConnectionInformation: () => Promise<{
    directReports: IIdentity[];
    successors: IIdentity[];
    managers: IIdentity[];
  }>;
  getEntityFromUniqueAttribute: (_entityId: string) => Promise<IIdentity>;
}

/**
 * Team member interface from Azure DevOps Core API
 */
interface TeamMember {
  identity?: {
    id: string;
    displayName?: string;
    uniqueName?: string;
    imageUrl?: string;
  };
}

/**
 * Service for managing project users and providing identity picker functionality.
 * Handles user discovery and identity management.
 * Permission filtering is handled by PermissionService.
 */
export class UserService {
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly USER_SEARCH_LIMIT = 10;
  private static readonly USER_PREVIEW_LIMIT = 5;

  private static projectUsersCache: ProjectUser[] | null = null;
  private static cacheTimestamp = 0;
  private static userIdentityCache = new Map<string, IIdentity>();

  /**
   * Get all project users, excluding the current user
   */
  public static async getProjectUsers(): Promise<ProjectUser[]> {
    if (this.isCacheValid()) {
      userServiceLogger.debug(
        `Returning cached project users: ${this.projectUsersCache!.length} users`,
      );
      return this.projectUsersCache!;
    }

    try {
      const context = await this.getProjectContext();
      if (!context) {
        return [];
      }

      const { project, currentUser } = context;

      const allUsers = await this.discoverUsersFromTeams(project, currentUser);

      // Filter out the current user
      const filteredUsers = allUsers.filter((user) => user.id !== currentUser.id);

      this.cacheResults(filteredUsers);
      userServiceLogger.debug(
        `Retrieved ${filteredUsers.length} project users (excluding current user)`,
      );

      return filteredUsers;
    } catch (error) {
      userServiceLogger.error('Failed to fetch project users:', error);
      return [];
    }
  }

  /**
   * Get all project users including admins and current user (for admin operations)
   */
  public static async getAllProjectUsers(): Promise<ProjectUser[]> {
    try {
      const context = await this.getProjectContext();
      if (!context) {
        return [];
      }

      const { project, currentUser } = context;
      const allUsers = await this.discoverUsersFromTeams(project, currentUser);

      userServiceLogger.debug(`Retrieved ${allUsers.length} total project users`);
      return allUsers;
    } catch (error) {
      userServiceLogger.error('Failed to fetch all project users:', error);
      return [];
    }
  }

  /**
   * Get the current user's information
   */
  public static async getCurrentUser(): Promise<ProjectUser | null> {
    try {
      await SDK.ready();

      const user = SDK.getUser();
      if (!user) {
        userServiceLogger.warn('Could not get current user from SDK');
        return null;
      }

      return {
        id: user.id,
        displayName: user.displayName || '',
        email: user.name || '',
        imageUrl: user.imageUrl,
        uniqueName: user.name,
      };
    } catch (error) {
      userServiceLogger.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Clear the project users cache
   */
  public static clearCache(): void {
    this.projectUsersCache = null;
    this.cacheTimestamp = 0;
    this.userIdentityCache.clear();
  }

  /**
   * Create a people picker provider for the Identity Picker component
   */
  public static createPeoplePickerProvider(): IPeoplePickerProvider {
    return {
      onFilterIdentities: async (filter: string, selectedItems: IIdentity[] = []) => {
        try {
          const users = await this.getProjectUsers();
          const selectedIds = new Set(selectedItems.map((item) => item.entityId));

          const filteredUsers = this.filterUsersBySearch(users, filter, selectedIds);
          // Ensure we only return user entities, not teams
          return filteredUsers
            .map((user) => this.createIdentityFromUser(user))
            .filter((identity) => identity.entityType === 'user');
        } catch (error) {
          userServiceLogger.error('Failed to filter identities:', error);
          return [];
        }
      },
      onEmptyInputFocus: async () => {
        try {
          const users = await this.getProjectUsers();
          const recentUsers = users.slice(0, this.USER_PREVIEW_LIMIT);
          // Ensure we only return user entities, not teams
          return recentUsers
            .map((user) => this.createIdentityFromUser(user))
            .filter((identity) => identity.entityType === 'user');
        } catch (error) {
          userServiceLogger.error('Failed to get users for empty input focus:', error);
          return [];
        }
      },
      onRequestConnectionInformation: async () => ({
        directReports: [],
        successors: [],
        managers: [],
      }),
      getEntityFromUniqueAttribute: async (entityId: string) => {
        const identity = await this.resolveUserIdentity(entityId);
        // Ensure we only return user entities, not teams
        return identity.entityType === 'user' ? identity : this.createFallbackIdentity(entityId);
      },
    };
  }

  /**
   * Resolve user identity by ID with multiple fallback strategies
   */
  private static async resolveUserIdentity(entityId: string): Promise<IIdentity> {
    // Strategy 1: Check cache
    const cachedIdentity = this.userIdentityCache.get(entityId);
    if (cachedIdentity) {
      userServiceLogger.debug(
        `Returning cached identity for ${entityId}: ${cachedIdentity.displayName}`,
      );
      return cachedIdentity;
    }

    // Strategy 2: Find in all project users (including admins)
    try {
      const allUsers = await this.getAllProjectUsers();
      const user = allUsers.find((u) => u.id === entityId);

      if (user) {
        const identity = this.createIdentityFromUser(user);
        this.userIdentityCache.set(entityId, identity);
        userServiceLogger.debug(
          `Found and cached identity for ${entityId}: ${identity.displayName}`,
        );
        return identity;
      }
    } catch (error) {
      userServiceLogger.debug(`Failed to find user ${entityId} in project users:`, error);
    }

    // Strategy 3: Check if it's the current user
    const currentUserIdentity = await this.getCurrentUserIdentity(entityId);
    if (currentUserIdentity) {
      return currentUserIdentity;
    }

    // Strategy 4: Return fallback identity
    return this.createFallbackIdentity(entityId);
  }

  /**
   * Get current user identity if the entityId matches
   */
  private static async getCurrentUserIdentity(entityId: string): Promise<IIdentity | null> {
    try {
      await SDK.ready();
      const currentUser = SDK.getUser();

      if (currentUser && currentUser.id === entityId) {
        const identity = {
          entityId: currentUser.id,
          originId: currentUser.id,
          entityType: 'user',
          originDirectory: 'aad',
          displayName: currentUser.displayName,
          mail: currentUser.name,
          image: currentUser.imageUrl,
          active: true,
        };

        this.userIdentityCache.set(entityId, identity);
        userServiceLogger.debug(
          `Found current user identity for ${entityId}: ${identity.displayName}`,
        );
        return identity;
      }
    } catch (error) {
      userServiceLogger.debug(`Failed to get current user identity for ${entityId}:`, error);
    }

    return null;
  }

  /**
   * Create a fallback identity for unknown users
   */
  private static createFallbackIdentity(entityId: string): IIdentity {
    userServiceLogger.warn(`User ${entityId} not found, creating fallback identity`);

    const fallbackIdentity = {
      entityId,
      originId: entityId,
      entityType: 'user',
      originDirectory: 'aad',
      displayName: 'Unknown User',
      mail: 'unknown@example.com',
      active: true,
    };

    this.userIdentityCache.set(entityId, fallbackIdentity);
    return fallbackIdentity;
  }

  /**
   * Filter users by search criteria
   */
  private static filterUsersBySearch(
    users: ProjectUser[],
    filter: string,
    selectedIds: Set<string>,
  ): ProjectUser[] {
    return users
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) => {
        if (!filter) return true;
        const searchTerm = filter.toLowerCase();
        return (
          user.displayName.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm) ||
          (user.uniqueName && user.uniqueName.toLowerCase().includes(searchTerm))
        );
      })
      .slice(0, this.USER_SEARCH_LIMIT);
  }

  /**
   * Create an IIdentity from a ProjectUser
   */
  private static createIdentityFromUser(user: ProjectUser): IIdentity {
    return {
      entityId: user.id,
      originId: user.id,
      entityType: 'user',
      originDirectory: 'aad',
      displayName: user.displayName,
      mail: user.email,
      image: user.imageUrl,
      active: true,
    };
  }

  /**
   * Check if the current cache is still valid
   */
  private static isCacheValid(): boolean {
    return (
      this.projectUsersCache !== null &&
      this.cacheTimestamp > 0 &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }

  /**
   * Get project and current user context
   */
  private static async getProjectContext(): Promise<{
    project: { id: string };
    currentUser: { id: string; name: string };
  } | null> {
    try {
      await SDK.ready();

      const projectService = await SDK.getService<IProjectPageService>(
        CommonServiceIds.ProjectPageService,
      );
      const project = await projectService.getProject();

      if (!project) {
        userServiceLogger.warn('No project context available');
        return null;
      }

      const currentUser = SDK.getUser();
      if (!currentUser) {
        userServiceLogger.warn('Could not get current user');
        return null;
      }

      return { project, currentUser };
    } catch (error) {
      userServiceLogger.error('Failed to get project context:', error);
      return null;
    }
  }

  /**
   * Discover users from project teams
   */
  private static async discoverUsersFromTeams(
    project: { id: string },
    _currentUser: { id: string; name: string },
  ): Promise<ProjectUser[]> {
    const allUsers = new Map<string, ProjectUser>();

    try {
      const coreClient = getClient(CoreRestClient);
      const teams = await coreClient.getTeams(project.id);

      userServiceLogger.debug(`Found ${teams.length} teams in project`);

      for (const team of teams) {
        try {
          const teamMembers = await coreClient.getTeamMembersWithExtendedProperties(
            project.id,
            team.id,
          );

          for (const member of teamMembers) {
            const user = this.createUserFromTeamMember(member);
            // Only add actual users, not teams or groups
            if (user && this.isValidUser(user)) {
              allUsers.set(user.id, user);
              this.cacheUserIdentity(user);
            }
          }
        } catch (teamError) {
          userServiceLogger.debug(`Failed to get members for team ${team.name}:`, teamError);
        }
      }

      userServiceLogger.debug(`Discovered ${allUsers.size} users from teams`);
    } catch (error) {
      userServiceLogger.error('Failed to discover users from teams:', error);
    }

    return Array.from(allUsers.values());
  }

  /**
   * Create a ProjectUser from team member data
   */
  private static createUserFromTeamMember(member: TeamMember): ProjectUser | null {
    if (!member.identity?.id) {
      return null;
    }

    const displayName = member.identity.displayName || 'Unknown User';
    const email = member.identity.uniqueName || displayName;

    return {
      id: member.identity.id,
      displayName,
      email,
      imageUrl: member.identity.imageUrl,
      uniqueName: member.identity.uniqueName,
    };
  }

  /**
   * Validate that a user is actually a user and not a team or group.
   */
  private static isValidUser(user: ProjectUser): boolean {
    // Filter out team entities and groups
    if (!user.displayName || !user.id) {
      return false;
    }

    // Common patterns for team names that should be excluded
    const teamIndicators = [
      '[team]',
      '[group]',
      '[service]',
      '[bot]',
      '[system]',
      'team',
      'group',
      'service account',
      'system account',
    ];

    const lowerDisplayName = user.displayName.toLowerCase();
    const lowerEmail = (user.email || '').toLowerCase();

    // Check if the display name or email suggests this is a team/service account
    const isTeamLike = teamIndicators.some(
      (indicator) => lowerDisplayName.includes(indicator) || lowerEmail.includes(indicator),
    );

    // Additional checks for service accounts and automated users
    const isServiceAccount =
      lowerEmail.includes('noreply') ||
      lowerEmail.includes('service') ||
      lowerDisplayName.includes('service') ||
      !user.email ||
      user.email === user.displayName;

    // GUID pattern check - teams often have GUID-like IDs in names
    const hasGuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
      user.displayName,
    );

    return !isTeamLike && !isServiceAccount && !hasGuidPattern;
  }

  /**
   * Cache user identity for later retrieval
   */
  private static cacheUserIdentity(user: ProjectUser): void {
    this.userIdentityCache.set(user.id, {
      entityId: user.id,
      originId: user.id,
      entityType: 'user',
      originDirectory: 'aad',
      displayName: user.displayName,
      mail: user.email,
      image: user.imageUrl,
      active: true,
    });
  }

  /**
   * Cache the final results
   */
  private static cacheResults(users: ProjectUser[]): void {
    this.projectUsersCache = users;
    this.cacheTimestamp = Date.now();
  }
}
