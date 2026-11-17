const express = require('express');
const router = express.Router();

const dailyActivityController = require('../controllers/dailyActivity.controller');

const authenticateSession = require('../middlewares/session.middleware');
const {guard}=require('../middlewares/careAccess.middleware');
const activityTarget=async(r,pool)=>{
  const [rows]=await pool.query('SELECT UserId FROM DailyActivity WHERE DailyActivityId=?',[r.body.dailyActivityId]);
  return rows[0]?.UserId;
};
//const { authenticateSession } = require('../middlewares/session.middleware');


router.post(
  '/add',
  authenticateSession,
  guard(r=>r.body.patronId),
  dailyActivityController.addDailyActivity
);

router.get(
  '/list',
  authenticateSession,
  (req,res,next)=>{
    if(req.user.RoleCode==='CT'&&!req.query.patronId)return res.status(400).json({success:false,message:'Select an assigned patron'});
    return req.query.patronId||req.user.RoleCode==='PT' ? guard(r=>r.query.patronId||r.user.UserID)(req,res,next) : next();
  },
  dailyActivityController.getDailyActivities
);

router.post(
  '/delete',
  authenticateSession,
  guard(activityTarget),
  dailyActivityController.deleteDailyActivity
);

module.exports = router;
