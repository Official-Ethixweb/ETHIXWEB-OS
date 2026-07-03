/**
 * One-time backfill: creates a default Organization for pre-multi-tenancy data
 * and stamps `organization` onto every existing document across every
 * collection that lacks it. Manual-only — never required by server.js.
 *
 * Usage:
 *   node src/scripts/migrate-add-organization.js [--dry-run] [--org-name="ETHIXWEB"]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const Organization = require('../models/Organization');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payslip = require('../models/Payslip');
const Subscription = require('../models/Subscription');
const Domain = require('../models/Domain');
const Server = require('../models/Server');
const Transaction = require('../models/Transaction');

const COLLECTIONS = [
  { name: 'User', model: User },
  { name: 'Project', model: Project },
  { name: 'Task', model: Task },
  { name: 'Employee', model: Employee },
  { name: 'Attendance', model: Attendance },
  { name: 'LeaveRequest', model: LeaveRequest },
  { name: 'Payslip', model: Payslip },
  { name: 'Subscription', model: Subscription },
  { name: 'Domain', model: Domain },
  { name: 'Server', model: Server },
  { name: 'Transaction', model: Transaction },
];

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const orgNameArg = argv.find((a) => a.startsWith('--org-name='));
  const orgName = orgNameArg ? orgNameArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : 'ETHIXWEB';
  return { dryRun, orgName };
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

async function countOrphans() {
  const counts = {};
  for (const { name, model } of COLLECTIONS) {
    counts[name] = await model.countDocuments({ organization: { $exists: false } });
  }
  return counts;
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  let total = 0;
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(14)} ${count}`);
    total += count;
  }
  console.log(`  ${'TOTAL'.padEnd(14)} ${total}`);
  return total;
}

async function run() {
  const { dryRun, orgName } = parseArgs(process.argv.slice(2));
  const slug = slugify(orgName);

  await connectDB(process.env.MONGODB_URI);

  const alreadyMigrated = await Organization.findOne({ slug });
  if (alreadyMigrated) {
    console.log(`Migration already applied: Organization "${alreadyMigrated.name}" (${alreadyMigrated._id}) already exists for slug "${slug}". Exiting without changes.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const before = await countOrphans();
  const totalBefore = printCounts('Documents missing `organization` (before):', before);

  if (totalBefore === 0) {
    console.log('\nNothing to migrate. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\n--dry-run: would create Organization "${orgName}" (slug "${slug}") and stamp it onto the ${totalBefore} document(s) above. No changes made.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const owner = await User.findOne({ organization: { $exists: false }, companyRole: 'owner' });
  if (!owner) {
    console.error('ERROR: No existing user with companyRole "owner" and no organization was found. Cannot determine organization ownership. Aborting without changes.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const ownerCandidates = await User.countDocuments({ organization: { $exists: false }, companyRole: 'owner' });
  if (ownerCandidates > 1) {
    console.error(`ERROR: Found ${ownerCandidates} unmigrated users with companyRole "owner" — ambiguous, refusing to guess. Aborting without changes.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nCreating Organization "${orgName}" (slug "${slug}") owned by ${owner.email} (${owner._id})...`);
  const organization = await Organization.create({ name: orgName, slug, ownerUser: owner._id });

  for (const { name, model } of COLLECTIONS) {
    const result = await model.updateMany(
      { organization: { $exists: false } },
      { $set: { organization: organization._id } }
    );
    console.log(`  ${name.padEnd(14)} modified: ${result.modifiedCount}`);
  }

  const employeeCount = await Employee.countDocuments({ organization: organization._id });
  organization.employeeIdSeq = employeeCount;
  await organization.save();
  console.log(`\nSeeded employeeIdSeq = ${employeeCount} (from existing employee count) to avoid EW-#### collisions.`);

  await Employee.syncIndexes();
  console.log('Synced Employee indexes (compound organization+employeeId unique index).');

  const after = await countOrphans();
  const totalAfter = printCounts('\nDocuments still missing `organization` (after):', after);

  if (totalAfter > 0) {
    console.error(`\nERROR: ${totalAfter} document(s) still missing organization after migration. Likely written concurrently during this run — re-run the script (it is idempotent per already-migrated org, but re-run will need a fresh check since the org now exists). Investigate before trusting the data.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nMigration complete. Organization: ${organization.name} (${organization._id}, slug "${organization.slug}"). Owner: ${owner.email}.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Migration failed with an unexpected error:', err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
