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

    if (!tipoDocumento || !numeroDocumento || !fechaNacimiento) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios'
      });
    }

    let fechaFormateada = fechaNacimiento;
    if (String(fechaNacimiento).includes('-')) {
      const [y, m, d] = fechaNacimiento.split('-');
      fechaFormateada = `${d}/${m}/${y}`;
    }

    const payload = {
      tipoDocumento: String(tipoDocumento).toUpperCase(),
      numeroDocumento: String(numeroDocumento).trim(),
      fechaNacimiento: fechaFormateada,
      numeroRegistro: numeroRegistro || '',
      captcha: 'dummy_token'
    };

    const r = await fetch('https://resultadosbackend.icfes.gov.co/api/segurity/autenticacionResultados', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://resultados.icfes.gov.co',
        'Referer': 'https://resultados.icfes.gov.co/'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data?.message || data?.mensaje || data?.error || `Error ${r.status}`,
        data
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: 'Error interno',
      details: err.message
    });
  }
};
