'use strict';
/**
 * Fix KTI grade boundaries:
 * - Current DB has 7 bands (A → F) with wrong ranges for C and F
 * - Source shows 12 bands: A B+ B B- C+ C C- D+ D D- E MS
 */
const { Pool } = require('pg');
const DB = 'postgres://postgres:password123@localhost:5432/amis_multi_tenant?sslmode=disable';
const SCALE_ID = '5c2d959d-3540-4dac-86ec-f95eec81f26f';

const CORRECT_BANDS = [
  { grade_letter: 'A',   description: 'Distinction',              min_score: 80,   max_score: 100,  grade_point: 5.0  },
  { grade_letter: 'B+',  description: 'Credit Upper',             min_score: 75,   max_score: 79.9, grade_point: 4.5  },
  { grade_letter: 'B',   description: 'Credit',                   min_score: 70,   max_score: 74.9, grade_point: 4.0  },
  { grade_letter: 'B-',  description: 'Credit Lower',             min_score: 65,   max_score: 69.9, grade_point: 3.5  },
  { grade_letter: 'C+',  description: 'Pass Upper',               min_score: 60,   max_score: 64.9, grade_point: 3.0  },
  { grade_letter: 'C',   description: 'Pass',                     min_score: 55,   max_score: 59.9, grade_point: 2.5  },
  { grade_letter: 'C-',  description: 'Pass Lower',               min_score: 50,   max_score: 54.9, grade_point: 2.0  },
  { grade_letter: 'D+',  description: 'Fail Upper',               min_score: 45,   max_score: 49.9, grade_point: 1.5  },
  { grade_letter: 'D',   description: 'Fail',                     min_score: 40,   max_score: 44.9, grade_point: 1.0  },
  { grade_letter: 'D-',  description: 'Fail Lower',               min_score: 25,   max_score: 39.9, grade_point: 0.5  },
  { grade_letter: 'E',   description: 'Very Poor',                min_score: 0,    max_score: 24.9, grade_point: 0.0  },
  { grade_letter: 'MS',  description: 'Missing Submission',       min_score: 0,    max_score: 0,    grade_point: -1.0 },
];

async function run() {
  const pool = new Pool({ connectionString: DB });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete all existing bands for this scale
    const del = await client.query(
      'DELETE FROM app.grade_boundaries WHERE grading_scale_id = $1',
      [SCALE_ID]
    );
    console.log(`Deleted ${del.rowCount} old bands`);

    // Insert all correct bands
    for (const b of CORRECT_BANDS) {
      await client.query(
        `INSERT INTO app.grade_boundaries
           (grading_scale_id, grade_letter, description, min_score, max_score, grade_point)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [SCALE_ID, b.grade_letter, b.description, b.min_score, b.max_score, b.grade_point]
      );
    }
    console.log(`Inserted ${CORRECT_BANDS.length} correct bands`);

    await client.query('COMMIT');
    console.log('Done.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
