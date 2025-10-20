import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

export async function fetchBatch() {
  const [rows] = await pool.query('SELECT * FROM Batch');
  return rows[0];
}

export async function createBatch(production, date, quality, beer_type, temperature, employee_id) {
  const [result] = await pool.query(
    'INSERT INTO Batch (production, date,quality, beer_type, temperature, employee_id) VALUES (?, ?, ?, ?, ?)',
    [production, date, quality, beer_type, temperature, employee_id]
  );
  return getNoteById(result.insertId);
}
/*
export async function updateNote(id, title, content) {
  await pool.query(
    'UPDATE Batch SET title = ?, content = ? WHERE id = ?',
    [title, content, id]
  );
    return getNoteById(id);

}*/

export async function deleteBatch(id) {
  await pool.query('DELETE FROM Batch WHERE id = ?', [id]);
    return getNoteById(id);
}

export async function getbatchById(id) {
  const [rows] = await pool.query('SELECT * FROM Batch WHERE id = ?', [id]);
  return rows[0];
}
