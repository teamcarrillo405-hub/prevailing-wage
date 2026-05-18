import { Router } from 'express';
import { z } from 'zod';
import { sendSupportForward } from '../services/emailService.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
  subject: z.string().max(200).optional(),
});

router.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
  }
  // Log the contact request and forward to support inbox (non-blocking)
  console.log('[contact]', parsed.data.email, parsed.data.subject ?? '(no subject)');
  sendSupportForward(parsed.data.email, parsed.data.name, parsed.data.subject ?? '', parsed.data.message).catch(() => {});
  return res.json({ success: true });
});

export default router;
