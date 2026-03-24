export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const response = await fetch('https://go.dev/_/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ version: '2', body: code, withVet: 'true' }),
    });

    const data = await response.json();

    // data.Errors contains compilation errors
    // data.Events is an array of { Message, Kind, Delay }
    let output = '';
    let errors = null;

    if (data.Errors) {
      errors = data.Errors;
    }

    if (data.Events) {
      output = data.Events
        .filter(e => e.Kind === 'stdout')
        .map(e => e.Message)
        .join('');

      const stderr = data.Events
        .filter(e => e.Kind === 'stderr')
        .map(e => e.Message)
        .join('');

      if (stderr) {
        errors = errors ? errors + '\n' + stderr : stderr;
      }
    }

    res.json({ output, errors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compile: ' + err.message });
  }
}
