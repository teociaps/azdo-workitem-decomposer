import React from 'react';
import { CustomHeader, HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Page } from 'azure-devops-ui/Page';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { Status, StatusSize, Statuses } from 'azure-devops-ui/Status';
import { Link } from 'azure-devops-ui/Link';
import packageJson from '../../../package.json';
import { GITHUB_REPO_BASE_URL } from '../../core/common/common';

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
}: BaseSettingsPageProps) {
  if (isLoading) {
    return (
      <Page className={`padding-16 flex-column transparent ${className}`.trim()}>
        <div className="flex-row flex-center flex-grow justify-center full-height">
          <Spinner size={SpinnerSize.large} label={loadingLabel} />
        </div>
      </Page>
    );
  }

  return (
    <Page className={`padding-16 flex-column transparent ${className}`.trim()}>
      <CustomHeader className="justify-space-between no-margin no-padding">        <div className="flex-column">
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
      {error && <Status {...Statuses.Failed} text={error} size={StatusSize.l} />}
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
