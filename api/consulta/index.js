module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Usa POST' });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchRetry(url, options, tries = 3) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, options);
        if (r.status === 429 || r.status === 503 || r.status === 502) {
          await sleep(800 * (i + 1));
          continue;
        }
        return r;
      } catch (e) {
        lastErr = e;
        await sleep(800 * (i + 1));
      }
    }
    if (lastErr) throw lastErr;
    return fetch(url, options);
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    let { tipoDocumento, numeroDocumento, fechaNacimiento, numeroRegistro = '' } = body;

    if (!tipoDocumento || !numeroDocumento || !fechaNacimiento) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos: tipo de documento, número y fecha de nacimiento'
      });
    }

    let fecha = String(fechaNacimiento).trim();
    if (fecha.includes('-')) {
      const [y, m, d] = fecha.split('-');
      fecha = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Origin: 'https://resultadossaber11.icfes.gov.co',
      Referer: 'https://resultadossaber11.icfes.gov.co/'
    };

    // 1. Petición de Autenticación
    const authRes = await fetchRetry(
      'https://resultadosbackend.icfes.gov.co/api/segurity/autenticacionResultados',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoDocumento: String(tipoDocumento).toUpperCase().trim(),
          numeroDocumento: String(numeroDocumento).trim(),
          fechaNacimiento: fecha,
          numeroRegistro: numeroRegistro || ''
          // Quitamos el dummy_token
        })
      }
    );

    // Si el ICFES nos bloquea o pide captcha, lo atrapamos aquí
    if (!authRes.ok) {
      const errorData = await authRes.json().catch(() => null);
      return res.status(200).json({
        success: false,
        message: `El ICFES rechazó la petición (Status: ${authRes.status})`,
        details: errorData // Aquí veremos si es por captcha o por IP
      });
    }

    const authData = await authRes.json().catch(() => null);

    if (!authData?.token || !authData?.datosAutenticacion?.length) {
      return res.status(200).json({
        success: false,
        message: 'No se encontraron resultados. Verifica los datos.',
        details: authData
      });
    }

    // 2. Petición de Datos (Token)
    const examenes = authData.datosAutenticacion;
    const exam = examenes.sort((a, b) => (b.anioExamen || 0) - (a.anioExamen || 0))[0];
    const token = authData.token;
    const registro = exam.numeroRegistro;
    const examenTipo = exam.datosParametros?.examen || 'SB11';
    const periodoAnio = exam.datosParametros?.periodoAnioExamen || '';
    const exapId = exam.exapId || '';
    const authHeaders = { ...headers, Authorization: token };

    // 3. Datos básicos
    const basicosUrl = new URL('https://resultadosbackend.icfes.gov.co/api/datos-basicos/datosBasicosRespuesta');
    basicosUrl.searchParams.set('examen', examenTipo);
    basicosUrl.searchParams.set('identificacionUnica', registro);

    const basicosRes = await fetchRetry(basicosUrl.toString(), { headers: authHeaders }, 2);
    const basicos = await basicosRes.json().catch(() => null);

    let nombre = 'Estudiante';
    if (basicos?.camposDatosBasicos) {
      const campo = basicos.camposDatosBasicos.find((c) =>
        (c.labelDatoBasico || '').toLowerCase().includes('nombre')
      );
      if (campo?.valorDatoBasico) nombre = campo.valorDatoBasico;
    }

    // 4. Reporte general
    const reporteUrl = new URL('https://resultadosbackend.icfes.gov.co/api/resultados/datosReporteGeneral');
    reporteUrl.searchParams.set('examen', examenTipo);
    reporteUrl.searchParams.set('identificacionUnica', registro);
    if (periodoAnio) reporteUrl.searchParams.set('periodoAnioExamen', String(periodoAnio));
    if (exapId) reporteUrl.searchParams.set('exapId', String(exapId));

    const reporteRes = await fetchRetry(reporteUrl.toString(), { headers: authHeaders }, 3);
    const reporte = await reporteRes.json().catch(() => null);

    if (!reporteRes.ok || !reporte?.resultadosGenerales) {
      return res.status(200).json({
        success: false,
        message: 'El examen está registrado pero el reporte no está disponible.'
      });
    }

    const gen = reporte.resultadosGenerales;
    const puntajes = (reporte.consultarPuntaje?.puntajes || []).map((p) => ({
      codigoPrueba: p.codigoPrueba,
      nombrePrueba: p.nombrePrueba,
      puntajePrueba: p.puntajePrueba,
      ordenPrueba: p.ordenPrueba
    }));

    return res.status(200).json({
      success: true,
      estudiante: nombre,
      registro,
      anioExamen: exam.anioExamen,
      examen: examenTipo,
      puntajeGlobal: Number(gen.puntajeGlobal),
      puntajeTotalGlobal: Number(gen.puntajeTotalGlobal || 500),
      percentilNacional: gen.percentilNacional,
      descripcionPercentil: gen.descripcionPercentilNacional,
      promedios: gen.promedios || [],
      puntajes,
      reporteIndividuales: reporte.reporteIndividuales || [],
      datosBasicos: basicos?.camposDatosBasicos || []
    });
  } catch (err) {
    console.error(err);
    return res.status(200).json({
      success: false,
      message: 'Error de conexión con el ICFES.',
      details: err.message
    });
  }
};
