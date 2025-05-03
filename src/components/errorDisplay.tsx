import React, { useState, useEffect } from 'react';
import { Link } from 'azure-devops-ui/Link';
import '../common/common.scss';
import './errorDisplay.scss';
import { GITHUB_REPO_BASE_URL } from '../common/common';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Icon } from 'azure-devops-ui/Icon';

interface ErrorDisplayProps {
  error: string | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): JSX.Element | null {
  const [showDetails, setShowDetails] = useState(false);
  const [isVisible, setIsVisible] = useState(!!error);

  useEffect(() => {
    setIsVisible(!!error);
    if (!error) {
      setShowDetails(false);
    }
  }, [error]);

  const handleDismiss = () => {
    setIsVisible(false);
    setShowDetails(false);
  };

  if (!error || !isVisible) {
    return null;
  }

  const issueWhatHappenedContent = encodeURIComponent(`**Error Details:**\n\n${error}\n`);
  const githubIssueUrl = `${GITHUB_REPO_BASE_URL}/issues/new?template=bug_report.yml&what-happened=${issueWhatHappenedContent}`;

  return (
    <>
      <MessageCard
        severity={MessageCardSeverity.Error}
        onDismiss={handleDismiss}
        buttonProps={[
          {
            text: showDetails ? 'Hide Details' : 'Show Details',
            onClick: () => setShowDetails(!showDetails),
          },
        ]}
        className='decompose-error-card'
      >
        An error occurred.
      </MessageCard>
      {showDetails && (
        <div className="error-details-container">
          <div className="error-details-card depth-8">
            <div className="error-header">
              <strong>Error Details:</strong>
              <Link
                href={githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                removeUnderline={true}
              >
                Report on GitHub{' '}
                <Icon ariaLabel="Report bug icon" iconName="NavigateExternalInline" />
              </Link>
            </div>
            <div className="error-details-content">{error}</div>
          </div>
        </div>
      )}
    </>
  );
}
