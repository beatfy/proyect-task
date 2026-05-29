import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad - XTask",
  description: "Política de Privacidad de XTask",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Política de Privacidad
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Última actualización: 29 de mayo de 2026
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              1. Responsable del Tratamiento
            </h2>
            <p>
              El responsable del tratamiento de los datos personales es <strong>Jesus Nuñez Lopez de Vicuña</strong>,
              autónomo con domicilio en España, contacto: <strong>info@localizate.eu</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              2. Datos que Recopilamos
            </h2>
            <p>Recopilamos los siguientes datos personales:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Datos de registro:</strong> nombre, dirección de correo electrónico y contraseña (almacenada de forma cifrada).</li>
              <li><strong>Datos de uso:</strong> información sobre cómo utiliza la plataforma, incluyendo tareas creadas, proyectos y actividad.</li>
              <li><strong>Datos de integraciones:</strong> si conecta Meta Ads o Google Analytics, almacenamos los tokens de acceso necesarios para mostrar sus métricas.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, sistema operativo y datos de navegación anónimos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              3. Finalidad del Tratamiento
            </h2>
            <p>Utilizamos sus datos para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Proporcionar y mantener el servicio XTask.</li>
              <li>Gestionar su cuenta de usuario y autenticación.</li>
              <li>Mostrar métricas y estadísticas desde Meta Ads y Google Analytics.</li>
              <li>Mejorar la plataforma y la experiencia del usuario.</li>
              <li>Enviar comunicaciones relacionadas con el servicio (si procede).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              4. Base Legal
            </h2>
            <p>
              El tratamiento de sus datos se basa en el cumplimiento del contrato de prestación del servicio,
              el consentimiento explícito para integraciones con terceros (Meta, Google), y el interés legítimo
              para mejorar el servicio, conforme al <strong>Reglamento General de Protección de Datos (RGPD)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              5. Integraciones con Terceros
            </h2>
            <p>
              XTask se integra con los siguientes servicios de terceros para proporcionar funcionalidades de análisis:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Meta (Facebook):</strong> Accedemos a datos de campañas publicitarias (gasto, impresiones, clics)
                a través de la API de Meta. Estos datos solo se obtienen con su autorización explícita mediante OAuth.
                Consulte la{" "}
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                  Política de Privacidad de Meta
                </a>.
              </li>
              <li>
                <strong>Google Analytics:</strong> Accedemos a datos de análisis web (sesiones, usuarios activos, páginas vistas)
                a través de la Google Analytics Data API. Estos datos solo se obtienen con su autorización explícita mediante OAuth.
                Consulte la{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                  Política de Privacidad de Google
                </a>.
              </li>
            </ul>
            <p>
              En ningún caso compartimos sus datos personales con estos terceros. Solo utilizamos los tokens de acceso
              para recuperar sus propias métricas y mostrarlas en la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              6. Conservación de Datos
            </h2>
            <p>
              Los datos personales se conservan mientras mantenga una cuenta activa en XTask. Los tokens de acceso
              de integraciones se eliminan inmediatamente al desconectar el servicio. Puede solicitar la eliminación
              completa de su cuenta y datos en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              7. Derechos del Usuario
            </h2>
            <p>
              Conforme al RGPD, tiene derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Acceso:</strong> solicitar una copia de sus datos personales.</li>
              <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de sus datos personales.</li>
              <li><strong>Portabilidad:</strong> solicitar la transferencia de sus datos.</li>
              <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos.</li>
              <li><strong>Limitación:</strong> solicitar la limitación del tratamiento.</li>
            </ul>
            <p>
              Para ejercer estos derechos, contacte con nosotros en <strong>info@localizate.eu</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              8. Seguridad
            </h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos personales,
              incluyendo cifrado de contraseñas (bcrypt), conexiones HTTPS, y control de acceso basado en roles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              9. Cookies
            </h2>
            <p>
              XTask utiliza cookies técnicas necesarias para el funcionamiento de la sesión de usuario
              (next-auth.session-token). No utilizamos cookies de seguimiento ni de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              10. Cambios en esta Política
            </h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Le notificaremos cambios significativos
              a través de la plataforma o por correo electrónico.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              11. Contacto
            </h2>
            <p>
              Para cualquier pregunta sobre esta política de privacidad, contacte con:<br />
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
