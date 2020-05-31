const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let rulesSchema = new Schema({
  id: String,
  name: String,
  desc: String
}, {
  collection: 'rules'
});

module.exports = mongoose.model('rulesSchema', rulesSchema);