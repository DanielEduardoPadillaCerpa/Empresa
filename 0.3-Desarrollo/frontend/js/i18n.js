/* ============================================================
   i18n — Selector de idioma
   Variantes: es-419 (español LatAm), es-ES (español España),
   en-US (inglés americano), en-GB (inglés británico)
   Uso: <span data-i18n="clave">texto por defecto en español</span>
   ============================================================ */

const IDIOMAS = {
  'es-419': { label: 'Español (Latinoamérica)', bandera: '🇨🇴' },
  'es-ES':  { label: 'Español (España)',        bandera: '🇪🇸' },
  'en-US':  { label: 'English (US)',             bandera: '🇺🇸' },
  'en-GB':  { label: 'English (UK)',             bandera: '🇬🇧' },
};

const T = {
  // ---------- Navbar ----------
  nav_catalogo:   { 'es-419': 'Catálogo', 'es-ES': 'Catálogo', 'en-US': 'Catalog', 'en-GB': 'Catalogue' },
  nav_registro:   { 'es-419': 'Registro de cliente', 'es-ES': 'Registro de cliente', 'en-US': 'Customer registration', 'en-GB': 'Customer registration' },
  nav_reportes:   { 'es-419': 'Reportes', 'es-ES': 'Informes', 'en-US': 'Reports', 'en-GB': 'Reports' },
  nav_clientes:   { 'es-419': 'Clientes', 'es-ES': 'Clientes', 'en-US': 'Customers', 'en-GB': 'Customers' },
  nav_contacto:   { 'es-419': 'Contacto', 'es-ES': 'Contacto', 'en-US': 'Contact', 'en-GB': 'Contact' },
  nav_carrito:    { 'es-419': 'Carrito', 'es-ES': 'Cesta', 'en-US': 'Cart', 'en-GB': 'Basket' },
  nav_brand:      { 'es-419': 'Suministros Institucionales', 'es-ES': 'Suministros Institucionales', 'en-US': 'Institutional Supplies', 'en-GB': 'Institutional Supplies' },
  nav_badge:      { 'es-419': 'PROVEEDOR AUTORIZADO · REG-2026-0417', 'es-ES': 'PROVEEDOR AUTORIZADO · REG-2026-0417', 'en-US': 'AUTHORISED SUPPLIER · REG-2026-0417', 'en-GB': 'AUTHORISED SUPPLIER · REG-2026-0417' },
  landing_page_title: { 'es-419': 'Suministros Institucionales', 'es-ES': 'Suministros Institucionales', 'en-US': 'Institutional Supplies', 'en-GB': 'Institutional Supplies' },
  landing_eyebrow: { 'es-419': 'Plataforma institucional 2026', 'es-ES': 'Plataforma institucional 2026', 'en-US': 'Institutional platform 2026', 'en-GB': 'Institutional platform 2026' },
  landing_title_first: { 'es-419': 'Dotación y suministro', 'es-ES': 'Dotación y suministro', 'en-US': 'Gear and supplies', 'en-GB': 'Kit and supplies' },
  landing_title_second: { 'es-419': 'para unidades policiales', 'es-ES': 'para unidades policiales', 'en-US': 'for police units', 'en-GB': 'for police units' },
  landing_lead: { 'es-419': 'Catálogo, pedidos y atención al cliente disponibles las 24 horas, con trazabilidad completa y cumplimiento de la Ley 1581 de 2012 en cada paso.', 'es-ES': 'Catálogo, pedidos y atención al cliente disponibles las 24 horas, con trazabilidad completa y cumplimiento de la Ley 1581 de 2012 en cada paso.', 'en-US': 'Catalog, orders, and customer support available around the clock, with full traceability and compliance with Law 1581 of 2012 at every step.', 'en-GB': 'Catalogue, orders, and customer support available around the clock, with full traceability and compliance with Law 1581 of 2012 at every step.' },
  landing_catalog_btn: { 'es-419': 'Ver catálogo', 'es-ES': 'Ver catálogo', 'en-US': 'View catalogue', 'en-GB': 'View catalogue' },
  landing_login_btn: { 'es-419': 'Iniciar sesión', 'es-ES': 'Iniciar sesión', 'en-US': 'Sign in', 'en-GB': 'Sign in' },
  landing_first_time: { 'es-419': '¿Primera vez aquí?', 'es-ES': '¿Primera vez aquí?', 'en-US': 'First time here?', 'en-GB': 'First time here?' },
  landing_create_account: { 'es-419': 'Crea tu cuenta institucional', 'es-ES': 'Crea tu cuenta institucional', 'en-US': 'Create your institutional account', 'en-GB': 'Create your institutional account' },
  landing_support_title: { 'es-419': 'Atención 24/7', 'es-ES': 'Atención 24/7', 'en-US': '24/7 support', 'en-GB': '24/7 support' },
  landing_support_text: { 'es-419': 'Chatbot institucional y pedidos disponibles a cualquier hora, con escalamiento a un agente humano cuando se necesita.', 'es-ES': 'Chatbot institucional y pedidos disponibles a cualquier hora, con escalamiento a un agente humano cuando se necesita.', 'en-US': 'Institutional chatbot and orders available at any time, with escalation to a human agent when needed.', 'en-GB': 'Institutional chatbot and orders available at any time, with escalation to a human agent when needed.' },
  landing_security_title: { 'es-419': 'Datos protegidos', 'es-ES': 'Datos protegidos', 'en-US': 'Protected data', 'en-GB': 'Protected data' },
  landing_security_text: { 'es-419': 'Cada dato se clasifica y se cifra según su nivel de sensibilidad, conforme a la Ley 1581 de 2012.', 'es-ES': 'Cada dato se clasifica y se cifra según su nivel de sensibilidad, conforme a la Ley 1581 de 2012.', 'en-US': 'Every data item is classified and encrypted according to its sensitivity level, in accordance with Law 1581 of 2012.', 'en-GB': 'Every data item is classified and encrypted according to its sensitivity level, in accordance with Law 1581 of 2012.' },
  landing_delivery_title: { 'es-419': 'Entrega directa', 'es-ES': 'Entrega directa', 'en-US': 'Direct delivery', 'en-GB': 'Direct delivery' },
  landing_delivery_text: { 'es-419': 'Despacho a la instalación oficial registrada, con seguimiento de pedido en tiempo real.', 'es-ES': 'Despacho a la instalación oficial registrada, con seguimiento de pedido en tiempo real.', 'en-US': 'Delivery to the registered official facility, with real-time order tracking.', 'en-GB': 'Delivery to the registered official facility, with real-time order tracking.' },
  login_page_title: { 'es-419': 'Iniciar sesión — Suministros Institucionales', 'es-ES': 'Iniciar sesión — Suministros Institucionales', 'en-US': 'Sign in — Institutional Supplies', 'en-GB': 'Sign in — Institutional Supplies' },
  login_eyebrow: { 'es-419': 'Acceso de cliente', 'es-ES': 'Acceso de cliente', 'en-US': 'Customer access', 'en-GB': 'Customer access' },
  login_title: { 'es-419': 'Iniciar sesión', 'es-ES': 'Iniciar sesión', 'en-US': 'Sign in', 'en-GB': 'Sign in' },
  login_lead: { 'es-419': 'Necesitas una cuenta para completar tu compra.', 'es-ES': 'Necesitas una cuenta para completar tu compra.', 'en-US': 'You need an account to complete your purchase.', 'en-GB': 'You need an account to complete your purchase.' },
  login_email: { 'es-419': 'Correo electrónico', 'es-ES': 'Correo electrónico', 'en-US': 'Email address', 'en-GB': 'Email address' },
  login_password: { 'es-419': 'Contraseña', 'es-ES': 'Contraseña', 'en-US': 'Password', 'en-GB': 'Password' },
  login_human_check: { 'es-419': 'Soy humano (captcha)', 'es-ES': 'Soy humano (captcha)', 'en-US': 'I am human (captcha)', 'en-GB': 'I am human (captcha)' },
  login_terms_check: { 'es-419': 'Acepto los términos y condiciones', 'es-ES': 'Acepto los términos y condiciones', 'en-US': 'I accept the terms and conditions', 'en-GB': 'I accept the terms and conditions' },
  login_submit: { 'es-419': 'Iniciar sesión', 'es-ES': 'Iniciar sesión', 'en-US': 'Sign in', 'en-GB': 'Sign in' },
  login_no_account: { 'es-419': '¿No tienes cuenta?', 'es-ES': '¿No tienes cuenta?', 'en-US': 'Do not have an account?', 'en-GB': 'Do not have an account?' },
  login_register_link: { 'es-419': 'Regístrate aquí', 'es-ES': 'Regístrate aquí', 'en-US': 'Register here', 'en-GB': 'Register here' },
  login_backend_url: { 'es-419': 'URL del backend:', 'es-ES': 'URL del backend:', 'en-US': 'Backend URL:', 'en-GB': 'Backend URL:' },
  registration_page_title: { 'es-419': 'Registro de cliente — Suministros Institucionales', 'es-ES': 'Registro de cliente — Suministros Institucionales', 'en-US': 'Customer registration — Institutional Supplies', 'en-GB': 'Customer registration — Institutional Supplies' },
  registration_header: { 'es-419': 'Ficha del titular · Ley 1581 de 2012', 'es-ES': 'Ficha del titular · Ley 1581 de 2012', 'en-US': 'Data subject form · Law 1581 of 2012', 'en-GB': 'Data subject form · Law 1581 of 2012' },
  registration_title: { 'es-419': 'Registro de cliente', 'es-ES': 'Registro de cliente', 'en-US': 'Customer registration', 'en-GB': 'Customer registration' },
  registration_lead: { 'es-419': 'Cada dato solicitado está clasificado según su nivel de sensibilidad. Solo recolectamos lo estrictamente necesario para procesar tu pedido.', 'es-ES': 'Cada dato solicitado está clasificado según su nivel de sensibilidad. Solo recolectamos lo estrictamente necesario para procesar tu pedido.', 'en-US': 'Each requested data item is classified by sensitivity. We collect only what is strictly necessary to process your order.', 'en-GB': 'Each requested data item is classified by sensitivity. We collect only what is strictly necessary to process your order.' },
  privacy_sensitive: { 'es-419': 'Sensible', 'es-ES': 'Sensible', 'en-US': 'Sensitive', 'en-GB': 'Sensitive' },
  registration_backend_url: { 'es-419': 'URL del backend', 'es-ES': 'URL del backend', 'en-US': 'Backend URL', 'en-GB': 'Backend URL' },
  registration_section_entity: { 'es-419': '1. Datos de la entidad', 'es-ES': '1. Datos de la entidad', 'en-US': '1. Organization details', 'en-GB': '1. Organisation details' },
  registration_section_commercial: { 'es-419': '2. Datos comerciales', 'es-ES': '2. Datos comerciales', 'en-US': '2. Commercial details', 'en-GB': '2. Commercial details' },
  registration_section_official: { 'es-419': '3. Datos del funcionario responsable', 'es-ES': '3. Datos del funcionario responsable', 'en-US': '3. Responsible official details', 'en-GB': '3. Responsible official details' },
  registration_section_security: { 'es-419': '4. Verificación de seguridad', 'es-ES': '4. Verificación de seguridad', 'en-US': '4. Security verification', 'en-GB': '4. Security verification' },
  registration_section_access: { 'es-419': '5. Crea tu acceso', 'es-ES': '5. Crea tu acceso', 'en-US': '5. Create your access', 'en-GB': '5. Create your access' },
  registration_unit_name: { 'es-419': 'Nombre de la unidad / instalación', 'es-ES': 'Nombre de la unidad / instalación', 'en-US': 'Unit / facility name', 'en-GB': 'Unit / facility name' },
  registration_unit_placeholder: { 'es-419': 'Ej. Estación de Policía Norte', 'es-ES': 'Ej. Estación de Policía Norte', 'en-US': 'E.g. North Police Station', 'en-GB': 'E.g. North Police Station' },
  registration_public_note: { 'es-419': 'Consta en registros públicos institucionales — no requiere autorización especial.', 'es-ES': 'Consta en registros públicos institucionales — no requiere autorización especial.', 'en-US': 'It appears in public institutional records and requires no special authorization.', 'en-GB': 'It appears in public institutional records and requires no special authorisation.' },
  registration_official_address: { 'es-419': 'Dirección de la instalación oficial', 'es-ES': 'Dirección de la instalación oficial', 'en-US': 'Official facility address', 'en-GB': 'Official facility address' },
  registration_address_placeholder: { 'es-419': 'Dirección de la sede', 'es-ES': 'Dirección de la sede', 'en-US': 'Facility address', 'en-GB': 'Facility address' },
  registration_tax_id: { 'es-419': 'NIT / código presupuestal', 'es-ES': 'NIT / código presupuestal', 'en-US': 'Tax ID / budget code', 'en-GB': 'Tax ID / budget code' },
  registration_commercial_note: { 'es-419': 'Interesa a la relación comercial (facturación, cumplimiento de pago).', 'es-ES': 'Interesa a la relación comercial (facturación, cumplimiento de pago).', 'en-US': 'Relevant to the commercial relationship (billing and payment compliance).', 'en-GB': 'Relevant to the commercial relationship (billing and payment compliance).' },
  registration_official_name: { 'es-419': 'Nombre completo del funcionario que gestiona la compra', 'es-ES': 'Nombre completo del funcionario que gestiona la compra', 'en-US': 'Full name of the official managing the purchase', 'en-GB': 'Full name of the official managing the purchase' },
  registration_email: { 'es-419': 'Correo electrónico', 'es-ES': 'Correo electrónico', 'en-US': 'Email address', 'en-GB': 'Email address' },
  registration_phone: { 'es-419': 'Teléfono de contacto', 'es-ES': 'Teléfono de contacto', 'en-US': 'Contact phone', 'en-GB': 'Contact telephone' },
  registration_delivery_address: { 'es-419': 'Dirección de entrega (si difiere de la instalación oficial)', 'es-ES': 'Dirección de entrega (si difiere de la instalación oficial)', 'en-US': 'Delivery address (if different from the official facility)', 'en-GB': 'Delivery address (if different from the official facility)' },
  registration_security_notice: { 'es-419': 'Este campo aplica un tratamiento especial: la empresa solo lo solicita porque parte del catálogo corresponde a equipo restringido, cuya entrega exige verificar que quien lo recibe está autorizado para manipularlo. No se solicita para ningún otro fin.', 'es-ES': 'Este campo aplica un tratamiento especial: la empresa solo lo solicita porque parte del catálogo corresponde a equipo restringido, cuya entrega exige verificar que quien lo recibe está autorizado para manipularlo. No se solicita para ningún otro fin.', 'en-US': 'This field receives special treatment because part of the catalogue contains restricted equipment whose delivery requires verifying that the recipient is authorized to handle it. It is not requested for any other purpose.', 'en-GB': 'This field receives special treatment because part of the catalogue contains restricted equipment whose delivery requires verifying that the recipient is authorised to handle it. It is not requested for any other purpose.' },
  registration_background_check: { 'es-419': 'Certificado o número de consulta de antecedentes judiciales del funcionario receptor', 'es-ES': 'Certificado o número de consulta de antecedentes judiciales del funcionario receptor', 'en-US': 'Background-check certificate or reference number for the receiving official', 'en-GB': 'Background-check certificate or reference number for the receiving official' },
  registration_background_placeholder: { 'es-419': 'Número de consulta ante Policía Nacional / Procuraduría', 'es-ES': 'Número de consulta ante Policía Nacional / Procuraduría', 'en-US': 'Reference number from the National Police / Ombudsman\'s Office', 'en-GB': 'Reference number from the National Police / Ombudsman\'s Office' },
  registration_background_note: { 'es-419': 'Requerido únicamente para pedidos que incluyan equipo táctico restringido (categoría "Equipo táctico" del catálogo).', 'es-ES': 'Requerido únicamente para pedidos que incluyan equipo táctico restringido (categoría "Equipo táctico" del catálogo).', 'en-US': 'Required only for orders containing restricted tactical equipment (the "Tactical equipment" catalogue category).', 'en-GB': 'Required only for orders containing restricted tactical equipment (the "Tactical equipment" catalogue category).' },
  registration_legal_notice: { 'es-419': 'Aviso legal — dato de tratamiento especial (Art. 6, Ley 1581 de 2012 y Decreto 1377 de 2013):', 'es-ES': 'Aviso legal — dato de tratamiento especial (Art. 6, Ley 1581 de 2012 y Decreto 1377 de 2013):', 'en-US': 'Legal notice — specially processed data (Art. 6, Law 1581 of 2012 and Decree 1377 of 2013):', 'en-GB': 'Legal notice — specially processed data (Art. 6, Law 1581 of 2012 and Decree 1377 of 2013):' },
  registration_sensitive_consent: { 'es-419': 'Autorizo expresa y voluntariamente el tratamiento de mi dato de antecedentes judiciales/de seguridad, exclusivamente para la finalidad de verificación descrita arriba.', 'es-ES': 'Autorizo expresa y voluntariamente el tratamiento de mi dato de antecedentes judiciales/de seguridad, exclusivamente para la finalidad de verificación descrita arriba.', 'en-US': 'I expressly and voluntarily authorize the processing of my judicial/security background data solely for the verification purpose described above.', 'en-GB': 'I expressly and voluntarily authorise the processing of my judicial/security background data solely for the verification purpose described above.' },
  registration_password: { 'es-419': 'Contraseña de acceso', 'es-ES': 'Contraseña de acceso', 'en-US': 'Access password', 'en-GB': 'Access password' },
  registration_password_note: { 'es-419': 'Mínimo 8 caracteres. Se guarda cifrada de forma irreversible (hash), nunca en texto plano — ni siquiera el equipo de soporte puede verla.', 'es-ES': 'Mínimo 8 caracteres. Se guarda cifrada de forma irreversible (hash), nunca en texto plano — ni siquiera el equipo de soporte puede verla.', 'en-US': 'At least 8 characters. Stored irreversibly encrypted (hashed), never in plain text — not even support staff can view it.', 'en-GB': 'At least 8 characters. Stored irreversibly encrypted (hashed), never in plain text — not even support staff can view it.' },
  registration_submit: { 'es-419': 'Registrar cliente', 'es-ES': 'Registrar cliente', 'en-US': 'Register customer', 'en-GB': 'Register customer' },
  registration_why_title: { 'es-419': '¿Por qué clasificamos cada dato?', 'es-ES': '¿Por qué clasificamos cada dato?', 'en-US': 'Why do we classify each data item?', 'en-GB': 'Why do we classify each data item?' },
  registration_why_text: { 'es-419': 'La Ley 1581 de 2012 exige un tratamiento diferenciado según el nivel de sensibilidad de la información. Marcar cada campo con su clasificación permite auditar qué se recolecta, por qué, y aplicar el nivel de acceso y cifrado correcto en el backend para cada categoría.', 'es-ES': 'La Ley 1581 de 2012 exige un tratamiento diferenciado según el nivel de sensibilidad de la información. Marcar cada campo con su clasificación permite auditar qué se recolecta, por qué, y aplicar el nivel de acceso y cifrado correcto en el backend para cada categoría.', 'en-US': 'Law 1581 of 2012 requires differentiated processing according to information sensitivity. Classifying each field makes it possible to audit what is collected and why, and apply the correct access and encryption level in the backend.', 'en-GB': 'Law 1581 of 2012 requires differentiated processing according to information sensitivity. Classifying each field makes it possible to audit what is collected and why, and apply the correct access and encryption level in the backend.' },
  registration_storage_text: { 'es-419': 'Los datos privados se almacenan cifrados en reposo. Los semiprivados son visibles también para contabilidad. Los públicos no requieren restricción. Los sensibles (antecedentes judiciales) se guardan en una tabla aparte, cifrada, visible solo para cumplimiento y seguridad.', 'es-ES': 'Los datos privados se almacenan cifrados en reposo. Los semiprivados son visibles también para contabilidad. Los públicos no requieren restricción. Los sensibles (antecedentes judiciales) se guardan en una tabla aparte, cifrada, visible solo para cumplimiento y seguridad.', 'en-US': 'Private data is encrypted at rest. Semi-private data is also visible to accounting. Public data requires no restriction. Sensitive data is stored in a separate encrypted table visible only to compliance and security.', 'en-GB': 'Private data is encrypted at rest. Semi-private data is also visible to accounting. Public data requires no restriction. Sensitive data is stored in a separate encrypted table visible only to compliance and security.' },
  registration_policy_title: { 'es-419': 'Política de tratamiento de datos', 'es-ES': 'Política de tratamiento de datos', 'en-US': 'Data processing policy', 'en-GB': 'Data processing policy' },
  registration_policy_intro: { 'es-419': 'Suministros Institucionales S.A.S. actúa como responsable del tratamiento de los datos personales recolectados en este formulario, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.', 'es-ES': 'Suministros Institucionales S.A.S. actúa como responsable del tratamiento de los datos personales recolectados en este formulario, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.', 'en-US': 'Institutional Supplies S.A.S. is responsible for processing the personal data collected in this form, in accordance with Law 1581 of 2012 and Decree 1377 of 2013.', 'en-GB': 'Institutional Supplies S.A.S. is responsible for processing the personal data collected in this form, in accordance with Law 1581 of 2012 and Decree 1377 of 2013.' },
  registration_policy_purpose: { 'es-419': 'Finalidad:', 'es-ES': 'Finalidad:', 'en-US': 'Purpose:', 'en-GB': 'Purpose:' },
  registration_policy_sensitive: { 'es-419': 'Datos de tratamiento especial:', 'es-ES': 'Datos de tratamiento especial:', 'en-US': 'Specially processed data:', 'en-GB': 'Specially processed data:' },
  registration_policy_rights: { 'es-419': 'Derechos del titular:', 'es-ES': 'Derechos del titular:', 'en-US': 'Data subject rights:', 'en-GB': 'Data subject rights:' },
  registration_chat_greeting: { 'es-419': 'Hola, soy el asistente virtual. ¿Tienes dudas sobre el registro o el tratamiento de tus datos?', 'es-ES': 'Hola, soy el asistente virtual. ¿Tienes dudas sobre el registro o el tratamiento de tus datos?', 'en-US': 'Hello, I am the virtual assistant. Do you have questions about registration or data processing?', 'en-GB': 'Hello, I am the virtual assistant. Do you have questions about registration or data processing?' },
  reports_page_title: { 'es-419': 'Reporte mensual de atención — Suministros Institucionales', 'es-ES': 'Reporte mensual de atención — Suministros Institucionales', 'en-US': 'Monthly support report — Institutional Supplies', 'en-GB': 'Monthly support report — Institutional Supplies' },
  reports_header: { 'es-419': 'Panel administrativo · Acceso restringido', 'es-ES': 'Panel administrativo · Acceso restringido', 'en-US': 'Administrative panel · Restricted access', 'en-GB': 'Administrative panel · Restricted access' },
  reports_title: { 'es-419': 'Reporte mensual de atención al cliente', 'es-ES': 'Reporte mensual de atención al cliente', 'en-US': 'Monthly customer support report', 'en-GB': 'Monthly customer support report' },
  reports_lead: { 'es-419': 'Julio 2026 — generado automáticamente a partir del historial de conversaciones del chatbot y las calificaciones registradas por los clientes.', 'es-ES': 'Julio 2026 — generado automáticamente a partir del historial de conversaciones del chatbot y las calificaciones registradas por los clientes.', 'en-US': 'July 2026 — automatically generated from chatbot conversation history and customer ratings.', 'en-GB': 'July 2026 — automatically generated from chatbot conversation history and customer ratings.' },
  reports_section_clients: { 'es-419': 'A. Clientes atendidos', 'es-ES': 'A. Clientes atendidos', 'en-US': 'A. Customers assisted', 'en-GB': 'A. Customers assisted' },
  reports_source_log: { 'es-419': 'Fuente: log de conversaciones', 'es-ES': 'Fuente: log de conversaciones', 'en-US': 'Source: conversation log', 'en-GB': 'Source: conversation log' },
  reports_attended: { 'es-419': 'Atendidos este mes', 'es-ES': 'Atendidos este mes', 'en-US': 'Assisted this month', 'en-GB': 'Assisted this month' },
  reports_resolved: { 'es-419': 'Resueltos sin agente humano', 'es-ES': 'Resueltos sin agente humano', 'en-US': 'Resolved without a human agent', 'en-GB': 'Resolved without a human agent' },
  reports_escalated: { 'es-419': 'Escalados a agente', 'es-ES': 'Escalados a agente', 'en-US': 'Escalated to an agent', 'en-GB': 'Escalated to an agent' },
  reports_response_time: { 'es-419': 'Tiempo prom. de 1ª respuesta', 'es-ES': 'Tiempo prom. de 1ª respuesta', 'en-US': 'Average first-response time', 'en-GB': 'Average first-response time' },
  reports_section_rating: { 'es-419': 'B. Calificación de la atención recibida', 'es-ES': 'B. Calificación de la atención recibida', 'en-US': 'B. Rating of support received', 'en-GB': 'B. Rating of support received' },
  reports_rating_scale: { 'es-419': 'Escala 1–5 · 892 calificaciones', 'es-ES': 'Escala 1–5 · 892 calificaciones', 'en-US': 'Scale 1–5 · 892 ratings', 'en-GB': 'Scale 1–5 · 892 ratings' },
  reports_average: { 'es-419': 'Promedio general', 'es-ES': 'Promedio general', 'en-US': 'Overall average', 'en-GB': 'Overall average' },
  reports_section_suggestions: { 'es-419': 'C. Sugerencias a la administración', 'es-ES': 'C. Sugerencias a la administración', 'en-US': 'C. Suggestions for management', 'en-GB': 'C. Suggestions for management' },
  reports_suggestions_source: { 'es-419': 'Generadas a partir de comentarios de clientes', 'es-ES': 'Generadas a partir de comentarios de clientes', 'en-US': 'Generated from customer comments', 'en-GB': 'Generated from customer comments' },
  reports_suggestions_intro: { 'es-419': 'Estas recomendaciones se derivan del análisis de los comentarios de texto libre dejados por los clientes con calificación ≤ 3, agrupados por tema recurrente.', 'es-ES': 'Estas recomendaciones se derivan del análisis de los comentarios de texto libre dejados por los clientes con calificación ≤ 3, agrupados por tema recurrente.', 'en-US': 'These recommendations come from analysis of free-text comments left by customers with a rating of 3 or below, grouped by recurring theme.', 'en-GB': 'These recommendations come from analysis of free-text comments left by customers with a rating of 3 or below, grouped by recurring theme.' },
  reports_suggestion_1_meta: { 'es-419': '21 menciones · calificación promedio 2.8', 'es-ES': '21 menciones · calificación promedio 2.8', 'en-US': '21 mentions · average rating 2.8', 'en-GB': '21 mentions · average rating 2.8' },
  reports_suggestion_1_title: { 'es-419': 'Reducir el tiempo de despacho a instalaciones fuera del área metropolitana.', 'es-ES': 'Reducir el tiempo de despacho a instalaciones fuera del área metropolitana.', 'en-US': 'Reduce delivery time to facilities outside the metropolitan area.', 'en-GB': 'Reduce delivery time to facilities outside the metropolitan area.' },
  reports_suggestion_1_text: { 'es-419': 'Los clientes de sedes en municipios reportan tiempos de entrega mayores a lo informado en el checkout.', 'es-ES': 'Los clientes de sedes en municipios reportan tiempos de entrega mayores a lo informado en el checkout.', 'en-US': 'Customers at facilities outside the city report delivery times longer than those shown at checkout.', 'en-GB': 'Customers at facilities outside the city report delivery times longer than those shown at checkout.' },
  reports_suggestion_2_meta: { 'es-419': '14 menciones · calificación promedio 3.0', 'es-ES': '14 menciones · calificación promedio 3.0', 'en-US': '14 mentions · average rating 3.0', 'en-GB': '14 mentions · average rating 3.0' },
  reports_suggestion_2_title: { 'es-419': 'Ampliar el catálogo de tallas en dotación (uniformes y botas).', 'es-ES': 'Ampliar el catálogo de tallas en dotación (uniformes y botas).', 'en-US': 'Expand the size range for gear (uniforms and boots).', 'en-GB': 'Expand the size range for kit (uniforms and boots).' },
  reports_suggestion_2_text: { 'es-419': 'Varios comentarios solicitan tallas extendidas no disponibles actualmente.', 'es-ES': 'Varios comentarios solicitan tallas extendidas no disponibles actualmente.', 'en-US': 'Several comments request extended sizes that are not currently available.', 'en-GB': 'Several comments request extended sizes that are not currently available.' },
  reports_suggestion_3_meta: { 'es-419': '9 menciones · calificación promedio 2.5', 'es-ES': '9 menciones · calificación promedio 2.5', 'en-US': '9 mentions · average rating 2.5', 'en-GB': '9 mentions · average rating 2.5' },
  reports_suggestion_3_title: { 'es-419': 'Agregar opción de pago con orden de compra a 30 días.', 'es-ES': 'Agregar opción de pago con orden de compra a 30 días.', 'en-US': 'Add a 30-day purchase-order payment option.', 'en-GB': 'Add a 30-day purchase-order payment option.' },
  reports_suggestion_3_text: { 'es-419': 'Algunas unidades reportan trámites presupuestales que no calzan con el pago inmediato actual.', 'es-ES': 'Algunas unidades reportan trámites presupuestales que no calzan con el pago inmediato actual.', 'en-US': 'Some units report budget procedures that do not fit the current immediate-payment model.', 'en-GB': 'Some units report budget procedures that do not fit the current immediate-payment model.' },
  reports_suggestion_4_meta: { 'es-419': '6 menciones · calificación promedio 3.2', 'es-ES': '6 menciones · calificación promedio 3.2', 'en-US': '6 mentions · average rating 3.2', 'en-GB': '6 mentions · average rating 3.2' },
  reports_suggestion_4_title: { 'es-419': 'Permitir que el chatbot consulte el estado del pedido sin pedir de nuevo el número de orden.', 'es-ES': 'Permitir que el chatbot consulte el estado del pedido sin pedir de nuevo el número de orden.', 'en-US': 'Allow the chatbot to check order status without requesting the order number again.', 'en-GB': 'Allow the chatbot to check order status without requesting the order number again.' },
  reports_suggestion_4_text: { 'es-419': 'Los clientes esperan que el bot reconozca su sesión activa automáticamente.', 'es-ES': 'Los clientes esperan que el bot reconozca su sesión activa automáticamente.', 'en-US': 'Customers expect the bot to recognize their active session automatically.', 'en-GB': 'Customers expect the bot to recognize their active session automatically.' },
  reports_methodology_title: { 'es-419': 'Nota metodológica', 'es-ES': 'Nota metodológica', 'en-US': 'Methodological note', 'en-GB': 'Methodological note' },
  reports_methodology_text: { 'es-419': 'Este reporte se genera automáticamente el primer día hábil de cada mes a partir de: (1) el log de conversaciones del chatbot y agentes humanos, (2) las calificaciones de 1 a 5 recolectadas al cierre de cada conversación, y (3) un análisis de temas recurrentes sobre los comentarios abiertos. No incluye datos personales identificables — solo métricas agregadas.', 'es-ES': 'Este reporte se genera automáticamente el primer día hábil de cada mes a partir de: (1) el log de conversaciones del chatbot y agentes humanos, (2) las calificaciones de 1 a 5 recolectadas al cierre de cada conversación, y (3) un análisis de temas recurrentes sobre los comentarios abiertos. No incluye datos personales identificables — solo métricas agregadas.', 'en-US': 'This report is generated automatically on the first business day of each month from: (1) chatbot and human-agent conversation logs, (2) ratings from 1 to 5 collected at the end of each conversation, and (3) recurring-topic analysis of open comments. It contains no identifiable personal data, only aggregated metrics.', 'en-GB': 'This report is generated automatically on the first business day of each month from: (1) chatbot and human-agent conversation logs, (2) ratings from 1 to 5 collected at the end of each conversation, and (3) recurring-topic analysis of open comments. It contains no identifiable personal data, only aggregated metrics.' },
  reports_footer_copyright: { 'es-419': '© 2026 Suministros Institucionales S.A.S.', 'es-ES': '© 2026 Suministros Institucionales S.A.S.', 'en-US': '© 2026 Suministros Institucionales S.A.S.', 'en-GB': '© 2026 Suministros Institucionales S.A.S.' },
  reports_footer_internal: { 'es-419': 'Reporte de uso interno — panel administrativo', 'es-ES': 'Reporte de uso interno — panel administrativo', 'en-US': 'Internal-use report — administrative panel', 'en-GB': 'Internal-use report — administrative panel' },
  nav_inicio:     { 'es-419': 'Inicio', 'es-ES': 'Inicio', 'en-US': 'Home', 'en-GB': 'Home' },
  nav_auth:       { 'es-419': 'Autenticación', 'es-ES': 'Autenticación', 'en-US': 'Authentication', 'en-GB': 'Authentication' },
  privacy_public: { 'es-419': 'público', 'es-ES': 'público', 'en-US': 'public', 'en-GB': 'public' },
  privacy_semiprivate: { 'es-419': 'semiprivado', 'es-ES': 'semiprivado', 'en-US': 'semi-private', 'en-GB': 'semi-private' },
  privacy_private: { 'es-419': 'privado', 'es-ES': 'privado', 'en-US': 'private', 'en-GB': 'private' },

  // ---------- Hero / index ----------
  hero_index_eyebrow: { 'es-419': 'Catálogo institucional 2026', 'es-ES': 'Catálogo institucional 2026', 'en-US': '2026 Institutional catalog', 'en-GB': '2026 Institutional catalogue' },
  hero_index_title:   { 'es-419': 'Dotación y suministro para unidades policiales', 'es-ES': 'Dotación y suministro para unidades policiales', 'en-US': 'Gear and supplies for police units', 'en-GB': 'Kit and supplies for police units' },
  hero_index_lead:    {
    'es-419': 'Uniformes, equipo táctico, papelería institucional y elementos de oficina, con despacho directo a la instalación registrada. Pedidos, seguimiento y soporte disponibles las 24 horas.',
    'es-ES':  'Uniformes, equipo táctico, papelería institucional y material de oficina, con envío directo a la instalación registrada. Pedidos, seguimiento y soporte disponibles las 24 horas.',
    'en-US':  'Uniforms, tactical gear, official paperwork, and office supplies, shipped directly to the registered facility. Orders, tracking, and support available around the clock.',
    'en-GB':  'Uniforms, tactical kit, official paperwork, and office supplies, delivered directly to the registered facility. Orders, tracking, and support available around the clock.',
  },
  products_heading: { 'es-419': 'Productos disponibles', 'es-ES': 'Productos disponibles', 'en-US': 'Available products', 'en-GB': 'Available products' },
  products_count:   { 'es-419': '42 referencias activas', 'es-ES': '42 referencias activas', 'en-US': '42 active listings', 'en-GB': '42 active listings' },

  cat_dotacion:  { 'es-419': 'Dotación', 'es-ES': 'Dotación', 'en-US': 'Gear', 'en-GB': 'Kit' },
  cat_tactico:   { 'es-419': 'Equipo táctico', 'es-ES': 'Equipo táctico', 'en-US': 'Tactical equipment', 'en-GB': 'Tactical equipment' },
  cat_papeleria: { 'es-419': 'Papelería oficial', 'es-ES': 'Papelería oficial', 'en-US': 'Official paperwork', 'en-GB': 'Official paperwork' },
  cat_oficina:   { 'es-419': 'Oficina', 'es-ES': 'Oficina', 'en-US': 'Office', 'en-GB': 'Office' },

  prod1_name: { 'es-419': 'Uniforme operativo — tela ripstop', 'es-ES': 'Uniforme operativo — tela ripstop', 'en-US': 'Operational uniform — ripstop fabric', 'en-GB': 'Operational uniform — ripstop fabric' },
  prod1_desc: { 'es-419': 'Camisa y pantalón reglamentario, resistente a abrasión, disponible en tallas S a XXL.', 'es-ES': 'Camisa y pantalón reglamentario, resistente a la abrasión, disponible en tallas S a XXL.', 'en-US': 'Regulation shirt and trousers, abrasion-resistant, available in sizes S to XXL.', 'en-GB': 'Regulation shirt and trousers, abrasion-resistant, available in sizes S to XXL.' },

  prod2_name: { 'es-419': 'Chaleco portaequipo modular', 'es-ES': 'Chaleco portaequipo modular', 'en-US': 'Modular load-bearing vest', 'en-GB': 'Modular load-carrying vest' },
  prod2_desc: { 'es-419': 'Sistema MOLLE, ajuste lateral, compatible con placas de protección estándar.', 'es-ES': 'Sistema MOLLE, ajuste lateral, compatible con placas de protección estándar.', 'en-US': 'MOLLE system, side adjustment, compatible with standard protective plates.', 'en-GB': 'MOLLE system, side adjustment, compatible with standard protective plates.' },

  prod3_name: { 'es-419': 'Talonario de comparendos (x50)', 'es-ES': 'Talonario de sanciones (x50)', 'en-US': 'Citation booklet (x50)', 'en-GB': 'Fixed penalty notice booklet (x50)' },
  prod3_desc: { 'es-419': 'Papel numerado consecutivo, formato oficial vigente, empaque sellado.', 'es-ES': 'Papel numerado consecutivo, formato oficial vigente, envase sellado.', 'en-US': 'Sequentially numbered paper, current official format, sealed packaging.', 'en-GB': 'Sequentially numbered paper, current official format, sealed packaging.' },

  prod4_name: { 'es-419': 'Botas tácticas antideslizantes', 'es-ES': 'Botas tácticas antideslizantes', 'en-US': 'Slip-resistant tactical boots', 'en-GB': 'Slip-resistant tactical boots' },
  prod4_desc: { 'es-419': 'Suela de goma reforzada, punta reforzada, tallas 36 a 45.', 'es-ES': 'Suela de goma reforzada, puntera reforzada, tallas 36 a 45.', 'en-US': 'Reinforced rubber sole, reinforced toe, sizes 36 to 45.', 'en-GB': 'Reinforced rubber sole, reinforced toe, sizes 36 to 45.' },

  prod5_name: { 'es-419': 'Kit de sellos institucionales', 'es-ES': 'Kit de sellos institucionales', 'en-US': 'Official stamp kit', 'en-GB': 'Official stamp kit' },
  prod5_desc: { 'es-419': 'Set de 3 sellos personalizados con escudo de la unidad, entintado automático.', 'es-ES': 'Set de 3 sellos personalizados con escudo de la unidad, autoentintables.', 'en-US': 'Set of 3 custom self-inking stamps with the unit\u2019s crest.', 'en-GB': 'Set of 3 bespoke self-inking stamps with the unit\u2019s crest.' },

  prod6_name: { 'es-419': 'Linterna operativa recargable', 'es-ES': 'Linterna operativa recargable', 'en-US': 'Rechargeable operational flashlight', 'en-GB': 'Rechargeable operational torch' },
  prod6_desc: { 'es-419': '1200 lúmenes, resistente a agua IP67, montaje compatible con arma larga.', 'es-ES': '1200 lúmenes, resistente al agua IP67, montaje compatible con arma larga.', 'en-US': '1,200 lumens, IP67 water-resistant, mount compatible with long guns.', 'en-GB': '1,200 lumens, IP67 water-resistant, mount compatible with long guns.' },

  btn_agregar: { 'es-419': 'Agregar', 'es-ES': 'Añadir', 'en-US': 'Add', 'en-GB': 'Add' },

  footer_rights:  { 'es-419': '© 2026 Suministros Institucionales S.A.S. · NIT 900.XXX.XXX-1', 'es-ES': '© 2026 Suministros Institucionales S.A.S. · NIF 900.XXX.XXX-1', 'en-US': '© 2026 Suministros Institucionales S.A.S. · Tax ID 900.XXX.XXX-1', 'en-GB': '© 2026 Suministros Institucionales S.A.S. · Tax ID 900.XXX.XXX-1' },
  footer_privacy: { 'es-419': 'Tratamiento de datos conforme a la Ley 1581 de 2012', 'es-ES': 'Tratamiento de datos conforme a la Ley 1581 de 2012 (Colombia)', 'en-US': 'Data handling in accordance with Colombian Law 1581 of 2012', 'en-GB': 'Data handling in accordance with Colombian Law 1581 of 2012' },
  footer_policy_link: { 'es-419': 'Ver política', 'es-ES': 'Ver política', 'en-US': 'View policy', 'en-GB': 'View policy' },

  cart_title: { 'es-419': 'Tu carrito', 'es-ES': 'Tu cesta', 'en-US': 'Your cart', 'en-GB': 'Your basket' },
  cart_restricted_notice_pre: {
    'es-419': 'Tu carrito incluye equipo táctico restringido. Para completar este pedido necesitarás registrar el número de consulta de antecedentes judiciales en el ',
    'es-ES':  'Tu cesta incluye equipo táctico restringido. Para completar este pedido necesitarás registrar el número de consulta de antecedentes penales en el ',
    'en-US':  'Your cart includes restricted tactical equipment. To complete this order you\u2019ll need to provide the background-check reference number in the ',
    'en-GB':  'Your basket includes restricted tactical equipment. To complete this order you\u2019ll need to provide the background-check reference number in the ',
  },
  cart_restricted_notice_link: { 'es-419': 'formulario de registro', 'es-ES': 'formulario de registro', 'en-US': 'registration form', 'en-GB': 'registration form' },
  cart_total_label: { 'es-419': 'Total', 'es-ES': 'Total', 'en-US': 'Total', 'en-GB': 'Total' },
  cart_continue_btn: { 'es-419': 'Continuar con el registro', 'es-ES': 'Continuar con el registro', 'en-US': 'Continue to registration', 'en-GB': 'Continue to registration' },
  cart_empty: { 'es-419': 'Tu carrito está vacío.', 'es-ES': 'Tu cesta está vacía.', 'en-US': 'Your cart is empty.', 'en-GB': 'Your basket is empty.' },
  cart_restricted_badge: { 'es-419': 'Equipo restringido', 'es-ES': 'Equipo restringido', 'en-US': 'Restricted equipment', 'en-GB': 'Restricted equipment' },
  cart_remove: { 'es-419': 'Quitar', 'es-ES': 'Quitar', 'en-US': 'Remove', 'en-GB': 'Remove' },

  chat_title: { 'es-419': 'Atención al cliente', 'es-ES': 'Atención al cliente', 'en-US': 'Customer support', 'en-GB': 'Customer support' },
  chat_greeting: {
    'es-419': 'Hola, soy el asistente virtual de Suministros Institucionales. ¿En qué puedo ayudarte?',
    'es-ES':  'Hola, soy el asistente virtual de Suministros Institucionales. ¿En qué puedo ayudarte?',
    'en-US':  'Hi, I\u2019m the virtual assistant for Suministros Institucionales. How can I help you? (Note: automatic replies are currently in Spanish only.)',
    'en-GB':  'Hello, I\u2019m the virtual assistant for Suministros Institucionales. How can I help you? (Note: automatic replies are currently in Spanish only.)',
  },
  chat_quick1: { 'es-419': 'Tiempos de entrega', 'es-ES': 'Plazos de entrega', 'en-US': 'Delivery times', 'en-GB': 'Delivery times' },
  chat_quick2: { 'es-419': 'Métodos de pago', 'es-ES': 'Métodos de pago', 'en-US': 'Payment methods', 'en-GB': 'Payment methods' },
  chat_quick3: { 'es-419': 'Protección de datos', 'es-ES': 'Protección de datos', 'en-US': 'Data protection', 'en-GB': 'Data protection' },
  chat_placeholder: { 'es-419': 'Escribe tu mensaje...', 'es-ES': 'Escribe tu mensaje...', 'en-US': 'Type your message...', 'en-GB': 'Type your message...' },
  chat_send: { 'es-419': 'Enviar', 'es-ES': 'Enviar', 'en-US': 'Send', 'en-GB': 'Send' },

  admin_dashboard_header: { 'es-419': 'Panel administrativo · Acceso restringido', 'es-ES': 'Panel administrativo · Acceso restringido', 'en-US': 'Administrative panel · Restricted access', 'en-GB': 'Administrative panel · Restricted access' },
  admin_dashboard_title: { 'es-419': 'Dashboard general', 'es-ES': 'Dashboard general', 'en-US': 'General dashboard', 'en-GB': 'General dashboard' },
  admin_dashboard_lead: { 'es-419': 'Resumen operativo de clientes, catálogo, inventario y pedidos.', 'es-ES': 'Resumen operativo de clientes, catálogo, inventario y pedidos.', 'en-US': 'Operational summary of customers, catalogue, inventory, and orders.', 'en-GB': 'Operational summary of customers, catalogue, inventory, and orders.' },
  admin_dashboard_api_label: { 'es-419': 'API del backend:', 'es-ES': 'API del backend:', 'en-US': 'Backend API:', 'en-GB': 'Backend API:' },
  admin_dashboard_stock_threshold: { 'es-419': 'Umbral inventario bajo:', 'es-ES': 'Umbral inventario bajo:', 'en-US': 'Low inventory threshold:', 'en-GB': 'Low inventory threshold:' },
  admin_dashboard_refresh: { 'es-419': 'Actualizar', 'es-ES': 'Actualizar', 'en-US': 'Refresh', 'en-GB': 'Refresh' },
  admin_dashboard_metric_clients: { 'es-419': 'Clientes registrados', 'es-ES': 'Clientes registrados', 'en-US': 'Registered customers', 'en-GB': 'Registered customers' },
  admin_dashboard_metric_products: { 'es-419': 'Productos activos', 'es-ES': 'Productos activos', 'en-US': 'Active products', 'en-GB': 'Active products' },
  admin_dashboard_metric_low_stock: { 'es-419': 'Inventario bajo', 'es-ES': 'Inventario bajo', 'en-US': 'Low inventory', 'en-GB': 'Low inventory' },
  admin_dashboard_metric_orders: { 'es-419': 'Pedidos totales', 'es-ES': 'Pedidos totales', 'en-US': 'Total orders', 'en-GB': 'Total orders' },
  admin_dashboard_orders_by_day: { 'es-419': 'Pedidos por día', 'es-ES': 'Pedidos por día', 'en-US': 'Orders by day', 'en-GB': 'Orders by day' },
  admin_dashboard_products_by_category: { 'es-419': 'Productos por categoría', 'es-ES': 'Productos por categoría', 'en-US': 'Products by category', 'en-GB': 'Products by category' },
  admin_dashboard_low_stock_title: { 'es-419': 'Productos con inventario bajo', 'es-ES': 'Productos con inventario bajo', 'en-US': 'Products with low inventory', 'en-GB': 'Products with low inventory' },
  admin_dashboard_product: { 'es-419': 'Producto', 'es-ES': 'Producto', 'en-US': 'Product', 'en-GB': 'Product' },
  admin_dashboard_category: { 'es-419': 'Categoría', 'es-ES': 'Categoría', 'en-US': 'Category', 'en-GB': 'Category' },
  admin_dashboard_available_quantity: { 'es-419': 'Cantidad disponible', 'es-ES': 'Cantidad disponible', 'en-US': 'Available quantity', 'en-GB': 'Available quantity' },
  admin_dashboard_latest_orders: { 'es-419': 'Últimos pedidos registrados', 'es-ES': 'Últimos pedidos registrados', 'en-US': 'Latest registered orders', 'en-GB': 'Latest registered orders' },
  admin_dashboard_order_id: { 'es-419': 'ID Pedido', 'es-ES': 'ID Pedido', 'en-US': 'Order ID', 'en-GB': 'Order ID' },
  admin_dashboard_unit: { 'es-419': 'Unidad', 'es-ES': 'Unidad', 'en-US': 'Unit', 'en-GB': 'Unit' },
  admin_dashboard_date: { 'es-419': 'Fecha', 'es-ES': 'Fecha', 'en-US': 'Date', 'en-GB': 'Date' },
  admin_dashboard_total: { 'es-419': 'Total', 'es-ES': 'Total', 'en-US': 'Total', 'en-GB': 'Total' },
  admin_dashboard_status: { 'es-419': 'Estado', 'es-ES': 'Estado', 'en-US': 'Status', 'en-GB': 'Status' },
  admin_dashboard_footer_copyright: { 'es-419': '© 2026 Suministros Institucionales S.A.S.', 'es-ES': '© 2026 Suministros Institucionales S.A.S.', 'en-US': '© 2026 Suministros Institucionales S.A.S.', 'en-GB': '© 2026 Suministros Institucionales S.A.S.' },
  admin_dashboard_footer_internal: { 'es-419': 'Vista de uso interno — no exponer públicamente sin autenticación', 'es-ES': 'Vista de uso interno — no exponer públicamente sin autenticación', 'en-US': 'Internal-use view — do not expose publicly without authentication', 'en-GB': 'Internal-use view — do not expose publicly without authentication' },
  admin_clients_page_title: { 'es-419': 'Clientes registrados — Panel administrativo', 'es-ES': 'Clientes registrados — Panel administrativo', 'en-US': 'Registered customers — Administrative panel', 'en-GB': 'Registered customers — Administrative panel' },
  admin_clients_id: { 'es-419': 'ID', 'es-ES': 'ID', 'en-US': 'ID', 'en-GB': 'ID' },
  admin_clients_unit: { 'es-419': 'Unidad', 'es-ES': 'Unidad', 'en-US': 'Unit', 'en-GB': 'Unit' },
  admin_clients_nit: { 'es-419': 'NIT', 'es-ES': 'NIT', 'en-US': 'Tax ID', 'en-GB': 'Tax ID' },
  admin_clients_responsible: { 'es-419': 'Funcionario', 'es-ES': 'Funcionario', 'en-US': 'Official', 'en-GB': 'Official' },
  admin_clients_email: { 'es-419': 'Correo', 'es-ES': 'Correo', 'en-US': 'Email', 'en-GB': 'Email' },
  admin_clients_phone: { 'es-419': 'Teléfono', 'es-ES': 'Teléfono', 'en-US': 'Phone', 'en-GB': 'Phone' },
  admin_clients_registered: { 'es-419': 'Registrado', 'es-ES': 'Registrado', 'en-US': 'Registered', 'en-GB': 'Registered' },
  admin_clients_actions: { 'es-419': 'Acciones', 'es-ES': 'Acciones', 'en-US': 'Actions', 'en-GB': 'Actions' },
  admin_clients_not_found: { 'es-419': 'No se encontró el cliente en la lista cargada. Vuelve a cargar clientes e inténtalo de nuevo.', 'es-ES': 'No se encontró el cliente en la lista cargada. Vuelve a cargar clientes e inténtalo de nuevo.', 'en-US': 'The customer was not found in the loaded list. Reload customers and try again.', 'en-GB': 'The customer was not found in the loaded list. Reload customers and try again.' },
  admin_clients_delete_confirm: { 'es-419': '¿Eliminar "{nombre}"? Esta acción no se puede deshacer.', 'es-ES': '¿Eliminar "{nombre}"? Esta acción no se puede deshacer.', 'en-US': 'Delete "{nombre}"? This action cannot be undone.', 'en-GB': 'Delete "{nombre}"? This action cannot be undone.' },
  cart_empty_alert: { 'es-419': 'Tu carrito está vacío. Agrega productos antes de confirmar.', 'es-ES': 'Tu cesta está vacía. Añade productos antes de confirmar.', 'en-US': 'Your cart is empty. Add products before confirming.', 'en-GB': 'Your basket is empty. Add products before confirming.' },
  cart_order_confirmed: { 'es-419': '✅ Pedido confirmado\nID: {id}\nTotal: {total}', 'es-ES': '✅ Pedido confirmado\nID: {id}\nTotal: {total}', 'en-US': '✅ Order confirmed\nID: {id}\nTotal: {total}', 'en-GB': '✅ Order confirmed\nID: {id}\nTotal: {total}' },
  cart_order_error: { 'es-419': '❌ Error al confirmar compra: {error}', 'es-ES': '❌ Error al confirmar compra: {error}', 'en-US': '❌ Error confirming purchase: {error}', 'en-GB': '❌ Error confirming purchase: {error}' },
  orders_page_title: { 'es-419': 'Historial de compras — Suministros Institucionales', 'es-ES': 'Historial de compras — Suministros Institucionales', 'en-US': 'Purchase history — Institutional Supplies', 'en-GB': 'Purchase history — Institutional Supplies' },
  orders_history_nav: { 'es-419': 'Historial', 'es-ES': 'Historial', 'en-US': 'History', 'en-GB': 'History' },
  orders_client_panel: { 'es-419': 'Panel del cliente', 'es-ES': 'Panel del cliente', 'en-US': 'Customer panel', 'en-GB': 'Customer panel' },
  orders_heading: { 'es-419': 'Historial de compras', 'es-ES': 'Historial de compras', 'en-US': 'Purchase history', 'en-GB': 'Purchase history' },
  orders_lead: { 'es-419': 'Consulta tus pedidos anteriores, con detalle de productos, total y estado.', 'es-ES': 'Consulta tus pedidos anteriores, con detalle de productos, total y estado.', 'en-US': 'View your previous orders, including product details, totals, and status.', 'en-GB': 'View your previous orders, including product details, totals, and status.' },
  orders_id: { 'es-419': 'ID', 'es-ES': 'ID', 'en-US': 'ID', 'en-GB': 'ID' },
  orders_date: { 'es-419': 'Fecha', 'es-ES': 'Fecha', 'en-US': 'Date', 'en-GB': 'Date' },
  orders_products: { 'es-419': 'Productos', 'es-ES': 'Productos', 'en-US': 'Products', 'en-GB': 'Products' },
  orders_total: { 'es-419': 'Total', 'es-ES': 'Total', 'en-US': 'Total', 'en-GB': 'Total' },
  orders_status: { 'es-419': 'Estado', 'es-ES': 'Estado', 'en-US': 'Status', 'en-GB': 'Status' },
  orders_no_data: { 'es-419': 'Sin pedidos todavía.', 'es-ES': 'Sin pedidos todavía.', 'en-US': 'No orders yet.', 'en-GB': 'No orders yet.' },
  orders_empty: { 'es-419': 'No hay pedidos registrados.', 'es-ES': 'No hay pedidos registrados.', 'en-US': 'No registered orders.', 'en-GB': 'No registered orders.' },
  orders_connection_error: { 'es-419': 'Error de conexión.', 'es-ES': 'Error de conexión.', 'en-US': 'Connection error.', 'en-GB': 'Connection error.' },
  orders_loading: { 'es-419': 'Cargando...', 'es-ES': 'Cargando...', 'en-US': 'Loading...', 'en-GB': 'Loading...' },
  orders_empty: { 'es-419': 'No tienes pedidos registrados.', 'es-ES': 'No tienes pedidos registrados.', 'en-US': 'You have no registered orders.', 'en-GB': 'You have no registered orders.' },
  orders_error: { 'es-419': 'Error cargando pedidos:', 'es-ES': 'Error cargando pedidos:', 'en-US': 'Error loading orders:', 'en-GB': 'Error loading orders:' },
  orders_footer_copyright: { 'es-419': '© 2026 Suministros Institucionales S.A.S.', 'es-ES': '© 2026 Suministros Institucionales S.A.S.', 'en-US': '© 2026 Suministros Institucionales S.A.S.', 'en-GB': '© 2026 Suministros Institucionales S.A.S.' },
  orders_footer_label: { 'es-419': 'Vista de cliente — historial de compras', 'es-ES': 'Vista de cliente — historial de compras', 'en-US': 'Customer view — purchase history', 'en-GB': 'Customer view — purchase history' },
  admin_orders_page_title: { 'es-419': 'Pedidos — Panel administrativo', 'es-ES': 'Pedidos — Panel administrativo', 'en-US': 'Orders — Administrative panel', 'en-GB': 'Orders — Administrative panel' },
  admin_orders_nav: { 'es-419': 'Pedidos', 'es-ES': 'Pedidos', 'en-US': 'Orders', 'en-GB': 'Orders' },
  admin_orders_header: { 'es-419': 'Panel administrativo · Acceso restringido', 'es-ES': 'Panel administrativo · Acceso restringido', 'en-US': 'Administrative panel · Restricted access', 'en-GB': 'Administrative panel · Restricted access' },
  admin_orders_title: { 'es-419': 'Pedidos registrados', 'es-ES': 'Pedidos registrados', 'en-US': 'Registered orders', 'en-GB': 'Registered orders' },
  admin_orders_lead: { 'es-419': 'Consulta todos los pedidos de clientes y actualiza su estado.', 'es-ES': 'Consulta todos los pedidos de clientes y actualiza su estado.', 'en-US': 'View all customer orders and update their status.', 'en-GB': 'View all customer orders and update their status.' },
  admin_orders_api_label: { 'es-419': 'API del backend:', 'es-ES': 'API del backend:', 'en-US': 'Backend API:', 'en-GB': 'Backend API:' },
  admin_orders_load: { 'es-419': 'Cargar pedidos', 'es-ES': 'Cargar pedidos', 'en-US': 'Load orders', 'en-GB': 'Load orders' },
  admin_orders_id: { 'es-419': 'ID', 'es-ES': 'ID', 'en-US': 'ID', 'en-GB': 'ID' },
  admin_orders_date: { 'es-419': 'Fecha', 'es-ES': 'Fecha', 'en-US': 'Date', 'en-GB': 'Date' },
  admin_orders_products: { 'es-419': 'Productos', 'es-ES': 'Productos', 'en-US': 'Products', 'en-GB': 'Products' },
  admin_orders_total: { 'es-419': 'Total', 'es-ES': 'Total', 'en-US': 'Total', 'en-GB': 'Total' },
  admin_orders_status: { 'es-419': 'Estado', 'es-ES': 'Estado', 'en-US': 'Status', 'en-GB': 'Status' },
  admin_orders_customer: { 'es-419': 'Cliente', 'es-ES': 'Cliente', 'en-US': 'Customer', 'en-GB': 'Customer' },
  admin_orders_no_data: { 'es-419': 'Sin pedidos todavía.', 'es-ES': 'Sin pedidos todavía.', 'en-US': 'No orders yet.', 'en-GB': 'No orders yet.' },
  admin_orders_empty: { 'es-419': 'No hay pedidos registrados.', 'es-ES': 'No hay pedidos registrados.', 'en-US': 'No registered orders.', 'en-GB': 'No registered orders.' },
  admin_orders_connection_error: { 'es-419': 'Error de conexión.', 'es-ES': 'Error de conexión.', 'en-US': 'Connection error.', 'en-GB': 'Connection error.' },
  admin_orders_footer_copyright: { 'es-419': '© 2026 Suministros Institucionales S.A.S.', 'es-ES': '© 2026 Suministros Institucionales S.A.S.', 'en-US': '© 2026 Suministros Institucionales S.A.S.', 'en-GB': '© 2026 Suministros Institucionales S.A.S.' },
  admin_orders_footer_internal: { 'es-419': 'Vista de uso interno — no exponer públicamente sin autenticación', 'es-ES': 'Vista de uso interno — no exponer públicamente sin autenticación', 'en-US': 'Internal-use view — do not expose publicly without authentication', 'en-GB': 'Internal-use view — do not expose publicly without authentication' },
  admin_orders_pending: { 'es-419': 'Pendiente', 'es-ES': 'Pendiente', 'en-US': 'Pending', 'en-GB': 'Pending' },
  admin_orders_sent: { 'es-419': 'Enviado', 'es-ES': 'Enviado', 'en-US': 'Shipped', 'en-GB': 'Shipped' },
  admin_orders_delivered: { 'es-419': 'Entregado', 'es-ES': 'Entregado', 'en-US': 'Delivered', 'en-GB': 'Delivered' },
  admin_orders_cancelled: { 'es-419': 'Cancelado', 'es-ES': 'Cancelado', 'en-US': 'Cancelled', 'en-GB': 'Cancelled' },

  // ---------- Nav adicional / reportes del cliente ----------
  nav_mis_reportes: { 'es-419': 'Mis reportes', 'es-ES': 'Mis informes', 'en-US': 'My reports', 'en-GB': 'My reports' },
  orders_actions: { 'es-419': 'Acciones', 'es-ES': 'Acciones', 'en-US': 'Actions', 'en-GB': 'Actions' },
  orders_cancel_btn: { 'es-419': 'Cancelar', 'es-ES': 'Cancelar', 'en-US': 'Cancel', 'en-GB': 'Cancel' },

  mis_reportes_page_title: { 'es-419': 'Mis reportes — Suministros Institucionales', 'es-ES': 'Mis informes — Suministros Institucionales', 'en-US': 'My reports — Institutional Supplies', 'en-GB': 'My reports — Institutional Supplies' },
  mis_reportes_heading: { 'es-419': 'Mis reportes y sugerencias', 'es-ES': 'Mis informes y sugerencias', 'en-US': 'My reports and suggestions', 'en-GB': 'My reports and suggestions' },
  mis_reportes_lead: { 'es-419': 'Registra observaciones sobre el servicio o los productos. Puedes editar o eliminar tus propios reportes en cualquier momento.', 'es-ES': 'Registra observaciones sobre el servicio o los productos. Puedes editar o eliminar tus propios informes en cualquier momento.', 'en-US': 'Log observations about the service or products. You can edit or delete your own reports at any time.', 'en-GB': 'Log observations about the service or products. You can edit or delete your own reports at any time.' },
  mis_reportes_new_btn: { 'es-419': '+ Nuevo reporte', 'es-ES': '+ Nuevo informe', 'en-US': '+ New report', 'en-GB': '+ New report' },
  mis_reportes_new_title: { 'es-419': 'Nuevo reporte', 'es-ES': 'Nuevo informe', 'en-US': 'New report', 'en-GB': 'New report' },
  mis_reportes_date: { 'es-419': 'Fecha', 'es-ES': 'Fecha', 'en-US': 'Date', 'en-GB': 'Date' },
  mis_reportes_comment: { 'es-419': 'Comentario', 'es-ES': 'Comentario', 'en-US': 'Comment', 'en-GB': 'Comment' },
  mis_reportes_rating: { 'es-419': 'Calificación', 'es-ES': 'Calificación', 'en-US': 'Rating', 'en-GB': 'Rating' },
  mis_reportes_empty: { 'es-419': 'Aún no tienes reportes registrados.', 'es-ES': 'Aún no tienes informes registrados.', 'en-US': 'You do not have any reports yet.', 'en-GB': 'You do not have any reports yet.' },
  mis_reportes_cancel_btn: { 'es-419': 'Cancelar', 'es-ES': 'Cancelar', 'en-US': 'Cancel', 'en-GB': 'Cancel' },
  mis_reportes_save_btn: { 'es-419': 'Guardar', 'es-ES': 'Guardar', 'en-US': 'Save', 'en-GB': 'Save' },
  mis_reportes_footer_label: { 'es-419': 'Vista de cliente — reportes y sugerencias', 'es-ES': 'Vista de cliente — informes y sugerencias', 'en-US': 'Customer view — reports and suggestions', 'en-GB': 'Customer view — reports and suggestions' },

  detail_page_title: { 'es-419': 'Detalle de producto — Suministros Institucionales', 'es-ES': 'Detalle de producto — Suministros Institucionales', 'en-US': 'Product detail — Institutional Supplies', 'en-GB': 'Product detail — Institutional Supplies' },
  detail_restricted_badge: { 'es-419': 'Equipo restringido', 'es-ES': 'Equipo restringido', 'en-US': 'Restricted equipment', 'en-GB': 'Restricted equipment' },
  detail_availability: { 'es-419': 'Disponibilidad', 'es-ES': 'Disponibilidad', 'en-US': 'Availability', 'en-GB': 'Availability' },
  detail_shipping: { 'es-419': 'Despacho', 'es-ES': 'Envío', 'en-US': 'Shipping', 'en-GB': 'Shipping' },
  detail_restricted_notice: { 'es-419': 'Este producto requiere validación especial: tu cuenta debe tener registrada la autorización/verificación de antecedentes para poder comprarlo.', 'es-ES': 'Este producto requiere validación especial: tu cuenta debe tener registrada la autorización/verificación de antecedentes para poder comprarlo.', 'en-US': 'This product requires special validation: your account must have the background-check authorization on file to purchase it.', 'en-GB': 'This product requires special validation: your account must have the background-check authorisation on file to purchase it.' },
  detail_quantity: { 'es-419': 'Cantidad:', 'es-ES': 'Cantidad:', 'en-US': 'Quantity:', 'en-GB': 'Quantity:' },
  detail_add_to_cart: { 'es-419': 'Agregar al carrito', 'es-ES': 'Añadir a la cesta', 'en-US': 'Add to cart', 'en-GB': 'Add to basket' },
  detail_out_of_stock: { 'es-419': 'Agotado', 'es-ES': 'Agotado', 'en-US': 'Out of stock', 'en-GB': 'Out of stock' },
  products_shipping_note: { 'es-419': 'A la instalación registrada en 3–5 días hábiles', 'es-ES': 'A la instalación registrada en 3–5 días hábiles', 'en-US': 'To the registered facility within 3–5 business days', 'en-GB': 'To the registered facility within 3–5 working days' },
};

