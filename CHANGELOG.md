# Changelog

## Version 1.0.9 (2024-12-01)

### Added
- Added `manifest.json` for proper version tracking and cache-busting
- Comprehensive error handling throughout the card to prevent configuration errors
- Better defensive programming with null checks and try-catch blocks
- Graceful degradation when configuration is partial or missing

### Fixed
- **Reduced configuration errors after updates** - Card now handles partial configs gracefully
- Improved error recovery - card continues to function even if some features fail to initialize
- Better cleanup of event subscriptions to prevent memory leaks
- Enhanced error messages in console for easier debugging

### Changed
- Updated README with detailed troubleshooting steps for configuration errors
- Improved error handling in `setConfig`, `connectedCallback`, `updated`, and subscription methods
- All service calls and event handlers now wrapped in try-catch blocks

## Version 1.0.8 (2024-12-01)

### Changed
- Updated timer duration range from 60-3600 seconds to 1-3000 seconds for more flexibility

## Version 1.0.7 (2024-12-01)

### Added
- 🏃 **Motion sensor functionality** - Light can now be controlled by motion sensors
  - Enable motion sensor control in card settings
  - Select motion sensor entity from dropdown
  - Motion icon badge displays when motion is enabled
  - Light turns on when motion is detected
  - Works with default brightness and timer features

### Fixed
- Fixed timer countdown display - timer now updates immediately on start
- Fixed duplicate startTimerInterval method
- Improved settings gear icon visibility with !important CSS

## Version 1.0.6 (2024-12-01)

### Fixed
- Fixed default brightness causing rapid flashing - now checks if brightness is already at target before applying
- Added tolerance check (5%) to prevent applying default brightness if already close to target
- Reset default brightness flag when user manually adjusts brightness significantly
- Fixed gear icon visibility with !important CSS rules
- Improved timer countdown display logic

## Version 1.0.5 (2024-12-01)

### Fixed
- Fixed default brightness causing light to turn on/off repeatedly - now only applies once when light transitions from off to on
- Added flag to track when default brightness has been applied to prevent loops

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

