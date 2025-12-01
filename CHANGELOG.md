# Changelog

## Version 1.0.4 (2024-12-01)

### Added
- Added `default_brightness_enabled` toggle to enable/disable default brightness feature
- Default brightness now only applies when turning light on (not when adjusting brightness)

### Fixed
- Fixed settings gear icon visibility - increased z-index and added display properties
- Fixed countdown timer display - improved timer state checking
- Default brightness is now only applied when light transitions from off to on state

## Version 1.0.3 (2024-12-01)

### Fixed
- Fixed gear icon settings functionality - added preventDefault and improved pointer events
- Added proper translations for timer options in UI editor:
  - "Enable timer" for timer_enabled
  - "Timer duration (seconds)" for timer_duration
  - "Default brightness (%)" for default_brightness
- Improved settings icon z-index and pointer events for better clickability

## Version 1.0.2 (2024-12-01)

### Fixed
- Updated release asset with correct built file containing proper element registration
- Ensured mushroom.js file in repository matches the latest build

## Version 1.0.1 (2024-11-30)

### Fixed
- Fixed timer countdown display not showing - added proper re-rendering when timer starts and updates
- Fixed custom element registration to use string literal instead of variable
- Improved timer state management to prevent duplicate timers
- Timer now updates immediately when interval starts

## Version 1.0.0 (2024-11-30)

### Added
- ⏱️ **Timer functionality** for Super Mushroom Light Card
  - Timer countdown display next to brightness percentage
  - Persistent timer that works across page reloads
  - Automatic light turn-off when timer expires
  - Timer icon badge when enabled
  - Default brightness option when timer starts
- ⚙️ **Settings gear icon** in upper left corner of card
- 🏷️ **Versioning** - Proper version management

### Changed
- All cards renamed from "Mushroom" to "Super Mushroom"
- Card prefix changed from "mushroom" to "super-mushroom"

### Upstream Version

Based on Mushroom Cards v5.0.8

