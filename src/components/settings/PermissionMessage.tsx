import React from 'react';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';

export interface PermissionMessageProps {
  /**
   * Whether the current user is an admin
   */
  isAdmin: boolean;

  /**
   * Whether the current user can edit settings
   */
  canEdit: boolean;

  /**
   * Whether the component is in a loading state
   */
  isLoading?: boolean;

  /**
   * Whether there's an error state
   */
  hasError?: boolean;

  /**
   * Optional CSS class name for the root container
   */
  className?: string;
}

/**
 * PermissionMessage - A component that displays permission-related messages
 * to inform users about their access level and editing capabilities
 */
export function PermissionMessage({
  isAdmin,
  canEdit,
  isLoading = false,
  hasError = false,
  className = '',
}: PermissionMessageProps) {
  // Don't show messages while loading or if there's an error
  if (isLoading || hasError) {
    return null;
  }

  // Admin users don't need permission messages
  if (isAdmin) {
    return null;
  }

  // Show read-only message if user can't edit
  if (!canEdit) {
    return (
      <MessageCard
        severity={MessageCardSeverity.Info}
        className={`margin-bottom-16 ${className}`.trim()}
      >
        <div>
          <strong>Read-only mode:</strong>&nbsp;You do not have permission to modify these settings.
          Contact your project administrator to request edit access.
        </div>
      </MessageCard>
    );
  }

  // Show edit access message if user can edit but is not admin
  return (
    <MessageCard
      severity={MessageCardSeverity.Info}
      className={`margin-bottom-16 ${className}`.trim()}
    >
      <div>
        <strong>Edit Access:</strong>&nbsp;You have been granted permission to modify these settings
        by a project administrator.
      </div>
    </MessageCard>
  );
}
