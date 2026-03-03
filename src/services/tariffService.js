const wbApiService = require('./wbApiService');
const tariffRepository = require('../repositories/tariffRepository');
const logger = require('../utils/logger');

/**
 * Safely parse numeric strings that might contain commas from WB API
 * @param {any} val
 * @returns {number|null}
 */
function parseNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.'));
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

const tariffService = {
    /**
     * Получение тарифов из WB API и сохранение/обновление в БД.
     * При повторном вызове в тот же день — обновляет существующие записи.
     *
     * @returns {Promise<void>}
     */
    async fetchAndSaveTariffs() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        logger.info(`Начинаем получение тарифов за ${today}`);

        try {
            const warehouseList = await wbApiService.fetchBoxTariffs(today);

            if (warehouseList.length === 0) {
                logger.warn('Список складов пуст — нечего сохранять');
                return;
            }

            /** @type {import('../repositories/tariffRepository').TariffRecord[]} */
            const records = warehouseList.map((wh) => ({
                date: today,
                warehouse_name: wh.warehouseName,
                box_delivery_and_storage_expr: wh.boxDeliveryAndStorageExpr || null,
                box_delivery_base: parseNumber(wh.boxDeliveryBase),
                box_delivery_liter: parseNumber(wh.boxDeliveryLiter),
                box_storage_base: parseNumber(wh.boxStorageBase),
                box_storage_liter: parseNumber(wh.boxStorageLiter),
            }));

            await tariffRepository.bulkUpsert(records);
            logger.info(`Тарифы за ${today} успешно сохранены (${records.length} складов)`);
        } catch (error) {
            logger.error('Ошибка при получении/сохранении тарифов:', error.message);
        }
    },
};

module.exports = tariffService;
