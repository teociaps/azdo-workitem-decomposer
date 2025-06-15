# Privacy Policy - Work Item Decomposer

**Effective Date:** January 16, 2025

## Overview

Work Item Decomposer is an Azure DevOps extension that helps you break down work items into organized hierarchies. This privacy policy explains how our extension handles data during operation.

## Data Processing

### What We Access
- **Work Item Data**: Only the specific work items you choose to decompose
- **Work Item Metadata**: Work item types, fields, and process templates from your Azure DevOps project
- **User Settings**: Extension configuration preferences

### What We Create
- **New Work Items**: Sub-items created based on your hierarchy specifications
- **Work Item Relationships**: Parent-child links between work items
- **Optional Comments**: HTML comments in work items (only if enabled in settings)

### What We DON'T Collect
- ❌ Personal information (names, emails, contact details)
- ❌ Work item content beyond what's necessary for decomposition
- ❌ Data from work items you don't interact with
- ❌ Usage analytics or telemetry
- ❌ Authentication credentials

## Data Storage & Transmission

### Local Operation Only
- **No External Servers**: All processing happens within your Azure DevOps environment
- **No Data Export**: We don't send your data to external services or our servers
- **Azure DevOps Boundaries**: Extension operates exclusively within Microsoft's Azure DevOps infrastructure

### Settings Storage
- Extension settings are stored using Azure DevOps' built-in extension data service
- Settings remain within your Azure DevOps organization
- Only stores: comment preferences and comment text template

### Temporary Data
- Minimal temporary data during work item creation process
- Automatically cleared when operations complete
- No persistent storage outside Azure DevOps

## Data Usage

We use accessed data solely to:
- ✅ Create work item hierarchies as you specify
- ✅ Establish parent-child relationships between work items
- ✅ Apply area paths and iteration paths to new work items
- ✅ Add optional tracking comments (if enabled)
- ✅ Ensure compatibility with your process templates

## Third-Party Access

- **No Third Parties**: We don't share data with any external parties
- **Microsoft Only**: Data remains within Microsoft's Azure DevOps ecosystem
- **No Analytics Services**: We don't use external analytics or tracking services

## Your Rights & Control

You have complete control over:
- **Extension Installation**: Install/uninstall at any time
- **Data Access**: Extension only accesses data when you explicitly use it
- **Settings Management**: Configure or disable features
- **Work Item Control**: You control which work items to decompose

## Security

- **Azure DevOps Security**: Inherits all security measures from Azure DevOps
- **Minimal Permissions**: Uses only necessary scopes (`vso.work_full`, `vso.settings_write`)
- **No External Communication**: No network requests outside Azure DevOps APIs
- **Microsoft Standards**: Follows Microsoft's security requirements for extensions

## Data Retention

- **No Retention**: We don't retain any of your data
- **Azure DevOps Managed**: All created work items are managed by Azure DevOps
- **Settings Only**: Extension settings persist until you uninstall or clear them

## Changes to This Policy

We may update this privacy policy to reflect changes in our extension. Updates will be:
- Posted in our GitHub repository
- Reflected in the extension marketplace
- Communicated through release notes for significant changes

## Contact & Support

For privacy questions or concerns:
- **GitHub Discussions**: [Ask Questions](https://github.com/teociaps/azdo-workitem-decomposer/discussions)
- **GitHub Repository**: [View Source Code](https://github.com/teociaps/azdo-workitem-decomposer)

## Technical Details

**Scopes Used:**
- `vso.work_full`: Read and create work items
- `vso.settings_write`: Store extension settings

**APIs Used:**
- Azure DevOps Work Item Tracking REST API
- Azure DevOps Extension Data Service API

---

*This extension is independently developed and is not affiliated with Microsoft Corporation. Microsoft Azure DevOps and related services are trademarks of Microsoft Corporation.*
