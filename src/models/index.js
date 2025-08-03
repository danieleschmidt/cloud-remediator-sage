/**
 * Models Index
 * Exports all data models for the Cloud Remediator Sage
 */

const Finding = require('./Finding');
const Asset = require('./Asset');
const { Remediation, RemediationTemplates } = require('./Remediation');

module.exports = {
  Finding,
  Asset,
  Remediation,
  RemediationTemplates
};