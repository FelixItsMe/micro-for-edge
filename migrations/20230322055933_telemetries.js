/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('telemetries', function (table) {
    table.increments('id');
    table.double('suhu', 8, 2).nullable();
    table.double('kelembapan', 8, 2).nullable();
    table.double('arah_angin', 8, 2).nullable();
    table.double('tekanan', 8, 2).nullable();
    table.double('kecepatan_angin', 8, 2).nullable();
    table.double('cahaya', 8, 2).nullable();
    table.string('cuaca').nullable();
    table.string('lat').nullable();
    table.string('lng').nullable();
    table.timestamps();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('telemetries');
};
