# Privacy Policy - Work Item Decomposer

**Effective Date:** August 5, 2025

## Overview

Work Item Decomposer is an Azure DevOps extension that helps you break down work items into organized hierarchies. This privacy policy explains how our extension handles data during operation, what permissions we require, and how we protect your information.

**Key Principles:**
- ✅ **Zero Data Collection**: We don't collect, store, or transmit your personal data
- ✅ **Minimal Permissions**: Only essential OAuth scopes required for functionality
- ✅ **Azure DevOps Boundary**: All operations remain within Microsoft's ecosystem
- ✅ **Transparency**: Complete source code available on GitHub

## Data Processing

### What We Access
- **Work Item Data**: Only the specific work items you choose to decompose
- **Work Item Metadata**: Work item types, fields, and process templates from your Azure DevOps project
- **Project Configuration**: Work item type configurations and fields
- **User Settings**: Extension configuration preferences
- **Project Group Memberships**: Graph API access to verify Project Administrator group membership for settings access control
- **Area Path & Iteration Data**: To properly organize new work items
- **Project Tags**: For applying tags to decomposed work items (if configured)

### What We Create
- **New Work Items**: Sub-items created based on your hierarchy specifications
- **Work Item Relationships**: Parent-child links between work items
- **Work Item Fields**: Title, description, area path, iteration path, tags, assignments
- **Optional Comments**: HTML comments in work items (only if enabled in settings)
- **Audit Trail**: Work item history entries for tracking decomposition actions

### What We DON'T Collect
- ❌ Personal information (names, emails, contact details)
- ❌ Work item content beyond what's necessary for decomposition
- ❌ Data from work items you don't interact with
- ❌ Usage analytics or telemetry
- ❌ Authentication credentials or tokens
- ❌ Organizational data unrelated to work items
- ❌ User behavior or navigation patterns
- ❌ Device information or browser details

## Data Storage & Transmission

### Local Operation Only
- **No External Servers**: All processing happens within your Azure DevOps environment
- **No Data Export**: We don't send your data to external services or our servers
- **Azure DevOps Boundaries**: Extension operates exclusively within Microsoft's Azure DevOps infrastructure
- **No Third-Party APIs**: No communication with external APIs or services

### Settings Storage
- Extension settings are stored using Azure DevOps' built-in extension data service
- Settings remain within your Azure DevOps organization
- Only stores: comment preferences, comment text template, and user permission overrides
- **Admin-Only Access**: Settings modification restricted to project administrators
- **Permission Verification**: Uses Azure DevOps Graph API to verify Project Administrator group membership
- **Encrypted Storage**: All settings encrypted using Azure DevOps' standard encryption

### Temporary Data & Caching
- **In-Memory Processing**: Work item data processed in browser memory only
- **Permission Caching**: Temporary caching of user permission status (5-minute expiration)
- **Project Metadata Caching**: Temporary caching of work item types and project structure
- **Automatic Cleanup**: All temporary data cleared when operations complete
- **Session-Based**: Cache cleared on page refresh or session end
- **No Persistent Storage**: No data stored outside Azure DevOps APIs

## Data Usage

We use accessed data solely to:
- ✅ Create work item hierarchies as you specify
- ✅ Establish parent-child relationships between work items  
- ✅ Apply area paths and iteration paths to new work items
- ✅ Copy relevant fields from parent to child work items
- ✅ Add optional tracking comments (if enabled)
- ✅ Apply tags to decomposed work items (if configured)
- ✅ Ensure compatibility with your process templates
- ✅ Verify user permissions for settings access
- ✅ Maintain work item type hierarchies and relationships

## Third-Party Access

- **No Third Parties**: We don't share data with any external parties
- **Microsoft Only**: Data remains within Microsoft's Azure DevOps ecosystem
- **No Analytics Services**: We don't use external analytics or tracking services
- **No CDNs**: No content delivery networks or external resources
- **No Social Media Integration**: No sharing or posting capabilities
- **No Advertising**: No advertising networks or tracking pixels

## Your Rights & Control

