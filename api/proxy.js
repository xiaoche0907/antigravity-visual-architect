export default async function handler(req, res) {
  // 1. Set CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-ModelScope-Async-Mode, X-ModelScope-Task-Type'
  );

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Get Target URL
  const { target } = req.query;
  
  if (!target) {
    return res.status(400).json({ error: 'Missing target URL parameter' });
  }

  try {
    // 3. Forward Request
    // Prepare fetch options
    const options = {
      method: req.method,
      headers: { ...req.headers },
      body: req.body ? JSON.stringify(req.body) : undefined,
    };

    // Clean up headers that shouldn't be forwarded or are managed by fetch
    delete options.headers.host;
    delete options.headers['content-length'];
    delete options.headers.connection;
    // Remove the original cookie/referer to avoid leaking or conflicts, unless needed
    // delete options.headers.cookie; 

    // Fetch the target
    const response = await fetch(target, options);

    // 4. Return Response
    // Forward status
    res.status(response.status);

    // Forward response headers (optional, but good for debugging)
    // Be careful with Transfer-Encoding: chunked which might conflict
    response.headers.forEach((value, key) => {
       if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
          res.setHeader(key, value);
       }
    });

    const data = await response.text(); 
    // We use text() to handle both JSON and potential error HTML, 
    // create-react-app proxy might default to json but here we return raw body usually.
    // But since we are likely handling JSON APIs:
    
    // Try to parse as JSON to set content-type if needed or just forward body.
    // The user said "Return original response".
    
    // Simply allow fetch to handle text 
    res.send(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}
