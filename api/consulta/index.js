module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Usa POST' });
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
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://resultadossaber11.icfes.gov.co',
      'Referer': 'https://resultadossaber11.icfes.gov.co/'
    };

    const authRes = await fetch(
      'https://resultadosbackend.icfes.gov.co/api/segurity/autenticacionResultados',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoDocumento: String(tipoDocumento).toUpperCase().trim(),
          numeroDocumento: String(numeroDocumento).trim(),
          fechaNacimiento: fecha,
          numeroRegistro: numeroRegistro || '',
          captcha: 'dummy_token'
        })
      }
    );

    const authData = await authRes.json().catch(() => null);

    if (!authRes.ok || !authData?.token || !authData?.datosAutenticacion?.length) {
      return res.status(200).json({
        success: false,
        message: authData?.message || authData?.error || 'No se encontraron resultados con esos datos'
      });
    }

    const examenes = authData.datosAutenticacion;
    const exam = examenes.sort((a, b) => (b.anioExamen || 0) - (a.anioExamen || 0))[0];
    const token = authData.token;
    const registro = exam.numeroRegistro;
    const examenTipo = exam.datosParametros?.examen || 'SB11';
    const periodoAnio = exam.datosParametros?.periodoAnioExamen || '';
    const exapId = exam.exapId || '';

    const authHeaders = { ...headers, Authorization: token };

    const basicosUrl = new URL('https://resultadosbackend.icfes.gov.co/api/datos-basicos/datosBasicosRespuesta');
    basicosUrl.searchParams.set('examen', examenTipo);
    basicosUrl.searchParams.set('identificacionUnica', registro);

    const basicosRes = await fetch(basicosUrl.toString(), { headers: authHeaders });
    const basicos = await basicosRes.json().catch(() => null);

    let nombre = 'Estudiante';
    if (basicos?.camposDatosBasicos) {
      const campo = basicos.camposDatosBasicos.find(c =>
        (c.labelDatoBasico || '').toLowerCase().includes('nombre')
      );
      if (campo?.valorDatoBasico) nombre = campo.valorDatoBasico;
    }

    const reporteUrl = new URL('https://resultadosbackend.icfes.gov.co/api/resultados/datosReporteGeneral');
    reporteUrl.searchParams.set('examen', examenTipo);
    reporteUrl.searchParams.set('identificacionUnica', registro);
    if (periodoAnio) reporteUrl.searchParams.set('periodoAnioExamen', String(periodoAnio));
    if (exapId) reporteUrl.searchParams.set('exapId', String(exapId));

    const reporteRes = await fetch(reporteUrl.toString(), { headers: authHeaders });
    const reporte = await reporteRes.json().catch(() => null);

    if (!reporteRes.ok || !reporte?.resultadosGenerales) {
      return res.status(200).json({
        success: false,
        message: reporte?.message || 'No se pudieron generar los resultados. Intenta de nuevo.'
      });
    }

    const gen = reporte.resultadosGenerales;
    const puntajes = (reporte.consultarPuntaje?.puntajes || []).map(p => ({
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
    return res.status(500).json({
      success: false,
      message: 'Error al conectar con el ICFES. Intenta de nuevo en unos segundos.',
      details: err.message
    });
  }
};
