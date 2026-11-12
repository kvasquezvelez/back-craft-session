# Backend Craft Session

Backend Node.js para la integración del proyecto.

## Requisitos

- Node.js 20 o superior.
- npm.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Pruebas

```bash
npm test
```

La configuración privada se administra mediante variables de entorno y no debe subirse al repositorio.

## Reservas y cantidad pagada

Cada reserva ocupa un unico documento SC. Por ejemplo, comprar cuatro cupos
crea un documento con `quantity: 4`. CC resume la disponibilidad por tienda,
fecha y hora usando `available = 15 - held - confirmed`; los contadores suman
`quantity`, nunca el numero de documentos. Pueden existir varias reservas
distintas en una orden, cada una con su identificador y cantidad.

El frontend genera `reservationId` antes del envio. El ID de SC es ese mismo
identificador expresado como GUID. La creacion se serializa por identificador y
por horario: reintentar el mismo envio reutiliza el registro y la retencion;
reutilizar el identificador con datos distintos se rechaza. El backend lee SC
directamente por su ID para evitar retrasos del indice de busqueda.

El webhook omite referencias eliminadas o canceladas solo si las cantidades
de las reservas vigentes suman exactamente las unidades del servicio compradas
en OMS. Si faltan o sobran cupos, una reserva vencio o ya pertenece a otra
orden, rechaza la confirmacion sin actualizar documentos. `ignoredReservationIds`
registra las referencias omitidas. Reintentar un webhook ya confirmado no vuelve
a actualizar SC ni vuelve a activar el correo.

La disponibilidad se consulta cada cinco segundos y al volver a enfocar la
ventana. Una cancelacion manual de SC libera la cantidad completa de esa
reserva en la siguiente consulta, sin borrar su documento de auditoria.

## Vencimiento a las cinco horas

Los documentos SC con `statusreserva = pendiente` vencen cinco horas después de
su `createdIn`. La tarea relee cada documento antes de cambiarlo a `cancelado`,
para descartar resultados de búsqueda antiguos. No modifica cupos confirmados.
El servicio IO de disponibilidad también aplica esta validación al consultar y
recalcula CC, incluyendo cancelaciones manuales en SC.

Después de desplegar el backend, activa la tarea en AWS una sola vez con la
plantilla `infrastructure/reservation-expiration.yaml`. Al crear el stack en
CloudFormation, proporciona el ARN de la Lambda existente como
`BackendFunctionArn`. La regla invoca esa misma Lambda cada minuto. Conviene
configurar un timeout de Lambda de al menos 60 segundos para procesar lotes.

Evento para probar la tarea en la consola de Lambda (modifica reservas vencidas):

```json
{
  "source": "craft-session.expiration",
  "action": "expire-pending"
}
```

Sin la regla de AWS activa, el vencimiento se aplica cuando se vuelve a
consultar disponibilidad desde el formulario; no hay un temporizador permanente
dentro de Lambda.
