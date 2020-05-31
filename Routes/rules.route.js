const express = require('express');
const app = express();

// Express route
const rules = express.Router();

// Rule schema
let ruleSchema = require('../Model/rules.model');

// Get Rules
rules.route('/rules').get((req, res) => {
  ruleSchema.find((error, data) => {
    if (error) {
      return next(error);
    } else {
      res.json(data);
    }
  })
});

module.exports = rules;