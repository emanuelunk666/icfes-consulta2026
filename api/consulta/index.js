module.exports = async (req, res) => {
  // CORS
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

    if (!tipoDocumento || !numeroDocumento || !fechaNacimiento) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (tipo de documento, número y fecha de nacimiento)'
      });
    }

    // Llamamos a tu Worker de Cloudflare (el bueno)
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

    // Devolvemos exactamente lo que responde el Worker
    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(500).json({
      success: false,
      transient: true,
      message: 'Error al conectar con el servidor. El ICFES puede estar saturado.',
      whatsapp: 'https://wa.me/573192463799?text=Hola%2C%20necesito%20ayuda%20con%20mi%20resultado%20ICFES'
    });
  }
};
