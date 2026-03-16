const express = require('express');
const router = express.Router();

const patronController = require('../controllers/patron.controller');
const sessionMiddleware = require('../middlewares/session.middleware');

router.post(
  '/create',
  sessionMiddleware,
  patronController.createPatron
);

router.get(
  '/list',
  sessionMiddleware,
  patronController.getPatronList
);

router.get(
  '/details/:patronId',
  sessionMiddleware,
  patronController.getPatronDetails);

router.post(
  '/delete',
  sessionMiddleware,
  patronController.deletePatron);

router.get(
  '/check-limit',
  sessionMiddleware,
  patronController.checkPatronLimit);

module.exports = router;