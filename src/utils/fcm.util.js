const admin = require('firebase-admin');

let firebaseInitialized = false;
let firebaseProjectId = null;

try {
  const serviceAccount = process.env.FIREBASE_CONFIG
    ? JSON.parse(process.env.FIREBASE_CONFIG)
    : require('../config/firebase.json');
  firebaseProjectId = serviceAccount.project_id;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firebaseInitialized = true;
  console.log('Firebase Admin initialized for project:', firebaseProjectId);
} catch (error) {
  console.warn('Firebase config not available. FCM notifications are disabled.', {
    code: error.code || 'firebase/config-invalid',
  });
}

const sendFCM = async (tokens, payload) => {
  if (!firebaseInitialized) {
    console.warn('FCM skipped because Firebase Admin is not initialized.');
    return;
  }
  if (!tokens || tokens.length === 0) {
    console.log('FCM skipped because no push tokens were found.');
    return;
  }
  //console.log('DATA:', payload);
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Medicine Reminder',
      body: 'Time to take your medicine',
    },
    data: {
      title: 'Medicine Reminder',
      body: 'Time to take your medicine',
      type: 'MEDICINE_REMINDER',
      payload: JSON.stringify(payload)
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'medicine-reminders',
        sound: 'default',
      },
    }
  });
  console.log('FCM send result:', {
    projectId: firebaseProjectId,
    successCount: response.successCount,
    failureCount: response.failureCount,
  });

  response.responses.forEach((result, index) => {
    if (!result.success) {
      console.warn('FCM token send failed:', {
        tokenIndex: index,
        code: result.error?.code,
      });
    }
  });
};

const sendScheduleFCM = async (device, reminder) => {
  if (!firebaseInitialized) {
    const error = new Error('Firebase is not initialized');
    error.code = 'firebase/not-initialized';
    throw error;
  }
  const { buildScheduleMessage } = require('./schedulePush.util');
  return admin.messaging().send(buildScheduleMessage(device, reminder));
};

const sendCareFCM=async(device,notice)=>{
  if(!firebaseInitialized)throw Object.assign(new Error('Firebase unavailable'),{code:'firebase/not-initialized'});
  const data={type:'CARE_WORKFLOW',recipientId:String(notice.RecipientID),target:notice.Target,
    referenceId:String(notice.ReferenceID),noticeId:String(notice.ID),title:'ELDARA',body:'You have a new update in ELDARA.'};
  const message={token:device.PushToken,data,android:{priority:'high',ttl:86400000}};
  if(device.Platform==='IOS'){
    message.notification={title:data.title,body:data.body};
    message.apns={headers:{'apns-push-type':'alert','apns-priority':'10','apns-collapse-id':`eldara-care-${notice.ID}`,'apns-expiration':String(Math.floor(Date.now()/1000)+86400)},payload:{aps:{sound:'default','thread-id':'eldara-care'}}};
  }
  return admin.messaging().send(message);
};
module.exports = { sendFCM, sendScheduleFCM, sendCareFCM };
