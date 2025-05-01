# Contributing to Azure DevOps Work Item Decompose

Thank you for considering contributing to the Azure DevOps Work Item Decompose extension! This document provides guidelines for contributing to the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Code of Conduct](#code-of-conduct)
4. [How to Contribute](#how-to-contribute)
5. [Pull Request Process](#pull-request-process)
6. [Extension Development Guidelines](#extension-development-guidelines)
7. [Testing](#testing)
8. [Documentation](#documentation)
9. [Need Help?](#need-help)

## Getting Started

To get started, follow these steps:

1. **Fork the repository**: [Fork](../../fork) the project to create a copy of the repository under your own GitHub account.
2. **Clone your fork**: Clone the repository to your local machine using:
   ```bash
   git clone https://github.com/YOUR-USERNAME/azdo-workitem-decompose.git
   ```
3. **Set up the remote upstream**: To keep your fork up to date with the original repository:
   ```bash
   git remote add upstream https://github.com/teociaps/azdo-workitem-decompose.git
   ```

## Development Environment

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)
- [Azure DevOps Personal Access Token](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate) (for publishing extensions)
- [TFX CLI](https://github.com/microsoft/tfs-cli) (automatically installed as a dev dependency)

### Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory with the following variables:
   ```
   AZURE_DEVOPS_EXT_PAT=your_personal_access_token
   ```
   > [!IMPORTANT]
   > Never commit your .env file containing your PAT to version control. Ensure `.env` is listed in your `.gitignore` file to prevent accidental exposure of credentials.

### Project Structure

- `src/` - Main source code for the extension
  - `components/` - React components
  - `common/` - Shared styles and utilities
- `scripts/` - Build and deployment scripts
  - `package.ts` - Creates VSIX packages
  - `publish.ts` - Publishes extensions to marketplace
- `marketplace/` - Extension marketplace assets
- `configs/` - Configuration files
  - `dev.json` - Development environment settings
  - `prod.json` - Production environment settings
- `vss-extension.json` - Extension manifest

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. By participating, you agree to uphold these guidelines.

## How to Contribute

### Areas for Contribution

- **Code**: Bug fixes, new features, performance improvements
- **Documentation**: Improve readme, inline documentation, or marketplace descriptions
- **Testing**: Add or improve tests
- **UX/UI**: Improve the user experience and interface

### Reporting Bugs

When reporting bugs, please [use the bug report template](https://github.com/teociaps/azdo-workitem-decompose/issues/new?template=bug_report.yml).

### Feature Requests

For feature requests, please [use the feature request template](https://github.com/teociaps/azdo-workitem-decompose/issues/new?template=feature_request.yml).

## Pull Request Process

1. **Create a branch**: Use a descriptive name (e.g., `feature/auto-decomposition`, `fix/error-handling`)

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**: Follow the coding style and add tests as needed

3. **Test your changes**: Ensure they work in a real Azure DevOps environment

4. **Update documentation**: If you've changed functionality, update relevant documentation

5. **Submit your PR**: [Create a pull request](https://github.com/teociaps/azdo-workitem-decompose/compare) targeting the **main** branch. Use the PR template and provide detailed information about your changes

6. **Code review**: Address any feedback from reviewers promptly

## Extension Development Guidelines

### TypeScript Best Practices

- Use strong typing wherever possible
- Follow the existing code structure
- Document complex functions with JSDoc comments
- Ensure consistent formatting and linting across the codebase

### React Component Guidelines

- Keep components focused on a single responsibility
- Use functional components with hooks when possible
- Follow component naming conventions in the project
- For styling, use the SCSS files and follow the Azure DevOps UI framework patterns

### Local Testing

1. Package the dev extension:
   ```bash
   npm run package:dev
   ```
2. Publish the dev extension to your organization:

   ```bash
   npm run publish:dev
   ```

3. Start the webpack dev server:
   ```bash
   npm run start:dev
   ```
4. Navigate to your Azure DevOps organization. Note that after publishing, you'll need to share the extension with your organization and install it before you can test your changes.

## Testing

- Add tests for new functionality
- Test on multiple browsers if adding UI features
- Verify your changes work with different work item types
- Test both on personal dev instance and on production Azure DevOps

## Documentation

- Update the README.md if necessary
- Document new features in the marketplace/details.md file
- Add comments to complex code sections

## Need Help?

If you have questions or need assistance:

- Open a discussion in the [Q&A category](https://github.com/teociaps/azdo-workitem-decompose/discussions/new?category=q-a)
- Refer to the [Azure DevOps Extension Development](https://developer.microsoft.com/azure-devops) documentation

Thank you for contributing to making Azure DevOps work item management better!
