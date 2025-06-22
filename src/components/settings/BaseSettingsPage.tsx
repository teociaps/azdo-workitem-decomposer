import React, { useState, useEffect } from 'react';
import SDK from 'azure-devops-extension-sdk';
import { CustomHeader, HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Page } from 'azure-devops-ui/Page';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { Status, StatusSize, Statuses } from 'azure-devops-ui/Status';
import { Link } from 'azure-devops-ui/Link';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import packageJson from '../../../package.json';
import { GITHUB_REPO_BASE_URL } from '../../core/common/common';
import { PermissionService } from '../../services/permissionService';
import { logger } from '../../core/common/logger';
import './settingsCommon.scss';

const baseSettingsLogger = logger.createChild('BaseSettingsPage');

export interface BaseSettingsPageProps {
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  children?: React.ReactNode;
  headerActions?: React.ReactNode;
  showFooter?: boolean;
  loadingLabel?: string;
  showExtensionLabel?: boolean;
  checkPermissions?: boolean;
  onPermissionCheck?: (_isAdmin: boolean) => void;
  showPermissionMessage?: boolean;
}

export function BaseSettingsPage({
  title = 'Work Item Decomposer',
  subtitle,
  isLoading = false,
  error = null,
  className = '',
  children,
  headerActions,
  showFooter = true,
  loadingLabel = 'Loading...',
  showExtensionLabel = true,
  checkPermissions = false,
  onPermissionCheck,
  showPermissionMessage = true,
}: BaseSettingsPageProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [permissionCheckLoading, setPermissionCheckLoading] = useState(checkPermissions);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkPermissions) return;

    const checkAdminPermissions = async () => {
      try {
        setPermissionCheckLoading(true);
        await SDK.ready();

        const hasAdminPermissions = await PermissionService.isProjectAdmin();
        setIsAdmin(hasAdminPermissions);
        setPermissionError(null);

        if (onPermissionCheck) {
          onPermissionCheck(hasAdminPermissions);
        }

        baseSettingsLogger.info(`User is admin: ${hasAdminPermissions}`);
      } catch (err) {
        baseSettingsLogger.error('Failed to check admin permissions:', err);
        setPermissionError('Failed to check permissions. Some features may be limited.');
        setIsAdmin(false);

        if (onPermissionCheck) {
          onPermissionCheck(false);
        }
      } finally {
        setPermissionCheckLoading(false);
      }
    };

    checkAdminPermissions();
  }, [checkPermissions, onPermissionCheck]);

  const isActuallyLoading = isLoading || (checkPermissions && permissionCheckLoading);

  if (isActuallyLoading) {
    return (
      <Page className={`padding-16 flex-column transparent ${className}`.trim()}>
        <div className="flex-row flex-center flex-grow justify-center full-height">
          <Spinner size={SpinnerSize.large} label={loadingLabel} />
        </div>
      </Page>
    );
  }

  // Show permission message if permission checking is enabled and user is not admin
  const permissionMessage = checkPermissions &&
    showPermissionMessage &&
    !isAdmin &&
    !permissionCheckLoading && (
      <MessageCard severity={MessageCardSeverity.Info} className="margin-bottom-16">
        <div>
          <strong>Read-only mode:</strong> Only project administrators can modify these settings.
          Contact your project administrator if you need to make changes.
        </div>
      </MessageCard>
    );
  return (
    <Page className={`padding-16 flex-column transparent ${className}`.trim()}>
      <CustomHeader className="justify-space-between no-margin no-padding">
        <div className="flex-column">
          <HeaderTitle titleSize={TitleSize.Large}>{title}</HeaderTitle>
          {subtitle && <div className="secondary-text font-size-m margin-top-4">{subtitle}</div>}
          {showExtensionLabel && (
            <div className="secondary-text font-size-m margin-top-4">
              Extension version: <strong>{packageJson.version}</strong>
            </div>
          )}
        </div>
        {headerActions && <div className="flex-row flex-center">{headerActions}</div>}
      </CustomHeader>{' '}
      {(error || permissionError) && (
        <Status {...Statuses.Failed} text={error || permissionError || ''} size={StatusSize.l} />
      )}
      {permissionMessage}
      {children}
      {showFooter && (
        <div className="separator-line-top padding-top-16 text-center">
          <Link href={GITHUB_REPO_BASE_URL} target="_blank">
            Need help or have feedback? Visit our GitHub.
          </Link>
        </div>
      )}
    </Page>
  );
}
