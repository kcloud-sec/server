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

function inRange(port, min, max) {
  return ((port-min) * (port-max) <= 0);
}

let boardData = [];
let meta = [];

async function validateRule (region, rules, ruleType, response, validatedRegionCount, validatedRulesCount) {
  let port;
  if (ruleType === 'Unrestricted_SSH_Access') {
    port = 22;
  } else if (ruleType === 'Unrestricted_RDP_Access') {
    port = 3389;
  } else if (ruleType === 'Unrestricted_Oracle_Access') {
    port = 1521;
  }

  for(let index=0; index < rules.length; index++) {
    if ((hasIpLocalHost(rules[index]) || hasIpV6LocalHost(rules[index]) || inRange(port, rules[index].FromPort, rules[index].ToPort))) {
      meta.push({
        status: 'failure',
        failure_introduced: 'Few moments ago',
        message: `Security group default allows ingress from 0.0.0.0/0 or ::/0 to port ${port}`,
        region: region,
        account: 'prod',
        description: 'default VPC security group',
        group_id: 'groupid',
        group_name: 'default',
        vpc_id: 'vpc_id'
      });
    }
  }


  if (validatedRegionCount === 16) {
    boardData.push({
      rule: ruleType,
      service: 'EC2',
      categories: ['security'],
      riskLevel: 'high',
      counts: 'Failure 1',
      meta: meta
    });
    meta = [];
  }

  if (validatedRegionCount === 16 && validatedRulesCount === 3) {
    let boardSchema = boardData;
    boardData = [];
    await response.status(200).json({ 'data': boardSchema });
  }
}

async function fetchEC2Services (response) {
  let errorObj = {}; let allRegions = {};

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
  let rules = ['Unrestricted_SSH_Access', 'Unrestricted_RDP_Access', 'Unrestricted_Oracle_Access'];
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
    const regions = allRegions.Regions;
    let validatedRegionCount = 1;
    let validatedRulesCount = ruleIndex+1;
    for (let index = 0; index < regions.length; index++) {
      let regionName = regions[index].RegionName;
      let ec2SecurityGroups = loadUserRegion(regionName);
      await ec2SecurityGroups.describeSecurityGroups((securityGroupErr, securityGroupData) => {
        if (securityGroupErr) {
          errorObj = securityGroupErr;
        } else {
          if (securityGroupData && securityGroupData.SecurityGroups && securityGroupData.SecurityGroups[0] && securityGroupData.SecurityGroups[0].IpPermissions) {
            validateRule(regionName, securityGroupData.SecurityGroups[0].IpPermissions, rules[ruleIndex], response, validatedRegionCount++, validatedRulesCount);
          }
        }
      });
    }
  }
}

rules.route('/services').get(async (req, res) => {
  loadUserCredential();
  await fetchEC2Services(res);
});

module.exports = rules;