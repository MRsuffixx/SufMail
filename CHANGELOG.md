# Changelog

All notable changes to MailForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Window Manager system with drag, resize, minimize/maximize/close
- 3-pane adaptive layout (sidebar, mail list, viewer)
- Command Palette (Ctrl+K)
- TipTap rich text compose editor
- Context menus for messages and folders
- Toast notification system
- Dark mode and theme support
- Focus mode for distraction-free reading

### Changed
- (None yet)

### Deprecated
- (None yet)

### Removed
- (None yet)

### Fixed
- (None yet)

### Security
- (None yet)

---

## [0.1.0] - 2024-01-01

### Added
- Initial release
- Core mail operations (list, read, send, reply, forward)
- IMAP sync via BullMQ workers
- SMTP sending via nodemailer
- Multi-account support with encrypted credentials
- tRPC v11 API with strict TypeScript
- NextAuth.js v5 authentication
- Prisma + PostgreSQL database
- Config-driven behavior via `src/config.ts`
- System labels (Inbox, Sent, Drafts, Trash, Spam, Archive)
- Auto-save drafts
- Scheduled sending
- Label management
- Filter rules
- Contact management
- User preferences
- GDPR data export