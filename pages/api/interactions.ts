// pages/api/interactions.ts
export default async function handler(req, res) {
  if (req.method === 'POST') {
    res.status(200).json({ message: 'Interaction logged' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
