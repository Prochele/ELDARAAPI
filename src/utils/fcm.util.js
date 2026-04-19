const admin = require('firebase-admin');

//const serviceAccount = require('../config/firebase.json');
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendFCM = async (tokens, payload) => {
  if (!tokens || tokens.length === 0) return;
  //console.log('DATA:', payload);
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      title: 'Medicine Reminder',
      body: 'Time to take your medicine',
      type: 'MEDICINE_REMINDER',
      payload: JSON.stringify(payload)
    },
    android: {
      priority: 'high'
    }
  });
  //console.log('FCM Response:', response);
};

module.exports = { sendFCM };