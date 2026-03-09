const { z } = require('zod');

const ticketIdParamSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
});

const listSupportTicketsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  ticketType: z.enum(['bug', 'feature_request', 'feedback', 'support', 'data_issue']).optional(),
});

const createSupportTicketSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  ticketType: z.enum(['bug', 'feature_request', 'feedback', 'support', 'data_issue']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(5000),
});

const updateSupportTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(5000).optional(),
});

module.exports = {
  ticketIdParamSchema,
  listSupportTicketsQuerySchema,
  createSupportTicketSchema,
  updateSupportTicketSchema,
};