import Admin from '../modules/admin/models/admin.model.js';

/**
 * Generate a unique employee ID
 * @param {string} department - Department name
 * @returns {Promise<string>} - Unique employee ID
 */
export const generateEmployeeId = async (department) => {
  // Get department abbreviation (first 2-3 letters)
  const deptMap = {
    'Executive': 'EXE',
    'Finance': 'FIN',
    'IT': 'IT',
    'Marketing': 'MKT',
    'Sales': 'SAL',
    'Customer Support': 'SUP',
    'Human Resources': 'HR',
    'Logistics': 'LOG'
  };
  
  const deptCode = deptMap[department] || department.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest existing employee ID for this department and year
  const regex = new RegExp(`^${deptCode}${year}\\d{3}$`);
  const lastEmployee = await Admin.findOne(
    { employeeId: { $regex: regex } },
    { employeeId: 1 },
    { sort: { employeeId: -1 } }
  );
  
  let sequence = 1;
  if (lastEmployee && lastEmployee.employeeId) {
    const lastSequence = parseInt(lastEmployee.employeeId.slice(-3));
    sequence = lastSequence + 1;
  }
  
  // Format: DeptCode + Year + 3-digit sequence (e.g., FIN24001)
  const employeeId = `${deptCode}${year}${sequence.toString().padStart(3, '0')}`;
  
  // Ensure uniqueness (in case of race conditions)
  const existing = await Admin.findOne({ employeeId });
  if (existing) {
    // Recursively try next number
    return generateEmployeeId(department);
  }
  
  return employeeId;
}; 