const IDIOMA_KEY = 'si_idioma';

function claveTextoAutomatico(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return 'auto_' + Math.abs(hash).toString(36);
}

function registrarTextoAutomatico(elemento) {
  const texto = elemento.textContent.trim();
  if (!texto || elemento.hasAttribute('data-i18n')) return;

  const clave = claveTextoAutomatico(texto);
  if (!T[clave]) {
    T[clave] = {
      'es-419': texto,
      'es-ES': texto,
      'en-US': texto,
      'en-GB': texto,
    };
  }
  elemento.setAttribute('data-i18n', clave);
}

function etiquetarTextosSinClave(raiz = document) {
  raiz.querySelectorAll('title, h1, h2, h3, h4, h5, h6, p, label, th, td, button, a, span, option, div').forEach(elemento => {
    if (elemento.closest('script, style, template, [aria-hidden="true"]')) return;
    if (elemento.children.length > 0) return;
    registrarTextoAutomatico(elemento);
  });
}

function idiomaGuardado() {
  return localStorage.getItem(IDIOMA_KEY) || 'es-419';
}

function textoI18n(clave, fallback) {
  const lang = idiomaGuardado();
  return T[clave]?.[lang] ?? fallback;
}

function aplicarIdioma(lang) {
  if (!IDIOMAS[lang]) lang = 'es-419';
  localStorage.setItem(IDIOMA_KEY, lang);
  document.documentElement.lang = lang.split('-')[0];

  etiquetarTextosSinClave();

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const clave = el.getAttribute('data-i18n');
    if (T[clave] && T[clave][lang] !== undefined) {
      el.textContent = T[clave][lang];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const clave = el.getAttribute('data-i18n-placeholder');
    if (T[clave] && T[clave][lang] !== undefined) {
      el.setAttribute('placeholder', T[clave][lang]);
    }
  });

  const selEtiqueta = document.getElementById('idioma-actual');
  if (selEtiqueta) selEtiqueta.textContent = IDIOMAS[lang].bandera + ' ' + lang.toUpperCase();
}

function construirSelectorIdioma() {
  const contenedores = document.querySelectorAll('.selector-idioma');
  contenedores.forEach(cont => {
    const opciones = Object.keys(IDIOMAS).map(code => `
      <li><a class="dropdown-item" href="#" onclick="aplicarIdioma('${code}'); return false;">${IDIOMAS[code].bandera} ${IDIOMAS[code].label}</a></li>
    `).join('');
    cont.innerHTML = `
      <button class="btn btn-sm dropdown-toggle" style="border:1px solid var(--brass-600); color:var(--brass-500); background:transparent;" type="button" data-bs-toggle="dropdown">
        <span id="idioma-actual">🌐</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">${opciones}</ul>
    `;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  construirSelectorIdioma();
  aplicarIdioma(idiomaGuardado());

  const observadorTextos = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(nodo => {
        if (nodo.nodeType === Node.ELEMENT_NODE) {
          etiquetarTextosSinClave(nodo);
          aplicarIdioma(idiomaGuardado());
        }
      });
    });
  });
  observadorTextos.observe(document.body, { childList: true, subtree: true });
});
