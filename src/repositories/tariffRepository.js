const db = require('../db');
const logger = require('../utils/logger');

/**
 * @typedef {Object} TariffRecord
 * @property {string} date - Дата тарифа (YYYY-MM-DD)
 * @property {string} warehouse_name - Имя склада
 * @property {string} [box_delivery_and_storage_expr] - Коэффициент
 * @property {number} [box_delivery_base] - Базовая стоимость доставки
 * @property {number} [box_delivery_liter] - Стоимость доставки за литр
 * @property {number} [box_storage_base] - Базовая стоимость хранения
 * @property {number} [box_storage_liter] - Стоимость хранения за литр
 */

const tariffRepository = {
    /**
     * Вставка или обновление тарифа (upsert).
     * При конфликте по (date, warehouse_name) — обновляет данные.
     *
     * @param {TariffRecord} data
     * @returns {Promise<void>}
     */
    async upsert(data) {
        const query = `
      INSERT INTO box_tariffs (date, warehouse_name, box_delivery_and_storage_expr, box_delivery_base, box_delivery_liter, box_storage_base, box_storage_liter, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (date, warehouse_name)
      DO UPDATE SET
        box_delivery_and_storage_expr = EXCLUDED.box_delivery_and_storage_expr,
        box_delivery_base = EXCLUDED.box_delivery_base,
        box_delivery_liter = EXCLUDED.box_delivery_liter,
        box_storage_base = EXCLUDED.box_storage_base,
        box_storage_liter = EXCLUDED.box_storage_liter,
        updated_at = NOW()
    `;

        await db.raw(query, [
            data.date,
            data.warehouse_name,
            data.box_delivery_and_storage_expr || null,
            data.box_delivery_base || null,
            data.box_delivery_liter || null,
            data.box_storage_base || null,
            data.box_storage_liter || null,
        ]);
    },

    /**
     * Массовый upsert тарифов.
     *
     * @param {TariffRecord[]} records
     * @returns {Promise<number>} Количество обработанных записей
     */
    async bulkUpsert(records) {
        let count = 0;
        for (const record of records) {
            await this.upsert(record);
            count++;
        }
        logger.info(`Обработано ${count} записей тарифов`);
        return count;
    },

    /**
     * Получение тарифов за указанную дату, отсортированных по коэффициенту.
     *
     * @param {string} date - Дата (YYYY-MM-DD)
     * @returns {Promise<TariffRecord[]>}
     */
    async getByDate(date) {
        return db('box_tariffs')
            .where({ date })
            .orderByRaw('box_delivery_and_storage_expr ASC NULLS LAST');
    },

    /**
     * Получение тарифов за последнюю дату.
     *
     * @returns {Promise<TariffRecord[]>}
     */
    async getLatest() {
        const lastDateRow = await db('box_tariffs')
            .max('date as max_date')
            .first();

        if (!lastDateRow || !lastDateRow.max_date) {
            return [];
        }

        return this.getByDate(lastDateRow.max_date);
    },
};

module.exports = tariffRepository;
