# Mushroom Cards Enhanced Fork

## Repository Information

- **Fork Source**: https://github.com/piitaya/lovelace-mushroom
- **This Repository**: https://github.com/ryandidurlabs/super-mushroom-card
- **Upstream**: https://github.com/piitaya/lovelace-mushroom.git

## Purpose

This is a fork of Mushroom Cards with additional features:
- Timer functionality for lights and fans
- Motion sensor integration
- Future enhancements to other card types

## Maintaining the Fork

### Syncing with Upstream

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream changes into your main branch
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/timer-motion-light-card
   ```

2. Make your changes

3. Commit and push:
   ```bash
   git add .
   git commit -m "Add timer and motion features to light card"
   git push origin feature/timer-motion-light-card
   ```

4. Create a pull request or merge to main

## Development

### Setup

```bash
npm install
npm run start  # Development mode with watch
npm run build  # Production build
```

### Building

The build process creates the distribution files in the root directory that can be used with HACS.

## HACS Configuration

This fork maintains HACS compatibility. The `hacs.json` file is configured for the fork.

## License

This fork maintains the same license as the original Mushroom Cards project.

