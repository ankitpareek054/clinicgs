const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const clinicServicesRepository = require('./clinic-services.repository');

function mapService(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    serviceName: row.service_name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertClinicAccess(clinicId, currentUser) {
  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(clinicId)
  ) {
    throw new ApiError(403, 'Forbidden clinic access.', { code: 'FORBIDDEN' });
  }
}

function assertCanManage(currentUser) {
  if (![ROLES.SUPER_ADMIN, ROLES.OWNER].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can manage clinic services.', {
      code: 'FORBIDDEN',
    });
  }
}

async function listByClinicId(clinicId, currentUser) {
  assertClinicAccess(clinicId, currentUser);

  const rows = await clinicServicesRepository.listByClinicId(clinicId);
  return rows.map(mapService);
}

async function createService(clinicId, input, currentUser) {
  assertClinicAccess(clinicId, currentUser);
  assertCanManage(currentUser);

  const created = await clinicServicesRepository.createService({
    clinicId,
    serviceName: input.serviceName,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });

  return mapService(created);
}

async function updateService(clinicId, serviceId, updates, currentUser) {
  assertClinicAccess(clinicId, currentUser);
  assertCanManage(currentUser);

  const existing = await clinicServicesRepository.findById(serviceId);

  if (!existing || Number(existing.clinic_id) !== Number(clinicId)) {
    throw new ApiError(404, 'Clinic service not found.', {
      code: 'CLINIC_SERVICE_NOT_FOUND',
    });
  }

  const updated = await clinicServicesRepository.updateService(serviceId, updates);

  return mapService(updated);
}

async function archiveService(clinicId, serviceId, currentUser) {
  return updateService(
    clinicId,
    serviceId,
    { isActive: false },
    currentUser
  );
}

module.exports = {
  listByClinicId,
  createService,
  updateService,
  archiveService,
};