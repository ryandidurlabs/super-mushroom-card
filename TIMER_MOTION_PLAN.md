# Timer Motion Card - Implementation Plan

## Overview
This is a fork of the Mushroom Light Card with added timer and motion sensor functionality.

## Repository Setup
- **Origin**: https://github.com/ryandidurlabs/timer-motion-card.git
- **Upstream**: https://github.com/piitaya/lovelace-mushroom.git

## Features to Add

### 1. Timer Functionality
- Add `timer_enabled` boolean config option
- Add `timer_duration` number config option (seconds)
- Add `default_brightness` number config option (0-100, optional)
- Display countdown timer next to brightness percentage
- Automatically turn off light when timer expires
- Timer should persist across page reloads (use localStorage)
- Show timer icon in header when enabled

### 2. Motion Sensor Functionality
- Add `motion_enabled` boolean config option
- Add `motion_sensor` string config option (entity_id)
- Add `motion_off_delay` number config option (seconds)
- Automatically turn on light when motion detected
- Automatically turn off light after motion clears (with delay)
- Show motion icon in header when enabled
- Motion icon should be green when motion is active

### 3. Settings UI
- Add gear icon in card header
- Settings modal should only show:
  - Timer enable/disable
  - Timer duration (when enabled)
  - Motion enable/disable
- All other settings remain in visual config editor

## Files to Modify

### 1. `src/cards/light-card/light-card-config.ts`
Add new config options:
```typescript
timer_enabled?: boolean;
timer_duration?: number;
default_brightness?: number;
motion_enabled?: boolean;
motion_sensor?: string;
motion_off_delay?: number;
```

### 2. `src/cards/light-card/light-card.ts`
- Add timer state management
- Add motion sensor subscription
- Add timer countdown display
- Add timer/motion icons in header
- Add settings modal
- Implement timer expiration logic
- Implement motion detection logic

### 3. `src/cards/light-card/light-card-editor.ts`
- Add timer/motion config options to editor
- Keep all existing Mushroom options

### 4. `src/cards/light-card/const.ts`
- Update card name/description

## Implementation Notes

1. **Timer Persistence**: Use localStorage with key `timer_motion_card_expiration_${entity_id}` to store expiration timestamp
2. **Timer Display**: Show countdown in format "MM:SS" next to brightness percentage
3. **Motion Subscription**: Subscribe to motion sensor state changes using `hass.connection.subscribeEvents`
4. **Settings Modal**: Create a simple modal that only shows timer/motion options
5. **Icons**: Use `mdi:timer-outline` for timer, `mdi:motion-sensor` for motion

## Testing Checklist

- [ ] Timer counts down correctly
- [ ] Timer turns off light when expired
- [ ] Timer persists across page reloads
- [ ] Motion sensor turns on light when motion detected
- [ ] Motion sensor turns off light after delay when motion clears
- [ ] Settings modal works without page reload
- [ ] All Mushroom styling preserved
- [ ] Slider matches Mushroom exactly
- [ ] Visual config editor works correctly

