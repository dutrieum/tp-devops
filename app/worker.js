const {PubSub} = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const request = require('request');
const ZipStream = require('zip-stream');
const photoModel = require('./photo_model');
const { getDatabase } = require("firebase-admin/database");

const pubSubClient = new PubSub();

function listenForMessages(subscriptionNameOrId = 'dmii2-9', timeout = 60) {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionNameOrId);

  // Create an event handler to handle messages
  const messageHandler = async message => {
    console.log(`Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);

    const tags = JSON.parse(message.data)[0];
    const tagmode = JSON.parse(message.data)[1];

    let storage = new Storage();
    const stream = await getStorageStream(storage, tags);

    let zip = new ZipStream();
    zip.pipe(stream);

    new Promise ((resolve, reject) => {
      stream.on('error', (err) => {
        reject(err);
      });
  
      stream.on('finish', () => {
        resolve('Ok');
      });
    });

    let queue = [];

    await photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        photos.forEach((photo, index) => {
          if (index < 10) {
            queue.push({ url: photo.media.m, name: photo.title });
          }
        });
      })
      .catch(error => {
        console.log('error in get flickr photos', error);
      });

    addNextFile(queue, zip);

    const database = getDatabase();
    const ref = database.ref('mathilde/' + new Date().getTime() + '/' + tags);
    ref.set({
      [`tag-${tags}`]: {
        tags: tags,
        tagmode: tagmode,
      },
    });

    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);
}

listenForMessages();

async function getStorageStream(storage, tags) {
  const file = await storage.bucket(process.env.BUCKET).file('mathilde/' + tags + '.zip');
  const stream = file.createWriteStream({
    metadata: {
      contentType: 'application/zip',
      cacheControl: 'private'
    },
    resumable: false
  });

  return stream
}

function addNextFile(queue, zip) {
  var elem = queue.shift()
  var stream = request(elem.url)
  console.log('stream', elem.name);

  zip.entry(stream, { name: elem.name ? elem.name : 'default' }, err => {
      if(err)
          throw err;
      if(queue.length > 0)
          addNextFile(queue, zip)
      else
          zip.finalize()
  })
}