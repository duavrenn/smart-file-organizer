import fs from 'fs/promises';
import path from 'path';
import { createLogger as createWinstonLogger, format, transports } from 'winston';

export async function initializeLogger(loggingConfig) {
  const logFilePath = path.resolve(loggingConfig.file);
  await fs.mkdir(path.dirname(logFilePath), { recursive: true });

  const commonFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true })
  );

  const fileFormat = format.combine(
    commonFormat,
    format.json()
  );

  const consoleFormat = format.combine(
    commonFormat,
    format.colorize({ all: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 0) : '';
      return `${timestamp} [${level}]: ${message}${metaString ? ` ${metaString}` : ''}`;
    })
  );

  return createWinstonLogger({
    level: loggingConfig.level || 'info',
    transports: [
      new transports.File({ filename: logFilePath, format: fileFormat }),
      new transports.Console({ format: consoleFormat })
    ],
    exitOnError: false
  });
}

export function buildLogEntry({ action, source = null, destination = null, status = 'success', durationMs = 0, error = null, metadata = {} }) {
  const logEntry = {
    action,
    source,
    destination,
    status,
    durationMs,
    ...metadata
  };

  if (error) {
    logEntry.error = {
      message: error.message,
      stack: error.stack
    };
  }

  return logEntry;
}
