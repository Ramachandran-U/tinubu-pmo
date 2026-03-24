const fs = require('fs');
const path = require('path');

async function testUploads() {
  const timelogPath = 'C:\\Users\\RamachandranU\\Downloads\\PMO Claude Project\\TimeLog_ALL (63).xlsx';
  const attendancePath = 'C:\\Users\\RamachandranU\\Downloads\\PMO Claude Project\\Attendance_Musterroll_Report (9).xlsx';

  if (!fs.existsSync(timelogPath) || !fs.existsSync(attendancePath)) {
    console.error("Test files not found at provided paths.");
    process.exit(1);
  }

  // Use dynamic import for node-fetch to avoid commonJS requires errors in some Node builds
  // Or since Node 18+, native fetch and FormData are available globally
  try {
    console.log("Creating FormData natively...");
    
    // We can use the native FormData and fetch objects if running Node 18+
    // But reading a file stream into native FormData requires a Blob.
    const timelogBuffer = fs.readFileSync(timelogPath);
    const timelogBlob = new Blob([timelogBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const attBuffer = fs.readFileSync(attendancePath);
    const attBlob = new Blob([attBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    console.log("Uploading Time Log to /api/upload/timelog ...");
    const form1 = new FormData();
    form1.append('file', timelogBlob, path.basename(timelogPath));
    const res1 = await fetch('http://localhost:3001/api/upload/timelog', {
      method: 'POST',
      body: form1
    });
    
    const data1 = await res1.json();
    console.log("Timelog Result:", res1.status, data1);

    console.log("\nUploading Attendance to /api/upload/attendance ...");
    const form2 = new FormData();
    form2.append('file', attBlob, path.basename(attendancePath));
    const res2 = await fetch('http://localhost:3001/api/upload/attendance', {
      method: 'POST',
      body: form2
    });
    
    const data2 = await res2.json();
    console.log("Attendance Result:", res2.status, data2);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

testUploads();
