import { createLogger, format, transports } from 'winston'
import * as path from 'path'
import * as fs from 'fs'

const logDir = path.join(__dirname, '../../logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const { combine, timestamp, printf, colorize, errors, json } = format

const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`
})

const fileFormat = combine(
  timestamp(),
  errors({ stack: true }), 
  json()
)

const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || 'info'
}

const logger = createLogger({
  level: getLogLevel(),
  format: fileFormat,
  transports: [
    new transports.Console({
      level: 'info',
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      ),
    }),

    new transports.File({
      filename: path.join(logDir, 'app.log'),
      level: 'info',
    }),

    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
  ],
  exitOnError: false,
})

export default logger
