const path = require('path');
const { parseTimelog } = require('../parse-timelog');
const { parseAttendance } = require('../parse-attendance');
const { entityToLocation } = require('../entity-location');

async function runTests() {
  console.log('--- TESTING ETL PARSERS ---');

  // Test Entity Location Mapping
  console.assert(entityToLocation('Hungary Kft') === 'Budapest', 'Hungary Kft -> Budapest');
  console.assert(entityToLocation('Swiss AG') === 'Zurich', 'Swiss AG -> Zurich');
  console.assert(entityToLocation('India') === 'Bangalore', 'India -> Bangalore');
  console.assert(entityToLocation('Spain SL') === 'Valencia', 'Spain SL -> Valencia');
  console.log('✅ Entity Location mapping looks correct.');

  const timelogPath = path.join(__dirname, '..', '..', '..', '..', 'TimeLog_ALL (63).xlsx');
  const attendancePath = path.join(__dirname, '..', '..', '..', '..', 'Attendance_Musterroll_Report (9).xlsx');

  try {
    console.log(`\nTesting TimeLog parser on: ${timelogPath}`);
    const timeLogResult = await parseTimelog(timelogPath);
    console.log(`✅ TimeLog parsed successfully!`);
    console.log(`- Rows extracted: ${timeLogResult.rows.length}`);
    console.log(`- Detected Period: ${timeLogResult.yearMonth}`);
    if (timeLogResult.rows.length > 0) {
      console.log('- Sample Row:', JSON.stringify(timeLogResult.rows[0], null, 2));
      
      const allDatesValid = timeLogResult.rows.every(r => r.date && r.date.match(/^\d{4}-\d{2}-\d{2}$/));
      if (!allDatesValid) console.warn('⚠️ Warning: Some dates are not in YYYY-MM-DD format.');
    }

  } catch (err) {
    console.error('❌ TimeLog parser error:', err.message);
  }

  try {
    console.log(`\nTesting Attendance parser on: ${attendancePath}`);
    const attendanceResult = await parseAttendance(attendancePath);
    console.log(`✅ Attendance parsed successfully!`);
    console.log(`- Total Day Statuses extracted: ${attendanceResult.rows.length}`);
    console.log(`- Detected Period: ${attendanceResult.yearMonth}`);
    
    // Count unique employees
    const uniqueEmps = new Set(attendanceResult.rows.map(r => r.employee_id));
    console.log(`- Unique Employees: ${uniqueEmps.size}`);

    if (attendanceResult.rows.length > 0) {
      console.log('- Sample Row:', JSON.stringify(attendanceResult.rows[0], null, 2));
    }

  } catch (err) {
    console.error('❌ Attendance parser error:', err.message);
  }

  console.log('\n--- TESTS COMPLETE ---');
}

runTests();
