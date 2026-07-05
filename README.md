# Smart File Organizer

Smart File Organizer is a cross-platform Node.js desktop automation utility that watches a user-defined Downloads folder and organizes files into categorized destination folders. It is designed as a lightweight, modular, and testable service suitable for desktop automation and portfolio demonstration.

## Project Overview

- Watches a downloads folder and organizes files by extension.
- Detects duplicates (SHA-256), handles filename conflicts, and logs structured events.
- Designed with modular services (watcher, organizer, duplicate detector, history, logger).

## Features

- Continuous folder watch (planned watcher module)
- Ignore temporary/partial download files
- Auto-create destination folders
- Organize files by extension categories (Documents, Pictures, Videos, Music, Archives, Installers, Others)
- SHA-256 duplicate detection
- Handle filename conflicts (conflict resolver extension point)
- Structured JSON logging
- Save history and support undo (extension point)
- Configuration-driven (`src/config/config.json`, `.env` overrides)
- Unit tested services (Jest)

## Architecture

High level components:

- `FileWatcher` — watches the download folder and emits events
- `FileOrganizer` — coordinates validation, categorization, duplicate check, and move
- `DuplicateDetector` — calculates hashes and compares against destination
- `ConflictResolver` — resolves filename collisions (extension point)
- `HistoryService` — records moves for undo (extension point)
- `Logger` — structured JSON logging via Winston

ASCII diagram:

```
[FileWatcher]
      │
      ▼
[FileOrganizer]
      ├─> [DuplicateDetector]
      ├─> [ConflictResolver]
      ├─> [HistoryService]
      └─> [Logger]
```

## Technologies Used

- Node.js (ESM)
- JavaScript (ES2022+)
- chokidar (watcher)
- winston (logging)
- fs/promises, path, crypto
- Jest (testing)
- Docker (containerization)

## Installation

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd smart-file-organizer
npm install
```

## Configuration

Configuration lives in `src/config/config.json`. You can override selected values with environment variables or a `.env` file in the project root.

Important config keys:

- `watchFolder` — the folder to monitor
- `destinationFolders` — mapping of categories to destination paths
- `extensionMappings` — which extensions map to which category
- `logging` — log file path and level
- `previewMode` — boolean, if `true` files will not actually be moved

Create a `.env` with values such as:

```
WATCH_FOLDER=C:\Users\You\Downloads
PREVIEW_MODE=true
LOG_LEVEL=info
```

## Running the Project

Start the app:

```bash
npm start
```

This runs `node src/index.js` which loads the configuration and initializes services.

## Running Tests

Run unit tests with Jest:

```bash
npm test
```

## Example Workflow

1. Put `Resume.pdf` into your `Downloads` folder
2. `FileWatcher` emits an event
3. `FileOrganizer` validates and skips temporary files
4. `DuplicateDetector` checks the destination folder for duplicates
5. If no duplicate, `ConflictResolver` checks for existing filename and `FileOrganizer` moves file
6. `HistoryService` records the move and `Logger` writes a JSON record

## Project Structure

```
src/
  config/
  duplicates/
  logger/
  organizer/
  watcher/
  history/
  utils/
tests/
package.json
README.md
```

## Roadmap

- Integrate `FileWatcher` (chokidar) to produce events
- ConflictResolver and HistoryService implementation
- GUI or tray app wrapper (optional)
- Persisted hash index for performance

## Future Improvements

- Add a GUI (Electron) for user configuration
- Add persistent database for hash index and history
- Implement file move dry-run and preview UI
- Add incremental file hashing and caching

## License

The project is available under the MIT License. See `LICENSE`.

---

If you plan to publish this repo, replace `<repo-url>` in the Installation section with the real GitHub repository URL.
# Smart File Organizer

Cross-platform desktop automation for organizing downloads into categorized folders.

## Overview

This application watches a user-defined `Downloads` folder and moves files into destination folders by extension. It also detects duplicates, handles filename conflicts, preserves history, and writes structured logs.

## Setup

1. Install dependencies: `npm install`
2. Start the app: `npm start`
