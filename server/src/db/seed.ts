import { pool } from './index';

const h1bCompanies = [
  { name: 'Google LLC', industry: 'Technology', size: 'large', hq: 'Mountain View, CA', petitions: 12000, approval: 95.2, avg_salary: 185000, roles: ['Software Engineer', 'Data Scientist', 'Product Manager'] },
  { name: 'Microsoft Corporation', industry: 'Technology', size: 'large', hq: 'Redmond, WA', petitions: 15000, approval: 94.8, avg_salary: 175000, roles: ['Software Engineer', 'Program Manager', 'Data Scientist'] },
  { name: 'Amazon.com Inc', industry: 'Technology', size: 'large', hq: 'Seattle, WA', petitions: 18000, approval: 93.1, avg_salary: 170000, roles: ['Software Development Engineer', 'Data Engineer', 'Solutions Architect'] },
  { name: 'Meta Platforms Inc', industry: 'Technology', size: 'large', hq: 'Menlo Park, CA', petitions: 8000, approval: 96.0, avg_salary: 195000, roles: ['Software Engineer', 'Research Scientist', 'Data Engineer'] },
  { name: 'Apple Inc', industry: 'Technology', size: 'large', hq: 'Cupertino, CA', petitions: 6000, approval: 94.5, avg_salary: 180000, roles: ['Software Engineer', 'Hardware Engineer', 'Machine Learning Engineer'] },
  { name: 'Salesforce Inc', industry: 'Technology', size: 'large', hq: 'San Francisco, CA', petitions: 4500, approval: 92.3, avg_salary: 165000, roles: ['Software Engineer', 'Solution Engineer', 'Data Analyst'] },
  { name: 'Intel Corporation', industry: 'Semiconductor', size: 'large', hq: 'Santa Clara, CA', petitions: 5000, approval: 91.8, avg_salary: 155000, roles: ['Hardware Engineer', 'Software Engineer', 'Process Engineer'] },
  { name: 'IBM Corporation', industry: 'Technology', size: 'large', hq: 'Armonk, NY', petitions: 7000, approval: 90.5, avg_salary: 140000, roles: ['Software Engineer', 'Data Scientist', 'Cloud Engineer'] },
  { name: 'Oracle Corporation', industry: 'Technology', size: 'large', hq: 'Austin, TX', petitions: 4000, approval: 89.7, avg_salary: 145000, roles: ['Software Engineer', 'Database Administrator', 'Cloud Engineer'] },
  { name: 'NVIDIA Corporation', industry: 'Semiconductor', size: 'large', hq: 'Santa Clara, CA', petitions: 3500, approval: 96.5, avg_salary: 200000, roles: ['Deep Learning Engineer', 'Software Engineer', 'Hardware Engineer'] },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const c of h1bCompanies) {
      await client.query(
        `INSERT INTO h1b_companies (name, normalized_name, industry, size_category, headquarters, total_petitions, approval_rate, avg_salary, common_roles, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT DO NOTHING`,
        [c.name, c.name.toLowerCase().replace(/[^a-z0-9]/g, ''), c.industry, c.size, c.hq, c.petitions, c.approval, c.avg_salary, c.roles]
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
