const db = require('../../db');

async function listByClinicId(clinicId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      service_name::text AS service_name,
      sort_order,
      is_active,
      created_at,
      updated_at
    FROM clinic_services
    WHERE clinic_id = $1
    ORDER BY sort_order ASC, id ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

async function findById(serviceId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      service_name::text AS service_name,
      sort_order,
      is_active,
      created_at,
      updated_at
    FROM clinic_services
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [serviceId], client);
  return result.rows[0] || null;
}

async function createService(input, client = null) {
  const query = `
    INSERT INTO clinic_services (
      clinic_id,
      service_name,
      sort_order,
      is_active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      clinic_id,
      service_name::text AS service_name,
      sort_order,
      is_active,
      created_at,
      updated_at
  `;

  const result = await db.query(
    query,
    [input.clinicId, input.serviceName, input.sortOrder, input.isActive],
    client
  );

  return result.rows[0];
}

async function updateService(serviceId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    serviceName: 'service_name',
    sortOrder: 'sort_order',
    isActive: 'is_active',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findById(serviceId, client);
  }

  values.push(serviceId);

  const query = `
    UPDATE clinic_services
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      service_name::text AS service_name,
      sort_order,
      is_active,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

module.exports = {
  listByClinicId,
  findById,
  createService,
  updateService,
};