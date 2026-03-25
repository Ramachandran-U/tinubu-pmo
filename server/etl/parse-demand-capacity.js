const XLSX = require('xlsx');

/**
 * Parse Demand_Capacity Excel file into structured rows.
 * Maps billable status values to normalized categories.
 */
function parseDemandCapacity(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('No data found in Demand Capacity file.');
  }

  // Normalize billable status — some entries have DU numbers or team names instead
  const normalizeBillable = (val) => {
    if (!val) return 'Unknown';
    const v = String(val).trim();
    if (v === 'Billable') return 'Billable';
    if (['Investment', 'Loaned', 'Bench'].includes(v)) return v;
    // Values like 'DU1', 'DU3', 'SHS Team', 'NA' are non-billable/investment
    return 'Investment';
  };

  const rows = rawRows
    .filter(row => row['Employee ID'] && String(row['Employee ID']).trim())
    .map(row => ({
      employee_id: String(row['Employee ID']).trim(),
      resource_name: String(row['Resource name '] || row['Resource name'] || '').trim(),
      designation_name: String(row['Designation Name'] || '').trim(),
      client: String(row['Client'] || '').trim(),
      project: String(row['Project'] || '').trim(),
      billable_status: normalizeBillable(row['Billable / Investment']),
      du_number: String(row['DU#'] || '').trim(),
      comment: String(row['Comment'] || '').trim(),
      location: String(row['Location'] || '').trim()
    }));

  console.log(`[Demand Capacity] Parsed ${rows.length} employees, squads: ${[...new Set(rows.map(r => r.du_number))].join(', ')}`);
  return rows;
}

module.exports = { parseDemandCapacity };
