const express = require('express');
const createWalkingRouter = ({ service, authenticate }) => {
  const router=express.Router();
  router.use(authenticate);
  router.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });
  const handle=fn=>async(req,res,next)=>{
    try { res.json({success:true,data:await fn(req)}); }
    catch(e) { if(e.status) return res.status(e.status).json({success:false,message:e.message}); next(e); }
  };
  // Every route is /me; no patron/group/owner ID is accepted from clients.
  router.get('/me',handle(r=>service.overview(r.user)));
  router.put('/me/goals',handle(r=>service.goals(r.user,r.body)));
  router.post('/me/walks',handle(r=>service.create(r.user,r.body)));
  router.get('/me/days/:date',handle(r=>service.history(r.user,r.params.date,r.query.before)));
  router.delete('/me/walks/:id',handle(r=>service.remove(r.user,r.params.id)));
  return router;
};
module.exports={createWalkingRouter};
