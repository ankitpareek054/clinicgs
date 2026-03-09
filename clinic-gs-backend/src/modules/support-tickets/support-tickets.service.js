const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const supportTicketsRepository = require('./support-tickets.repository');

function mapTicket(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    createdByUserId: row.created_by_user_id,
    ticketType: row.ticket_type,
    status: row.status,
    priority: row.priority,
    title: row.title,
    description: row.description,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveClinicId(inputClinicId, currentUser) {
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    if (!inputClinicId) {
      throw new ApiError(400, 'clinicId is required for super admin.', {
        code: 'CLINIC_ID_REQUIRED',
      });
    }

    return Number(inputClinicId);
  }

  return Number(currentUser.clinicId);
}

function canViewTicket(currentUser, ticket) {
  if (currentUser.role === ROLES.SUPER_ADMIN) return true;

  if (currentUser.role === ROLES.OWNER) {
    return Number(currentUser.clinicId) === Number(ticket.clinic_id);
  }

  if (currentUser.role === ROLES.RECEPTIONIST) {
    return Number(currentUser.id) === Number(ticket.created_by_user_id);
  }

  return false;
}

async function listTickets(filters, currentUser) {
  const finalFilters = { ...filters };

  if (currentUser.role === ROLES.SUPER_ADMIN) {
    if (finalFilters.clinicId !== undefined) {
      finalFilters.clinicId = Number(finalFilters.clinicId);
    }
  } else if (currentUser.role === ROLES.OWNER) {
    finalFilters.clinicId = Number(currentUser.clinicId);
  } else {
    finalFilters.clinicId = Number(currentUser.clinicId);
    finalFilters.createdByUserId = Number(currentUser.id);
  }

  const rows = await supportTicketsRepository.listTickets(finalFilters);
  return rows.map(mapTicket);
}

async function getTicketById(ticketId, currentUser) {
  const row = await supportTicketsRepository.findTicketById(ticketId);

  if (!row) {
    throw new ApiError(404, 'Support ticket not found.', {
      code: 'SUPPORT_TICKET_NOT_FOUND',
    });
  }

  if (!canViewTicket(currentUser, row)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return mapTicket(row);
}

async function createTicket(input, currentUser) {
  if (![ROLES.OWNER, ROLES.RECEPTIONIST, ROLES.SUPER_ADMIN].includes(currentUser.role)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  const clinicId = resolveClinicId(input.clinicId, currentUser);

  const created = await supportTicketsRepository.createTicket({
    clinicId,
    createdByUserId: currentUser.id,
    ticketType: input.ticketType,
    priority: input.priority || 'medium',
    title: input.title,
    description: input.description,
  });

  return mapTicket(created);
}

async function updateTicket(ticketId, updates, currentUser) {
  const existing = await supportTicketsRepository.findTicketById(ticketId);

  if (!existing) {
    throw new ApiError(404, 'Support ticket not found.', {
      code: 'SUPPORT_TICKET_NOT_FOUND',
    });
  }

  if (currentUser.role === ROLES.SUPER_ADMIN) {
    const resolvedStatuses = ['resolved', 'closed'];
    const isResolved = updates.status && resolvedStatuses.includes(updates.status);

    const updated = await supportTicketsRepository.updateTicket(ticketId, {
      status: updates.status,
      priority: updates.priority,
      title: updates.title,
      description: updates.description,
      resolvedByUserId: isResolved ? currentUser.id : null,
      resolvedAt: isResolved ? new Date().toISOString() : null,
    });

    return mapTicket(updated);
  }

  if (currentUser.role === ROLES.OWNER) {
    if (Number(currentUser.clinicId) !== Number(existing.clinic_id)) {
      throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
    }

    if (updates.status) {
      throw new ApiError(403, 'Only super admin can update support ticket status.', {
        code: 'FORBIDDEN',
      });
    }

    const updated = await supportTicketsRepository.updateTicket(ticketId, {
      priority: updates.priority,
      title: updates.title,
      description: updates.description,
    });

    return mapTicket(updated);
  }

  if (currentUser.role === ROLES.RECEPTIONIST) {
    if (Number(currentUser.id) !== Number(existing.created_by_user_id)) {
      throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
    }

    if (updates.status) {
      throw new ApiError(403, 'Only super admin can update support ticket status.', {
        code: 'FORBIDDEN',
      });
    }

    const updated = await supportTicketsRepository.updateTicket(ticketId, {
      priority: updates.priority,
      title: updates.title,
      description: updates.description,
    });

    return mapTicket(updated);
  }

  throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
}

module.exports = {
  listTickets,
  getTicketById,
  createTicket,
  updateTicket,
};