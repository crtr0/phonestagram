var os = require('os')
  , fs = require('fs')
  , socketio = require('socket.io')
  , request = require('request')
  , twilio = require('twilio')
  , Hapi = require('hapi')
  , Joi = require('joi')
  , uuid = require('node-uuid')
  , levelup = require('level')
  , Caman = require('caman').Caman
  , io;

// valid filters - http://camanjs.com/docs/presets.html
var filters = {
  "vintage": "vintage",
  "lomo": "lomo",
  "clarity": "clarity",
  "sincity": "sinCity",
  "sunrise": "sunrise",
  "crossprocess": "crossProcess",
  "orangepeel": "orangePeel",
  "love": "love",
  "grungy": "grungy",
  "jarques": "jarques",
  "pinhole": "pinhole",
  "oldboot": "oldBoot",
  "glowingsun": "glowingSun",
  "hazydays": "hazyDays",
  "hermajesty": "herMajesty",
  "nostalgia": "nostalgia",
  "hemingway": "hemingway",
  "concentrate": "concentrate"
};

var db = levelup('./mydb', {valueEncoding: "json"});

var client = new twilio.RestClient();

// Create a server with a host and port
var server = new Hapi.Server(process.env.PORT || 3000);

/**
 * Send an MMS with an animated GIF attached
 */
var sendPhoto = function(host, photo, from, to) {
  // an assumption made here is that the protocol is HTTP
  var photoUrl = 'http://' + host + '/' + photo;
  client.sendMessage({
    to: from, from: to,
    body: 'Powered by Twilio MMS',
    mediaUrl: photoUrl}, function(err, responseData) {
      if (err) {
        console.log('Error sending MMS: ', JSON.stringify(err));
      }
    });
};

/**
 * Filter and return photo
 */
var filterAndReply = function(mediaUrl, filter, from, to, host) {
  // create a unique UUID for all of our video/gif processing
  var id = uuid.v1();

  var original = os.tmpdir() + "/" + id;
  var filtered = id + ".png";
  var filteredPath = "./static/" + filtered;

  // Save the remote image file to the /tmp fs
  download = request(mediaUrl).pipe(fs.createWriteStream(original));

  download.on('finish', function() {
    // initialize CamanJS
    Caman(original, function () {
      // apply the filter
      this.resize({width: 600});
      this[filter]();
      this.render(function () {
        // save to the file system
        this.save(filteredPath);
        console.log('Saved: ', filtered);
        // save some metadata to our db
        db.put(id, {filter: filter, number: from, file: filtered});
        // delete the temp file
        fs.unlink(original, function(err) {});
        sendPhoto(host, filtered, from, to);
      });
    });
  });
};

/**
 * Handle requests for /message
 */
var handleMessage = function(req, reply) {
  var from = req.payload.From;
  var to = req.payload.To;
  var host = req.info.host;
  var mediaUrl = req.payload.MediaUrl0;
  var mediaContentType = req.payload.MediaContentType0;
  var filter = req.payload.Body.toLowerCase().trim();
  var twiml = new twilio.TwimlResponse();

  console.log('Processing MMS: ', mediaUrl, mediaContentType, filter);

  // check to see that the user has submitted an image
  if (mediaUrl && mediaContentType && mediaContentType.indexOf('image') >= 0) {
    // check to see that a valid filter command was passed
    if (filter === null || (Object.keys(filters).indexOf(filter) >= 0)) {
      // send immediate reply
      twiml.message('Thanks for the awesome photo! Applying filter now..');
      reply(twiml.toString()).type('text/xml');

      filterAndReply(mediaUrl, filters[filter], from, to, host);
    }
    else {
      // else respond with a list of valid filters
      twiml.message('Hmmm, I do not recognize the filter "'+ filter + '".\n\n' +
        'Valid filters are: ' + Object.keys(filters).join(', '));
      reply(twiml.toString()).type('text/xml');
    }

  }
  else {
    // send instructions for app
    twiml.message('Thanks for trying Phonestagram, the photo filtering ' +
      'and sharing app that works on any phone! Just text a photo to this ' +
      'number and specify the filter you would like.\n\nValid filters are: ' +
      Object.keys(filters).join(', '));
    reply(twiml.toString()).type('text/xml');
  }
};

// Schema to validate incoming Twilio requests
var twilioRequestSchema = Joi.object().keys({
  NumMedia: Joi.number().integer().min(0),
}).unknown();

// Add the routes
server.route([{
  method: 'POST', path: '/message', handler: handleMessage, config: {
    validate: {
      payload: twilioRequestSchema
    }
  } }, {
  method: 'GET', path: '/{p*}',
    handler: {
      directory: { path: './static', listing: false, index: true }
    }
  }
]);

// Start the server
server.start(function () {
  io = socketio.listen(server.listener);

  io.on('connection', function(socket){
    io.to(socket.id).emit('connected', 'Connected!');
    streamImagesToNewUser(socket.id);
  });

  console.log("Listening on port", process.env.PORT || 3000);
});

