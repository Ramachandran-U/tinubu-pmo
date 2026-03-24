const xlsx = require('xlsx');

/**
 * Parses a Tinubu PMO Attendance Muster Roll Excel file.
 * Returns an array of normalized objects matching the `attendance` database schema.
 * 
 * @param {string} filePath - Path to the uploaded .xlsx file
 * @returns {Promise<{ rows: Array<object>, yearMonth: string }>}
 */
async function parseAttendance(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // We read the sheet as an array of arrays to handle the complex 2D positional layout manually
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // 1. Find the date header row
  // Looks for a row containing things like "1 - Mar" or "15 - Apr"
  let dateRowIdx = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    let matchCount = 0;
    for (const cell of row) {
      if (typeof cell === 'string' && /^\d{1,2}\s*[-–]\s*[A-Za-z]{3}/.test(cell.trim())) {
        matchCount++;
      }
    }
    if (matchCount >= 5) {
      dateRowIdx = i;
      break;
    }
  }

  if (dateRowIdx === -1) {
    throw new Error('Could not locate the date headers row in the attendance Excel file.');
  }

  // 2. Extract Year from the start date at the top of the file
  let year = new Date().getFullYear().toString();
  for (let i = 0; i < dateRowIdx; i++) {
    const row = data[i];
    const joined = row.filter(Boolean).join(' ');
    // Look for DD-Mon-YY or DD-Mon-YYYY (e.g. 01-Mar-2026)
    const match = joined.match(/\d{1,2}-[A-Za-z]{3}-(\d{2,4})/);
    if (match) {
      if (match[1].length === 2) {
        year = '20' + match[1]; // Assume 20XX
      } else {
        year = match[1];
      }
      break;
    }
  }

  // 3. Find the fields header row (usually right below the date row)
  let headerRowIdx = -1;
  for (let i = dateRowIdx + 1; i < dateRowIdx + 5 && i < data.length; i++) {
    const firstCell = String(data[i][0] || '').toLowerCase();
    if (firstCell.includes('employee id') || firstCell.includes('employee no')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Could not locate the employee data header row.');
  }

  const columns = data[headerRowIdx];
  const dateRow = data[dateRowIdx];

  // Map indexes for fixed left columns
  const getColIdx = (names) => {
    return columns.findIndex(c => c && typeof c === 'string' && names.some(n => c.toLowerCase().includes(n.toLowerCase())));
  };

  const map = {
    employeeId: Math.max(0, getColIdx(['Employee Id', 'Employee No'])),
    name: getColIdx(['Name', 'Full Name']),
    email: getColIdx(['Email']),
    entity: getColIdx(['Entity']),
    businessUnit: getColIdx(['Business Unit']),
    department: getColIdx(['Department']),
    designation: getColIdx(['Designation']),
    location: getColIdx(['Location'])
  };

  // Map date columns
  // The structure is typical: [Date Text] is in col N (representing the Shift column), and the status is in N+1
  const dateColumns = [];
  for (let c = 10; c < dateRow.length; c++) {
    const val = dateRow[c];
    if (val && typeof val === 'string' && /^\d{1,2}\s*[-–]\s*[A-Za-z]{3}/.test(val.trim())) {
      // Parse day and month to reconstruct true YYYY-MM-DD
      // Example: "1 - Mar" -> Day = 1, Month = Mar
      const parts = val.replace(/[–]/g, '-').split('-');
      if (parts.length >= 2) {
        let day = parseInt(parts[0].trim(), 10);
        let mon = parts[1].trim().substring(0, 3);
        const dateStr = `${day} ${mon} ${year}`;
        const parsedDate = new Date(dateStr);

        if (!isNaN(parsedDate.getTime())) {
          dateColumns.push({
            dateIso: parsedDate.toISOString().split('T')[0],
            statusColIdx: c + 1 // The status code is in the next column after the shift header
          });
        }
      }
    }
  }

  const rows = [];
  const monthCounts = {};

  // Parse employee rows
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[map.employeeId] || typeof row[map.employeeId] !== 'string') continue;

    const employeeId = row[map.employeeId].trim();
    if (!employeeId.startsWith('INN-')) continue; // specific logic applied from instructions

    const baseData = {
      employee_id: employeeId,
      employee_name: row[map.name] || null,
      email: row[map.email] || null,
      entity: row[map.entity] || null,
      business_unit: row[map.businessUnit] || null,
      department: row[map.department] || null,
      designation: row[map.designation] || null,
      location: row[map.location] || null
    };

    // For every valid date column found, grab the status
    for (const dCol of dateColumns) {
      let status = row[dCol.statusColIdx];
      
      // Clean up empty or non-string statuses
      if (!status || typeof status !== 'string') {
        status = '-'; // empty marker
      }
      status = status.trim().toUpperCase();

      // Only add to DB if there is an actual tracked status code
      if (status) {
        const ym = dCol.dateIso.substring(0, 7);
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;

        rows.push({
          ...baseData,
          date: dCol.dateIso,
          year_month: ym,
          status: status
        });
      }
    }
  }

  // Determine dominant year_month for the "replace-by-period" logic
  let dominantYearMonth = null;
  let maxCount = 0;
  for (const [ym, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantYearMonth = ym;
    }
  }

  if (!dominantYearMonth && rows.length > 0) {
    dominantYearMonth = rows[0].year_month;
  }

  // Force all rows to have the same yearMonth consistency just in case of weird cross-month overlaps 
  // typical in some muster rolls
  rows.forEach(r => r.year_month = dominantYearMonth);

  return { rows, yearMonth: dominantYearMonth };
}

module.exports = { parseAttendance };
