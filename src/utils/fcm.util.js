const admin = require('firebase-admin');

let firebaseInitialized = false;

try {
  const serviceAccount = process.env.FIREBASE_CONFIG
    ? JSON.parse(process.env.FIREBASE_CONFIG)
    : require('../config/firebase.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firebaseInitialized = true;
} catch (error) {
  console.warn('Firebase config not available. FCM notifications are disabled.');
}

const sendFCM = async (tokens, payload) => {
  if (!firebaseInitialized) return;
  if (!tokens || tokens.length === 0) return;
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
  //console.log('FCM Response:', response);
};

module.exports = { sendFCM };
