# Consulta Resultados ICFES

Página web pública para que cualquier persona pueda consultar sus resultados del ICFES (Saber 11 y similares).

Incluye:
- Frontend moderno y responsive
- Proxy serverless (evita problemas de CORS)
- Listo para desplegar en **Vercel** (gratis)

---

## Cómo publicarlo (Vercel)

### Opción 1 – Desde la web (más fácil)

1. Crea una cuenta en [vercel.com](https://vercel.com) (puedes usar GitHub).
2. Sube esta carpeta a un repositorio de GitHub (o usa Vercel CLI).
3. En Vercel → **Add New Project** → importa el repositorio.
4. Deja la configuración por defecto y haz clic en **Deploy**.
5. ¡Listo! Te dará un link tipo `https://tu-proyecto.vercel.app`

### Opción 2 – Con Vercel CLI

```bash
# Instalar Vercel CLI (si no la tienes)
npm i -g vercel

# Dentro de la carpeta del proyecto
cd icfes-consulta
vercel
```

Sigue las instrucciones. Al final te dará el link público.

---

## Estructura del proyecto

```
icfes-consulta/
├── api/
│   └── consulta.js      ← Proxy que llama al backend del ICFES
├── public/
│   └── index.html       ← Página que ven los usuarios
├── package.json
├── vercel.json
└── README.md
```

---

## Notas importantes

- El captcha se envía como `dummy_token` (como pediste). Si el ICFES lo valida estrictamente, la consulta puede fallar.
- La herramienta **no guarda** los datos de los usuarios.
- Si el backend del ICFES cambia o pone más protecciones, puede dejar de funcionar.

---

## Personalizar

- Colores y textos: edita `public/index.html`
- Lógica del proxy: edita `api/consulta.js`
