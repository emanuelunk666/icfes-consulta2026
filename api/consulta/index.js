module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Usa POST' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    
    const { tipoDocumento, numeroDocumento, fechaNacimiento, numeroRegistro = '' } = body;

    // Llamamos a tu Worker de Cloudflare
    const response = await fetch('https://consulta-icfes.emanuel-tenorio.workers.dev/api/consultar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        docType: tipoDocumento,
        document: numeroDocumento,
        born: fechaNacimiento,
        registro: numeroRegistro
      })
    });

    const data = await response.json();
    
    // Devolvemos la respuesta tal como viene
    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Error al conectar con el servidor: ' + err.message
    });
  }
};
