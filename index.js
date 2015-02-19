var os = require('os')
  , fs = require('fs')
  , socketio = require('socket.io')
  , request = require('request')
  , twilio = require('twilio')
  , Hapi = require('hapi')
  , Joi = require('joi')
  , Boom = require('boom')
  , uuid = require('node-uuid')
  , level = require('level')
  , Caman = require('caman').Caman
  , io;

// valid filters - http://camanjs.com/docs/presets.html
var filters = [
  "vintage",
  "lomo",
  "clarity",
  "sinCity",
  "sunrise",
  "crossProcess",
  "orangePeel",
  "love",
  "grungy",
  "jarques",
  "pinhole",  
  "oldBoot",
  "glowingSun",
  "hazyDays",
  "herMajesty",
  "nostalgia",
  "hemingway",
  "concentrate"
];

// handle to the DB (will establish lock)
var db = level('./mydb', {valueEncoding: "json"});

// client to Twilio REST API
var client = new twilio.RestClient();

// Create a server with a host and port
var server = new Hapi.Server(process.env.PORT || 3000);


/**
 * Send an MMS with the filtered photo attached
 */
var sendPhoto = function(url_base, photo, from, to) {
  // an assumption made here is that the protocol is HTTP
  var photoUrl = url_base + '/' + photo;
  // update website in realtime
  io.emit('new_media', photoUrl);
  // send user the filtered photo via Twilio MMS
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
var applyFilter = function(mediaUrl, filter, from, to, url_base) {
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
      //this.resize({width: 600});
      this[filter]();
      this.render(function () {
        // save to the file system
        this.save(filteredPath);
        console.log('Saved: ', filtered);
        // save some metadata to our db
        db.put(id, {filter: filter, number: from, file: filtered});
        // delete the temp file
        fs.unlink(original, function(err) {});
        sendPhoto(url_base, filtered, from, to);
      });
    });    
  });
};

/**
 * Handle requests for /message
 */
var handleMessage = function(req, reply) {

  var header = req.headers['x-twilio-signature'];
  var token = process.env.TWILIO_AUTH_TOKEN;
  var url_base = 'http://'+req.info.host;
  if (!twilio.validateRequest(token, header, url_base+'/message', req.payload)) {
    reply(Boom.forbidden('Invalid x-twilio-signature'));
    return;
  }

  var from = req.payload.From;
  var to = req.payload.To;
  var mediaUrl = req.payload.MediaUrl0;
  var mediaContentType = req.payload.MediaContentType0;
  var filter = req.payload.Body.toLowerCase().trim();
  var twiml = new twilio.TwimlResponse();

  console.log('Processing MMS: ', mediaUrl, mediaContentType, filter);

  // see if a valid filter was passed
  var filterValid = false;
  for (i in filters) {
    if (filter === filters[i].toLowerCase()) {
      filterValid = true;
      filter = filters[i];
      break;
    }
  }
 
  // check to see that the user has submitted an image
  if (mediaUrl && mediaContentType && mediaContentType.indexOf('image') >= 0) {
    // check to see that a valid filter command was passed
    if (filterValid) {
      // send immediate reply
      twiml.message('Thanks for the awesome photo! Applying filter now..');
      reply(twiml.toString()).type('text/xml');
      
      applyFilter(mediaUrl, filter, from, to, url_base);
    }
    else {
      // else respond with a list of valid filters
      twiml.message('Hmmm, I do not recognize the filter "'+ filter + '".\n\n' +  
        'Valid filters are: ' + filters.join(', '));
      reply(twiml.toString()).type('text/xml');
    }

  }
  else {
    // send instructions for app
    twiml.message('Thanks for trying Phonestagram, the photo filtering ' +
      'and sharing app that works on any phone! Just text a photo to this ' +
      'number and specify the filter you would like.\n\nValid filters are: ' +
      filters.join(', '));
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
      payload: twilioRequestSchema,
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
  // bind socket.io handlers to this server/port
  io = socketio.listen(server.listener);

  io.on('connection', function(socket){
    io.to(socket.id).emit('connected', 'Connected!');
  });

  console.log("Listening on port", process.env.PORT || 3000);
});



