const xlsx = require('xlsx');

/**
 * Parses a Tinubu PMO Time Log Excel file.
 * Returns an array of normalized objects matching the `timelog_raw` database snake_case columns.
 * 
 * @param {string} filePath - Path to the uploaded .xlsx file
 * @returns {Promise<{ rows: Array<object>, yearMonth: string }>}
 */
async function parseTimelog(filePath) {
  // Read file and grab the first sheet
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('sheet1')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of JSON objects based on the header row
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const rows = [];
  const monthCounts = {};

  for (const row of rawRows) {
    // Expected Columns handling (allow some variations in casing/spacing)
    const getVal = (possibleKeys) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
      }
      return null;
    };

    const dateVal = getVal(['Date of Date', 'Date']);
    const employeeId = getVal(['Employee ID', 'Employee Id']);
    let hoursStr = getVal(['Hours']);

    // Skip empty rows or rows without an employee ID
    if (!employeeId || !dateVal) continue;

    // Parse date safely
    let dateObj;
    if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else {
      dateObj = new Date(dateVal);
    }
    
    // Skip if date is invalid
    if (isNaN(dateObj.getTime())) continue;

    // Parse numeric hours
    const hours = parseFloat(hoursStr);
    if (isNaN(hours) || hours < 0) continue;

    // Format Date string YYYY-MM-DD
    const dateFormatted = dateObj.toISOString().split('T')[0];

    // Compute year_month
    const yearMonth = dateFormatted.substring(0, 7); // 'YYYY-MM'
    monthCounts[yearMonth] = (monthCounts[yearMonth] || 0) + 1;

    // Build the clean row
    const cleanRow = {
      date: dateFormatted,
      hours: hours,
      entity: getVal(['Entity']),
      business_unit: getVal(['Business Unit']),
      department: getVal(['Department Name', 'Department']),
      designation: getVal(['Designation Name', 'Designation']),
      employee_id: employeeId.toString().trim(),
      full_name: getVal(['Full Name']),
      last_name: getVal(['Last Name']),
      first_name: getVal(['First Name']),
      client_name: getVal(['Client Name']),
      project_name: getVal(['Project Name', 'Project']),
      approval_status: getVal(['APPROVAL STATUS', 'Approval Status']),
      billable_status: getVal(['Billable Status (Job)', 'Billable Status']),
      task_name: getVal(['Task Name']),
      task_code: getVal(['Task Code']),
      jira_no: getVal(['Jira No.', 'Jira No']),
      contractor_company: getVal(['Contractor Company']),
      comment: getVal(['Comment', 'Notes'])
    };

    rows.push(cleanRow);
  }

  // Determine the most frequent year_month to declare as the file's primary period
  let dominantYearMonth = null;
  let maxCount = 0;
  for (const [ym, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantYearMonth = ym;
    }
  }

  if (!dominantYearMonth) {
    throw new Error('Could not determine a valid month from the timelog dates.');
  }

  // Assign the determined yearMonth to all valid rows to ensure consistency for the "replace-by-period" logic
  rows.forEach(r => r.year_month = dominantYearMonth);

  return { rows, yearMonth: dominantYearMonth };
}

module.exports = { parseTimelog };
