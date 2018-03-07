'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _events = require('events');

var _request = require('request');

var _jsonStream = require('json-stream');

var _jsonStream2 = _interopRequireDefault(_jsonStream);

var _lodash = require('lodash.flatmap');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.findkey');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.pick');

var _lodash6 = _interopRequireDefault(_lodash5);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// default emitted events
var defaultEvents = ['added', 'modified', 'deleted'];

// allowed query parameters to be passed as option
var queryParameters = ['labelSelector', 'fieldSelector', 'resourceVersion', 'timeoutSeconds'];

// supported resources by API version
var apiResources = {
  v1: ['nodes', 'namespaces', 'endpoints', 'events', 'limitranges', 'persistentvolumeclaims', 'persistentvolumes', 'pods', 'podtemplates', 'replicationcontrollers', 'resourcequotas', 'secrets', 'serviceaccounts', 'services', 'configmaps'],
  v1beta1: ['horizontalpodautoscalers', 'ingresses', 'jobs'],
  'apps/v1beta1': ['deployments']
};

var notNamespaced = ['namespaces', 'persistentvolumes', 'nodes'];

var _class = function (_EventEmitter) {
  _inherits(_class, _EventEmitter);

  function _class() {
    var res = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, _class);

    // check for k8s URL
    var _this = _possibleConstructorReturn(this, (_class.__proto__ || Object.getPrototypeOf(_class)).call(this));
    // be an EventEmitter


    if (!options.url) {
      throw new Error('Missing Kubernetes API URL.');
    }

    // force plural form
    var resource = res.toLowerCase();
    if (resource.charAt(resource.length - 1) !== 's') {
      resource += 's';
    }

    // check if resource is supported
    var resources = (0, _lodash2.default)(apiResources);
    if (!resources.includes(resource)) {
      throw new Error('Unknown resource. Available resources: ' + resources.join(', '));
    }

    // get api version
    var version = (0, _lodash4.default)(apiResources, function (res) {
      return res.includes(resource);
    });

    // options
    var namespace = options.namespace;
    var name = options.name;
    var events = options.events || defaultEvents;

    var baseUrl = options.url + '/api/' + version;

    if (version === 'apps/v1beta1') {
      baseUrl = options.url + '/apis/' + version;
    }

    // default HTTP resource
    // eg: http://api-server/api/v1/pods
    _this.url = baseUrl + '/' + resource;

    // update url if resource is namespaced
    if (namespace) {
      _this.url = baseUrl + '/namespaces/' + namespace + '/' + resource;
    }

    // update url if resource is filtered by his name
    if (name) {
      // resource is not namespaced
      if (notNamespaced.includes(resource)) {
        _this.url = baseUrl + '/watch/' + resource + '/' + name;
      } else {
        _this.url = baseUrl + '/watch/namespaces/' + namespace + '/' + resource + '/' + name;
      }
    }

    // we will get a stream of json data..
    var stream = new _jsonStream2.default();
    stream.on('data', function (event) {
      if (event && event.type) {
        // emit event if we have to
        var type = event.type.toLowerCase();
        if (events.includes(type)) {
          _this.emit(type, event.object);
        }
      } else {
        // something not expected, emit event as an error
        _this.emit('error', event);
      }
    });

    // request options
    var watchRequest = _extends({
      uri: _this.url,
      qs: _extends({
        watch: true }, (0, _lodash6.default)(options, queryParameters))
    }, options.request);

    // `resourceVersion` is specified, perform request now
    if (typeof options.resourceVersion !== 'undefined') {
      var _ret;

      (0, _request.get)(watchRequest).pipe(stream);
      return _ret = _this, _possibleConstructorReturn(_this, _ret);
    }

    // fetch last `resourceVersion` to only get last events
    var versionRequest = _extends({
      uri: _this.url,
      json: true,
      qs: _extends({}, (0, _lodash6.default)(options, queryParameters))
    }, options.request);

    (0, _request.get)(versionRequest, function (err, rs) {
      if (err) {
        throw err;
      }
      if (!rs.body || !rs.body.metadata || !rs.body.metadata.resourceVersion) {
        throw new Error('Could not get `resourceVersion`.\n' + 'Please set it manually or retry.');
      }

      // watch start at `resourceVersion`
      watchRequest.qs.resourceVersion = rs.body.metadata.resourceVersion;
      // perform request, pipe to json stream
      (0, _request.get)(watchRequest).pipe(stream);
    });
    return _this;
  }

  return _class;
}(_events.EventEmitter);

exports.default = _class;
