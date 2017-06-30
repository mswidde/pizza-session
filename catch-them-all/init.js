var express = require('express');
var request = require('request');
var fs = require('fs');
var async = require('async');

var app = express();
app.set('view engine', 'pug');
app.use('/static',express.static('static'));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var nodeName = process.env.HOSTNAME
var nameSpace = process.env.OPENSHIFT_BUILD_NAMESPACE
//var oseMaster = 'https://ose-master-api.linux.rabobank.nl:8443'
var oseMaster = process.env.OSE_MASTER
var oseAPIURL = oseMaster + '/api/v1/namespaces/' + nameSpace
var accessToken = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'); 
var pokemonService = process.env.POKEMON_SERVICE

app.get('/', function(req, res) {
  request({
    url: oseAPIURL + '/pods/',
    auth: {
      'bearer': accessToken
    }
  }, function(err, result){
    if(err){
      res.send('API call error: ' + err);
      console.log(err);
    } else {
      var jsonResult = JSON.parse(result.body);
      var pods = [];
      var app = "";
      if ( jsonResult.status === 'Failure' ){
        res.send('API failure: ' + jsonResult.message);
      } else {
        jsonResult.items.forEach(function(pod){
          if ( pod.status.phase === 'Running' ){
            pods.push(pod);
          };
          if ( pod.metadata.name === nodeName ){
            app = pod.metadata.labels.app;
          };
        });
        pods.forEach(function(pod){
          if ( pod.metadata.labels.app != app ) {
            pods.pop(pod);
          }
        });
        res.render('index',
          { title: 'Catch them all', nameSpace: nameSpace, node: nodeName, pods: pods, app: app, pokemonService: pokemonService });
      };
    };
  });
});

// healthz check to determin that the node app has started ans is running correctly
app.get('/healthz', function(req, res) {
  // Check if depended services are available
  var no_proxy_req = request.defaults({'proxy': ''});
  var urls = [
    'http://' + nodeName + ':8080/',
    pokemonService,
  ];

  var urlError = false;
  async.forEach(urls,function(url, callback){
    no_proxy_req.get(url, function(err, response, body){
      if ( !err && response.statusCode !== 200 ) {
        urlError = true;
      };
      callback();
    });
  },function(err){
  });

  // Check if environment variables are filled
  var env_vars = [ 
    process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    process.env.OPENSHIFT_BUILD_NAMESPACE,
    process.env.OSE_MASTER,
    process.env.POKEMON_SERVICE,
  ];
  envError = false;
  async.forEach(env_vars,function(env_var, callback){
    if(!env_var){
      envError = true;
    };
  },function(err){
  });

  // Check if picture exists
  var fsError = false;
  try {
    fs.accessSync('./static/ash.png');
  } catch(err) {
    console.log(err);
    fsError = true;
  };

  // On error return status 500 else return 200
  if ( urlError === true || envError === true || fsError ) {
    console.log('return 500');
    res.sendStatus(500);
  } else {
    res.sendStatus(200);
  };
});

app.listen(8080, function() {
  console.log('Demo app listening on port 8080!');
});
