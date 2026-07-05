import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, 'config.json');

function parseBoolean(value) {
  return typeof value === 'string' ? ['1', 'true', 'yes'].includes(value.toLowerCase()) : Boolean(value);
}

function createDefaultConfig() {
  return {
    watchFolder: path.resolve(ROOT_DIR, './downloads'),
    destinationFolders: {
      documents: path.resolve(ROOT_DIR, './organized/Documents'),
      pictures: path.resolve(ROOT_DIR, './organized/Pictures'),
      videos: path.resolve(ROOT_DIR, './organized/Videos'),
      music: path.resolve(ROOT_DIR, './organized/Music'),
      archives: path.resolve(ROOT_DIR, './organized/Archives'),
      installers: path.resolve(ROOT_DIR, './organized/Installers'),
      others: path.resolve(ROOT_DIR, './organized/Others')
    },
    extensionMappings: {
      documents: ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'],
      pictures: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'],
      videos: ['mp4', 'mkv', 'mov', 'avi', 'wmv'],
      music: ['mp3', 'wav', 'flac', 'aac'],
      archives: ['zip', 'rar', '7z', 'tar', 'gz'],
      installers: ['exe', 'msi', 'dmg', 'pkg'],
      others: []
    },
    logging: {
      level: 'info',
      json: true,
      file: path.resolve(ROOT_DIR, './logs/application.log')
    },
    previewMode: false
  };
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be a non-empty object.');
  }

  if (!config.watchFolder || typeof config.watchFolder !== 'string') {
    throw new Error('Configuration key "watchFolder" is required and must be a string.');
  }

  if (!config.destinationFolders || typeof config.destinationFolders !== 'object') {
    throw new Error('Configuration key "destinationFolders" is required and must be an object.');
  }

  if (!config.extensionMappings || typeof config.extensionMappings !== 'object') {
    throw new Error('Configuration key "extensionMappings" is required and must be an object.');
  }

  if (!config.logging || typeof config.logging !== 'object') {
    throw new Error('Configuration key "logging" is required and must be an object.');
  }

  if (typeof config.previewMode !== 'boolean') {
    throw new Error('Configuration key "previewMode" must be a boolean.');
  }
}

function resolvePaths(config) {
  const resolvedConfig = { ...config };

  resolvedConfig.watchFolder = path.resolve(ROOT_DIR, resolvedConfig.watchFolder);

  resolvedConfig.destinationFolders = Object.fromEntries(
    Object.entries(resolvedConfig.destinationFolders).map(([key, value]) => [key, path.resolve(ROOT_DIR, value)])
  );

  resolvedConfig.logging = {
    ...resolvedConfig.logging,
    file: path.resolve(ROOT_DIR, resolvedConfig.logging.file)
  };

  return resolvedConfig;
}

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });

  const defaultConfig = createDefaultConfig();
  const rawConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const mergedConfig = {
    ...defaultConfig,
    ...rawConfig,
    destinationFolders: {
      ...defaultConfig.destinationFolders,
      ...(rawConfig.destinationFolders ?? {})
    },
    extensionMappings: {
      ...defaultConfig.extensionMappings,
      ...(rawConfig.extensionMappings ?? {})
    },
    logging: {
      ...defaultConfig.logging,
      ...(rawConfig.logging ?? {})
    }
  };

  if (process.env.WATCH_FOLDER) {
    mergedConfig.watchFolder = process.env.WATCH_FOLDER;
  }

  if (process.env.PREVIEW_MODE !== undefined) {
    mergedConfig.previewMode = parseBoolean(process.env.PREVIEW_MODE);
  }

  if (process.env.LOG_LEVEL) {
    mergedConfig.logging.level = process.env.LOG_LEVEL;
  }

  validateConfig(mergedConfig);
  return resolvePaths(mergedConfig);
}
