// We are repurposing Minimongo tests to test reactive server-side MongoDB
// collections. So we have to do some preparations here.

LocalCollection = function (name, options) {
  // We want always to use MongoDB, not local collections.
  name = name || Random.id();
  // To make Mongo.Collection generate ObjectIDs by default.
  options = options || {};
  options.idGeneration = 'MONGO';
  return new Mongo.Collection(name, options);
};

// Currently server and client side behaves differently when counting with skip. So we make it
// behave the same for tests. See https://github.com/meteor/meteor/issues/1201
var SynchronousCursor = Object.getPrototypeOf(MongoInternals.defaultRemoteCollectionDriver().mongo._createSynchronousCursor({'collectionName': 'foobar', 'options': {}})).constructor;
SynchronousCursor.prototype.count = function () {
  return this._synchronousCount({'applySkipLimit': true}).wait();
};

var originalFind = Mongo.Collection.prototype.find;
Mongo.Collection.prototype.find = function (selector, options) {
  // Few tests are expecting an exception for unsupported operators.
  if (options && options.fields && (options.fields.grades || options.fields['grades.$'])) {
    throw new Error("Unsupported in Minimongo");
  }
  if (selector && selector.location && selector.location['$not']) {
    throw new Error("Unsupported in Minimongo");
  }
  if (selector && selector['$and'] && selector['$and'][0].location) {
    throw new Error("Unsupported in Minimongo");
  }
  if (selector && selector['$or'] && selector['$or'][0].location) {
    throw new Error("Unsupported in Minimongo");
  }
  if (selector && selector['$nor'] && selector['$nor'][0].location) {
    throw new Error("Unsupported in Minimongo");
  }
  if (selector && selector['$and'] && selector['$and'][0]['$and'] && selector['$and'][0]['$and'][0].location) {
    throw new Error("Unsupported in Minimongo");
  }

  // Geo queries need indexes.
  if (selector && selector['rest.loc']) {
    this._ensureIndex({'rest.loc': '2d'});
  }
  if (selector && selector['location']) {
    this._ensureIndex({'location': '2dsphere'});
  }
  if (selector && selector['a.b']) {
    this._ensureIndex({'a.b': '2d'});
  }

  return originalFind.apply(this, arguments);
};

var originalUpdate = Mongo.Collection.prototype.update;
Mongo.Collection.prototype.update = function (selector, mod, options, callback) {
  if (selector && selector['a.b'] && selector['a.b'].$near) {
    this._ensureIndex({'a.b': '2d'});
  }

  return originalUpdate.apply(this, arguments);
};

var IGNORED_TESTS = [
  // Tests which do not test any reactive behavior, just Minimongo specifics,
  // and use code which does not exist on the server.
  'minimongo - misc',
  'minimongo - projection_compiler',
  'minimongo - fetch with projection, deep copy',
  'minimongo - ordering',
  'minimongo - binary search',
  'minimongo - saveOriginals',
  'minimongo - saveOriginals errors',
  'minimongo - pause',
  'minimongo - ids matched by selector',

  // Fail because of difference between Minimongo and server.
  // See https://github.com/meteor/meteor/issues/3527
  'minimongo - basics',
  // See https://github.com/meteor/meteor/issues/5165
  // See https://github.com/meteor/meteor/issues/5166
  // See https://github.com/meteor/meteor/issues/5167
  'minimongo - modify',
  // See https://github.com/meteor/meteor/issues/3597
  'minimongo - observe ordered',
  'minimongo - observe ordered: true',
  'minimongo - observe ordered: false',
  'minimongo - observe ordered with projection',
  // See https://github.com/meteor/meteor/issues/3599
  'minimongo - $near operator tests'
];

var originalTinytestAdd = Tinytest.add;
Tinytest.add = function (name, func) {
  if (_.contains(IGNORED_TESTS, name)) return;
  return originalTinytestAdd.call(Tinytest, name, func);
};