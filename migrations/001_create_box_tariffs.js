/**
 * Миграция: создание таблицы box_tariffs
 * Хранит тарифы коробов WB по дням с уникальным ключом (date, warehouse_name)
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
    await knex.schema.createTable('box_tariffs', (table) => {
        table.increments('id').primary();
        table.date('date').notNullable();
        table.string('warehouse_name', 255).notNullable();
        table.string('box_delivery_and_storage_expr', 50);
        table.decimal('box_delivery_base', 10, 2);
        table.decimal('box_delivery_liter', 10, 2);
        table.decimal('box_storage_base', 10, 2);
        table.decimal('box_storage_liter', 10, 2);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['date', 'warehouse_name']);
        table.index('date', 'idx_box_tariffs_date');
    });
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('box_tariffs');
};
