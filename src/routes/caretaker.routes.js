const express = require('express');
const router = express.Router();

const caretakerController = require('../controllers/caretaker.controller');
const sessionMiddleware = require('../middlewares/session.middleware');

const patronAdmin=(req,res,next)=>req.user.RoleCode==='PTA'?next():res.status(403).json({success:false,message:'Patron Admin account required'});
router.get('/registered', sessionMiddleware, patronAdmin, caretakerController.getRegisteredCaretakers);
router.get('/assigned', sessionMiddleware, patronAdmin, caretakerController.getAssignedCaretakers);
const upgrade=(req,res)=>res.status(409).json({success:false,message:'Update ELDARA to use confirmed assignments and dated reviews.'});
router.post('/assign', sessionMiddleware, upgrade);
router.post('/rate', sessionMiddleware, upgrade);

module.exports = router;
