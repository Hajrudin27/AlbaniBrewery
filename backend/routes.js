import express from 'express';
import {fetchBatch, createBatch, deleteBatch, getbatchById} from './database.js';

const app = express();
app.use(express.json());

app.get('/notes', async (req, res) => {
    const notes = await fetchBatch();
res.status(201).send(note);
});

app.post('/notes', async (req, res) => {
  const { production, date, quality, beer_type, temperature, employee_id} = req.body;
  const note = await createBatch(production, date, quality, beer_type, temperature, employee_id);
  res.status(201).send(note);
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(8080, () => {
  console.log('Server is running on port 8080');
}); 