You have complete control over:
- **Extension Installation**: Install/uninstall at any time
- **Data Access**: Extension only accesses data when you explicitly use it
- **Settings Management**: Configure or disable features (project administrators only)
- **Work Item Control**: You control which work items to decompose
- **Permission-Based Access**: Settings are read-only for non-administrators
- **Data Deletion**: Uninstalling removes all extension data
- **Audit Transparency**: All actions logged in work item history

## Security & Compliance

### Security Measures
- **Azure DevOps Security**: Inherits all security measures from Azure DevOps
- **Minimal Permissions**: Uses only necessary OAuth scopes (`vso.work_full`, `vso.settings_write`, `vso.graph`, `vso.memberentitlementmanagement`)
- **Admin-Only Configuration**: Settings modification restricted to project administrators
- **Permission Verification**: Real-time admin status checking using Azure DevOps Graph API and Member Entitlement Management API
- **No External Communication**: No network requests outside Azure DevOps APIs
- **Microsoft Standards**: Follows Microsoft's security requirements for extensions
- **OAuth 2.0**: Secure authentication using Azure DevOps OAuth flow
- **HTTPS Only**: All API communications encrypted with TLS 1.2+

### Compliance
- **GDPR Compliant**: No personal data processing requiring consent
- **SOC 2 Type II**: Inherits Azure DevOps compliance certifications
- **ISO 27001**: Follows Microsoft's information security standards
- **CCPA Compliant**: No sale or sharing of personal information
- **HIPAA Compatible**: Suitable for healthcare organizations using Azure DevOps

## Data Retention

- **No Retention**: We don't retain any of your data
- **Azure DevOps Managed**: All created work items are managed by Azure DevOps
- **Settings Persistence**: Extension settings persist until you uninstall or clear them
- **Cache Expiration**: Temporary caches expire automatically (5 minutes)
- **Complete Removal**: Uninstalling the extension removes all associated data
- **No Backups**: We don't create backups of your data

## Changes to This Policy

We may update this privacy policy to reflect changes in our extension. Updates will be:
- Posted in our GitHub repository
- Reflected in the extension marketplace
- Communicated through release notes for significant changes

## Contact & Support

For privacy questions or concerns:
- **GitHub Discussions**: [Ask Questions](https://github.com/teociaps/azdo-workitem-decomposer/discussions)
- **GitHub Issues**: [Report Issues](https://github.com/teociaps/azdo-workitem-decomposer/issues)
- **GitHub Repository**: [View Source Code](https://github.com/teociaps/azdo-workitem-decomposer)
- **Security Issues**: Use GitHub's security reporting feature

## Technical Details

### OAuth Scopes Used
- `vso.work_full`: Read and create work items, access work item types and fields
- `vso.settings_write`: Store and retrieve extension settings within Azure DevOps
- `vso.graph`: Read user and group information to verify Project Administrator membership
- `vso.memberentitlementmanagement`: Access user entitlements to verify Project Administrator permissions

### APIs Used
- **Azure DevOps Work Item Tracking REST API**: For reading and creating work items
- **Azure DevOps Extension Data Service API**: For storing extension settings
- **Azure DevOps Graph API**: For permission verification and user management
- **Azure DevOps Member Entitlement Management API**: For verifying user permissions and project administrator status
- **Azure DevOps Process Template API**: For work item type definitions
- **Azure DevOps Core API**: For project and team information

### Data Flow
1. User initiates decomposition through Azure DevOps UI
2. Extension authenticates using OAuth 2.0 with Azure DevOps
3. Work item data retrieved via Azure DevOps REST API
4. Processing occurs in browser memory (no server-side processing)
5. New work items created via Azure DevOps REST API
6. All data remains within Azure DevOps ecosystem

### Architecture
- **Client-Side Only**: No server-side components or databases
- **Browser-Based**: All processing happens in your web browser
- **Stateless**: No persistent state between sessions
- **API-Driven**: Direct integration with Azure DevOps APIs only

---

*This extension is independently developed and is not affiliated with Microsoft Corporation. Microsoft Azure DevOps and related services are trademarks of Microsoft Corporation. This extension operates within Microsoft's Azure DevOps ecosystem and follows Microsoft's security and privacy standards.*
