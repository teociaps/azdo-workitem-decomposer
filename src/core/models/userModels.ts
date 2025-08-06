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

/**
 * User Entitlement from Azure DevOps API
 * @see https://docs.microsoft.com/en-us/rest/api/azure/devops/memberentitlementmanagement/user-entitlements
 */
export interface UserEntitlement {
  id: string;
  user: {
    subjectKind: string;
    descriptor: string;
    displayName: string;
    mailAddress?: string;
    principalName: string;
    origin: string;
    originId: string;
  };
  accessLevel: {
    accountLicenseType: string;
    assignmentSource: string;
    licenseDisplayName: string;
    licensingSource: string;
    msdnLicenseType: string;
    status: string;
    statusMessage: string;
  };
  groupAssignments: {
    group: {
      groupType: string;
      displayName: string;
      descriptor: string;
    };
    accessLevel: {
      accountLicenseType: string;
      assignmentSource: string;
      licenseDisplayName: string;
      licensingSource: string;
      msdnLicenseType: string;
      status: string;
      statusMessage: string;
    };
  }[];
  projectEntitlements: {
    group: {
      groupType: string;
      displayName: string;
      descriptor: string;
    };
    projectRef: {
      id: string;
      name: string;
    };
  }[];
}

/**
 * Admin permission check result with detailed source information
 */
export interface AdminPermissionResult {
  isAdmin: boolean;
  source: 'project' | 'organization' | 'entitlement' | 'none';
  details: {
    projectAdmin?: boolean;
    organizationAdmin?: boolean;
    entitlementAdmin?: boolean;
    groupName?: string;
    groupType?: string;
    method: string;
  };
}
