const startWalkingCleanup = service => {
  const run=()=>service.cleanup().catch(e=>console.error('Walking cleanup failed',{code:e.code}));
  const task=require('node-cron').schedule('0 0 * * *',run,{timezone:'Asia/Kolkata',noOverlap:true});
  void run();
  return task;
};
module.exports={startWalkingCleanup};
