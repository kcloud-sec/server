const express = require('express');
const AWS = require('aws-sdk');
const mongodb = require("mongodb").MongoClient;
const dbConfig = require('../db/database');
let db;

mongodb.connect(dbConfig.db, (error, database)=>{
  if(error) {
    console.log(error);
  } else {
    console.log("DB Connected");
    db = database.db('kcloud_server');
  }
});

// Express route
const rules = express.Router();

function loadUserCredential () {
  return AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY
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

function validateRule (region, rules, ruleType) {
  let IpPermissions = rules.IpPermissions; let port;
  if (ruleType === 'Unrestricted_SSH_Access') {
    port = 22;
  } else if (ruleType === 'Unrestricted_RDP_Access') {
    port = 3389;
  } else if (ruleType === 'Unrestricted_Oracle_Access') {
    port = 1521;
  }

  for (let index=0; index < IpPermissions.length; index++) {
    if (inRange(port, IpPermissions[index].FromPort, IpPermissions[index].ToPort)) {
      return {
        status: 'failure',
        failure_introduced: 'Few moments ago',
        message: `Security group default allows ingress from 0.0.0.0/0 or ::/0 to port ${port}`,
        region: region,
        account: 'prod',
        description: rules.Description,
        group_id: rules.GroupId,
        group_name: rules.GroupName,
        vpc_id: rules.VpcId
      };
    }
  }
}

async function fetchEC2Services (response) {
  // Get all the regions
  let ec2Region = loadUserRegion('ap-south-1');
  let allRegions = await ec2Region.describeRegions( (regionErr, regionData) => {
    if (regionErr) {
      response.json({ 'data': 'Something went wrong' });
    } else {
      return regionData;
    }
  }).promise();

  // Get all inbound rules with all regions
  let regions = allRegions.Regions;
  let inboundRules = [];
  for (let index = 0; index < regions.length; index++) {
    let regionName = regions[index].RegionName;
    let ec2SecurityGroups = loadUserRegion(regionName);
    let inboundRule = await ec2SecurityGroups.describeSecurityGroups((securityGroupErr, securityGroupData) => {
      if (securityGroupErr) {
        response.json({ 'data': 'Something went wrong' });
      } else {
        return securityGroupData;
      }
    }).promise();
    inboundRules.push({ region: regionName, rules: inboundRule.SecurityGroups[0] });
  }

  let metaData = [];  let dashboardData = [];
  let rules = ['Unrestricted_SSH_Access', 'Unrestricted_RDP_Access', 'Unrestricted_Oracle_Access'];
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
    for (let inboundIndex = 0; inboundIndex < inboundRules.length; inboundIndex++) {
       let data = validateRule(inboundRules[inboundIndex].region, inboundRules[inboundIndex].rules, rules[ruleIndex]);
       if (data) {
         metaData.push(data);
       }
    }
    dashboardData.push({
      rule: rules[ruleIndex],
      service: 'EC2',
      categories: ['security'],
      riskLevel: 'high',
      counts: `Failure ${metaData.length}`,
      meta: metaData
    });
    metaData = [];
  }

  return dashboardData;
}

rules.route('/services').get(async (req, res) => {
  loadUserCredential();
  let data = await fetchEC2Services(res);
  let userId = 'test';
  if (Object.keys(data).length) {
    db.collection('dashboard').insertOne({ user_id: userId, data: data }, function (error, record) {
      if (error) {
        res.json({'data': 'Something went wrong'});
      }
    });
  }
  res.status(200).json({ user_id: userId, data: data });
});

rules.route('/dashboard').get(async (req, res) => {
  db.collection('dashboard').find().toArray(function (err, docs) {
    if (err) return res.status(500).send({error: err});
    res.send(docs);
  });
});

module.exports = rules;