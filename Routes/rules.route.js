const express = require('express');
const AWS = require('aws-sdk');
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

function loadUserCredential () {
  return AWS.config.update({
    accessKeyId: XXX,
    secretAccessKey: XXX
  });
}

function loadUserRegion (region) {
  return new AWS.EC2({
    region: region
  });
}

rules.route('/services').get(async (req, res) => {
  let inboundRules = [];
  loadUserCredential();
  let ec2Region = loadUserRegion('ap-south-1');
  await ec2Region.describeRegions( (regionErr, regionData) => {
    if (regionErr) {
      console.log(regionErr);
    } else {
      regionData.Regions.forEach( (region) => {
        if (region.RegionName) {
          let ec2SecurityGroups = loadUserRegion(region.RegionName);
          ec2SecurityGroups.describeSecurityGroups((securityGroupErr, securityGroupData) => {
            if (securityGroupErr) {
              console.log('error', securityGroupErr);
            } else {
              if (securityGroupData && securityGroupData.SecurityGroups && securityGroupData.SecurityGroups[0] && securityGroupData.SecurityGroups[0].IpPermissions) {
                inboundRules.push({
                  region: region.RegionName ,
                  rules: securityGroupData.SecurityGroups[0].IpPermissions
                });
              }
            }
          });
        }
      });
    }
  });
  res.json({'data': inboundRules});
});

module.exports = rules;