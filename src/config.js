require('dotenv').config();

/**
 * @typedef {Object} AppConfig
 * @property {string} wbApiToken - Токен WB API
 * @property {Object} db - Настройки БД
 * @property {string} db.host
 * @property {number} db.port
 * @property {string} db.user
 * @property {string} db.password
 * @property {string} db.database
 * @property {string[]} googleSheetIds - Массив ID Google-таблиц
 * @property {string} googleSheetName - Имя листа в Google-таблице
 * @property {string} fetchCron - Cron-выражение для получения тарифов
 * @property {string} sheetsSyncCron - Cron-выражение для синхронизации с Google Sheets
 */

/** @type {AppConfig} */
const config = {
    wbApiToken: process.env.WB_API_TOKEN || '',

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'postgres',
    },

    googleSheetIds: (process.env.GOOGLE_SHEET_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),

    googleSheetName: process.env.GOOGLE_SHEET_NAME || 'stocks_coefs',

    fetchCron: process.env.FETCH_CRON || '0 * * * *',
    sheetsSyncCron: process.env.SHEETS_SYNC_CRON || '*/5 * * * *',
};

module.exports = config;
