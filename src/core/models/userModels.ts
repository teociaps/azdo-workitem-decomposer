/**
 * User information from Azure DevOps SDK
 */
export interface User {
  id: string;
  displayName: string;
  name: string;
  descriptor?: string;
  imageUrl?: string;
}

/**
 * Graph API Group information
 * @see https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/groups
 */
export interface GraphGroup {
  displayName: string;
  principalName: string;
  descriptor: string;
  origin: string;
  originId: string;
  subjectKind: string;
  domain: string;
  mailAddress?: string;
  url?: string;
}

/**
 * Graph API User information
 * @see https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/users
 */
export interface GraphUser {
  displayName: string;
  principalName: string;
  descriptor: string;
  origin: string;
  originId: string;
  subjectKind: string;
  domain: string;
  mailAddress?: string;
  url?: string;
}

/**
 * Graph API Membership information
 * @see https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/memberships
 */
export interface GraphMembership {
  containerDescriptor: string;
  memberDescriptor: string;
  url?: string;
}

/**
 * Extended user context with additional permission-related information
 */
export interface ExtendedUserContext {
  user: User;
  isProjectAdmin: boolean;
  canEditSettings: boolean;
  permissions: {
    lastChecked: Date;
    cached: boolean;
  };
}

/**
 * Permission check result with detailed information
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  reason: string;
  details?: {
    userId: string;
    groupDescriptor?: string;
    apiEndpoint?: string;
    statusCode?: number;
  };
}
