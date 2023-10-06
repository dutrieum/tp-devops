const formValidator = require('./form_validator');
const photoModel = require('./photo_model');

const {PubSub} = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
// let lastTagsUploaded = '';

async function getImages(tags, tagmode, res, zip = false) {
  const ejsLocalVariables = {
    tagsParameter: tags || '',
    tagmodeParameter: tagmode || '',
    photos: [],
    searchResults: false,
    invalidParameters: false
  };

  // if no input params are passed in then render the view with out querying the api
  if (!tags && !tagmode) {
    return res.render('index', ejsLocalVariables);
  }

  // validate query parameters
  if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
    ejsLocalVariables.invalidParameters = true;
    return res.render('index', ejsLocalVariables);
  }


  // get photos from flickr public feed api
  if (zip === true) {
    await quickstart(tags, tagmode);
    res.status(200).send("zip in progress");
  } else {
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
        return res.status(500).send({ error });
      });
  }
}

async function quickstart(tags, tagmode) {
  const projectId = 'temporaryprojectdmii'; // Your Google Cloud Platform project ID
  const topicNameOrId = 'dmii2-9'; // Name for the new topic to create
  // Instantiates a client
  const pubsub = new PubSub({projectId});

  const dataBuffer = Buffer.from(JSON.stringify([tags, tagmode]));

  // Creates a new topic
  await pubsub.topic(topicNameOrId)
    .publishMessage({data: dataBuffer});
}

function route(app) {
  app.get('/', async (req, res) => {
    const tags = req.query.tags;
    const tagmode = req.query.tagmode;
    await getImages(tags, tagmode, res);

    // if (lastTagsUploaded !== tags) {
    //   const options = {
    //     action: 'read',
    //     expires: moment().add(2, 'days').unix() * 1000
    //   };

    //   let storage = new Storage();
    //   const signedUrls = await storage
    //     .bucket(process.env.BUCKET)
    //     .file('public/users/' + 'test-9.zip')
    //     .getSignedUrl(options);

    //   console.log('signedUrls', signedUrls);
    // }
  });

  app.post('/zip', async(req, res) => {
    const tags = req.body.tags;
    const tagmode = req.body.tagmode;
    await getImages(tags, tagmode, res, true);
    // lastTagsUploaded = tags;
  });
}

module.exports = route;
