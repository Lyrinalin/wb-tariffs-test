const config = require('../config');
const logger = require('../utils/logger');

/**
 * @typedef {Object} WarehouseTariff
 * @property {string} warehouseName - Имя склада
 * @property {string} boxDeliveryAndStorageExpr - Коэффициент логистики
 * @property {number} boxDeliveryBase - Базовая стоимость доставки
 * @property {number} boxDeliveryLiter - Стоимость доставки за литр
 * @property {number} boxStorageBase - Базовая стоимость хранения
 * @property {number} boxStorageLiter - Стоимость хранения за литр
 */

const WB_API_URL = 'https://common-api.wildberries.ru/api/v1/tariffs/box';

const wbApiService = {
    /**
     * Получение тарифов коробов из WB API.
     *
     * @param {string} date - Дата в формате YYYY-MM-DD
     * @returns {Promise<WarehouseTariff[]>} Список тарифов по складам
     */
    async fetchBoxTariffs(date) {
        if (!config.wbApiToken) {
            logger.error('WB_API_TOKEN не задан. Невозможно получить тарифы.');
            return [];
        }

        const url = `${WB_API_URL}?date=${date}`;
        logger.info(`Запрос тарифов WB: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: config.wbApiToken,
                },
            });

            if (!response.ok) {
                const text = await response.text();
                logger.error(`WB API вернул ошибку ${response.status}: ${text}`);
                return [];
            }

            const json = await response.json();

            /** @type {WarehouseTariff[]} */
            const warehouseList = json?.response?.data?.warehouseList || [];

            logger.info(`Получено ${warehouseList.length} складов из WB API`);
            return warehouseList;
        } catch (error) {
            logger.error('Ошибка при запросе WB API:', error.message);
            return [];
        }
    },
};

module.exports = wbApiService;
