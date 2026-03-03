/**
 * Seed: инициализация sheets_config из переменной окружения GOOGLE_SHEET_IDS
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.seed = async function (knex) {
    const sheetIds = process.env.GOOGLE_SHEET_IDS || '';
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'stocks_coefs';

    if (!sheetIds) {
        console.log('[seed] GOOGLE_SHEET_IDS не задан, пропускаем seed');
        return;
    }

    const ids = sheetIds.split(',').map((id) => id.trim()).filter(Boolean);

    for (const sheetId of ids) {
        const exists = await knex('sheets_config').where({ sheet_id: sheetId }).first();
        if (!exists) {
            await knex('sheets_config').insert({
                sheet_id: sheetId,
                sheet_name: sheetName,
                is_active: true,
            });
            console.log(`[seed] Добавлена таблица: ${sheetId}`);
        }
    }
};
