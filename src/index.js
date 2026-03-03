const cron = require('node-cron');
const config = require('./config');
const db = require('./db');
const tariffService = require('./services/tariffService');
const googleSheetsService = require('./services/googleSheetsService');
const logger = require('./utils/logger');

/**
 * Инициализация sheets_config из env (если таблица пуста)
 * @returns {Promise<void>}
 */
async function initSheetsConfig() {
    try {
        const count = await db('sheets_config').count('id as cnt').first();
        if (Number(count.cnt) === 0 && config.googleSheetIds.length > 0) {
            for (const sheetId of config.googleSheetIds) {
                await db('sheets_config')
                    .insert({
                        sheet_id: sheetId,
                        sheet_name: config.googleSheetName,
                        is_active: true,
                    })
                    .onConflict('sheet_id')
                    .ignore();
            }
            logger.info(`Инициализировано ${config.googleSheetIds.length} Google-таблиц из env`);
        }
    } catch (error) {
        logger.warn('Не удалось инициализировать sheets_config:', error.message);
    }
}

/**
 * Главная функция запуска приложения
 */
async function main() {
    logger.info('=== WB Tariffs Service запускается ===');
    logger.info(`Расписание fetch: ${config.fetchCron}`);
    logger.info(`Расписание sheets sync: ${config.sheetsSyncCron}`);

    // Инициализация sheets_config из env
    await initSheetsConfig();

    // ===== Первый запуск сразу при старте =====
    logger.info('Выполняем первичное получение тарифов...');
    await tariffService.fetchAndSaveTariffs();

    logger.info('Выполняем первичную синхронизацию с Google Sheets...');
    await googleSheetsService.syncToSheets();

    // ===== Настройка cron-задач =====

    // Ежечасное получение тарифов
    cron.schedule(config.fetchCron, async () => {
        logger.info('[CRON] Запуск получения тарифов WB');
        await tariffService.fetchAndSaveTariffs();
    });

    // Регулярная синхронизация с Google Sheets
    cron.schedule(config.sheetsSyncCron, async () => {
        logger.info('[CRON] Запуск синхронизации с Google Sheets');
        await googleSheetsService.syncToSheets();
    });

    logger.info('=== Cron-задачи настроены. Сервис работает. ===');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Получен SIGTERM, завершаем работу...');
    await db.destroy();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Получен SIGINT, завершаем работу...');
    await db.destroy();
    process.exit(0);
});

main().catch((error) => {
    logger.error('Критическая ошибка:', error.message);
    process.exit(1);
});
