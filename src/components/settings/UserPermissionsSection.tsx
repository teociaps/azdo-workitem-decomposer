import React, { useState, useEffect, useCallback } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { IdentityPicker, IIdentity } from 'azure-devops-ui/IdentityPicker';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { UserService } from '../../services/userService';
import { logger } from '../../core/common/logger';
import './UserPermissionsSection.scss';

const userPermissionsLogger = logger.createChild('UserPermissionsSection');

export interface UserPermissionsSectionProps {
  /**
   * Array of user IDs who currently have permission to edit settings
   */
  allowedUsers: string[];

  /**
   * Callback fired when the list of allowed users changes
   */
  onAllowedUsersChange: (_userIds: string[]) => void;

  /**
   * Whether the current user is an admin (can modify user permissions)
   */
  isAdmin: boolean;

  /**
   * Whether the component is in a loading state
   */
  isLoading?: boolean;

  /**
   * Optional CSS class name for the root container
   */
  className?: string;
}

/**
 * UserPermissionsSection - A dedicated component for managing user permissions
 * in the settings panel. This component handles:
 * - Loading and displaying user identities
 * - Adding/removing users from the permissions list
 * - Proper error handling and loading states
 * - Accessibility and UX considerations
 */
export function UserPermissionsSection({
  allowedUsers,
  onAllowedUsersChange,
  isAdmin,
  isLoading = false,
  className = '',
}: UserPermissionsSectionProps) {
  const [selectedUsers, setSelectedUsers] = useState<IIdentity[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Load user identities from the provided user IDs
   */
  const loadUserIdentities = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) {
      setSelectedUsers([]);
      return;
    }

    setIsLoadingUsers(true);
    setLoadError(null);

    try {
      const provider = UserService.createPeoplePickerProvider();
      const identities: IIdentity[] = [];

      // Use getEntityFromUniqueAttribute to get proper identity data
      for (const userId of userIds) {
        try {
          const identity = await provider.getEntityFromUniqueAttribute(userId);
          identities.push(identity);
        } catch (error) {
          userPermissionsLogger.warn(`Failed to load identity for user ${userId}:`, error);
          // Fallback to minimal identity to avoid empty state
          identities.push({
            entityId: userId,
            entityType: 'user',
            originDirectory: 'aad',
            originId: userId,
            displayName: 'Unknown User',
            mail: '',
            active: true,
          });
        }
      }

      setSelectedUsers(identities);
    } catch (error) {
      userPermissionsLogger.error('Failed to load user identities:', error);
      setLoadError('Failed to load user information. Please try refreshing the page.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  /**
   * Handle adding a user to the permissions list
   */
  const handleUserIdentityAdded = useCallback(
    (identity: IIdentity) => {
      if (!isAdmin) return; // Only admins can change user permissions

      const newUsers = [...selectedUsers, identity];
      const userIds = newUsers.map((user) => user.entityId);

      setSelectedUsers(newUsers);
      onAllowedUsersChange(userIds);
    },
    [isAdmin, selectedUsers, onAllowedUsersChange],
  );

  /**
   * Handle removing a user from the permissions list
   */
  const handleUserIdentityRemoved = useCallback(
    (identity: IIdentity) => {
      if (!isAdmin) return; // Only admins can change user permissions

      const newUsers = selectedUsers.filter((user) => user.entityId !== identity.entityId);
      const userIds = newUsers.map((user) => user.entityId);

      setSelectedUsers(newUsers);
      onAllowedUsersChange(userIds);
    },
    [isAdmin, selectedUsers, onAllowedUsersChange],
  );

  /**
   * Handle bulk changes to user permissions (e.g., when multiple users are removed)
   */
  const handleUserPermissionsChange = useCallback(
    (users: IIdentity[]) => {
      if (!isAdmin) return; // Only admins can change user permissions

      const userIds = users.map((user) => user.entityId);

      setSelectedUsers(users);
      onAllowedUsersChange(userIds);
    },
    [isAdmin, onAllowedUsersChange],
  );

  // Load user identities when allowedUsers changes
  useEffect(() => {
    loadUserIdentities(allowedUsers);
  }, [allowedUsers, loadUserIdentities]);

  // Don't render anything if not an admin
  if (!isAdmin) {
    return null;
  }

  return (
    <Card
      className={`settings-card margin-bottom-16 user-permissions-section ${className}`.trim()}
      contentProps={{ className: 'flex-column' }}
    >
      <div role="region" aria-label="User permissions management">
        <FormItem className="margin-bottom-8">
          <HeaderTitle titleSize={TitleSize.Large}>User Permissions</HeaderTitle>
          <p className="secondary-text margin-top-8">
            Grant specific users permission to edit these settings. Only project administrators can
            modify this list.
          </p>
        </FormItem>

        {/* Error message */}
        {loadError && (
          <MessageCard
            severity={MessageCardSeverity.Error}
            className="margin-bottom-16"
            onDismiss={() => setLoadError(null)}
          >
            {loadError}
          </MessageCard>
        )}

        <FormItem className="margin-bottom-12">
          <div className="flex-column identity-picker-container">
            <label className="settings-label margin-bottom-8" htmlFor="user-permissions-picker">
              Users who can edit settings
            </label>

            {/* Loading state */}
            {(isLoading || isLoadingUsers) && (
              <div
                className="flex-row flex-center margin-bottom-8"
                role="status"
                aria-live="polite"
              >
                <Spinner size={SpinnerSize.small} className="margin-right-8" />
                <span className="secondary-text loading-text">Loading user information...</span>
              </div>
            )}

            {/* Identity Picker */}
            <IdentityPicker
              pickerProvider={UserService.createPeoplePickerProvider()}
              selectedIdentities={selectedUsers}
              onIdentityAdded={handleUserIdentityAdded}
              onIdentityRemoved={handleUserIdentityRemoved}
              onIdentitiesRemoved={handleUserPermissionsChange}
              placeholderText="Search for users to grant settings access..."
              ariaLabel="Select users who can edit settings"
              className="identity-picker"
            />

            {/* Success state */}
            {selectedUsers.length > 0 && !isLoading && !isLoadingUsers && !loadError && (
              <div className="margin-top-8" role="status" aria-live="polite">
                <p className="secondary-text help-text permission-counter">
                  ✓ <strong>Current permissions:</strong> {selectedUsers.length} user(s) can edit
                  settings.
                </p>
              </div>
            )}

            {/* Help text */}
            <div className="margin-top-8" role="region" aria-label="Help information">
              <div className="margin-top-8 info-box" role="note" aria-label="Important information">
                <p className="secondary-text help-text">
                  <strong>Note:</strong> Only users who are members of project teams will appear in
                  the picker above. Project administrators always have full permissions to all
                  settings and do not need to be added here.
                </p>
              </div>

              <div className="margin-top-8 info-box" role="note" aria-label="Important information">
                <p className="secondary-text help-text">
                  <strong>Important:</strong> Users added here will be able to modify all extension
                  settings, but will not be able to modify this user permissions list (admin-only).
                  Project administrators always have full access to all settings.
                </p>
              </div>
            </div>
          </div>
        </FormItem>
      </div>
    </Card>
  );
}
