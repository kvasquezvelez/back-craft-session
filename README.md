# Backend Craft Session + VTEX

Backend Express que recibe eventos de órdenes VTEX, lee el detalle de la orden, identifica a la persona que compró Craft Session y confirma su reserva en la entidad `SC` de Master Data.

## Primer flujo implementado

1. VTEX envía un evento `invoiced` a `POST /webhooks/vtex/orders`.
2. El backend valida `x-webhook-secret`.
3. Consulta la orden en OMS mediante `GET /api/oms/pvt/orders/{orderId}`.
4. Verifica nuevamente que el estado actual de la orden sea `invoiced`.
5. Comprueba que la orden incluya exactamente el SKU `663375276`.
6. Obtiene y normaliza el correo desde `clientProfileData.email`.
7. Busca en `SC` la reserva creada desde el front con ese mismo correo.
8. Actualiza el documento con `{ "statusreserva": "confirmado" }`.

La operación es idempotente: si `statusreserva` ya tiene el valor `confirmado`, no realiza otro `PATCH`. Por seguridad, la configuración predeterminada falla si encuentra más de una reserva para el mismo correo, evitando confirmar una reserva incorrecta.

## Estructura

```text
src/
├── clients/       # Comunicación HTTP con OMS y Master Data
├── config/        # Variables de entorno y validación
├── controllers/   # Adaptadores HTTP de Express
├── errors/        # Errores operacionales
├── middlewares/   # Autenticación, request ID y manejo de errores
├── routes/        # Rutas Express
├── services/      # Reglas de negocio
├── utils/         # Funciones reutilizables
├── app.js         # Composición de Express
└── server.js      # Inicio y apagado del servidor
```

## Requisitos

- Node.js 20 o superior.
- Credenciales VTEX con permisos para leer Orders y leer/escribir la entidad `SC`.
- El campo usado para localizar a la persona en `SC` debe estar habilitado para filtros.
- El campo `statusreserva` debe aceptar el valor `confirmado`.

## Configuración

```bash
cp .env.example .env
```

Variables principales:

```dotenv
VTEX_ACCOUNT=nombre-cuenta-qa
VTEX_ENVIRONMENT=vtexcommercestable
VTEX_APP_KEY=app-key
VTEX_APP_TOKEN=app-token
WEBHOOK_SECRET=secreto-largo

VTEX_WEBHOOK_STATUS=invoiced
CRAFT_SERVICE_SKU_IDS=663375276

MASTER_DATA_ENTITY=SC
SC_PERSON_FIELD=email
SC_PERSON_ORDER_PATH=clientProfileData.email
SC_STATUS_FIELD=statusreserva
SC_CONFIRMED_VALUE=confirmado
SC_REQUIRE_UNIQUE_MATCH=true
```

Si el campo del correo en `SC` tiene otro nombre, cambia únicamente `SC_PERSON_FIELD`. Por ejemplo:

```dotenv
SC_PERSON_FIELD=correoelectronico
```

## Ejecutar

```bash
pnpm install
pnpm start
```

También puede utilizarse `npm install` y `npm start` si no tienes pnpm disponible.

En desarrollo:

```bash
pnpm dev
```

Comprobar el servidor:

```bash
curl http://localhost:3000/health
```

## Endpoints

Todos los endpoints de órdenes requieren el header `x-webhook-secret`.

### Webhook VTEX

```http
POST /webhooks/vtex/orders
```

Ejemplo:

```bash
curl -X POST http://localhost:3000/webhooks/vtex/orders \
  -H 'content-type: application/json' \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"OrderId":"ORDER-ID-01","State":"invoiced"}'
```

### Leer una orden

```bash
curl http://localhost:3000/api/orders/ORDER-ID-01 \
  -H "x-webhook-secret: $WEBHOOK_SECRET"
```

### Confirmar manualmente la reserva de una orden

Este endpoint ejecuta exactamente la misma regla de negocio que el webhook:

```bash
curl -X POST http://localhost:3000/api/orders/ORDER-ID-01/confirm-reservation \
  -H "x-webhook-secret: $WEBHOOK_SECRET"
```

## Configurar el Hook en QA

Con el backend desplegado en una URL HTTPS, configura `PUBLIC_BASE_URL` y ejecuta:

```bash
pnpm hook:configure
```

El script registra el filtro `status = "invoiced"`. VTEX permite un Hook por appKey, por lo que se recomienda utilizar una appKey exclusiva para esta integración.

## Pruebas

```bash
pnpm test
```
