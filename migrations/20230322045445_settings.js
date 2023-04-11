/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('settings', function (table) {
    table.increments('id');
    table.string('ip_server').nullable();
    table.string('no_seri');
    table.datetime('last_data_sent_at', { precision: 6 }).nullable();
    table.timestamps();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('settings');
};
