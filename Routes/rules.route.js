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

function hasIpLocalHost (rule) {
  return !!(rule.IpRanges && rule.IpRanges.length && rule.IpRanges[0].CidrIp === '0.0.0.0/0');
}

function hasIpV6LocalHost (rule) {
  return !!(rule.Ipv6Ranges && rule.Ipv6Ranges.length && rule.Ipv6Ranges[0].CidrIpv6 === '::/0');
}

function hasSSHPort (rule) {
  return (rule.FromPort > 0 && rule.ToPort === 22);
}

function validateRule (region, rules, ruleType) {
  if (ruleType === 'Unrestricted_SSH_Access') {
    for(let index=0; index < rules.length; index++) {
      if (hasIpLocalHost(rules[index]) || hasIpV6LocalHost(rules[index]) || hasSSHPort(rules[index])) {
        return {
          status: 'failure',
          message: 'Security group default allows ingress from 0.0.0.0/0 or ::/0 to port 22',
          region: region
        }
      }
    }
  }
}


async function fetchEC2Services () {
  let errorObj = {}; let allRegions = {}; let data = [];

  // Get all the regions
  let ec2Region = loadUserRegion('ap-south-1');
  await ec2Region.describeRegions( (regionErr, regionData) => {
    if (regionErr) {
      errorObj = regionErr;
    } else {
      allRegions = regionData;
    }
  }).promise();

  // Loop all the regions, get securityGroup details, validate with specific rules
  const regions = allRegions.Regions;
  for (let index = 0; index < regions.length; index++) {
    let regionName = regions[index].RegionName;
    let ec2SecurityGroups = loadUserRegion(regionName);
    await ec2SecurityGroups.describeSecurityGroups((securityGroupErr, securityGroupData) => {
      if (securityGroupErr) {
        errorObj = securityGroupErr;
      } else {
        if (securityGroupData && securityGroupData.SecurityGroups && securityGroupData.SecurityGroups[0] && securityGroupData.SecurityGroups[0].IpPermissions) {
          let response = validateRule(regionName, securityGroupData.SecurityGroups[0].IpPermissions, 'Unrestricted_SSH_Access');
          if (response && !data.some((item) => item.region === regionName)) {
            data.push(response);
          }
        }
      }
    }).promise();
  }

  return data;
}

rules.route('/services').get(async (req, res) => {
  let data = await fetchEC2Services();
  await res.json({'data': data});
});

module.exports = rules;