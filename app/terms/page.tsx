import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio - XTask",
  description: "Términos y Condiciones de Uso de XTask",
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Términos y Condiciones de Uso
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Última actualización: 29 de mayo de 2026
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder y utilizar la plataforma XTask (disponible en{" "}
              <strong>xtask.space</strong>), acepta quedar vinculado por estos
              Términos y Condiciones. Si no está de acuerdo con alguno de estos términos,
              no debe utilizar la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              2. Descripción del Servicio
            </h2>
            <p>
              XTask es una plataforma de gestión de proyectos y tareas que incluye funcionalidades de
              integración con Meta Ads y Google Analytics para la visualización de métricas y estadísticas
              de marketing digital. El servicio es operado por <strong>Jesus Nuñez Lopez de Vicuña</strong>,
              autónomo con domicilio en España.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              3. Registro y Cuentas de Usuario
            </h2>
            <p>
              Para utilizar XTask, debe crear una cuenta proporcionando nombre, dirección de correo
              electrónico y contraseña. Es responsable de:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Proporcionar información veraz y actualizada.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>Toda actividad que ocurra bajo su cuenta.</li>
              <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              4. Integraciones con Terceros
            </h2>
            <p>
              XTask permite la conexión con servicios de terceros:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Meta (Facebook/Meta Ads):</strong> Al conectar su cuenta de Meta,
                autoriza a XTask a acceder a datos de sus campañas publicitarias (gasto, impresiones,
                clics) de forma exclusivamente lectura. No realizamos ninguna acción de escritura
                ni modificación en su cuenta de Meta.
              </li>
              <li>
                <strong>Google Analytics:</strong> Al conectar su cuenta de Google Analytics,
                autoriza a XTask a acceder a datos de análisis web (sesiones, usuarios, páginas vistas)
                de forma exclusivamente lectura. No realizamos ninguna acción de escritura ni modificación
                en su propiedad de Google Analytics.
              </li>
            </ul>
            <p>
              Puede desconectar estas integraciones en cualquier momento desde la sección de Reportes.
              Al hacerlo, los tokens de acceso se eliminan inmediatamente de nuestros sistemas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              5. Uso Aceptable
            </h2>
            <p>Se compromete a no utilizar XTask para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Actividades ilegales o no autorizadas.</li>
              <li>Violar los derechos de terceros.</li>
              <li>Introducir malware o código malicioso.</li>
              <li>Acceder a datos de otros usuarios sin autorización.</li>
              <li>Realizar ingeniería inversa del servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              6. Propiedad Intelectual
            </h2>
            <p>
              Todo el contenido, diseño, código y materiales de XTask son propiedad de{" "}
              <strong>Jesus Nuñez Lopez de Vicuña</strong> y están protegidos por las leyes de
              propiedad intelectual aplicables. No se otorga licencia de uso más allá del acceso
              al servicio conforme a estos términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              7. Datos del Usuario
            </h2>
            <p>
              Usted mantiene la titularidad de todos los datos que introduce en XTask (tareas, proyectos,
              organizaciones). Nosotros procesamos estos datos únicamente para prestar el servicio.
              Puede exportar o eliminar sus datos en cualquier momento. Para más detalles, consulte
              nuestra <a href="/privacy" className="text-blue-600 dark:text-blue-400 underline">Política de Privacidad</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              8. Disponibilidad del Servicio
            </h2>
            <p>
              Nos esforzamos por mantener XTask disponible de forma continua, pero no garantizamos
              un servicio sin interrupciones. Podemos realizar mantenimiento programado o experimentar
              interrupciones no planificadas. No seremos responsables de pérdidas derivadas de
              la indisponibilidad temporal del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              9. Limitación de Responsabilidad
            </h2>
            <p>
              En la máxima medida permitida por la ley, XTask no será responsable de daños indirectos,
              incidentales, especiales o consecuentes derivados del uso o imposibilidad de uso del servicio.
              Esto incluye, sin limitación, pérdida de datos, pérdida de beneficios o interrupción de negocio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              10. Modificaciones
            </h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento.
              Las modificaciones significativas serán notificadas a través de la plataforma o por correo
              electrónico. El uso continuado de XTask tras la notificación constituye la aceptación
              de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              11. Terminación
            </h2>
            <p>
              Puede eliminar su cuenta en cualquier momento. Nos reservamos el derecho de suspender
              o terminar cuentas que violen estos términos. Tras la terminación, sus datos serán
              eliminados conforme a nuestra Política de Privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              12. Ley Aplicable
            </h2>
            <p>
              Estos términos se rigen por la legislación española. Cualquier disputa será sometida
              a los juzgados y tribunales competentes de España, conforme al Reglamento General de
              Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos (LOPDGDD).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              13. Contacto
            </h2>
            <p>
              Para cualquier pregunta sobre estos Términos, contacte con:<br />
              <strong>Email:</strong> info@localizate.eu<br />
              <strong>Responsable:</strong> Jesus Nuñez Lopez de Vicuña
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Volver a XTask
          </a>
        </div>
      </div>
    </div>
  );
}
