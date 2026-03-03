const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

const config = require('../config');
const db = require('../db');
const tariffRepository = require('../repositories/tariffRepository');
const logger = require('../utils/logger');

/**
 * Загрузка credentials для Google Service Account
 * @returns {JWT|null}
 */
function loadGoogleAuth() {
    const credPath = path.resolve('/app/credentials.json');
    const localCredPath = path.resolve(process.cwd(), 'credentials.json');
    const finalPath = fs.existsSync(credPath) ? credPath : localCredPath;

    if (!fs.existsSync(finalPath)) {
        logger.warn('credentials.json не найден. Google Sheets sync отключён.');
        return null;
    }

    try {
        const creds = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
        const auth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        return auth;
    } catch (error) {
        logger.error('Ошибка загрузки credentials.json:', error.message);
        return null;
    }
}

const googleSheetsService = {
    /**
     * Получение списка активных Google-таблиц.
     * Приоритет: sheets_config в БД, затем GOOGLE_SHEET_IDS из env.
     *
     * @returns {Promise<{sheetId: string, sheetName: string}[]>}
     */
    async getSheetConfigs() {
        try {
            const dbConfigs = await db('sheets_config')
                .where({ is_active: true })
                .select('sheet_id', 'sheet_name');

            if (dbConfigs.length > 0) {
                return dbConfigs.map((c) => ({
                    sheetId: c.sheet_id,
                    sheetName: c.sheet_name,
                }));
            }
        } catch {
            // Таблица может не существовать до миграций
        }

        // Fallback: env-переменная
        return config.googleSheetIds.map((id) => ({
            sheetId: id,
            sheetName: config.googleSheetName,
        }));
    },

    /**
     * Экспорт актуальных тарифов во все настроенные Google-таблицы.
     * Данные сортируются по коэффициенту (ASC).
     *
     * @returns {Promise<void>}
     */
    async syncToSheets() {
        const auth = loadGoogleAuth();
        if (!auth) {
            return;
        }

        const sheetConfigs = await this.getSheetConfigs();

        if (sheetConfigs.length === 0) {
            logger.warn('Нет настроенных Google-таблиц для синхронизации');
            return;
        }

        // Получаем последние тарифы (отсортированные по коэффициенту ASC)
        const tariffs = await tariffRepository.getLatest();

        if (tariffs.length === 0) {
            logger.warn('Нет тарифов в БД для экспорта');
            return;
        }

        logger.info(`Экспорт ${tariffs.length} тарифов в ${sheetConfigs.length} таблиц(у/ы)`);

        for (const { sheetId, sheetName } of sheetConfigs) {
            try {
                await this.exportToSheet(auth, sheetId, sheetName, tariffs);
                logger.info(`Таблица ${sheetId} (${sheetName}) — обновлена`);
            } catch (error) {
                logger.error(`Ошибка при экспорте в таблицу ${sheetId}:`, error.message);
            }
        }
    },

    /**
     * Экспорт данных в конкретную Google-таблицу.
     *
     * @param {JWT} auth
     * @param {string} sheetId
     * @param {string} sheetName
     * @param {import('../repositories/tariffRepository').TariffRecord[]} tariffs
     * @returns {Promise<void>}
     */
    async exportToSheet(auth, sheetId, sheetName, tariffs) {
        const doc = new GoogleSpreadsheet(sheetId, auth);
        await doc.loadInfo();

        // Найти или создать лист
        let sheet = doc.sheetsByTitle[sheetName];
        if (!sheet) {
            sheet = await doc.addSheet({
                title: sheetName,
                headerValues: [
                    'Дата',
                    'Склад',
                    'Коэффициент',
                    'Базовая доставка',
                    'Доставка/литр',
                    'Базовое хранение',
                    'Хранение/литр',
                ],
            });
        }

        // Очистить содержимое
        await sheet.clear();

        // Установить заголовки
        await sheet.setHeaderRow([
            'Дата',
            'Склад',
            'Коэффициент',
            'Базовая доставка',
            'Доставка/литр',
            'Базовое хранение',
            'Хранение/литр',
        ]);

        // Подготовить строки (уже отсортированы по коэффициенту из repository)
        const rows = tariffs.map((t) => ({
            'Дата': t.date,
            'Склад': t.warehouse_name,
            'Коэффициент': t.box_delivery_and_storage_expr || '',
            'Базовая доставка': t.box_delivery_base || '',
            'Доставка/литр': t.box_delivery_liter || '',
            'Базовое хранение': t.box_storage_base || '',
            'Хранение/литр': t.box_storage_liter || '',
        }));

        await sheet.addRows(rows);
    },
};

module.exports = googleSheetsService;
