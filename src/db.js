const knex = require('knex');
const knexConfig = require('../knexfile');

/**
 * Инстанс knex для работы с PostgreSQL
 * @type {import('knex').Knex}
 */
const db = knex(knexConfig);

module.exports = db;
