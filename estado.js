export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  const startTime = Date.now();
  let status = 'ok';
  let message = 'El ICFES está respondiendo con normalidad.';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const icfesRes = await fetch('https://resultadosbackend.icfes.gov.co/api/segurity/autenticacionResultados', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://resultadossaber11.icfes.gov.co',
        'Referer': 'https://resultadossaber11.icfes.gov.co/'
      },
      body: JSON.stringify({ tipoDocumento: 'CC', numeroDocumento: '0', fechaNacimiento: '01/01/2000' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (icfesRes.status === 500 || icfesRes.status === 503) {
      status = 'error';
      message = 'El ICFES está en mantenimiento (Error 500).';
    } else if (latency > 3000) {
      status = 'slow';
      message = 'El ICFES está respondiendo lento (saturación).';
    }

    return res.status(200).json({ status, message, latency: latency + 'ms' });

  } catch (error) {
    if (error.name === 'AbortError') {
        return res.status(200).json({ status: 'down', message: 'El ICFES no responde (Timeout).', latency: '5000ms' });
    }
    return res.status(200).json({ status: 'error', message: 'Error de conexión con el ICFES.', latency: '0ms' });
  }
}
