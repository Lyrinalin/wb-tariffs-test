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

/**
 * Форматирует дату в строку YYYY-MM-DD
 * @param {any} dateVal
 * @returns {string}
 */
function formatDate(dateVal) {
    if (dateVal instanceof Date) {
        return dateVal.toISOString().split('T')[0];
    }
    return String(dateVal).split('T')[0];
}

/**
 * Безопасно возвращает значение для ячейки Google Sheets.
 * Если null/undefined — вернёт прочерк "-".
 * @param {any} val
 * @returns {string|number}
 */
function cellValue(val) {
    if (val === null || val === undefined) return '-';
    return val;
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
     * Стратегия: удаляем старый лист (если есть) и создаём новый.
     * Это гарантирует, что никакие "Таблицы" (Tables), фильтры
     * или форматирование не будут мешать записи данных.
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

        // ====== 1. Удалить старый лист, если он существует ======
        const existingSheet = doc.sheetsByTitle[sheetName];
        if (existingSheet) {
            await existingSheet.delete();
            logger.info(`Лист "${sheetName}" удалён для пересоздания`);
        }

        // ====== 2. Создать новый чистый лист с заголовками ======
        const headers = [
            'Дата',
            'Склад',
            'Коэффициент',
            'Базовая доставка',
            'Доставка/литр',
            'Базовое хранение',
            'Хранение/литр',
        ];

        const sheet = await doc.addSheet({
            title: sheetName,
            headerValues: headers,
        });

        // ====== 3. Подготовить строки ======
        const rows = tariffs.map((t) => ({
            'Дата': formatDate(t.date),
            'Склад': t.warehouse_name,
            'Коэффициент': cellValue(t.box_delivery_and_storage_expr),
            'Базовая доставка': cellValue(t.box_delivery_base),
            'Доставка/литр': cellValue(t.box_delivery_liter),
            'Базовое хранение': cellValue(t.box_storage_base),
            'Хранение/литр': cellValue(t.box_storage_liter),
        }));

        // ====== 4. Записать все строки одним вызовом ======
        await sheet.addRows(rows);
    },
};

module.exports = googleSheetsService;
