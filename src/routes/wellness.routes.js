const express = require('express');
const createWellnessRouter = ({ service, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const handle = fn => async (req, res, next) => {
    try { res.json({ success: true, data: await fn(req) }); }
    catch (e) {
      if (e.status) return res.status(e.status).json({ success: false, message: e.message });
      next(e);
    }
  };
  router.get('/patrons', handle(r => service.patrons(r.user)));
  router.get('/patrons/:patronId', handle(r => service.overview(r.user, r.params.patronId)));
  router.post('/patrons/:patronId/check-ins', handle(r => service.create(r.user, r.params.patronId, r.body)));
  router.patch('/patrons/:patronId/check-ins/:id', handle(r => service.update(r.user, r.params.patronId, r.params.id, r.body)));
  router.delete('/patrons/:patronId/check-ins/:id', handle(r => service.remove(r.user, r.params.patronId, r.params.id, r.body)));
  router.get('/patrons/:patronId/requests', handle(r => service.requests(r.user, r.params.patronId, r.query.before)));
  router.post('/patrons/:patronId/requests', handle(r => service.createRequest(r.user, r.params.patronId, r.body)));
  router.patch('/patrons/:patronId/requests/:id', handle(r => service.updateRequest(r.user, r.params.patronId, r.params.id, r.body)));
  return router;
};
module.exports = { createWellnessRouter };
