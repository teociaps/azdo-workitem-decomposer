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
 * User Entitlement data from Member Entitlement Management API
 */
export interface UserEntitlement {
  id: string;
  user: {
    origin: string; // 'aad', 'msa', 'vsts'
    metaType: string; // 'member', 'guest', etc.
    displayName: string;
    principalName: string;
    mailAddress: string;
    descriptor: string;
  };
  accessLevel: {
    accountLicenseType: string; // 'stakeholder', 'professional', 'advanced'
    licenseDisplayName: string;
    status: string;
  };
  projectEntitlements: ProjectEntitlement[];
}

/**
 * Project entitlement information for a user
 */
export interface ProjectEntitlement {
  group: {
    groupType: string; // 'projectAdministrator', 'projectContributor', etc.
    displayName: string;
  };
  projectRef: {
    id: string;
    name: string;
  };
}
