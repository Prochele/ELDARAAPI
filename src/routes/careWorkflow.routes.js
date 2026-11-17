const express = require('express');
const auth = require('../middlewares/session.middleware');
const { createCareWorkflow } = require('../services/careWorkflow.service');
const service = createCareWorkflow(require('../config/db'));
const router = express.Router();
router.use(auth);
router.use((req, res, next) => {
  if (!['PTA', 'CT'].includes(req.user.RoleCode))
    return res
      .status(403)
      .json({ success: false, message: 'Patron Admin or Caretaker account required' });
  next();
});
const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, message: e.message });
    next(e);
  }
};
router.get(
  '/search',
  handle((r) => service.search(r.user, r.query))
);
router.get(
  '/availability',
  handle((r) => service.getAvailability(r.user))
);
router.put(
  '/availability',
  handle((r) => service.saveAvailability(r.user, r.body))
);
router.get(
  '/contacts',
  handle((r) => service.contacts(r.user))
);
router.post(
  '/contacts',
  handle((r) => service.requestContact(r.user, r.body))
);
router.put(
  '/contacts/:id/respond',
  handle((r) => service.respondContact(r.user, r.params.id, r.body))
);
router.get(
  '/contacts/:id/messages',
  handle((r) => service.messages(r.user, r.params.id, r.query))
);
router.post(
  '/contacts/:id/messages',
  handle((r) => service.sendMessage(r.user, r.params.id, r.body))
);
router.put(
  '/contacts/:id/read',
  handle((r) => service.markRead(r.user, r.params.id, r.body))
);
router.put(
  '/contacts/:id/block',
  handle((r) => service.blockContact(r.user, r.params.id, r.body))
);
router.post(
  '/contacts/:id/report',
  handle((r) => service.reportContact(r.user, r.params.id, r.body))
);
router.get(
  '/assignments',
  handle((r) => service.assignments(r.user))
);
router.post(
  '/assignments',
  handle((r) => service.propose(r.user, r.body))
);
router.put(
  '/assignments/:id/respond',
  handle((r) => service.respondAssignment(r.user, r.params.id, r.body))
);
router.put(
  '/assignments/:id/end',
  handle((r) => service.endAssignment(r.user, r.params.id))
);
router.get(
  '/reviews/:caretakerId',
  handle((r) => service.reviews(r.user, r.params.caretakerId))
);
router.put(
  '/reviews/:id',
  handle((r) => service.review(r.user, r.params.id, r.body))
);
router.put(
  '/reviews/:id/reply',
  handle((r) => service.reply(r.user, r.params.id, r.body))
);
module.exports = router;
