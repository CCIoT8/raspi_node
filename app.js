const express = require('express');
const axios = require('axios')
const app = express();
const port = 3000;

const mqtt = require("mqtt");  // require mqtt
const client = mqtt.connect("mqtt://localhost");  // create a client

const http = require('http').Server(app);
const fs = require('fs');
const io = require('socket.io')(http);

const hostname = 'http://192.168.20.159:3000'

// Serve static files (like HTML, CSS, JS)
app.use(express.static('public'));

// Basic route to serve the homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// MQTT subscription
client.on('connect', () => {
  const topics = [
    'home/security/inputs/esp32-1/motion',
    'home/security/inputs/esp32-1/magnetic',
    'home/security/inputs/esp32-1/vibration',
    'home/security/inputs/esp32-2/buzzer',
    'home/security/inputs/esp32-2/led',
    'home/security/inputs/esp32-2/camera'
  ];

  client.subscribe(topics, (err) => {
    if (!err) {
      console.log('Subscribed to topics:', topics.join(', '));
    }
  });
});

// When RPi receives a message, print to console, then forward it to
// the output device if it is in alarm mode.
// Send a post request to the server as well.
client.on('message', (topic, message) => {
  const msg = message.toString();  
  console.log('Received message on topic ${topic}: ${msg}')

  const endpoint = '/api/batch-update';
  const link = hostname + endpoint;

  const image1 = fs.readFileSync('img3.jpg', {encoding: 'base64'})

  // Prepare the payload
  const payload = {
    sensors: [{
      sensorType:"a",
      value:"a",
      timestamp: new Date().toISOString()
    }],
    images: [{
      image: image1,
      timestamp: new Date().toISOString()
    }]
    
  };

  // Send a POST request
  axios.post(link, payload)
    .then(response => {
      console.log(`POST request sent to ${hostname} with response:`, response.data);
    })
    .catch(error => {
      console.error(`Failed to send POST request to ${hostname}:`, error);
    });

  // if (topic === 'home/security/inputs/esp32-1/motion') {
  //   console.log(msg);
  // }
  // if (topic === 'home/security/inputs/esp32-1/magnetic') {
  //   console.log(msg);
  // }
  // if (topic === 'home/security/inputs/esp32-1/vibration') {
  //   console.log(msg);
  // }

  stopAlarm();

});

function sendPicture(filePath) {
  const form = FormData();
  form.append('file', fs.createReadStream(filePath));

  const hostname = 'http://192.168.20.159:3000/'


  axios.post(hostname, form, {
    headers: form.getHeaders()
  })
  .then(response => {
    console.log(`Picture sent to ${hostname} with response:`, response.data);
  })
  .catch(error => {
    console.error(`Failed to send picture to ${hostname}:`, error);
  });
}

function sendAlarm() {
  publishMessage('home/security/outputs/esp32-2/buzzer', "{\"state\":\"on\"}");
  publishMessage('home/security/outputs/esp32-2/led', "{\"state\":\"on\"}");
  publishMessage('home/security/outputs/esp32-3/camera', "{\"command\":\"capture\"}");
}

function stopAlarm() {
  publishMessage('home/security/outputs/esp32-2/buzzer', "{\"state\":\"off\"}");
  publishMessage('home/security/outputs/esp32-2/led', "{\"state\":\"off\"}");
}

// Function to publish a message to a specified topic
function publishMessage(topic, message) {
  client.publish(topic, message, (err) => {
    if (err) {
      console.error(`Failed to publish message to ${topic}:`, err);
    } else {
      console.log(`Message published to ${topic}: ${message}`);
    }
  });
}

// Start the server
http.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
