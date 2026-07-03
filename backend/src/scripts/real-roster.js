require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const logger = require('../utils/logger');

// Real ETHIXWEB team roster. Not demo/seed data, no seedTag, never delete
// via the fictional-data cleanup path in scripts/seed.js.
const ROSTER = [
  { name: 'Akash', department: 'Engineering', designation: 'Full Stack Developer' },
  { name: 'Yashraj', department: 'Engineering', designation: 'Web Developer' },
  { name: 'Shreya', department: 'Engineering', designation: 'WordPress Developer' },
  { name: 'Alefys', department: 'Design', designation: 'UI/UX Developer' },
  { name: 'Disha', department: 'Design', designation: 'UI/UX Developer' },
  { name: 'Admin', department: 'Operations', designation: 'Owner', companyRole: 'owner' },
];

async function run() {
  await connectDB(process.env.MONGODB_URI);

  // Remove the fictional Phase 1/2 demo roster entirely.
  const fictional = await Employee.find({ seedTag: 'phase1-demo' }).select('_id').lean();
  const fictionalIds = fictional.map((e) => e._id);
  if (fictionalIds.length) {
    await Attendance.deleteMany({ employee: { $in: fictionalIds } });
    await LeaveRequest.deleteMany({ employee: { $in: fictionalIds } });
    await Employee.deleteMany({ _id: { $in: fictionalIds } });
    logger.info(`Removed ${fictionalIds.length} fictional demo employees`);
  }

  const count = await Employee.countDocuments({});
  let created = 0;
  for (let i = 0; i < ROSTER.length; i++) {
    const person = ROSTER[i];
    const slug = person.name.split(' ')[0].toLowerCase();
    const employeeId = `EW-${String(count + i + 1).padStart(4, '0')}`;
    const existing = await Employee.findOne({ name: person.name });
    if (existing) {
      logger.info(`Skipping ${person.name}, already exists`);
      continue;
    }
    await Employee.create({
      employeeId,
      name: person.name,
      email: `${slug}@ethixweb.com`,
      department: person.department,
      designation: person.designation,
      companyRole: person.companyRole ?? 'employee',
      joiningDate: new Date(),
      status: 'active',
      salary: { amount: 0, currency: 'INR' },
    });
    created++;
  }
  logger.info(`Created ${created} real employees`);

  const total = await Employee.countDocuments({});
  logger.info(`Total employees now: ${total}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error('Roster update failed', err);
  process.exit(1);
});
