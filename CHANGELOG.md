# Changelog

## Version 1.0.17 (2024-12-01)

### Fixed
- **Duplicate custom element registration error** - Fixed "Failed to execute 'define' on 'CustomElementRegistry'" error
  - Changed mushroom-select from decorator-based to manual registration with guard
  - Added check to prevent duplicate registration if element already exists
  - Resolves issue when resource is loaded multiple times

## Version 1.0.16 (2024-12-01)

### Fixed
- **Timer countdown display** - Timer countdown now properly appears next to brightness percentage
  - Simplified timer display logic
  - Timer is directly added to stateDisplay string before passing to renderStateInfo
  - Ensured proper re-rendering when timer updates
  - Removed excessive console logging

The timer countdown should now be visible next to the brightness percentage (e.g., "75% • 5:30") in all views.

## Version 1.0.15 (2024-12-01)

### Changed
- **Settings Modal** - Simplified to only show enable/disable toggles
  - Removed motion sensor entity picker from modal (configure in full editor)
  - Timer duration input remains when timer is enabled
  - Motion sensor selection should be done via the full card editor

### Fixed
- Added extensive console logging for timer debugging
- Increased timer start delay to ensure state is properly updated

**Note**: Check browser console (F12) for timer debugging information to help diagnose countdown display issues.

## Version 1.0.14 (2024-12-01)

### Added
- **Settings Modal** - Click the settings gear icon to open a modal with timer and motion options
  - Enable/disable timer toggle
  - Timer duration input (shown when timer is enabled)
  - Enable/disable motion sensor toggle
  - Motion sensor entity picker (shown when motion is enabled)
  - Settings sync with card UI configuration editor
  - Modal can be closed by clicking outside or the close button

### Changed
- Settings icon now opens a modal instead of the full card editor
- Modal provides quick access to timer and motion settings
- All settings changes are immediately reflected in the card

## Version 1.0.13 (2024-12-01)

### Fixed
- **Settings icon rendering** - Changed from `ha-icon-button` to `ha-icon` for proper icon display
  - Fixed CSS to target `ha-icon` instead of `ha-icon-button`
  - Icon should now be visible instead of just showing a circle
- **Timer countdown debugging** - Added comprehensive console logging
  - Improved timer initialization to start timer if light is already on when card loads
  - Added logging to help diagnose timer countdown display issues

### Changed
- Added console logging throughout timer lifecycle for debugging
- Timer now automatically starts if light is on but timer hasn't started yet

**Note**: Check browser console (F12) for timer debugging information. The logs will show:
- When timer initializes
- When timer starts
- Timer updates every second
- When timer is added to display

## Version 1.0.12 (2024-12-01)

### Fixed
- **Settings gear icon visibility** - Now properly positioned and visible in upper right corner
  - Moved settings icon outside mushroom-state-item to mushroom-card level for proper absolute positioning
  - Changed container to use flexbox for better display
- **Timer countdown display** - Timer now displays correctly
  - Fixed display logic to show timer when >= 0 (not just > 0)
  - Improved timer initialization to check state on connect and config changes
  - Added force update in updated lifecycle to ensure timer display updates every second
  - Fixed formatTime to handle edge cases properly

## Version 1.0.11 (2024-12-01)

### Changed
- **Motion icon positioning** - Moved from bottom-right to top-left of icon for better visual appearance
- **Settings gear icon** - Now positioned in upper right of button and made visible
  - Moved settings icon inside mushroom-state-item for proper positioning
  - Increased z-index and added visibility rules to ensure it displays correctly

## Version 1.0.10 (2024-12-01)

### Fixed
- **Timer and motion icons positioning** - Icons now appear in different locations instead of overlapping
  - Timer icon positioned at top-right of badge area
  - Motion icon positioned at bottom-right of badge area
  - When both icons are present, they are spaced further apart (-8px) to avoid overlap
  - Added proper RTL (right-to-left) language support for icon positioning

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

