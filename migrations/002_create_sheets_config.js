/**
 * Миграция: создание таблицы sheets_config
 * Хранит ID Google-таблиц для экспорта тарифов
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sheets_config', (table) => {
        table.increments('id').primary();
        table.string('sheet_id', 255).notNullable().unique();
        table.string('sheet_name', 100).defaultTo('stocks_coefs');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('sheets_config');
};
